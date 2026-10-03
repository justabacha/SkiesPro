# SKIESPRO SYSTEM INTEGRITY & DIAGNOSTIC AUDIT REPORT

**Date:** March 2025  
**Scope:** Frontend Auth Lifecycle, Unauthenticated Polling, Candlestick Chart Anomalies, Trading State Persistence, Server Health & Circuit Breaker  
**Status:** Audit Completed – Awaiting Confirmation for Application

---

## EXECUTIVE SUMMARY
This audit evaluated four critical subsystems of the SkiesPro trading platform:
1. **Unauthenticated Polling & 401 Cascade:** Identified in-memory JWT volatility coupled with unhandled 401 responses in polling loops in `useWallet` and `useTrading`.
2. **Candlestick Chart & Active Trade Anomalies:** Discovered cross-asset scale corruption in chart min/max scaling due to unfiltered active contracts, symbol transition fallback pollution, hardcoded pip decimal places, and unpersisted chart settings.
3. **Trading State Persistence & UI Integrity:** Confirmed lack of `localStorage` / URL parameter persistence for stake amounts, selected asset symbols, and chart view preferences across page reloads.
4. **Server Health & Circuit Breaker Audit:** Resolved root cause for Render container 404 logs (`HEAD /` and `GET /`) and detailed circuit breaker protection to block real-money trades when price feeds degrade to Tier 3 (Mock).

---

## SECTION 1: UNAUTHENTICATED POLLING & 401 CASCADE AUDIT

### Symptoms
Production logs display continuous 401 Unauthorized responses for `GET /contracts`, `GET /contracts/active`, and `GET /balance` even after public route updates.

### Affected Files & Line Numbers
- `frontend/src/shared/services/apiClient.ts` (Lines 31-72)
- `frontend/src/shared/context/AuthContext.tsx` (Lines 70-87, 178-193)
- `frontend/src/shared/hooks/useWallet.ts` (Lines 43-52, 109-120)
- `frontend/src/modules/trading/hooks/useTrading.ts` (Lines 115-177, 190-210)
- `src/modules/wallet/wallet.routes.ts` (Lines 11-17)
- `src/modules/trading/trading.routes.ts` (Lines 22-26)
- `src/infrastructure/routes.ts` (Lines 25-28)

### Root Cause Analysis
1. **In-Memory Token Wiping on Refresh:** In `apiClient.ts`, the access token (`this.accessToken`) is held strictly in memory. On page refresh, memory is cleared. `AuthContext.tsx` initializes `isLoading: true` and calls `refresh()`. Until `refresh()` finishes, `apiClient` has no bearer token.
2. **Unstopped Polling Intervals on Auth Failure:**
   - In `useWallet.ts` (line 114): `useEffect` initiates a 30-second polling interval `setInterval(fetchBalance, 30000)`.
   - In `useTrading.ts` (line 204): `useEffect` initiates a 3-second polling interval `setInterval(...)` for active contracts and history.
   - When a request returns `401 Unauthorized`, `apiClient` throws an `Error('Unauthorized')`. The catch blocks in `useWallet` and `useTrading` capture the error in local component state (`setError`), but **do not stop or cancel the polling interval** and **do not notify `AuthContext` to transition `isAuthenticated` to `false`**.
   - As a result, when an access token expires after 15 minutes or when a user's session becomes invalid, the interval timers continue executing every 3s and 30s indefinitely, streaming hundreds of 401 requests into the backend logs.
3. **Missing HTTP 401 Interceptor in `apiClient`:** `apiClient.ts` does not intercept 401 response statuses to automatically trigger a token refresh attempt or clear the invalidated auth state.

### Proposed Surgical Remedies
1. **401 Interceptor / Auth Callback in `apiClient.ts`:** Register an unauthorized callback handler in `apiClient` that alerts `AuthContext` when a 401 response occurs so `isAuthenticated` can be reset to `false` and invalid tokens purged.
2. **Interval Teardown on 401 in Hooks:** Update `fetchBalance`, `fetchActiveContracts`, and `fetchTradeHistory` in `useWallet.ts` and `useTrading.ts` to clear active polling intervals if a 401 error is caught.
3. **Verify Route Consistency:** Confirm path alignments:
   - Client: `GET /api/v1/wallets/balance` -> Backend: `router.use('/api/v1/wallets', walletRoutes)` -> `router.get('/balance')`.
   - Client: `GET /api/v1/trading/contracts/active` -> Backend: `router.use('/api/v1/trading', tradingRoutes)` -> `router.get('/contracts/active')`.

---

## SECTION 2: CANDLESTICK CHART BEHAVIOR & ACTIVE TRADE ANOMALIES

### Symptoms
- **Symptom A:** When a trade is active, new candles freeze/flatten into a straight horizontal line at the bottom of the chart.
- **Symptom B:** Switching symbols (e.g. EUR/USD to BTC/USD) results in distorted, huge, or weirdly spaced candle bars.
- **Symptom C:** Changing chart view types (e.g. Area line to Candlesticks) resets to default upon browser refresh.

### Affected Files & Line Numbers
- `frontend/src/modules/trading/components/TradingChart.tsx` (Lines 80-82, 100-120, 140-169, 208-231, 233)
- `frontend/src/modules/trading/hooks/usePriceStream.ts` (Lines 35-75, 115-135)
- `frontend/src/pages/trading/TradingPage.tsx` (Lines 20-35, 130-140)

### Root Cause Analysis
1. **Symptom A (Active Trade Candle Flattening):**
   - In `TradingChart.tsx` (lines 140-169), the min/max price range computation iterates over `activeContracts`:
     ```ts
     if (activeContracts.length > 0) {
       const strike = parseFloat(activeContracts[activeContracts.length - 1].strike_price);
       ...
     }
     ```
   - `activeContracts` contains **all** active user trades regardless of asset. If a user holds an active contract on **BTC/USD** (strike 60,000) or **Gold** (strike 2,345) and switches view to **EUR/USD** (price ~1.0850), `maxPrice` scales to 60,000 while EUR/USD prices remain ~1.0850.
   - On the 320px SVG canvas height, `y = 320 - ((1.0850 - 1.0850) / 59998.915) * 320` evaluates to `y ≈ 320`. Every EUR/USD candle flattens into a 1px flat line stuck at the bottom of the canvas.
   - Furthermore, `activeContractDetails` (lines 208-231) checks `activeContracts[activeContracts.length - 1]` without filtering for `c.asset_symbol === symbol`, rendering strike lines for foreign assets.
2. **Symptom B (Symbol Switching Distortion):**
   - In `usePriceStream.ts` (lines 35-75), switching symbols re-seeds `priceHistory`. However, `currentPrice` or `priceHistory` can briefly retain ticks from the previous symbol during component re-render.
   - In `TradingChart.tsx` (lines 100-120), when switching symbols, `tradingService.getCandles()` executes asynchronously. Before remote candles arrive or if the server returns an empty list, `generateFallbackCandles(displayedHistory, granularity, currentPrice, symbol)` is called.
   - If `displayedHistory` contains ticks from EUR/USD (~1.085) and `currentPrice` has updated to BTC (60,000), fallback candle synthesis computes open=1.085 and close=60,000, creating giant vertical block distortion.
   - In addition, line 233 hardcodes `const pipPlaces = currentPrice > 100 ? 2 : 5;` instead of consuming `asset.pipDecimalPlaces` from metadata.
3. **Symptom C (Chart Preferences Reset):**
   - In `TradingChart.tsx` (lines 80-82), `chartType` (`'line'` | `'candle'`) and `selectedTimeframe` (`'1m'`) are stored in temporary React `useState` without reading or writing to `localStorage`.

### Proposed Surgical Remedies
1. **Filter Active Contracts by Symbol:** In `TradingChart.tsx`, filter `activeContracts` by `symbol` (`c.asset_symbol === symbol`) before computing chart min/max bounds and active contract strike overlays.
2. **Sanitize Symbol Transitions & Fallback Data:**
   - Clear local `candles` state immediately when `symbol` or `granularity` changes.
   - Ensure `generateFallbackCandles` filters history ticks to only include ticks where `t.symbol === symbol`.
   - Pass `asset.pipDecimalPlaces` as a prop into `TradingChart` to dynamically format prices.
3. **Persist Chart Settings:** Save `chartType` and `selectedTimeframe` to `localStorage` (keys: `skies_chart_type`, `skies_timeframe`) upon user selection and read them during state initialization.

---

## SECTION 3: TRADING STATE PERSISTENCE & UI INTEGRITY

### Symptoms
- **Symptom A:** Stake amount resets to default ($100 / KES 100) on page refresh instead of persisting the user's previous selection (e.g., $500).
- **Symptom B:** Active selected symbol and chart preferences reset to default on page refresh.

### Affected Files & Line Numbers
- `frontend/src/modules/trading/components/OrderForm.tsx` (Lines 20-22)
- `frontend/src/modules/trading/hooks/useTrading.ts` (Lines 62, 100-113)
- `frontend/src/pages/trading/TradingPage.tsx` (Lines 18-35)
- `frontend/src/modules/trading/components/TradingChart.tsx` (Lines 80-82)

### Root Cause Analysis
1. **OrderForm Stake Isolation:** In `OrderForm.tsx` (line 21), `stake` is initialized to `'100'` (`const [stake, setStake] = useState<string>('100');`) and `expirySeconds` to `60`. When the user edits the input or clicks quick stake buttons (+250, +500), state updates in memory only. Page refresh resets state back to `'100'`.
2. **Trading Terminal Symbol Isolation:** In `TradingPage.tsx` (line 22) and `useTrading.ts` (line 62), initial symbol defaults to hardcoded `'EUR/USD'`. Asset selection (`handleSelectAsset`) updates in-memory React state without writing to `localStorage` or updating URL search params (`?symbol=...`).

### Proposed Surgical Remedies
1. **Persist Order Form Configuration:**
   - Initialize `stake` and `expirySeconds` in `OrderForm.tsx` from `localStorage` (`skies_trade_stake`, `skies_trade_expiry`), falling back to `'100'` and `60`.
   - Add `useEffect` triggers in `OrderForm.tsx` to write changes back to `localStorage`.
2. **Persist Selected Asset Symbol:**
   - In `TradingPage.tsx` / `useTrading.ts`, initialize symbol from URL query parameter `?symbol=...` or `localStorage.getItem('skies_selected_symbol')`, defaulting to `'EUR/USD'`.
   - On asset selection, update `localStorage` and sync URL query parameters via `window.history.replaceState`.

---

## SECTION 4: SERVER HEALTH & CIRCUIT BREAKER AUDIT

### Symptoms & Mandates
1. Render container health check logs report 404 errors for `HEAD /` and `GET /`.
2. Evaluate order placement logic in `tradingService.ts` to block real-money trades during Tier 3 (Mock) feeds without breaking Demo mode.

### Affected Files & Line Numbers
- `src/infrastructure/routes.ts` (Lines 10-15)
- `src/index.ts` (Lines 48-55)
- `src/modules/trading/services/tradingService.ts` (Lines 30-80)
- `src/modules/pricing/services/PriceFeedIngestionService.ts` (Lines 11-13)

### Root Cause Analysis & Circuit Breaker Design
1. **Root Path 404s on Container Probes:** In `src/infrastructure/routes.ts`, routes `/health` and `/ready` are registered, but root path `/` is absent. Platform container monitoring tools issue `HEAD /` or `GET /` probes, which hit the global 404 middleware in `src/index.ts` (lines 50-55).
2. **Circuit Breaker Gap During Tier 3 Mock Ingestion:**
   - `PriceFeedIngestionService.ts` maintains static state `PriceFeedIngestionService.currentTier` (`'tier1_kraken'` | `'tier2_coinbase'` | `'tier3_mock'`).
   - In `tradingService.ts` (`placeTrade`), the 10-step validation chain checks user status, self-exclusion, market hours, limits, and tick age, but **never checks feed tier status**.
   - If external feeds drop and the system fails over to Tier 3 Mock, synthetic prices are distributed. Allowing live trades against mock prices introduces extreme financial exposure and compliance violations.

### Proposed Surgical Remedies
1. **Add Root Health Endpoints:** Register `router.get('/', ...)` and `router.head('/', ...)` in `src/infrastructure/routes.ts` returning `200 OK` with JSON `{ status: 'ok', service: 'SkiesPro API' }`.
2. **Implement Real-Money Circuit Breaker in `placeTrade`:**
   - In `tradingService.ts` `placeTrade`, inspect `PriceFeedIngestionService.currentTier`.
   - If `PriceFeedIngestionService.currentTier === 'tier3_mock'` and user account/trade is non-demo (live real-money trade), abort order placement with error:
     `'Trading is temporarily suspended due to live price feed degradation. Please try again shortly.'`
   - Allow demo/practice trades to continue executing seamlessly during Tier 3 mock mode.

---

## SUMMARY OF AFFECTED FILES & PROPOSED CHANGES

| Section | File Path | Impacted Component / Function | Proposed Surgical Remedy |
| :--- | :--- | :--- | :--- |
| **Section 1** | `frontend/src/shared/services/apiClient.ts` | `ApiClient.request` | Add 401 callback listener to purge stale tokens and notify AuthContext |
| **Section 1** | `frontend/src/shared/hooks/useWallet.ts` | `useWallet` / `fetchBalance` | Stop 30s polling interval if 401 error occurs |
| **Section 1** | `frontend/src/modules/trading/hooks/useTrading.ts` | `useTrading` / `fetchActiveContracts` | Stop 3s polling interval if 401 error occurs |
| **Section 2** | `frontend/src/modules/trading/components/TradingChart.tsx` | `minPrice`, `maxPrice`, `activeContractDetails` | Filter `activeContracts` by `c.asset_symbol === symbol` |
| **Section 2** | `frontend/src/modules/trading/components/TradingChart.tsx` | `generateFallbackCandles` / `useEffect` | Sanitize transition fallback data & flush stale candles on symbol switch |
| **Section 2** | `frontend/src/modules/trading/components/TradingChart.tsx` | `chartType`, `selectedTimeframe` | Read/write state from/to `localStorage` |
| **Section 3** | `frontend/src/modules/trading/components/OrderForm.tsx` | `stake`, `expirySeconds` | Read/write stake and duration from/to `localStorage` |
| **Section 3** | `frontend/src/pages/trading/TradingPage.tsx` | `handleSelectAsset` | Sync selected symbol to URL query params and `localStorage` |
| **Section 4** | `src/infrastructure/routes.ts` | Root route definitions | Register `GET /` and `HEAD /` 200 OK handlers for container health checks |
| **Section 4** | `src/modules/trading/services/tradingService.ts` | `TradingService.placeTrade` | Reject real-money orders when `PriceFeedIngestionService.currentTier === 'tier3_mock'` |

---
*End of Report.*
