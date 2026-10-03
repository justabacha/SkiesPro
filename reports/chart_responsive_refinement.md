# Responsive Trading Chart Refinement Report

## Changes delivered

- Kept the chart pane clear by setting `layout.attributionLogo: false` and removing the TradingView link from `TradingChart`. The attribution link is outside the chart card in `TradingPage`.
- Applied the requested emerald area gradient (`#00E676`, 2px line, `rgba(0, 230, 118, 0.45)` to transparent) and bullish/bearish candle and wick colors (`#00E676` / `#FF5252`).
- Configured the right price scale for normal-mode autoscaling with 20% top and bottom margins.
- Kept a `ResizeObserver` on the chart canvas. Resizes update chart width and height, use `barSpacing: 16` and a ~20-bar recent range below 640px, and use `barSpacing: 10` and a ~40-bar range at larger widths. Both layouts reserve a 10-bar right offset.
- Preserved incremental `series.update()` for live candles and area points.
- Made the trading page explicitly stack its chart and order form in a mobile flex column, switch to a three-column desktop grid, constrain nested content against overflow, and allow chart controls and position tabs to scroll horizontally on narrow screens.

## Updated files

| File | Main changes |
|---|---|
| `frontend/src/modules/trading/components/TradingChart.tsx` | Chart colors, clean pane, autoscale margins, responsive resize/viewport behavior, and mobile-scrollable controls. |
| `frontend/src/pages/trading/TradingPage.tsx` | Responsive page spacing and chart/order layout, scrollable bottom tabs, and chart-library attribution outside the chart card. |
| `reports/chart_responsive_refinement.md` | This report. |

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` in `frontend` | Passed. |
| `npm run build` in `frontend` | Passed. Vite emitted the existing advisory that the minified JavaScript bundle exceeds 500 kB (733.53 kB). |
| ESLint on the two modified components | Passed with no warnings. |
| `git diff --check` | Passed. |
