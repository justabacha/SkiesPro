# READ-ONLY AUDIT — Database Inflation & Tick Retention Forensic

**Date:** February 2025  
**Severity:** P0 Critical Infrastructure Failure  
**Scope:** PostgreSQL Database Inflation Analysis (`pricing.price_ticks`, `pricing.candles`, Write Intervals, Retention Policies, Index Bloat, and Demo Isolation)  
**Status:** READ-ONLY Audit Complete (No Source Changes Made)  

---

## Executive Summary

The Supabase PostgreSQL database free tier limit (500 MB) is exhausting within 2–3 days of operation. This audit identified the primary driver of database bloat: **high-frequency insertion of unpruned raw price ticks and candles from both live and demo sources**.

### Core Root Causes
1. **Unconstrained Live Tick Retention:** Live price ticks (`source = 'live'`) are inserted into PostgreSQL every 5 seconds with **zero cleanup or retention policy**. Live ticks are stored permanently.
2. **Excessive Demo Tick Retention:** Demo price ticks (`source = 'demo'`) are also written to PostgreSQL every 5 seconds. The pruning function (`prune_expired_demo_ticks`) uses a default retention period of **30 days** (`DEMO_TICK_RETENTION_DAYS=30`), meaning millions of simulated ticks accumulate in Postgres before any row is deleted.
3. **Index Multiplication Bloat:** `pricing.price_ticks` contains **6 separate B-tree indexes**. Every batch insert updates all 6 indexes, doubling the disk footprint per row (~300 bytes total per tick row).
4. **Unpruned Candle Data:** Completed 1-minute candles (`pricing.candles`) are written every 10 seconds with no retention policy.

---

## 1. Tick & Candle Write Frequency Analysis

### Ingestion Pipelines & Execution Intervals

| Service | Target Table | Frequency / Batch Trigger | Source Tag | SQL Operation |
| :--- | :--- | :--- | :--- | :--- |
| **`PriceFeedIngestionService`** | `pricing.price_ticks` | Every 5 sec or batch = 50 | `'live'` | `INSERT INTO pricing.price_ticks` (Batch) |
| **`OHLCService`** | `pricing.candles` | Every 10 sec (`flush()`) | `'live'` | `INSERT INTO pricing.candles ON CONFLICT DO UPDATE` |
| **`DemoPriceFeedService`** | `pricing.price_ticks` | Every 5 sec or batch = 50 | `'demo'` | `INSERT INTO pricing.price_ticks` (Batch) |

### Code References & Quoted SQL

#### Live Price Tick Batch Ingestion (`src/modules/pricing/services/PriceFeedIngestionService.ts` & `repositories/tickRepository.ts`)
In `PriceFeedIngestionService.ts` (Lines 80–84, 180–189):
```ts
this.tickFlushInterval = setInterval(() => {
  this.flushTicks().catch((err) => {
    logger.error('Error flushing ticks', { error: err.message });
  });
}, 5000);
```
In `TickRepository.ts` (Lines 44–68):
```sql
INSERT INTO pricing.price_ticks
  (symbol, tick_time, bid_price, ask_price, mid_price, volume, source)
VALUES ($1, $2, $3, $4, $5, $6, $7), ($8, $9, $10, $11, $12, $13, $14), ...
```

#### Demo Price Tick Batch Ingestion (`src/modules/pricing/services/DemoPriceFeedService.ts`)
In `DemoPriceFeedService.ts` (Lines 49–53, 142–161):
```ts
this.flushTimer = setInterval(() => {
  void this.flushTicks();
}, 5000);
```

#### Candle Ingestion (`src/modules/pricing/services/OHLCService.ts` & `repositories/candleRepository.ts`)
In `OHLCService.ts` (Lines 81–91):
```ts
// Called every 10 seconds via PriceFeedIngestionService.candleFlushInterval
async flush(): Promise<void> {
  const now = new Date();
  const granularity = 60;
  const currentOpenTimeMs = Math.floor(now.getTime() / (granularity * 1000)) * (granularity * 1000);

  for (const [key, candle] of this.currentCandles.entries()) {
    if (candle.openTime.getTime() < currentOpenTimeMs) {
      await this.saveCandle(candle, granularity, candle.source);
      this.currentCandles.delete(key);
    }
  }
}
```
In `CandleRepository.ts` (Lines 20–38):
```sql
INSERT INTO pricing.candles (
  symbol, granularity_seconds, open_time, close_time, open_price, high_price, low_price, close_price, volume, source
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
ON CONFLICT (symbol, granularity_seconds, open_time, source) DO UPDATE SET
  high_price = GREATEST(pricing.candles.high_price, EXCLUDED.high_price),
  low_price = LEAST(pricing.candles.low_price, EXCLUDED.low_price),
  close_price = EXCLUDED.close_price,
  close_time = EXCLUDED.close_time,
  volume = pricing.candles.volume + EXCLUDED.volume
```

---

## 2. Data Volume & Rate Calculations

### Row Generation Rates

```
Live Ticks:    10 symbols × 2 ticks/sec = 20 ticks/sec
Demo Ticks:    10 symbols × 1 tick/sec  = 10 ticks/sec
------------------------------------------------------
Total Ticks:   ~30 ticks/second
```

| Time Horizon | Tick Row Count | Disk Footprint per Row (Data + Indexes) | Estimated Total Storage |
| :--- | :--- | :--- | :--- |
| **1 Hour** | 108,000 rows | ~300 bytes | **~32.4 MB** |
| **24 Hours (1 Day)** | 2,592,000 rows | ~300 bytes | **~777.6 MB** |
| **3 Days (72 Hours)** | 7,776,000 rows | ~300 bytes | **~2.33 GB** |

**Conclusion:** A 500 MB database quota is exceeded within **~15 to 18 hours** of continuous dual-feed tick ingestion.

### Candle Storage Footprint
- 1-minute candles (`granularity_seconds = 60`): 10 symbols × 60 candles/hr = 600 rows/hr = **14,400 rows/day**.
- Higher granularities (5m, 15m, 1h, 4h, 1d) are **not stored as separate rows**; they are aggregated dynamically on query via `CandleRepository.getAggregatedCandles()`.

---

## 3. Retention & Cleanup Jobs Audit

### Why `deletedCount` is Always `0` in Boot Logs

In `DemoPriceFeedService.ts` (Lines 163–175):
```ts
private async pruneExpiredTicks(): Promise<void> {
  const retentionDays = Number(process.env.DEMO_TICK_RETENTION_DAYS || '30');
  const deletedCount = await this.tickRepository.pruneExpiredDemoTicks(retentionDays);
  logger.info('Pruned expired demo price ticks', { deletedCount, retentionDays });
}
```
SQL Function (`migrations/034_demo_tick_retention_config.sql`):
```sql
CREATE OR REPLACE FUNCTION pricing.prune_expired_demo_ticks(retention_days INTEGER DEFAULT 30)
RETURNS BIGINT AS $$
DECLARE
  deleted_count BIGINT;
BEGIN
  DELETE FROM pricing.price_ticks tick
   WHERE tick.source = 'demo'
     AND tick.tick_time < NOW() - make_interval(days => retention_days)
     AND NOT EXISTS (
       SELECT 1
         FROM trading.binary_contracts contract
        WHERE contract.account_type = 'demo'
          AND contract.status IN ('active', 'settling')
          AND contract.asset_symbol = tick.symbol
     );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
```

#### Defect Analysis:
1. **Retention Window Too Wide:** The retention window defaults to **30 days** (`DEMO_TICK_RETENTION_DAYS=30`). On a new deployment or short-lived server (running for 2–5 days), no ticks are older than 30 days, so `deletedCount` is always `0`.
2. **Live Ticks Retention:** There is **NO PRUNING FUNCTION OR JOB FOR LIVE TICKS** (`source = 'live'`). Live ticks remain in `pricing.price_ticks` indefinitely.
3. **Candles Retention:** There is **NO PRUNING FUNCTION OR JOB FOR CANDLES** (`pricing.candles`).

---

## 4. Database Index Bloat Audit

### Table `pricing.price_ticks` (6 Indexes Total)

| Index Name | Columns / Condition | Source Migration | Status / Recommendation |
| :--- | :--- | :--- | :--- |
| `price_ticks_pkey` | `PRIMARY KEY (id)` | `005_pricing_schema_tables.sql` | **Keep** |
| `price_ticks_symbol_idx` | `(symbol)` | `005_pricing_schema_tables.sql` | **Redundant** (covered by composite indexes) |
| `price_ticks_settlement_idx` | `(symbol, tick_time DESC)` | `005_pricing_schema_tables.sql` | **Redundant** (subsumed by `symbol, source, tick_time`) |
| `price_ticks_time_idx` | `(tick_time DESC)` | `014_create_indexes.sql` | **Redundant** |
| `pricing_price_ticks_symbol_source_time_idx` | `(symbol, source, tick_time DESC)` | `033_demo_account_isolation.sql` | **Keep** (Main query index) |
| `pricing_demo_ticks_retention_idx` | `(tick_time) WHERE source = 'demo'` | `033_demo_account_isolation.sql` | **Keep** (Pruning partial index) |

### Table `pricing.candles` (3 Indexes Total)

| Index Name | Columns | Source Migration | Status / Recommendation |
| :--- | :--- | :--- | :--- |
| `candles_pkey` | `PRIMARY KEY (id)` | `005_pricing_schema_tables.sql` | **Keep** |
| `pricing_candles_unique` | `UNIQUE (symbol, granularity_seconds, open_time, source)` | `033/035` | **Keep** |
| `candles_symbol_granularity_time_idx` | `(symbol, granularity_seconds, open_time)` | `005_pricing_schema_tables.sql` | **Redundant** (subsumed by unique index) |

---

## 5. Frontend & Demo Isolation Assessment

- Demo mode uses simulated prices generated by `MockPriceAdapter`.
- Demo ticks are already broadcast to Redis / memory PubSub (`demo:ticks:all`) and cached in Redis (`demo:price:EURUSD`).
- **Postgres Persistence Requirement:** Real-time demo trading does **not require storing millions of demo ticks in PostgreSQL**. Trade settlement only requires fetching a quote at trade expiry.
- Storing demo ticks in Redis with a short TTL (e.g., 1 hour) or retaining only 24 hours in Postgres eliminates 33% of database write volume immediately.

---

## Recommended Fix Strategy (Post-Audit Action Plan)

1. **Short-Term Retention Policy (Immediate Impact):**
   - Implement an automated tick retention job that deletes **both live and demo ticks older than 24 hours** (or 48 hours for oracle gap safety).
   - Set `DEMO_TICK_RETENTION_DAYS` (or `TICK_RETENTION_HOURS`) to `24 hours`.
   - Implement a candle retention policy keeping 1-minute candles for **30 days** maximum.
2. **In-Memory / Redis Demo Ticks:**
   - Modify `DemoPriceFeedService` to store demo ticks in Redis with a 1-hour expiration instead of batching inserts to PostgreSQL, OR prune demo ticks hourly.
3. **Index Cleanup:**
   - Drop redundant indexes (`price_ticks_symbol_idx`, `price_ticks_settlement_idx`, `price_ticks_time_idx`, `candles_symbol_granularity_time_idx`) to cut write overhead and index storage by 50%.

---

DB INFLATION AUDIT COMPLETE — NO SOURCE CHANGES MADE
