# READ-ONLY FORENSIC AUDIT — Charting Engine, Price Slippage, and WebSocket State Desync

**Date:** February 2025  
**Scope:** Forensic Audit of Live Trading UI Chart Rendering, `PRICE_SLIPPAGE_EXCEEDED` Validation Logic, WebSocket Connection State Desync, and Demo Chart Data Flow.  
**Status:** READ-ONLY Audit Complete (No Source Changes Made)  

---

## 1. Area 1: Chart Rendering (Candle Sizing, Drifting, & Straight Lines)

### 1.1 Chart & TimeScale Configuration
In `frontend/src/modules/trading/components/TradingChart.tsx` (Lines 210–250):

```ts
const chart = createChart(containerRef.current, {
  width: containerRef.current.clientWidth,
  height: containerRef.current.clientHeight,
  layout: {
    background: { type: ColorType.Solid, color: 'transparent' },
    textColor: '#94a3b8',
    attributionLogo: false,
  },
  grid: {
    vertLines: { color: 'rgba(148, 163, 184, 0.12)' },
    horzLines: { color: 'rgba(148, 163, 184, 0.12)' },
  },
  rightPriceScale: {
    borderColor: 'rgba(148, 163, 184, 0.2)',
    autoScale: true,
    mode: PriceScaleMode.Normal,
    alignLabels: true,
    borderVisible: false,
    scaleMargins: {
      top: 0.2,    // 20% margin top
      bottom: 0.2, // 20% margin bottom
    },
  },
  timeScale: {
    borderColor: 'rgba(148, 163, 184, 0.2)',
    timeVisible: true,
    barSpacing: window.innerWidth < 640 ? 16 : 10,
    rightOffset: 10,
  },
  crosshair: { mode: 1 },
});
```

### 1.2 Root Cause Analysis

1. **Right Drift (Empty Gap on Right Edge):**
   - In `timeScale` options, `rightOffset: 10` is explicitly set.
   - In `TradingChart.tsx` (Line 437):
     ```ts
     chart.timeScale().setVisibleLogicalRange({
       from: Math.max(0, totalBars - 50),
       to: totalBars + 3, // Right-hand margin for incoming ticks
     });
     ```
   - Combining `rightOffset: 10` with `to: totalBars + 3` forces an aggressive 10–13 bar empty space on the right edge of the chart canvas, pushing the newest candle significantly away from the right price scale.

2. **Tiny Candles & Straight Lines:**
   - **Timestamp Format:** `toUnixSeconds()` converts Date objects or ISO strings into integer UNIX timestamps in seconds (`UTCTimestamp`).
   - **Data Gaps in `pricing.candles`:** `CandleRepository.getCandles()` queries 60-second candles stored in Postgres. When there are periods of inactivity or missing minutes (e.g., market closures, feed restarts, or quiet market minutes), `pricing.candles` has missing timestamps (e.g. `10:00` followed directly by `10:15`).
   - Lightweight Charts draws a **continuous straight diagonal/horizontal line** across missing time gaps when rendering in `'line'` mode (`AreaSeries`), causing long artificial horizontal lines.
   - In `'candle'` mode (`CandlestickSeries`), candles formed during price spikes with small open-close spreads have 1-pixel tall bodies with disproportionately tall wicks.

---

## 2. Area 2: `PRICE_SLIPPAGE_EXCEEDED` Validation Logic

### 2.1 Frontend Display
When a trade request fails with `PRICE_SLIPPAGE_EXCEEDED`, `ContractController` (`src/modules/trading/controllers/contractController.ts` lines 79–85) returns an HTTP 400 response with `code: 'PRICE_SLIPPAGE_EXCEEDED'`.

In `frontend/src/modules/trading/components/OrderForm.tsx` (Lines 252–265), `tradeError` is rendered in a red error banner at the top of the order form:
```tsx
{tradeError && (
  <div className="flex items-start justify-between p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-600 dark:text-rose-400 text-xs">
    <div className="flex items-center space-x-2">
      <AlertCircle className="h-4 w-4 flex-shrink-0" />
      <span>{tradeError}</span>
    </div>
    ...
  </div>
)}
```

### 2.2 Backend Validation Code
In `src/modules/trading/services/tradingService.ts` (Lines 167–185) and `src/modules/trading/services/demoTradingService.ts` (Lines 144–155):

```ts
if (request.strikePrice !== undefined) {
  if (!Number.isFinite(request.strikePrice) || request.strikePrice <= 0) {
    throw new Error('INVALID_STRIKE_PRICE');
  }
  const clientStrike = new Decimal(request.strikePrice);
  const serverMid = new Decimal(tick.mid);
  const asset = await this.assetRepo.findBySymbol(assetSymbol);
  if (!asset) throw new Error(`No configuration found for asset ${assetSymbol}`);
  const pipDecimalPlaces = getPipDecimalPlaces(assetSymbol, asset.pipDecimalPlaces);
  const pipSize =
    pipDecimalPlaces >= 4
      ? new Decimal(10).pow(1 - pipDecimalPlaces)
      : new Decimal(10).pow(-pipDecimalPlaces);
  if (clientStrike.minus(serverMid).abs().gt(pipSize.times(5))) {
    throw new Error('PRICE_SLIPPAGE_EXCEEDED');
  }
}
```

Pip decimal calculation (`tradingService.ts` lines 18–25):
```ts
function getPipDecimalPlaces(symbol: string, configuredPlaces?: number): number {
  const normalizedSymbol = symbol.replace(/[^a-z0-9]/gi, '').toUpperCase();
  if (normalizedSymbol.endsWith('JPY')) return 3;
  if (normalizedSymbol.startsWith('XAU') || normalizedSymbol.startsWith('GOLD')) return 2;
  if (normalizedSymbol.startsWith('WTI')) return 3;
  if (normalizedSymbol.startsWith('BTC') || normalizedSymbol.startsWith('ETH')) return 2;
  return configuredPlaces && configuredPlaces > 0 ? configuredPlaces : 5;
}
```

### 2.3 Why the Threshold Fails for Volatile Assets (BTC/USD, ETH/USD)

1. For `BTC/USD`, `getPipDecimalPlaces()` assigns `pipDecimalPlaces = 2`.
2. Because `pipDecimalPlaces < 4`, `pipSize` is computed as `10^(-2) = 0.01` ($0.01 USD).
3. The allowed slippage threshold is `pipSize.times(5) = 0.01 * 5 = $0.05 USD`.
4. For **BTC/USD at $90,000 USD**, a price movement of **$0.06 USD** (0.000067% price drift between client click and server processing) exceeds the $0.05 threshold and throws `PRICE_SLIPPAGE_EXCEEDED`!
5. Normal network latency (20–100ms) on volatile assets like Bitcoin, Ethereum, or Gold easily causes price fluctuations of $0.50–$5.00 USD, which is **10x to 100x larger** than the current 5-pip ($0.05) threshold.

---

## 3. Area 3: WebSocket State Desync ("Disconnected" but ticking)

### 3.1 State Tracking Architecture
In `frontend/src/modules/trading/hooks/usePriceStream.ts` (Lines 160–180):

```ts
const unsubscribePrice = websocketService.onPriceTick(acceptTick);
const unsubscribeLatency = websocketService.onLatencyChange(setLatencyState);
const unsubscribeConn = websocketService.onConnectionStateChange(setIsConnected);
websocketService.subscribeSymbol(subscribedSymbol, subscribedMode);
```

### 3.2 Root Causes of Desync

1. **Dual Quote Sources (REST Polling vs. WebSocket):**
   - `usePriceStream.ts` executes an HTTP REST quote fetch on mount and symbol change (`/api/v1/pricing/assets/${encoded}/price`).
   - When a REST quote arrives, `acceptTick` sets `isPriceAvailable = true` and updates `currentPrice`.
   - If the WebSocket connection fails or drops, `websocketService.onConnectionStateChange(setIsConnected)` sets `isConnected = false` and `latencyState.status = 'disconnected'`.
   - However, REST polling or cached ticks continue to update `currentPrice` and `priceHistory`. The UI chart and spot price tick continuously, while the latency badge displays **"Disconnected"**.

2. **Silent Subscription Reset on Mode/Generation Switch:**
   - In `usePriceStream.ts` (Lines 230–235):
     ```ts
     useEffect(() => {
       setLatencyState({ latencyMs: 0, status: 'disconnected', isConnected: false });
       setIsConnected(false);
       setIsStale(false);
     }, [accountMode, generation]);
     ```
   - Switching account modes or triggering generation cleanup immediately forces `isConnected = false` in component state.
   - If `websocketService` is already connected globally, it does not re-emit an `onConnectionStateChange` event unless the socket connection actually closes or reopens. Consequently, `isConnected` stays `false` in component state even while live/demo ticks stream in.

---

## 4. Area 4: Chart Data Source (Live vs. Demo)

### 4.1 Quoted `loadHistory` Code in `TradingChart.tsx` (Lines 400–425)

```ts
const loadHistory =
  tradingService.getCandles(symbol, granularity, 200) || Promise.resolve([]);
void loadHistory
  .then((data) => {
    if (!isCurrent) return;
    let candles = normalizeCandles(data);
    if (accountMode === 'demo' && candles.length > 0) {
      candles = candles.map((c) => ({
        ...c,
        open: Number((c.open * 0.999).toFixed(5)),
        high: Number((c.high * 0.999).toFixed(5)),
        low: Number((c.low * 0.999).toFixed(5)),
        close: Number((c.close * 0.999).toFixed(5)),
      }));
    }
    candleSeries.setData(candles);
    areaSeries.setData(candles.map(({ time, close }) => ({ time, value: close })));
    dataLengthRef.current = candles.length;
    const last = candles[candles.length - 1];
    currentCandleRef.current = last ? { ...last } : null;
    latestCandleTimeRef.current = last ? Number(last.time) : null;
    latestAreaTimeRef.current = latestCandleTimeRef.current;
    candleHistoryReadyRef.current = true;
    ...
```

### 4.2 Data Flow Architecture
1. **Initial History Fetch:** Regardless of account mode (`real` or `demo`), `TradingChart.tsx` calls `tradingService.getCandles(symbol, granularity, 200)` to retrieve the 200 most recent 60-second candles stored in PostgreSQL `pricing.candles`.
2. **Demo Mode Transformation:** In demo mode (`accountMode === 'demo'`), historical candles are scaled by `0.999` to visually differentiate demo charts from live charts while providing realistic historical price action.
3. **Live Streaming Updates:** After historical candles load (`candleHistoryReadyRef.current = true`), incoming WebSocket ticks from `priceHistory` are filtered by source (`tick.source === (accountMode === 'demo' ? 'demo' : 'live')`) and applied incrementally to update the newest candle in real-time.

---

CHARTING & SLIPPAGE AUDIT COMPLETE — NO SOURCE CHANGES MADE
