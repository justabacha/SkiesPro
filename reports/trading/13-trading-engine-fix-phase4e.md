# Trading Engine Fix — Phase 4E: Chart Bucketing & Latency

**Date:** October 30, 2026  
**Phase:** 4E  
**Scope:** Candle timeframe bucketing, chart auto-scroll options, and latency badge display  
**Files changed:** `frontend/src/modules/trading/components/TradingChart.tsx`, `frontend/src/modules/trading/components/LatencyIndicator.tsx`  
**Status:** Implemented and locally verified

## 1. Candle Time Bucketing

In `frontend/src/modules/trading/components/TradingChart.tsx`, ticks are bucketed to the selected timeframe's (`granularity`) boundary for candle updates. The area series continues to use the original tick timestamp:

```ts
const seconds = toUnixSeconds(tick.tick_time || tick.timestamp);
if (seconds === null) return;

const rawSeconds = seconds;
const candleStart = (Math.floor(rawSeconds / granularity) * granularity) as Time;
```

```ts
candleSeries.update(next);
areaSeries.update({ time: rawSeconds as Time, value: tick.price });
chart?.timeScale().scrollToRealTime();
```

## 2. Chart Auto-Scroll and Viewport

The chart disables automatic visible-range shifting for new bars and uses the requested bar spacing and right offset. The responsive viewport applies the same spacing and offset:

```ts
timeScale: {
  borderColor: 'rgba(148, 163, 184, 0.2)',
  timeVisible: true,
  barSpacing: 10,
  rightOffset: 5,
  shiftVisibleRangeOnNewBar: false,
},
```

The `applyTick()` scroll remains the live-update path. A separate `scrollToRealTime()` call remains after initial history is loaded to position the initial dataset, including when there are no pending live ticks.

## 3. Latency Badge Display

In `frontend/src/modules/trading/components/LatencyIndicator.tsx`, a connected state displays measured positive latency; zero latency displays the connected fallback. Both connected states use the green badge and dot:

```ts
if (!isConnected) {
  return {
    label: 'Disconnected',
    colorClass: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
    dotClass: 'bg-gray-400',
  };
}

return {
  label: latencyMs > 0 ? `${latencyMs} ms` : 'Connected',
  colorClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  dotClass: 'bg-emerald-400 animate-pulse',
};
```

## Validation

`cd frontend && npm run build` completed successfully:

```text
> skiespro-frontend@1.0.0 build
> tsc && vite build

vite v5.4.21 building for production...
✓ 1847 modules transformed.
dist/index.html                   1.08 kB │ gzip:   0.57 kB
dist/assets/index-C5-aYfUC.css   54.50 kB │ gzip:   9.82 kB
dist/assets/index-CiN8zeX4.js   945.89 kB │ gzip: 267.23 kB
✓ built in 14.09s
```

Vite emitted a non-blocking warning that the minified JS chunk exceeds 500 kB. The focused chart UI tests passed: **1 test file, 8 tests**. ESLint reported no issues in the two modified components.

TRADING PHASE 4E FIX COMPLETE — AWAITING GATE PASS..
