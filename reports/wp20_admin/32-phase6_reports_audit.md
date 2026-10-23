# WP-20 Phase 6 Audit: Reports & Analytics Dashboard (`/admin/reports`)

## Status
Read-Only Audit Completed

---

## 1. Executive Summary
The Reports & Analytics dashboard (`/admin/reports`) visualizes business metrics including daily revenue, trade volume, user registrations, and settlement latency. However, it contains a critical schema drift bug in the backend repository and lacks controller error handling and UI export functionality.

### Top 3 Gaps:
1. **Critical Schema Drift (`stake_amount`)**: `AdminRepository.getReports` queries `SUM(stake_amount)` from `trading.binary_contracts`. Because Migration 022 renamed `stake_amount` to `stake`, trade volume reports will throw a PostgreSQL column error (`42703`).
2. **Missing Controller Exception Handling**: `AdminController` report methods (`getDailyRevenue`, `getTradeVolume`, `getUserRegistrations`, `getSettlementPerformance`) lack `try/catch` blocks, meaning database errors will cause request sockets to hang indefinitely.
3. **Missing UI States & Export Controls**: The analytics view lacks dedicated loading skeleton components, advanced date range pickers, and fully wired CSV/PDF export buttons.

---

## 2. Page & Route Map (A)
1. **Frontend Route**: Defined in `frontend/src/routes/adminRoutes.tsx` at path `reports` under `AdminProtectedRoute` allowing roles `['finance', 'admin', 'super_admin']`.
2. **Backend Endpoints**: Registered in `src/modules/admin/admin.routes.ts`:
   - `GET /api/v1/admin/reports/daily-revenue`
   - `GET /api/v1/admin/reports/trade-volume`
   - `GET /api/v1/admin/reports/user-registrations`
   - `GET /api/v1/admin/reports/settlement-performance`
3. **Main Page Component**: `ReportsDashboardPage.tsx` (`frontend/src/pages/admin/ReportsDashboardPage.tsx`).
4. **Hook**: `useAdminReports.ts` (`frontend/src/hooks/admin/useAdminReports.ts`).

---

## 3. Data Wiring Findings (B)
- **Live Endpoints**: Wired to backend report endpoints.
- **Mock Data**: None; fetches live JSON data arrays.
- **SQL Schema Drift Bug**: `AdminRepository.getReports` references `stake_amount` instead of `stake` in `trading.binary_contracts`.
- **Date Aggregation**: Uses `DATE(created_at)` grouping ordered by day descending.

---

## 4. Controller Error Handling (C)
- **Controller Methods**: `getDailyRevenue`, `getTradeVolume`, `getUserRegistrations`, `getSettlementPerformance` in `AdminController.ts`.
- **Missing Try/Catch**: None of these 4 methods have `try/catch` error handling. If a database query fails, the promise rejects unhandled, hanging the client socket.

---

## 5. UI/UX Findings (D)
- **Loading State**: Uses a spin animation on the "Refresh Metrics" button during fetch, but no full-page skeleton loader.
- **Empty State**: Renders basic "No data reported." text when data arrays are empty.
- **Date Filtering & Export**: Lacks a date range picker and CSV/PDF export controls.

---

## 6. Mathematical Aggregations (E)
- **Aggregations**: Uses `COALESCE(SUM(...), 0)` and `COUNT(*)` grouped by date.
- **Division-by-Zero Risks**: No complex division in reports queries, but frontend chart components rely on safe formatting utils (`safeFormatNumber`).

---

## 7. Impact Map
- `src/modules/admin/repositories/AdminRepository.ts` (Fix `stake_amount` to `stake` in `getReports`).
- `src/modules/admin/controllers/AdminController.ts` (Add `try/catch` error handling to report endpoints).
- `frontend/src/pages/admin/ReportsDashboardPage.tsx` (Add loading skeletons and export buttons).

---

## 8. Recommended Fix Scope
1. Fix schema drift in `AdminRepository.getReports` (`stake_amount` -> `stake`).
2. Add `try/catch` error handling to report controller actions in `AdminController.ts`.
3. Enhance UI with skeleton loaders and CSV export functionality.
