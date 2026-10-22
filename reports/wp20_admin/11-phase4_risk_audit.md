# WP-20 Phase 4 Audit: Risk Dashboard (`/admin/risk`)

## Status
Read-Only Audit Completed

---

## 1. Executive Summary
The Risk Dashboard (`/admin/risk`) provides risk managers and administrators with real-time visibility into open positions, total payout liability, volume metrics, and symbol-level exposure. It is successfully wired to backend endpoints (`/api/v1/admin/risk/...`) and enforces MFA step-up security for asset configuration updates.

### Top 3 Gaps:
1. **Missing Shared UI States**: The asset exposure table does not utilize `TableLoading` or `TableEmpty` components, rendering an empty table body when no risk exposure data is returned.
2. **Hardcoded / Stubbed Metrics**: `adminApiClient.ts` synthesizes fallback metric values (`platform_win_loss_ratio: 0.5`, `active_traders_24h: 0`, `high_risk_flagged_users: 0`) because the backend `getRiskDashboard()` query only computes open contracts, settled contracts, and total exposure.
3. **Database Column Mismatches in Asset Configuration**: The frontend asset config modal and API client submit `max_stake` and `is_active`, whereas the backend SQL query in `AdminRepository.updateAssetConfig` updates `max_stake_per_trade` and does not persist `is_active`.

---

## 2. Page & Route Map (A)
1. **Frontend Route**: Defined in `frontend/src/routes/adminRoutes.tsx` at path `risk` under `AdminProtectedRoute` allowing roles `['risk_manager', 'admin', 'super_admin']`.
2. **Main Page Component**: `RiskDashboardPage.tsx` (`frontend/src/pages/admin/RiskDashboardPage.tsx`).
3. **Sub-components**: `AssetConfigModal`, `MfaStepUpModal`, Lucide icons (`TrendingUp`, `RefreshCw`, `Sliders`, `AlertCircle`).

---

## 3. Data Wiring Findings (B)
4. **Live Endpoints**:
   - `GET /api/v1/admin/risk/dashboard`
   - `GET /api/v1/admin/risk/exposure`
   - `PUT /api/v1/admin/risk/asset-config/:symbol`
5. **Mock/Stub Data**: Win/loss ratio, active traders, and high-risk flagged users are hardcoded defaults in `adminApiClient.ts`.
6. **Type Mapping & Backend Query Gaps**:
   - Frontend `max_stake` maps to backend `max_stake_per_trade`.
   - `is_active` sent from frontend modal is ignored by backend `UPDATE trading.asset_config` query.

---

## 4. UI/UX Findings (C)
8. **Shared Components**: Does not use `TableLoading` or `TableEmpty`.
9. **Empty State**: Renders an empty table if `exposures` array is empty.
10. **Loading State**: Refresh button spins during fetch, but no skeleton table loader is displayed.
11. **Error State**: Displays an error banner at the top, but lacks an inline retry button.

---

## 5. Logic & Actions Findings (D)
12. **Admin Actions**: Asset parameter tuning (payout rate, min/max stake limits) protected by MFA step-up modal (`MfaStepUpModal`).
13. **Unwired Buttons**: None; "Refresh Exposure" and "Configure" are fully wired.
14. **Form Validation**: Validates payout rate (50-95%) and min stake < max stake before triggering MFA.
15. **Raw Database Strings**: Cleanly formatted labels are rendered.

---

## 6. Edge Cases & Formatting (E)
16. **Refresh**: Manual refresh button via `fetchRiskData()`.
17. **Formatting**: Uses `safeFormatNumber` for currency/volumes.
18. **Dates/Numbers**: Properly formatted.
19. **Null Safety**: Uses `COALESCE` in SQL and optional chaining on frontend.

---

## 7. Impact Map
- `src/modules/admin/repositories/AdminRepository.ts` (Enhance `getRiskDashboard` metrics and `updateAssetConfig` column persistence).
- `frontend/src/services/admin/adminApiClient.ts` (Align risk metrics and asset config payload properties).
- `frontend/src/pages/admin/RiskDashboardPage.tsx` (Integrate `TableLoading` and `TableEmpty`).

---

## 8. Recommended Fix Scope
1. Expand backend `getRiskDashboard` and frontend exposure aggregation to compute actual platform win/loss ratios and active traders rather than hardcoded fallbacks.
2. Update backend `updateAssetConfig` SQL query to support `is_active` status and match column names (`max_stake` vs `max_stake_per_trade`).
3. Refactor `RiskDashboardPage.tsx` to use `TableLoading` and `TableEmpty` for polished UX.
