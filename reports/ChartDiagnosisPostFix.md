# Trading Chart Diagnosis Post-Fix Report

## 1. SOURCE MIXING

### a. `OHLCService` Tick Ingestion & Routing
- **Routing**: `PriceFeedIngestionService` (`src/modules/pricing/services/PriceFeedIngestionService.ts` line 225) routes all ticks it handles directly to `OHLCService`:
```typescript
await this.ohlcService.processTick(normalizedSymbol, mid, '0', time);
```
- **Source Filtering**: Inside `OHLCService.ts` (line 20), `processTick` accepts `(symbol: string, price: string, volume: string, time: Date)`. It has **no source filter** and no parameter to record or distinguish tick sources (`live` vs `mock`/`demo`).
- **Tier Failover Behavior**: When `PriceFeedIngestionService` loses primary feed connection (Kraken), it fails over to `tier3_mock` (`MockPriceAdapter`). The mock adapter generates prices centered around `base: 1.085`. These mock ticks are passed directly into `ohlcService.processTick(...)` and persisted into `pricing.candles`.
- **Demo Service Behavior**: `DemoPriceFeedService` (`src/modules/pricing/services/DemoPriceFeedService.ts`) runs its own `MockPriceAdapter` and writes ticks to `pricing.price_ticks` with `source: 'demo'`, but does **not** invoke `OHLCService`.

### b. Database Schema (`pricing.candles`)
- **Schema Columns**: Querying `information_schema.columns` for `pricing.candles`:
  `id`, `symbol`, `granularity_seconds`, `open_time`, `close_time`, `open_price`, `high_price`, `low_price`, `close_price`, `volume`, `created_at`, `tick_count`.
- **Source Column**: There is **NO `source` column** in `pricing.candles`.
- **Source Distinction**: There is no structural or metadata mechanism in `pricing.candles` to separate live-origin rows from mock-origin rows.

### c. Daily Price Level Summary (`EUR/USD`, Granularity 60)
Querying `close_price` min/max per day for EUR/USD (granularity 60):

| Date | min_open | max_open | min_close | max_close | candle_count |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **2026-08-19** | 1.168850 | 1.169350 | 1.168750 | 1.169250 | 3 |
| **2026-08-20** | 1.170350 | 1.171250 | 1.170350 | 1.171250 | 5 |
| **2026-08-27** | 1.084220 | 1.163950 | 1.084040 | 1.163950 | 32 |
| **2026-08-29** | 1.076870 | 1.085480 | 1.076510 | 1.085390 | 16 |
| **2026-08-30** | 1.083940 | 1.086570 | 1.083980 | 1.086600 | 16 |
| **2026-08-31** | 1.080090 | 1.096390 | 1.080150 | 1.096300 | 351 |
| **2026-09-01** | 1.084840 | 1.088470 | 1.084800 | 1.088360 | 16 |
| **2026-09-02** | 1.078520 | 1.085360 | 1.078130 | 1.085460 | 30 |
| **2026-09-06** | 1.078390 | 1.085130 | 1.078360 | 1.083670 | 16 |
| **2026-09-09** | 1.080730 | 1.092390 | 1.080810 | 1.092360 | 46 |
| **2026-09-10** | 1.078370 | 1.085390 | 1.076860 | 1.085440 | 17 |
| **2026-09-16** | 1.078240 | 1.085540 | 1.078340 | 1.085560 | 16 |
| **2026-09-17** | 1.081980 | 1.086520 | 1.082010 | 1.086470 | 15 |
| **2026-09-21** | 1.084410 | 1.090600 | 1.084280 | 1.090690 | 34 |
| **2026-09-23** | 1.083940 | 1.087880 | 1.083760 | 1.088480 | 15 |
| **2026-09-28** | 1.080390 | 1.088070 | 1.080570 | 1.087920 | 47 |
| **2026-09-30** | 1.084980 | 1.091630 | 1.085500 | 1.091610 | 30 |
| **2026-10-01** | 1.084740 | 1.092710 | 1.084770 | 1.093300 | 26 |
| **2026-10-02** | 1.078110 | 1.124865 | 1.078180 | 1.124865 | 503 |
| **2026-10-03** | 1.124130 | 1.125690 | 1.124125 | 1.125765 | 402 |
| **2026-10-04** | 1.120745 | 1.124685 | 1.120745 | 1.124680 | 33 |

- **Analysis**: Yes. Days prior to Oct 2 sat exclusively at ~1.08 (mock generator period). On Oct 2, live Kraken feed started (`~1.1248`) while mock failover also occurred (`~1.0781`), producing both ~1.08 and ~1.12 price levels on the same day.

### d. Intra-Minute Source Conflict & Upsert Behavior
- **Upsert Conflict Rule** (`src/modules/pricing/repositories/candleRepository.ts` line 27):
```sql
ON CONFLICT (symbol, granularity_seconds, open_time) DO UPDATE SET
  high_price = GREATEST(pricing.candles.high_price, EXCLUDED.high_price),
  low_price = LEAST(pricing.candles.low_price, EXCLUDED.low_price),
  close_price = EXCLUDED.close_price,
  close_time = EXCLUDED.close_time,
  volume = pricing.candles.volume + EXCLUDED.volume
```
- **Result when both feeds write in same minute**: On `2026-09-01T21:55:00.000Z`, `open_price = 1.096250`, `high_price = 1.097970`, `low_price = 1.084630`, `close_price = 1.084670`. The `GREATEST` and `LEAST` functions stretch the candle's high/low over 130 pips within 60 seconds, creating artificial vertical spikes.


## 2. GAPS

### a. Top 20 Gaps > 5 Minutes (`EUR/USD`, Granularity 60)

| Gap Index | Gap Start | Gap End | Duration (Minutes) | Duration (Days/Hours) |
| :--- | :--- | :--- | :--- | :--- |
| **0** | `2026-08-21T10:03:59.999Z` | `2026-08-28T09:32:00.000Z` | **10,048.0 min** | ~7.0 days |
| **1** | `2026-09-11T15:11:59.999Z` | `2026-09-17T11:09:00.000Z` | **8,397.0 min** | ~5.8 days |
| **2** | `2026-09-24T21:40:59.999Z` | `2026-09-29T19:37:00.000Z` | **7,076.0 min** | ~4.9 days |
| **3** | `2026-09-18T11:40:59.999Z` | `2026-09-22T12:37:00.000Z` | **5,816.0 min** | ~4.0 days |
| **4** | `2026-09-03T13:19:59.999Z` | `2026-09-07T12:57:00.000Z` | **5,737.0 min** | ~4.0 days |
| **5** | `2026-09-07T13:12:59.999Z` | `2026-09-10T15:34:00.000Z` | **4,461.0 min** | ~3.1 days |
| **6** | `2026-09-22T14:00:59.999Z` | `2026-09-24T21:26:00.000Z` | **3,325.0 min** | ~2.3 days |
| **7** | `2026-09-29T20:23:59.999Z` | `2026-10-01T20:33:00.000Z` | **2,889.0 min** | ~2.0 days |
| **8** | `2026-08-28T11:18:59.999Z` | `2026-08-30T07:58:00.000Z` | **2,679.0 min** | ~1.8 days |
| **9** | `2026-08-31T10:33:59.999Z` | `2026-09-01T13:37:00.000Z` | **1,623.0 min** | ~27.0 hours |
| **10** | `2026-08-30T08:13:59.999Z` | `2026-08-31T10:18:00.000Z` | **1,564.0 min** | ~26.0 hours |
| **11** | `2026-09-17T11:24:59.999Z` | `2026-09-18T11:26:00.000Z` | **1,441.0 min** | ~24.0 hours |
| **12** | `2026-10-02T15:05:59.999Z` | `2026-10-03T14:39:00.000Z` | **1,413.0 min** | ~23.5 hours |
| **13** | `2026-09-02T13:52:59.999Z` | `2026-09-03T12:50:00.000Z` | **1,377.0 min** | ~23.0 hours |
| **14** | `2026-09-10T16:25:59.999Z` | `2026-09-11T14:55:00.000Z` | **1,349.0 min** | ~22.5 hours |
| **15** | `2026-08-20T15:11:59.999Z` | `2026-08-21T09:18:00.000Z` | **1,086.0 min** | ~18.1 hours |
| **16** | `2026-10-01T21:02:59.999Z` | `2026-10-02T14:40:00.000Z` | **1,057.0 min** | ~17.6 hours |
| **17** | `2026-09-01T22:24:59.999Z` | `2026-09-02T13:37:00.000Z` | **912.0 min** | ~15.2 hours |
| **18** | `2026-10-05T00:41:59.999Z` | `2026-10-05T09:01:00.000Z` | **499.0 min** | ~8.3 hours (overnight) |
| **19** | `2026-10-03T23:55:59.999Z` | `2026-10-04T07:33:00.000Z` | **457.0 min** | ~7.6 hours (overnight) |

### b. Last 24 Hours Bar Count Analysis
- **Expected Bars in 24 Hours**: `1,440` (60 bars/hr × 24 hrs)
- **Actual Stored Bars in Database**: `384`
- **Deficit**: **1,056 missing bars (73.3% data loss)** in the last 24 hours.

### c. Backfill Behavior
There is **no backfilling mechanism** or REST backfill job when the backend starts up or reconnects. Unrecorded minutes remain permanent empty gaps in `pricing.candles`.


## 3. EMPTY CHART AUDIT

### a. Endpoint Output Audit (`limit = 200`, no `from`/`to`)
- **HTTP Status**: `200 OK` for all granularities.

| Granularity | Count | Execution Time | First Candle Open Time | Last Candle Open Time | Last Close Price |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **60s (1m)** | **17** | 440ms | `2026-10-05T09:01:00.000Z` | `2026-10-05T09:17:00.000Z` | `1.121365` |
| **300s (5m)** | **46** | 402ms | `2026-10-04T13:15:00.000Z` | `2026-10-05T09:15:00.000Z` | `1.121365` |
| **900s (15m)** | **75** | 261ms | `2026-10-03T14:30:00.000Z` | `2026-10-05T09:15:00.000Z` | `1.121365` |
| **3600s (1H)** | **30** | 257ms | `2026-09-29T19:00:00.000Z` | `2026-10-05T09:00:00.000Z` | `1.121365` |
| **14400s (4H)** | **31** | 261ms | `2026-08-28T08:00:00.000Z` | `2026-10-05T08:00:00.000Z` | `1.121365` |
| **86400s (1D)** | **21** | 268ms | `2026-08-20T00:00:00.000Z` | `2026-10-05T00:00:00.000Z` | `1.121365` |

- **Cause for 17 Candles at 60s**: `PricingService.getCandles` calculates `from = to - (60 * 200 * 1000 * 1.2) = to - 4 hours`. In the last 4 hours (`05:17` to `09:17`), because the backend was offline overnight until `09:01`, only 17 candles exist in that 4-hour window. If the backend is started 1 minute before opening the chart, `from = to - 4h` returns **0 or 1 candle**, causing an empty chart.

### b. SQL Performance & Errors at 14400s / 86400s
- **14400s (4H)**: Execution time `261ms`, Status `200 OK`, `31` candles returned.
- **86400s (1D)**: Execution time `268ms`, Status `200 OK`, `21` candles returned.
- No SQL errors, no 400/500 errors.

### c. Frontend `normalizeCandles` Validation Check
Applying `normalizeCandles` validation rules (`!Number.isFinite(v) || v <= 0 || high < low || high < open || high < close`):
- **Dropped Count**: **0 dropped across all timeframes** (100% passed validation).

### d. Demo Mode Behavior (`accountMode === 'demo'`)
- In `TradingChart.tsx` line 405:
```typescript
const loadHistory = accountMode === 'demo' ? Promise.resolve([]) : tradingService.getCandles(symbol, granularity, 200);
```
- In demo mode, `loadHistory` returns `[]`. No historical candles are fetched or displayed.
- On timeframe switch (e.g. to 5m) in demo mode, the chart clears existing bars and renders a **blank canvas**. Live demo ticks build candles in real-time going forward, but **no demo history restoration path exists** (`/api/v1/demo/pricing/candles` route does not exist).


## 4. ROOT CAUSE

**Symptom 1 (Empty chart on timeframe switch / 1m timeframe)**: Caused by (i) severe data time gaps in `pricing.candles` due to backend downtime with no historical backfilling, (ii) the dynamic `from` lookback calculation in `PricingService.getCandles` (`to - granularity * limit * 1.2`), which for 1m (`60s`) restricts the query window to the last 4 hours (`now - 4h`). When the server is restarted or has been offline during that 4-hour window, 0 to 17 candles are found, rendering an almost empty chart. Furthermore, in demo mode (`accountMode === 'demo'`), no historical candle route exists, causing `loadHistory` to return `[]` and render an empty chart on every timeframe switch until new ticks arrive.

**Symptom 2 (Long straight segments on line chart)**: Caused by multi-day and multi-hour data gaps in `pricing.candles` (e.g. 7-day, 5-day, and 8-hour gaps) where ingestion was stopped. When Lightweight Charts receives consecutive candles separated by hours or days, it draws a straight connecting line across the time gap. In addition, `PriceFeedIngestionService` fallback to `tier3_mock` writes mock prices (~1.085) alongside live Kraken prices (~1.124) into `pricing.candles` without a `source` column, causing vertical spikes and flat lines when price levels jump between feed sources.

### List of files that would need to change:
1. `src/modules/pricing/services/pricingService.ts`
   - Adjust `from` calculation for small granularities (60s) so it falls back to a wider minimum lookback window (e.g. min 24h–48h) or ignores `from` if fewer than $N$ candles are returned.
2. `src/modules/pricing/repositories/candleRepository.ts`
   - Add a `source` column filter to `pricing.candles` or isolate live vs mock/demo candle history so price universes (~1.085 vs ~1.124) are never mixed into the same chart series.
3. `migrations/035_add_source_to_candles.sql` (New Migration)
   - Add `source` column to `pricing.candles` table and composite constraint `UNIQUE(symbol, granularity_seconds, open_time, source)`.
4. `src/modules/pricing/services/OHLCService.ts`
   - Accept and record `source` ('live' vs 'demo') when building and persisting candles.
5. `src/modules/pricing/services/DemoPriceFeedService.ts` / `demo.routes.ts`
   - Implement historical candle aggregation and a dedicated demo candle route `/api/v1/demo/pricing/candles` so demo mode charts have historical candles on mount and timeframe switch.
6. `frontend/src/modules/trading/services/tradingService.ts` & `frontend/src/modules/trading/components/TradingChart.tsx`
   - Update demo history loading to call the demo candles endpoint instead of returning `Promise.resolve([])`.
