# Trading Chart Data Mismatch Diagnostic Report

## 1. CANDLE ENDPOINT

### a. Backend Route and Handler Code
- **Frontend Caller**: `frontend/src/modules/trading/services/tradingService.ts` (lines 310–335)
  - **HTTP Method**: `GET`
  - **URL**: `/api/v1/pricing/assets/${encodeURIComponent(symbol)}/candles?granularity=${granularity}&limit=${limit}`
  - **Parameters**: `symbol` (string, e.g. `'EUR/USD'`), `granularity` (number in seconds, default `60`), `limit` (number of bars, e.g. `200`).

- **Backend Route**: `src/modules/pricing/pricing.routes.ts` (lines 18–28)
```typescript
router.get(
  '/assets/:symbol/candles',
  [
    param('symbol').isString().notEmpty(),
    query('granularity').optional().isInt({ min: 60 }),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
    validate,
  ],
  (req: any, res: any) => controller.getCandles(req, res)
);
```

- **Controller Handler**: `src/modules/pricing/controllers/pricingController.ts` (lines 36–49)
```typescript
  async getCandles(req: Request, res: Response): Promise<void> {
    try {
      const query = {
        symbol: req.params.symbol,
        granularity: req.query.granularity ? parseInt(req.query.granularity as string) : undefined,
        from: req.query.from as string,
        to: req.query.to as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      };
      const candles = await this.pricingService.getCandles(query);
      res.status(200).json({ data: candles });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
```

- **Service Handler**: `src/modules/pricing/services/pricingService.ts` (lines 46–68)
```typescript
  async getCandles(query: CandleRequestDto) {
    const normalizedSymbol = normalizeSymbol(query.symbol);
    const granularity = query.granularity || 60;
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from ? new Date(query.from) : new Date(to.getTime() - 24 * 60 * 60 * 1000);
    const limit = query.limit || 500;

    const candles = await this.candleRepo.getCandles(
      normalizedSymbol,
      granularity,
      from,
      to,
      limit
    );

    return candles.map((c) => ({
      symbol: c.symbol,
      granularity_seconds: c.granularity_seconds,
      open_time: c.open_time.toISOString(),
      close_time: c.close_time.toISOString(),
      open: c.open_price,
      high: c.high_price,
      low: c.low_price,
      close: c.close_price,
      volume: c.volume,
    }));
  }
```

- **Repository Query**: `src/modules/pricing/repositories/candleRepository.ts` (lines 52–67)
```typescript
  async getCandles(
    symbol: string,
    granularity: number,
    from: Date,
    to: Date,
    limit: number = 500
  ): Promise<CandleRow[]> {
    const result = await this.client.query<CandleRow>(
      `SELECT id, symbol, granularity_seconds, open_time, close_time, open_price, high_price, low_price, close_price, volume, created_at
       FROM pricing.candles
       WHERE symbol = $1 AND granularity_seconds = $2 AND open_time >= $3 AND open_time <= $4
       ORDER BY open_time ASC
       LIMIT $5`,
      [symbol, granularity, from, to, limit]
    );
    return result.rows;
  }
```

### b. Live API Call Output (symbol: "EUR/USD", granularity: 60, limit: 200)
- **Candle Count**: `200`
- **First Candle**:
```json
{
  "symbol": "EUR/USD",
  "granularity_seconds": 60,
  "open_time": "2026-10-03T14:39:00.000Z",
  "close_time": "2026-10-03T14:39:59.999Z",
  "open": "1.085170",
  "high": "1.085390",
  "low": "1.084840",
  "close": "1.085130",
  "volume": "0"
}
```
- **Last Candle**:
```json
{
  "symbol": "EUR/USD",
  "granularity_seconds": 60,
  "open_time": "2026-10-03T18:50:00.000Z",
  "close_time": "2026-10-03T18:50:59.999Z",
  "open": "1.084095",
  "high": "1.085015",
  "low": "1.083395",
  "close": "1.083450",
  "volume": "0"
}
```
- **Timezone/Unit of `open_time`**: ISO 8601 UTC string (`YYYY-MM-DDTHH:mm:ss.sssZ`).

### c. API Output for Granularities 300 and 3600
- **Granularity 300s (5m)**: `Candle count: 0`
- **Granularity 3600s (1H)**: `Candle count: 0`
- **Explanation**: The `pricing.candles` database table currently only contains records generated with `granularity_seconds = 60` (1-minute bars). There are no rows stored for 300s or 3600s granularities.


## 2. CANDLE DATA SOURCE

### a. Data Source
The candle data is stored in the PostgreSQL database table `pricing.candles`.
- Active live ticks from Kraken are ingested by `PriceFeedIngestionService` (`src/modules/pricing/services/PriceFeedIngestionService.ts`), which routes them to `OHLCService` (`src/modules/pricing/services/OHLCService.ts`).
- `OHLCService` aggregates 1-minute ticks in memory and periodically calls `CandleRepository.upsert(...)` to persist completed candles into `pricing.candles`.

### b. Background Job / Ingestion Service
- The `OHLCService.flush()` function is scheduled to run every 10 seconds inside `PriceFeedIngestionService.start()` (`src/modules/pricing/services/PriceFeedIngestionService.ts` line 77):
```typescript
setInterval(() => {
  this.ohlcService.flush().catch((err) => {
    logger.error('Error flushing candles', { error: err.message });
  });
}, 10000);
```
- **Last Execution**: Ran continuously in real-time. Querying `pricing.candles` directly shows recent active candles:
  - Most recent `open_time` in database: `2026-10-04T13:53:00.000Z`
  - Created at: `2026-10-04T13:54:00.114Z`

### c. Most Recent Candle in Database
Raw database query result for `SELECT * FROM pricing.candles WHERE symbol = 'EUR/USD' AND granularity_seconds = 60 ORDER BY open_time DESC LIMIT 1`:
```json
{
  "id": "17055",
  "symbol": "EUR/USD",
  "granularity_seconds": 60,
  "open_time": "2026-10-04T13:53:00.000Z",
  "close_time": "2026-10-04T13:53:59.999Z",
  "open_price": "1.124830",
  "high_price": "1.124840",
  "low_price": "1.124780",
  "close_price": "1.124785",
  "volume": "0",
  "created_at": "2026-10-04T13:54:00.114Z"
}
```
- **Distance from now**: 0 minutes (current minute bar).

### d. Caching Layer
There is **no caching layer** (Redis, in-memory, or HTTP cache) applied to `getCandles`. Every API request directly executes the SQL query against PostgreSQL via `CandleRepository.getCandles(...)`.


## 3. LIVE TICK SOURCE

### a. Code Path from Source to TradingChart
1. **Ingestion**: `KrakenAdapter` (`src/modules/pricing/adapters/krakenAdapter.ts`) connects to `wss://ws.kraken.com/v2` and receives live ticker updates for `EUR/USD`.
2. **Distribution**: `PriceFeedIngestionService.handleTick` validates ticks, buffers them into `pricing.price_ticks`, and calls `PriceDistributionService.distributeTick(...)` (`src/modules/pricing/services/priceDistributionService.ts`), which publishes them to Redis/Memory PubSub and updates WebSocket clients.
3. **Frontend Stream**: `usePriceStream` (`frontend/src/modules/trading/hooks/usePriceStream.ts`) subscribes via WebSocket to the `price` channel (live) or `demo.price` channel (demo).
4. **State to Props**: `TradingPage` (`frontend/src/pages/trading/TradingPage.tsx`) receives `currentPrice` and `priceHistory` from `usePriceStream` and passes them directly as props into `<TradingChart symbol={symbol} currentPrice={currentPrice} priceHistory={priceHistory} />`.

### b. Raw PriceTick Samples

**Live Mode Ticks (`source = 'live'`)**:
```json
[
  { "id": "1372961", "symbol": "EUR/USD", "tick_time": "2026-10-04T13:54:11.045Z", "bid_price": "1.124710", "ask_price": "1.124830", "mid_price": "1.124770", "source": "live" },
  { "id": "1372962", "symbol": "EUR/USD", "tick_time": "2026-10-04T13:54:11.045Z", "bid_price": "1.124710", "ask_price": "1.124820", "mid_price": "1.124765", "source": "live" },
  { "id": "1372959", "symbol": "EUR/USD", "tick_time": "2026-10-04T13:54:11.042Z", "bid_price": "1.124710", "ask_price": "1.124830", "mid_price": "1.124770", "source": "live" },
  { "id": "1372958", "symbol": "EUR/USD", "tick_time": "2026-10-04T13:54:11.020Z", "bid_price": "1.124710", "ask_price": "1.124830", "mid_price": "1.124770", "source": "live" },
  { "id": "1372957", "symbol": "EUR/USD", "tick_time": "2026-10-04T13:54:11.016Z", "bid_price": "1.124710", "ask_price": "1.124840", "mid_price": "1.124775", "source": "live" }
]
```

**Demo Mode Ticks (`source = 'demo'`)**:
```json
[
  { "id": "1372972", "symbol": "EUR/USD", "tick_time": "2026-10-04T13:54:12.231Z", "bid_price": "1.088650", "ask_price": "1.088900", "mid_price": "1.088775", "source": "demo" },
  { "id": "1372952", "symbol": "EUR/USD", "tick_time": "2026-10-04T13:54:11.216Z", "bid_price": "1.088610", "ask_price": "1.088940", "mid_price": "1.088775", "source": "demo" },
  { "id": "1372945", "symbol": "EUR/USD", "tick_time": "2026-10-04T13:54:10.216Z", "bid_price": "1.088700", "ask_price": "1.088904", "mid_price": "1.088870", "source": "demo" },
  { "id": "1372907", "symbol": "EUR/USD", "tick_time": "2026-10-04T13:54:09.119Z", "bid_price": "1.088650", "ask_price": "1.088970", "mid_price": "1.088810", "source": "demo" },
  { "id": "1372906", "symbol": "EUR/USD", "tick_time": "2026-10-04T13:54:08.719Z", "bid_price": "1.088620", "ask_price": "1.088960", "mid_price": "1.088790", "source": "demo" }
]
```

### c. Real vs Simulated Price Analysis
- **Live Price (~1.1247)**: Real market price streamed directly from Kraken WebSocket (`wss://ws.kraken.com/v2`). The database candles currently generated in real-time by `OHLCService` are also at ~1.1247.
- **Demo Price (~1.0887)**: Generated by `MockPriceAdapter` / `DemoPriceFeedService` using a mathematical process initialized with `base: 1.085`.
- **Returned Candle History Level (~1.0834)**: Stale historical candle data returned because `getCandles` fetched the oldest 200 candles starting from 24 hours ago (Oct 3 14:39 to Oct 3 18:50), when prices were around ~1.0834. The returned candle history is **wrong** due to the SQL pagination ordering bug described in section 7.


## 4. SYMBOL AND MODE MAPPING

### a. Symbol Passing
- Symbol is passed as `"EUR/USD"` from `TradingChart.tsx` to `tradingService.getCandles("EUR/USD", granularity, 200)`.
- Backend controller receives `req.params.symbol = "EUR/USD"`.
- `pricingService.getCandles` runs `normalizeSymbol("EUR/USD")` which returns `"EUR/USD"`.
- `candleRepository.getCandles` queries `WHERE symbol = 'EUR/USD'`.
- The live tick feed also uses `"EUR/USD"`. Backend mapping is consistent.

### b. Source Field Mapping
- In live mode, ticks are stored and streamed with `source: 'live'`.
- In demo mode, ticks are stored and streamed with `source: 'demo'`.
- `TradingChart.tsx` filters incoming ticks matching `tick.source === (accountMode === 'demo' ? 'demo' : 'live')`.


## 5. TIME ALIGNMENT

### a. Timezone and Units
- `open_time` from `getCandles` API: ISO 8601 UTC string (e.g. `"2026-10-03T14:39:00.000Z"`), parsed in `TradingChart.tsx` via `toUnixSeconds()` to UNIX timestamp in seconds (`1791038340`).
- `tick_time` from `priceHistory`: ISO 8601 UTC string (e.g. `"2026-10-04T13:54:11.045Z"`), parsed in `TradingChart.tsx` via `toUnixSeconds()` to UNIX timestamp in seconds (`1791122051`).
- Both timestamps are UTC and correctly parsed into UNIX seconds.

### b. Time Gap
- Last candle returned by `getCandles` for EUR/USD: `open_time = 2026-10-03T18:50:00.000Z` (UNIX: `1791053400`).
- First live tick received on Oct 4: `tick_time = 2026-10-04T13:29:13.300Z` (UNIX: `1791120553`).
- **Time Gap**: `67,153 seconds` (**18 hours, 39 minutes, 13 seconds**).


## 6. BROWSER EVIDENCE / RUNTIME EVIDENCE

### a. Console Errors/Warnings
- No console errors or network exceptions are thrown by `tradingService.getCandles()`. The HTTP request returns status `200 OK`.

### b. Actual JSON Response of `getCandles` Network Request
```json
{
  "data": [
    {
      "symbol": "EUR/USD",
      "granularity_seconds": 60,
      "open_time": "2026-10-03T14:39:00.000Z",
      "close_time": "2026-10-03T14:39:59.999Z",
      "open": "1.085170",
      "high": "1.085390",
      "low": "1.084840",
      "close": "1.085130",
      "volume": "0"
    },
    ... 198 intermediate bars ...
    {
      "symbol": "EUR/USD",
      "granularity_seconds": 60,
      "open_time": "2026-10-03T18:50:00.000Z",
      "close_time": "2026-10-03T18:50:59.999Z",
      "open": "1.084095",
      "high": "1.085015",
      "low": "1.083395",
      "close": "1.083450",
      "volume": "0"
    }
  ]
}
```

### c. Catch Block Behavior
- `getCandles` does NOT return an error or empty array in live mode for EUR/USD. It returns 200 candles, but they are truncated to Oct 3 18:50 due to the SQL query ordering bug.


## 7. ROOT CAUSE

**(A) candle history is stale (old date, outdated price level)**

**Root Cause Explanation**:
The root cause is a SQL query pagination bug in `CandleRepository.getCandles` (`src/modules/pricing/repositories/candleRepository.ts`) combined with default parameter calculation in `PricingService.getCandles` (`src/modules/pricing/services/pricingService.ts`). When `TradingChart` requests candle history with `limit = 200`, `PricingService` sets the query window from `from = 24 hours ago` (Oct 3 14:39) to `to = now` (Oct 4 13:54). `CandleRepository` executes `SELECT ... WHERE open_time >= from AND open_time <= to ORDER BY open_time ASC LIMIT 200`. Because there are over 1,500 candles stored in the database within that 24-hour window, ordering by `open_time ASC` with `LIMIT 200` fetches the **200 oldest candles starting from 24 hours ago** (cutting off on Oct 3 at 18:50 at price level ~1.0834). It never reaches today's recent candles (Oct 4 at price level ~1.1247). Consequently, `TradingChart` receives an outdated block of candles from yesterday (~1.0834) alongside live ticks from today (~1.1247), creating an 18-hour timeline gap and squashing today's live price movements into a flat line at the far right.

### List of files that would need to change:
1. `src/modules/pricing/repositories/candleRepository.ts`
   - Modify the SQL query in `getCandles` to fetch the most recent $N$ candles up to `to` date by ordering by `open_time DESC LIMIT $5` and returning them in chronological order (`ASC`).
2. `src/modules/pricing/services/pricingService.ts`
   - Ensure `getCandles` handles sorting or timeframe filters so the returned dataset is the most recent up to `to`.
3. `src/modules/pricing/services/OHLCService.ts` / background candle aggregators
   - Add aggregation/storage support for granularities `300` (5m) and `3600` (1H) if requested by chart timeframe selectors.
