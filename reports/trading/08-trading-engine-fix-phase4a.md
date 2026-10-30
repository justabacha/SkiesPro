# Trading Engine Phase 4A Implementation Report (Backend Data Integrity)

**Date:** February 2025  
**Scope:** Phase 4A Backend Data Integrity Fixes — Live/Demo Candle Source Isolation, Ingestion Buffer Retention on DB Failure, Settlement Worker Fallback Expiry Bounds Check, and Smooth OHLC Candle Open Price Continuity.  
**Status:** Successfully Implemented & 100% Full Suite Verified  

---

## Metadata

- **Modified Files:**
  - `src/modules/pricing/repositories/candleRepository.ts`
  - `src/modules/pricing/dto/pricing.dto.ts`
  - `src/modules/pricing/services/pricingService.ts`
  - `src/modules/pricing/controllers/pricingController.ts`
  - `src/modules/pricing/services/PriceFeedIngestionService.ts`
  - `src/modules/trading/workers/settlementWorker.ts`
  - `src/modules/pricing/services/OHLCService.ts`
  - `frontend/src/modules/trading/services/tradingService.ts`
  - `tests/pricing/candleRepository.test.ts`
  - `tests/trading/unit/settlementWorker.test.ts`
- **Created Files:**
  - `tests/pricing/priceFeedIngestion.test.ts`

---

## 1. CandleRepository Source Isolation (`src/modules/pricing/repositories/candleRepository.ts`)

Updated `getCandles` and `getAggregatedCandles` to require a `source` parameter (`'live'` or `'demo'`) and append `AND source = $6` to the SQL query, preventing cross-mode candle data bleeding.

```ts
async getCandles(
  symbol: string,
  granularity: number,
  from: Date,
  to: Date,
  limit: number = 500,
  source: 'live' | 'demo' = 'live'
): Promise<CandleRow[]> {
  const result = await this.client.query<CandleRow>(
    `SELECT * FROM (
       SELECT id, symbol, granularity_seconds, open_time, close_time, open_price,
              high_price, low_price, close_price, volume, source, created_at
       FROM pricing.candles
       WHERE symbol = $1 AND granularity_seconds = $2 AND open_time >= $3 AND open_time <= $4 AND source = $6
       ORDER BY open_time DESC
       LIMIT $5
     ) recent
     ORDER BY open_time ASC`,
    [symbol, granularity, from, to, limit, source]
  );
  return result.rows;
}
```

---

## 2. Ingestion Buffer Retention on DB Error (`src/modules/pricing/services/PriceFeedIngestionService.ts`)

Updated `PriceFeedIngestionService.flushTicks` to remove flushed ticks from `this.tickBuffer` **only after** `saveBatch` succeeds. If database insertion fails, ticks remain in the buffer for retry on the next flush cycle.

```ts
private async flushTicks() {
  if (this.tickBuffer.length === 0) return;

  const ticksToSave = [...this.tickBuffer];

  try {
    await this.tickRepo.saveBatch(ticksToSave);
    this.tickBuffer = this.tickBuffer.filter((t) => !ticksToSave.includes(t));
  } catch (error: any) {
    logger.error('Failed to save tick batch, keeping in buffer', {
      error: error.message,
      count: ticksToSave.length,
    });
    if (this.tickBuffer.length > 5000) {
      this.tickBuffer = this.tickBuffer.slice(-2000);
    }
  }
}
```

---

## 3. SettlementWorker Expiry Bounds Check (`src/modules/trading/workers/settlementWorker.ts`)

Hardened `settle()` fallback logic: if exact tick is unavailable, `getLatest` is checked to ensure its `tick_time` is less than or equal to `contract.expiryTime`. Any tick with `tick_time > contract.expiryTime` is rejected for settlement, triggering contract refund/cancellation instead.

```ts
if (!settlementTick) {
  logger.warn('Missing settlement tick, falling back to latest tick', { contractId });
  const latestTick = await this.tickRepo.getLatest(
    contract.assetSymbol,
    accountType === 'real' ? 'live' : 'demo'
  );
  if (
    latestTick &&
    new Date(latestTick.tick_time).getTime() <= contract.expiryTime.getTime()
  ) {
    settlementTick = latestTick;
  } else if (latestTick) {
    logger.warn('Latest tick is after contract expiry time; cannot use for settlement', {
      contractId,
      expiryTime: contract.expiryTime,
      tickTime: latestTick.tick_time,
    });
  }
}
```

---

## 4. OHLCService Candle Open Price Continuity (`src/modules/pricing/services/OHLCService.ts`)

When initializing a new candle interval for a symbol/source, `open` is set to the `close` price of the previous candle if present, ensuring smooth body continuity across consecutive candle bars.

```ts
if (current && current.openTime.getTime() === openTimeMs) {
  // Update existing candle
  current.high = Decimal.max(current.high, priceDec);
  current.low = Decimal.min(current.low, priceDec);
  current.close = priceDec;
  current.volume += volBig;
} else {
  // If there was a previous candle, save it
  if (current) {
    await this.saveCandle(current, granularity, source);
  }

  // Start new candle: set open price to previous candle's close if available for smooth body continuity
  const openPrice = current ? current.close : priceDec;
  const highPrice = Decimal.max(openPrice, priceDec);
  const lowPrice = Decimal.min(openPrice, priceDec);

  this.currentCandles.set(key, {
    symbol,
    open: openPrice,
    high: highPrice,
    low: lowPrice,
    close: priceDec,
    volume: volBig,
    openTime,
    source,
  });
}
```

---

## 5. Test Verification (2x Full Suite Consecutive Runs)

### Frontend Vitest Suite (`cd frontend && npm run test:ui`)
```text
Test Files  4 passed (4)
     Tests  22 passed (22)
  Duration  9.60s
```

### Backend Test Suite Run 1 (`npx jest --maxWorkers=2 --forceExit`)
```text
Test Suites: 73 passed, 73 total
Tests:       488 passed, 488 total
Snapshots:   0 total
Time:        410.068 s
Ran all test suites.
```

### Backend Test Suite Run 2 (`npx jest --maxWorkers=2 --forceExit`)
```text
Test Suites: 73 passed, 73 total
Tests:       488 passed, 488 total
Snapshots:   0 total
Time:        408.796 s
Ran all test suites.
```

---

TRADING PHASE 4A FIX COMPLETE — AWAITING GATE PASS
