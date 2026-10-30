# Trading Engine Fix — Phase 4C: Chart Visuals & React State

## Metadata

- **Date:** 2026-10-30
- **Scope:** Frontend chart scaling/follow behavior, WebSocket connectivity state synchronization, and active-contract pill placement.
- **Status:** Implemented; frontend build and focused UI tests passed.
- **Files changed:** `TradingChart.tsx`, `usePriceStream.ts`, `websocketService.ts`, `trading.types.ts`, `LatencyIndicator.tsx`, and the focused chart UI test mock.

## 1. Chart scale and candle borders

In `frontend/src/modules/trading/components/TradingChart.tsx:273-303`, the `createChart` right scale margins were reduced from 20% to 10%; `autoScale: true` remains enabled. The follow-up `priceScale('right').applyOptions` uses the same margins:

```ts
rightPriceScale: {
  autoScale: true,
  // ...
  scaleMargins: {
    top: 0.1,
    bottom: 0.1,
  },
},
```

In the same file at `:322-330`, candle borders are enabled and match the candle body colors:

```ts
upColor: '#00E676',
downColor: '#FF5252',
borderVisible: true,
borderUpColor: '#00E676',
borderDownColor: '#FF5252',
wickUpColor: '#00E676',
wickDownColor: '#FF5252',
```

## 2. Chart right-edge follow

Removed the history loader’s manual `setVisibleLogicalRange(...)` range, which forced a fixed viewport and right-side gap. `applyTick` now scrolls to the real-time edge after applying both candle and area updates (`TradingChart.tsx:233-237`):

```ts
areaSeries.update({ time: Number(time) as Time, value: tick.price });
chart?.timeScale().scrollToRealTime();
```

History load retains its optional one-time `scrollToRealTime()` call after data is set (`TradingChart.tsx:494`).

## 3. WebSocket React state synchronization

When the WebSocket connects, `frontend/src/modules/trading/services/websocketService.ts:36-40` notifies both connection and latency listeners immediately:

```ts
this.isConnected = true;
this.notifyConnectionState(true);
this.notifyLatency({ latencyMs: 0, status: 'connected', isConnected: true });
```

The connection listener in `frontend/src/modules/trading/hooks/usePriceStream.ts:174-180` synchronizes both React states:

```ts
const unsubscribeConn = websocketService.onConnectionStateChange((connected) => {
  setIsConnected(connected);
  setLatencyState({
    latencyMs: 0,
    status: connected ? 'connected' : 'disconnected',
    isConnected: connected,
  });
});
```

Every valid accepted tick also marks the feed connected (`usePriceStream.ts:89-90`):

```ts
setIsConnected(true);
setLatencyState({ latencyMs: 0, status: 'connected', isConnected: true });
```

Added `connected` to `LatencyStatus` and rendered it as a green “Connected” state in `LatencyIndicator.tsx`, so the badge displays the synchronized state instead of falling through to its poor-latency style.

## 4. Active contract pill placement

Moved the pill out of the bottom-axis flex row and positioned it at the chart’s top-left with a `z-10` stacking level and opaque green/red backgrounds (`TradingChart.tsx:633-642`):

```tsx
className={`pointer-events-auto absolute left-2 top-2 z-10 ... text-white ... ${
  isWinning ? 'bg-emerald-700' : 'bg-rose-700'
}`}
```

The spot price remains in a separate bottom-right overlay.

## 5. Validation

- **Frontend build:** `npm.cmd run build` — passed; TypeScript check and Vite production build completed. Vite emitted a non-fatal warning that the minified JavaScript chunk is larger than 500 kB.
- **Focused tests:** `npm.cmd run test:ui -- src/tests/trading/OrderFormAndChart.test.tsx` — passed; 1 test file, 6 tests.
- **Diff check:** `git diff --check` — passed.
- **Test fixture:** Updated the Lightweight Charts mock to provide `scrollToRealTime()`.

TRADING PHASE 4C FIX COMPLETE — AWAITING GATE PASS
