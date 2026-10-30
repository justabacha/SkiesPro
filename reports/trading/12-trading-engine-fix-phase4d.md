# Trading Engine Fix — Phase 4D: React Race Conditions & Chart Fallbacks

## Metadata

- **Date:** 2026-10-30
- **Scope:** WebSocket teardown race protection, sparse candle history fallback, and chart right-edge following.
- **Status:** Implemented; frontend build, focused tests, and targeted lint passed.
- **Files changed:** `TradingChart.tsx`, `usePriceStream.ts`, `websocketService.ts`, `websocketClient.ts`, and `OrderFormAndChart.test.tsx`.

## 1. WebSocket React race cleanup

The WebSocket initialization effect in `frontend/src/modules/trading/hooks/usePriceStream.ts:148-164` now disconnects the service during cleanup:

```ts
websocketService.initialize(accessToken);
return () => {
  websocketService.disconnect();
};
```

In `frontend/src/modules/trading/services/websocketService.ts:33-68`, callbacks are scoped to the client instance that created them. A late callback from a replaced client is ignored:

```ts
const client = new WebSocketClient({
  // ...
  onDisconnected: () => {
    if (this.client !== client) return;
    this.isConnected = false;
    // ...
  },
  // ...
});

this.client = client;
client.connect();
```

`websocketService.disconnect()` nulls the active client reference before disconnecting it and publishes a disconnected state to active listeners (`websocketService.ts:149-163`). The underlying `WebSocketClient.disconnect()` also clears its socket event handlers before closing, preventing an intentional teardown from invoking its old `onDisconnected` handler (`frontend/src/shared/ws/websocketClient.ts:73-87`):

```ts
const ws = this.ws;
this.ws = null;
ws.onopen = null;
ws.onmessage = null;
ws.onerror = null;
ws.onclose = null;
ws.close(1000, 'Normal closure');
```

## 2. Sparse candle fallback

`frontend/src/modules/trading/components/TradingChart.tsx:70-78` now has a helper that generates flat candles at the requested timeframe spacing:

```ts
const createFlatHistory = (
  anchorTime: number,
  price: number,
  count: number,
  step: number
) =>
  Array.from({ length: count }, (_, index) => {
    const time = (anchorTime - (count - index) * step) as Time;
    return { time, open: price, high: price, low: price, close: price };
  });
```

`normalizeCandles` (`TradingChart.tsx:81-130`) no longer returns early for fewer than two candles. For a non-empty history with fewer than 50 valid bars, it prepends 100 synthetic bars based on the earliest real candle’s open price (`:126-127`). With no valid history, a positive current price seeds 100 prior bars plus a current anchor candle (`:113-124`). The loader passes the latest rendered quote through a ref so this fallback does not add `currentPrice` to the history effect dependencies (`:197-200, 508`).

If history is empty and no quote was available when the request completed, the first valid tick seeds 100 prior flat candles before applying the live candle update (`TradingChart.tsx:227-238`).

These are **visual chart placeholders**, not persisted candles or independently observed market history; each generated OHLC value is flat at the selected anchor price.

## 3. Right-edge following

The chart `timeScale` configuration now includes `shiftVisibleRangeOnNewBar: true` (`TradingChart.tsx:325-331`):

```ts
timeScale: {
  borderColor: 'rgba(148, 163, 184, 0.2)',
  timeVisible: true,
  barSpacing: window.innerWidth < 640 ? 16 : 10,
  rightOffset: 2,
  shiftVisibleRangeOnNewBar: true,
},
```

`applyTick` continues to scroll after applying live series updates (`TradingChart.tsx:276-277`):

```ts
areaSeries.update({ time: Number(time) as Time, value: tick.price });
chart?.timeScale().scrollToRealTime();
```

No manual `setVisibleLogicalRange(...)` fallback was added; the requested shift option and real-time scrolling are both active.

## 4. Validation

- **Frontend build:** `npm.cmd run build` — passed; TypeScript check completed and Vite transformed 1,847 modules. Output chunks: `index.html` 1.08 kB, CSS 54.68 kB, JS 946.34 kB (267.31 kB gzip). Vite emitted a non-fatal warning that the JavaScript chunk exceeds 500 kB after minification.
- **Focused UI tests:** `npm.cmd run test:ui -- src/tests/trading/OrderFormAndChart.test.tsx` — passed; 1 test file, 8 tests. Added coverage for both empty history and a single-candle API response.
- **Targeted lint:** ESLint on all five modified frontend files with `--max-warnings 0` — passed.
- **Diff check:** `git diff --check` — passed.

TRADING PHASE 4D FIX COMPLETE — AWAITING GATE PASS
