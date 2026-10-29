# READ-ONLY FORENSIC AUDIT — Full Trading Engine Architecture & Failure Analysis

**Date:** February 2025  
**Audit Scope:** End-to-End Trading Module Architecture (Frontend UI, React Hooks, WebSocket Gateway, Settlement Engine, Ingestion Pipelines, Database Schema & Indexes)  
**Status:** READ-ONLY Forensic Audit Complete (No Source Changes Made)  

---

## Executive Summary & Systemic Failure Narrative

A holistic forensic audit of the SkiesPro Trading Engine was conducted to investigate four interconnected production symptoms:
1. **Trades Stuck in `settling`:** Contracts placed by users remain permanently in the `settling` state.
2. **WebSocket Disconnected:** The UI displays "disconnected" and fails to show real-time stream latency.
3. **Cannot Place Trade:** Trade action buttons ("Higher" / "Lower") are hard-disabled or fail silently.
4. **UI Chart Bug:** Candlestick and area charts render flat lines, multi-day time gaps, or blank canvases.

### The Systemic Failure Cascade
The reported issues are not isolated bugs; they stem from a **cascade of configuration gaps, architectural asymmetries, and query flaws**:

```
[1. Config / Worker Off] ---------> ENABLE_SETTLEMENT_WORKER=false (default)
                                      └── SettlementWorker never starts in src/index.ts
                                      └── Expired contracts stay in DB status 'settling' indefinitely

[2. WS Protocol Asymmetry] -------> WS_INBOUND_RATE_LIMIT_PER_MIN=10 (too strict)
                                    + Client ping payload omitted in websocketService.ts
                                      └── Client fails to receive 'pong' & hits 10 msg/min limit
                                      └── Server closes socket; UI shows 'disconnected'

[3. UI Button Gating] ------------> isPriceAvailable = false (triggered by 10s tick timeout)
                                      └── OrderForm.tsx sets isDisabled = true
                                      └── Higher / Lower trade buttons hard-disabled

[4. Chart Data Mismatch] ---------> CandleRepository.getCandles SQL query orders ASC LIMIT 200
                                    + Demo mode loadHistory returns Promise.resolve([])
                                      └── Fetches 200 oldest candles (Oct 3 @ ~1.08) vs Live (Oct 4 @ ~1.12)
                                      └── 18-hour gap on chart & blank canvas in demo mode
```

---

## Area 1: Trade Lifecycle & Settlement Engine (Backend Audit)

### 1.1 State Machine Architecture
Contracts follow a strict database-enforced lifecycle:
```
[created] ──► [active] ──(Atomic CAS)──► [settling] ──► [won / lost / draw / cancelled]
```
- **Creation:** Placed via `TradingService.placeTrade()` or `DemoTradingService.placeDemoTrade()`.
- **Expiration Trigger:** Published to RabbitMQ exchange/queue `trade.expiry` with `x-message-ttl = expirySeconds * 1000`.
- **Atomic Compare-And-Swap (CAS):** When `trade.expiry` fires, `SettlementWorker.settle()` executes:
  ```sql
  UPDATE trading.binary_contracts
  SET status = 'settling'
  WHERE id = $1 AND account_type = $2 AND status = 'active'
  ```
  *(Defined in `src/modules/trading/repositories/contractRepository.ts#L136-L146`)*

### 1.2 Root Cause Analysis: Why Trades Get Stuck in `settling`

#### Root Cause 1.1: `ENABLE_SETTLEMENT_WORKER` Feature Flag Defaults to `false`
In `src/config/app.ts` (Line 21) and `.env.example` (Line 128):
```ts
enableSettlementWorker: process.env.ENABLE_SETTLEMENT_WORKER === 'true',
```
In `src/index.ts` (Lines 161–168):
```ts
if (config.enableSettlementWorker) {
  import('./modules/trading/workers/settlementWorker.js')
    .then((m) => {
      const worker = new m.SettlementWorker();
      return worker.start();
    })
    .catch((err) => {
      logger.error('Failed to start settlement worker', { error: err.message });
    });
}
```
**Impact:** If `ENABLE_SETTLEMENT_WORKER` is omitted or set to `false` in `.env`, the `SettlementWorker` is **never instantiated or subscribed** to `trade.expiry`. When RabbitMQ releases expired trade messages, there are zero active consumers listening. Trades remain in `active` or `settling` status in PostgreSQL forever.

#### Root Cause 1.2: Missing Orphaned Settlement Recovery Worker
If a node process crashes, restarts, or encounters a network partition after executing `updateStatusCAS('active', 'settling')` but before executing the settlement transaction:
- The contract is locked in DB with `status = 'settling'`.
- `SettlementWorker.settle()` catch block attempts `updateStatusCAS('settling', 'active')`, but if the process dies or database connection drops during `client.query('BEGIN ISOLATION LEVEL REPEATABLE READ')`, the status revert **never executes**.
- **Code Defect:** There is **no background recovery job/cron** in `src/modules/trading/workers/` to query for contracts with `status = 'settling'` where `expiry_time < NOW() - INTERVAL '30 seconds'` and re-trigger settlement.

#### Root Cause 1.3: Oracle Price Tick Missing at Expiry
In `src/modules/trading/workers/settlementWorker.ts` (Lines 118–127):
```ts
const settlementTick = await this.tickRepo.getPriceAt(
  contract.assetSymbol,
  contract.expiryTime,
  accountType === 'real' ? 'live' : 'demo'
);

if (!settlementTick) {
  throw new Error(
    `Price tick not found for ${contract.assetSymbol} at ${contract.expiryTime.toISOString()}`
  );
}
```
In `src/modules/pricing/repositories/tickRepository.ts` (Lines 77–88):
```sql
SELECT id, symbol, tick_time, bid_price, ask_price, mid_price, volume, source, created_at
FROM pricing.price_ticks
WHERE symbol = $1 AND source = $2 AND tick_time <= $3
ORDER BY tick_time DESC
LIMIT 1
```
If price ingestion was interrupted or delayed during the contract's expiry window, `getPriceAt()` returns `null`. The worker throws an exception and nacks the RabbitMQ message (`nack(true)`). Re-queued messages retry infinitely if price ingestion remains down for that symbol.

---

## Area 2: Real-time Price Feed & WebSockets (Full Stack Audit)

### 2.1 Price Tick Flow Architecture
```
[Kraken / Coinbase / Mock]
       │ (WebSocket / REST)
       ▼
[PriceFeedIngestionService] ──► [OHLCService] ──► [pricing.candles DB]
       │
       ▼ (Redis PubSub / Memory)
[PriceDistributionService] ──► [PriceTickSubscriber / DemoPriceTickSubscriber]
                                       │
                                       ▼
                             [ConnectionManager] ──► [PriceGateway (WS Server)]
                                                            │ (/ws/v1)
                                                            ▼
                                                   [WebSocketClient (Frontend)]
                                                            │
                                                            ▼
                                                  [websocketService.ts]
                                                            │
                                                            ▼
                                                  [usePriceStream.ts]
```

### 2.2 Root Cause Analysis: Why the UI Shows "Disconnected"

#### Root Cause 2.1: Overly Aggressive Rate Limiter in `PriceGateway.ts`
In `src/modules/pricing/websocket/priceGateway.ts` (Lines 18–21):
```ts
private readonly INBOUND_RATE_LIMIT_PER_MIN = parseInt(
  process.env.WS_INBOUND_RATE_LIMIT_PER_MIN || '10',
  10
);
```
In `priceGateway.ts` (Lines 142–153):
```ts
if (!this.checkRateLimit(connectionId)) {
  logger.warn('WebSocket rate limit exceeded', { connectionId, userId });
  this.subscriptionManager.sendError(connectionId, 'WS_001', 'Rate limit exceeded', requestId);

  const rateLimitInfo = this.rateLimitMap.get(connectionId);
  if (rateLimitInfo && rateLimitInfo.count >= 3) {
    const connection = this.connectionManager.getConnection(connectionId);
    if (connection && connection.socket.readyState === WebSocket.OPEN) {
      connection.socket.close(4001, 'Rate limit exceeded');
    }
  }
  return;
}
```
**Impact:** A limit of `10` inbound messages per minute equals **1 message every 6 seconds**. When the React frontend initializes, mounts components, or switches symbols/timeframes, `websocketService` sends `subscribe` and `unsubscribe` frames. Exceeding 10 messages within 60 seconds triggers `socket.close(4001, 'Rate limit exceeded')`, force-disconnecting the client.

#### Root Cause 2.2: Ping/Pong Heartbeat Protocol Asymmetry
In `frontend/src/modules/trading/services/websocketService.ts` (Lines 204–211):
```ts
private startPingInterval(): void {
  this.stopPingInterval();
  this.pingIntervalId = setInterval(() => {
    if (this.client && this.client.isConnected()) {
      this.lastPingTime = Date.now();
      // Ping is managed by WebSocket client / browser or server message
    }
  }, 10000);
}
```
**Code Defect:** `websocketService.ts` records `this.lastPingTime = Date.now()` every 10 seconds, but **never sends a `{ "type": "ping" }` message frame** to the server over the wire!
In `src/modules/pricing/websocket/subscriptionManager.ts` (Lines 205–218), the backend handles `{ "type": "ping" }` and returns `{ "type": "pong" }`, but because the client never sends ping frames:
- No `pong` frames are received by `websocketService.ts` line 192.
- Latency (`latencyMs`) is never calculated via roundtrip time.
- Browser/reverse-proxy idle timeout drops the connection after 30–60 seconds of inactivity.

#### Root Cause 2.3: `DEMO_ENABLED` Channel Gate
In `src/modules/pricing/websocket/subscriptionManager.ts` (Lines 118–121):
```ts
if (normalizedChannel === 'demo.price' && process.env.DEMO_ENABLED !== 'true') {
  errors.push('Demo price channel is unavailable');
  continue;
}
```
If `DEMO_ENABLED` is missing or set to `false` in the backend environment, any frontend subscription to `demo.price` for virtual trading returns an error response, breaking demo quote streaming.

---

## Area 3: Trading UI & Chart Rendering (Frontend Audit)

### 3.1 Root Cause Analysis: Why Trades Cannot Be Placed

In `frontend/src/modules/trading/components/OrderForm.tsx` (Lines 145–152):
```tsx
const isDisabled =
  !hasTradingConfig ||
  requiresTradingKyc ||
  config.isLoading ||
  !isMarketOpen ||
  !isPriceAvailable ||
  isPlacingTrade ||
  Boolean(validationError);
```
In `frontend/src/modules/trading/hooks/usePriceStream.ts` (Lines 205–215):
```ts
useEffect(() => {
  if (!isPriceAvailable || quoteUpdatedAt === 0) return;
  const interval = setInterval(() => {
    if (Date.now() - quoteUpdatedAt > MAX_QUOTE_AGE_MS) {
      setIsPriceAvailable(false);
      setCurrentPrice(0);
      if (accountModeRef.current === 'demo') {
        setIsConnected(false);
        setLatencyState({ latencyMs: 0, status: 'disconnected', isConnected: false });
      }
    }
  }, 1000);
  return () => clearInterval(interval);
}, [isPriceAvailable, quoteUpdatedAt]);
```
**Impact Chain:**
1. WebSocket disconnects (due to rate limiting or missing ping).
2. No live price ticks arrive for > 10 seconds (`MAX_QUOTE_AGE_MS = 10,000`).
3. `usePriceStream` sets `isPriceAvailable = false`.
4. `OrderForm` computes `isDisabled = true`.
5. Both "Higher" (CALL) and "Lower" (PUT) trade buttons become hard-disabled (`disabled={isDisabled}`).
6. If the user clicks, the buttons do not respond or fail silently.

### 3.2 Root Cause Analysis: Why Candlestick Charts Are Visually Broken

#### Root Cause 3.1: Backward SQL Query Pagination in `CandleRepository.getCandles`
In `src/modules/pricing/repositories/candleRepository.ts` (Lines 52–67):
```sql
SELECT id, symbol, granularity_seconds, open_time, close_time, open_price, high_price, low_price, close_price, volume, created_at
FROM pricing.candles
WHERE symbol = $1 AND granularity_seconds = $2 AND open_time >= $3 AND open_time <= $4
ORDER BY open_time ASC
LIMIT $5
```
In `src/modules/pricing/services/pricingService.ts` (Lines 48–52):
```ts
const to = query.to ? new Date(query.to) : new Date();
const from = query.from ? new Date(query.from) : new Date(to.getTime() - 24 * 60 * 60 * 1000);
```
**Impact:** `PricingService` sets the search window from `24 hours ago` to `now`. When `TradingChart` requests 200 candles (`LIMIT 200`), the query orders by `open_time ASC LIMIT 200`.
- Instead of returning the **200 most recent candles up to now**, it returns the **200 oldest candles starting from 24 hours ago** (e.g., stopping at Oct 3 18:50 at price level ~1.0834).
- Today's recent candles (~1.1247) are excluded.
- The chart renders an 18-hour gap on the canvas, connecting yesterday's historical candles (~1.0834) to today's live price ticks (~1.1247) with a long diagonal line.

#### Root Cause 3.2: Demo Mode Returns Empty History Array
In `frontend/src/modules/trading/components/TradingChart.tsx` (Lines 324–327):
```ts
const loadHistory =
  accountMode === 'demo'
    ? Promise.resolve([])
    : tradingService.getCandles(symbol, granularity, 200);
```
In demo mode, `loadHistory` immediately resolves to an empty array `[]`. There is no historical REST route for demo candles (`/api/v1/demo/pricing/candles`). Whenever the user switches timeframes (e.g., from `1m` to `5m`), `TradingChart` clears all candles and renders a completely blank canvas until new real-time ticks arrive.

---

## Area 4: Systemic Vulnerabilities & Hidden Flaws ("Look for Everything Else")

### 4.1 Missing Database Indexes
- **`trading.binary_contracts`:** Missing composite index on `(user_id, account_type, status)`. Queries in `getActiveByUser()` (`WHERE user_id = $1 AND account_type = $2 AND status = 'active'`) perform sequential scans when trade volume scales.
- **`pricing.candles`:** Missing `source` column (`live` vs `demo`). Live market prices (~1.1247) and mock failover prices (~1.0850) are stored in the same `pricing.candles` table under `UNIQUE(symbol, granularity_seconds, open_time)`.
  - When both feeds run simultaneously, the SQL upsert `GREATEST(high_price)` and `LEAST(low_price)` stretches a 1-minute candle high/low across 130 pips, creating artificial vertical spikes on the chart.

### 4.2 Unhandled Promise Rejections & Exception Swallowing
- In `src/modules/pricing/services/PriceFeedIngestionService.ts` (Lines 77–81), the `OHLCService.flush()` timer swallows errors to logger without re-establishing database connection pools if PostgreSQL briefly disconnects.
- In `src/modules/trading/workers/settlementWorker.ts` (Line 41), if RabbitMQ message deserialization fails, `ack()` is called and the message is dropped without pushing to a Dead Letter Queue (DLQ) or alerting.

### 4.3 Hardcoded Timeout Configuration Risks
- **`WS_INBOUND_RATE_LIMIT_PER_MIN` (`10`):** Extremely low threshold for modern SPA applications with multi-tab or multi-chart subscriptions.
- **`MAX_ORACLE_GAP_MS` (`10,000` ms):** 10-second threshold. If WebSocket or price feed delays tick ingestion by 10.1 seconds, trade settlements fail with `"Oracle gap too large"`, triggering trade cancellation and refund.
- **`DEFAULT_PRICE_TTL_MS` (`10,000` ms):** In-memory quote cache TTL in `src/infrastructure/cache/memoryCache.ts`. Quotes older than 10s throw `MARKET_DATA_UNAVAILABLE` during `placeTrade()`.

---

## Root Cause Synthesis & Recommended Fix Roadmap

| Component / Layer | Root Cause | Impact | Recommended Action (Post-Audit) |
| :--- | :--- | :--- | :--- |
| **Settlement Worker** | `ENABLE_SETTLEMENT_WORKER` default `false`; no orphaned recovery cron. | Trades stuck in `settling` indefinitely. | Set `ENABLE_SETTLEMENT_WORKER=true` in `.env`; add `SettlementRecoveryJob` cron. |
| **WebSocket Gateway** | `WS_INBOUND_RATE_LIMIT_PER_MIN=10`; no client ping frame sent over wire. | UI shows "disconnected"; socket closed with 4001. | Increase WS rate limit to `120`; implement `{ type: 'ping' }` frame in `websocketService.ts`. |
| **Trading Order Form** | `isDisabled` hard-gated on `isPriceAvailable` (10s stale check). | Trade action buttons disabled or silent failure. | Gracefully handle WS reconnects; allow REST quote fallback for trade placement. |
| **Trading Chart** | `CandleRepository.getCandles` SQL query orders `ASC LIMIT 200`. | Chart shows 18h time gap & wrong price level (~1.08 vs ~1.12). | Fix SQL query to order `DESC LIMIT $5` and reverse results to chronological `ASC`. |
| **Demo Chart** | `loadHistory` returns `[]` in demo mode; missing demo candles route. | Chart renders blank canvas on timeframe switch. | Add `/api/v1/demo/pricing/candles` endpoint & update `loadHistory` in `TradingChart.tsx`. |

---

FULL TRADING AUDIT COMPLETE — NO SOURCE CHANGES MADE
