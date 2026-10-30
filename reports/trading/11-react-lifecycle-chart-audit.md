# READ-ONLY FORENSIC AUDIT — React Lifecycle, Chart Integration & State Desync

**Date:** 2026-10-30  
**Scope:** Trading chart data/lifecycle, live tick application, connection-state rendering, and frontend WebSocket construction.  
**Status:** Read-only audit; no source changes made.

## Executive findings

- The chart history effect does **not** run on every render or tick. Its dependencies are `[accountMode, symbol, granularity]` (`frontend/src/modules/trading/components/TradingChart.tsx:514`). It clears both series when one of those values changes, then repopulates them when the request resolves.
- History candles reach `setData` as objects with **numeric Unix-second `time` values**, numeric OHLC, and ascending chronological order. A one-candle API result remains a one-candle array: `normalizeCandles` returns early for fewer than two rows (`TradingChart.tsx:98-99`).
- Live updates use `candleSeries.update(...)`, not `setData([oneCandle])` (`TradingChart.tsx:205, 233`). The chart now scrolls to real time after area updates (`:237`). Large gaps can nevertheless remain where history gap filling is capped, or where the backend/API returns only one or a few candles.
- `TradingPage` renders `<TradingChart>` without a dynamic React `key` (`frontend/src/pages/trading/TradingPage.tsx:169-176`). The chart is created once and properly removed on unmount (`TradingChart.tsx:259-262, 355-360`).
- The latency badge receives both `latencyState` and the hook’s `isConnected` prop (`TradingPage.tsx:110`). A valid accepted tick sets both states connected (`usePriceStream.ts:89-90`), so persistent “Disconnected” is not explained by a missing prop. It can still occur if a later/stale disconnect callback resets state after a tick, and the callback currently has no connection-generation guard.
- Only one frontend `new WebSocket(...)` construction site was found. `usePriceStream` calls `websocketService.initialize(...)`; it does not construct an independent socket. Reinitialization disconnects an existing client first, but the hook has no cleanup for that initialization effect, so Strict Mode or auth/user changes can produce overlapping close/connect callbacks and stale state events.

## 1. Chart data and rendering lifecycle

### History `setData` effect and dependencies

The history-loading effect in `frontend/src/modules/trading/components/TradingChart.tsx:443-514` clears the series before fetching and applies normalized history only if its request is still current:

```tsx
useEffect(() => {
  // ...
  candleSeries.setData([]);
  areaSeries.setData([]);

  const loadHistory =
    tradingService.getCandles(symbol, granularity, 200) || Promise.resolve([]);
  void loadHistory.then((data) => {
    if (!isCurrent) return;
    let candles = normalizeCandles(data, granularity);
    // ...
    candleSeries.setData(candles);
    areaSeries.setData(candles.map(({ time, close }) => ({ time, value: close })));
    // ...
  });
  return () => {
    isCurrent = false;
  };
}, [accountMode, symbol, granularity]);
```

This dependency list changes when account mode, symbol, or selected timeframe changes. It does not depend on `priceHistory`, `currentPrice`, or chart type, so normal tick-driven renders do not wipe candle history. The `isCurrent` flag prevents an old history response from applying after an effect cleanup. A mode/symbol/timeframe transition does intentionally clear the old series while its new request is pending.

### Data format passed to the chart

`normalizeCandles` at `TradingChart.tsx:51-119` parses `open_time` through `toUnixSeconds`. It converts ISO strings and `Date`s to milliseconds and divides by 1,000; numeric millisecond values are likewise converted to seconds. It converts OHLC values using `Number(...)`, filters invalid rows, deduplicates by second-valued timestamp, then sorts ascending:

```ts
byTime.set(time, {
  time: time as Time,
  open: values[0],
  high: values[1],
  low: values[2],
  close: values[3],
});

const sorted = [...byTime.values()].sort(
  (a, b) => Number(a.time) - Number(b.time)
);
if (sorted.length < 2) return sorted;
```

The resulting `candles` array passed to `candleSeries.setData(candles)` (`:467, 477`) has this runtime shape:

```ts
[
  {
    time: 1793376000, // numeric Unix seconds; branded as UTCTimestamp for TypeScript
    open: 1.1000,     // number
    high: 1.1010,     // number
    low: 1.0990,      // number
    close: 1.1005,    // number
  },
  // further candles in ascending time order
]
```

The exact sample values are illustrative; the shape, numeric conversion, timestamp conversion, and ascending sort are implementation behavior. The API serializes `open_time` as an ISO string (`src/modules/pricing/services/pricingService.ts:72-80`), and the frontend normalization converts it before it reaches Lightweight Charts. If only one valid API candle remains after filtering/deduplication, the early return prevents synthetic gap filling, so Lightweight Charts receives one point and has little or no historical span to display.

The history request asks for up to 200 rows (`TradingChart.tsx:462-463`). The frontend service includes `source=live|demo` in the URL and defaults to `live` (`frontend/src/modules/trading/services/tradingService.ts:245-256`), but this call supplies only three arguments; in demo mode it therefore still requests live-source candle history. This does not itself collapse multiple bars into one, but it means demo history does not match the live demo tick stream.

### Live update path and gap candidates

`applyTick` uses `candleSeries.update(...)` for both in-progress and new candles, and `areaSeries.update(...)` for ticks (`TradingChart.tsx:171-237`); it does not call `setData([oneCandle])`. The update also calls:

```ts
areaSeries.update({ time: Number(time) as Time, value: tick.price });
chart?.timeScale().scrollToRealTime();
```

(`TradingChart.tsx:236-237`).

Potential reasons for a single visible candle or large empty gaps:

- **A one-row/low-row history response:** the chart’s data normalization retains one valid candle and performs no gap filling because of `if (sorted.length < 2) return sorted` (`:98-99`). A 200-row request is a maximum, not a guarantee of returned rows.
- **Capped gap synthesis:** `normalizeCandles` inserts flat candles only between available history rows and caps each gap at 100 inserted intervals (`:101-119`). Larger outages leave a remaining time gap.
- **Capped live gap synthesis:** when a live tick advances beyond the current candle, `applyTick` fills at most 50 missing intervals (`:207-230`). Any longer time outage can still appear as an empty chart span.
- **Timestamp deduplication:** `byTime` is keyed by integer seconds (`:73-99`), so duplicate candle opens that normalize to the same second overwrite earlier rows. Candle opens are expected to be granularity-aligned, but duplicate source/duplicate API records would be collapsed.
- **No chart-side evidence of “one candle setData” behavior:** the history effect sets the complete normalized array, and incremental data uses `update`. If the plotted history is genuinely one point, inspect the candle response, number of valid normalized rows, and timeframe/symbol request rather than attributing it to a per-tick `setData([oneCandle])`.

## 2. React chart lifecycle and configuration

### Render identity

The chart element at `frontend/src/pages/trading/TradingPage.tsx:169-176` has no `key` prop:

```tsx
<TradingChart
  symbol={selectedAsset?.symbol || 'EUR/USD'}
  priceHistory={priceHistory}
  currentPrice={currentPrice}
  activeContracts={activeContracts}
  pipDecimalPlaces={selectedAsset?.pipDecimalPlaces}
/>
```

Changing the symbol updates props and reruns the history effect; it does not force React to remount the chart through a changing key.

### Chart options and series options

The chart is created by a `useEffect(..., [])` in `TradingChart.tsx:259-360`. The relevant current options (`:262-292`) are:

```ts
rightPriceScale: {
  autoScale: true,
  mode: PriceScaleMode.Normal,
  alignLabels: true,
  borderVisible: false,
  scaleMargins: { top: 0.1, bottom: 0.1 },
},
timeScale: {
  timeVisible: true,
  barSpacing: window.innerWidth < 640 ? 16 : 10,
  rightOffset: 2,
},
crosshair: { mode: 1 },
```

The right scale options are also applied directly with `chart.priceScale('right').applyOptions(...)` (`:294-303`). The candle and area series are both added once and begin hidden (`:322-343`). Chart-type switching uses `series.applyOptions({ visible: ... })` (`:375-377`). Price precision changes use `applyOptions({ priceFormat })` for both series (`:380-393`).

There is **no** `autoscaleInfoProvider` and no production call to `timeScale().setVisibleRange(...)` or `setVisibleLogicalRange(...)` in the current chart component. The earlier manual `setVisibleLogicalRange` logic is absent. `scrollToRealTime()` is used after history load (`:494`) and after live updates (`:237`); `rightOffset: 2` leaves a small intentional right margin.

### Disposal

The chart-creation effect cleans up its `ResizeObserver`, removes tracked price lines, calls `chart.remove()`, and nulls chart/series refs (`TradingChart.tsx:355-360`). This is correct chart disposal; no evidence in this component indicates overlapping chart canvases from ordinary remounts.

## 3. “Disconnected” state and React binding

### Tick acceptance and connection updates

After symbol, price, and timestamp validation, `acceptTick` updates the current price, freshness timestamp, connection state, and latency state (`frontend/src/modules/trading/hooks/usePriceStream.ts:61-93`):

```ts
setCurrentPrice(liveTick.price);
setIsPriceAvailable(true);
setIsStale(false);
setQuoteUpdatedAt(now);
setIsConnected(true);
setLatencyState({ latencyMs: 0, status: 'connected', isConnected: true });
```

This runs for both WebSocket ticks and the initial REST quote, because `fetchLivePrice` calls the same `acceptTick` (`:108-136`). Therefore, `isConnected` is currently best understood as “a fresh accepted quote was observed recently” as well as being driven by the connection event; a REST quote can mark it true even when the socket itself is not verified connected.

### Effects that can set it false

The WebSocket initialization effect (`usePriceStream.ts:148-163`) calls `disconnect()` and sets false when unauthenticated or when no access token exists. Otherwise it initializes the socket:

```ts
useEffect(() => {
  if (!isAuthenticated) {
    websocketService.disconnect();
    setIsConnected(false);
    return;
  }
  const accessToken = apiClient.getAccessToken();
  if (!accessToken) {
    websocketService.disconnect();
    setIsConnected(false);
    return;
  }
  websocketService.initialize(accessToken);
}, [isAuthenticated, user?.id]);
```

This effect has no cleanup. The subscription effect (`:165-205`) also sets false when unauthenticated (`:165-168`) and in registered account-mode transition cleanup (`:183-197`). Its dependencies are `[acceptTick, accountMode, generation, isAuthenticated, registerModeCleanup, symbol, user?.id]` (`:205`); ordinary price renders do not retrigger it. A separate freshness timer sets false only in demo mode (`:208-216`), not for real mode.

The direct tick path sets both state values true. However, the connection callbacks can subsequently set both false. In particular, reinitializing the singleton closes the prior client; its asynchronous close handler can still call `onDisconnected` and notify the same service-level listeners after a replacement client has started. There is no client-generation token in `WebsocketService` to ignore late callbacks. This is a plausible stale-event race, especially during auth/user changes or React development Strict Mode effect replay; production logs are needed to confirm it.

### LatencyIndicator props

`TradingPage.tsx:110` passes both values:

```tsx
<LatencyIndicator latencyState={latencyState} isConnected={isConnected} />
```

`LatencyIndicator.tsx:9-14` prefers the explicit prop over `latencyState.isConnected`. Its disconnected branch at `:16-22` also treats `status === 'disconnected'` as authoritative even when the explicit `isConnected` prop is true. Therefore, a stale latency status can still render the disconnected label despite a true prop; normal `acceptTick` updates both fields, but a delayed latency/connection callback can reintroduce a mismatch.

## 4. WebSocket connection count and duplication

Frontend search found one direct `new WebSocket(...)` call: `frontend/src/shared/ws/websocketClient.ts:61`. `WebsocketService.initialize` constructs a `WebSocketClient` at `frontend/src/modules/trading/services/websocketService.ts:21-56`; the only call site found in the trading page flow is `usePriceStream.ts:161`. `TradingPage.tsx` does not independently initialize or connect a second socket.

`WebsocketService.initialize` first disconnects an existing client if present (`websocketService.ts:21-23`), so repeated initialization is intended to replace the prior client rather than keep it. Nevertheless:

- The hook’s initialization effect has no cleanup (`usePriceStream.ts:148-163`). Development Strict Mode may replay the effect setup, and authentication/user ID changes also rerun it. These calls can close an old socket asynchronously while a new client is being brought up.
- `WebSocketClient.handleClose` invokes the old client’s `onDisconnected` callback (`websocketClient.ts:178-189`). The callback mutates the singleton state without identifying which client emitted it, creating the stale-state race described above.
- The client stores subscriptions in an array (`websocketClient.ts:83-89`) and resends them on reconnect (`:127-135`); `WebsocketService.onConnected` also subscribes its current symbol (`websocketService.ts:36-45`). This is a duplicate-subscription risk, not evidence of multiple simultaneous sockets.

No evidence was found for one WebSocket initialized in `TradingPage` and another in `usePriceStream`. Multiple connections remain possible if multiple independent hook consumers mount or initialization is replayed, but the observed page contains a single hook call (`TradingPage.tsx:34-35`).

## Conclusion

The React chart effect and `setData` usage do not support the theory that each tick wipes the chart. The array passed to Lightweight Charts is normalized numeric OHLC with Unix-second timestamps and ascending order; a single-candle display can result if the API provides only one valid row, or if most records are filtered/deduplicated. Gap insertion is explicitly capped, which can preserve large time gaps after outages.

The badge receives the parent’s `isConnected` value correctly, and accepted ticks set both connection fields true. The main state risk is that `acceptTick` also treats REST quotes as proof of socket connectivity, while stale callbacks from a replaced WebSocket client can later set connection and latency state false. There is only one direct socket construction site; multiple active clients are a lifecycle/reinitialization possibility, not established as the normal page behavior.

REACT & CHART LIFECYCLE AUDIT COMPLETE — NO SOURCE CHANGES MADE
