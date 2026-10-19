# READ-ONLY AUDIT — WP-20 FRONTEND ADMIN DASHBOARD

**Audit Date**: May 2024  
**Scope**: Frontend Admin Console (`frontend/src/pages/admin/`, `components/admin/`, `hooks/admin/`, `services/admin/`, `routes/adminRoutes.tsx`, route guards)  
**Status**: Completed (Read-Only Inventory & Pattern Analysis)

---

## 1. Route Inventory

All admin routes are mounted as children of the top-level `/admin` layout route in `frontend/src/router/index.tsx`, protected by `AdminRouteGuard` (`AdminProtectedRoute.tsx`) and wrapped inside `AdminLayout.tsx`.

| Path | Component File Path | Route Guard Roles Allowed | Status |
|------|---------------------|---------------------------|--------|
| `/admin` (index) | `[AdminIndexRedirect](file:///C:/SkiesPro/frontend/src/routes/adminRoutes.tsx#L25)` | Role-based redirect to default route (`/admin/users`, `/admin/finance`, etc.) | Implemented |
| `/admin/users` | `[UserManagementPage](file:///C:/SkiesPro/frontend/src/pages/admin/UserManagementPage.tsx)` | `admin`, `super_admin` | Implemented |
| `/admin/kyc` | `[KycReviewPage](file:///C:/SkiesPro/frontend/src/pages/admin/KycReviewPage.tsx)` | `compliance`, `admin`, `super_admin` | Implemented |
| `/admin/finance` | `[FinanceOverviewPage](file:///C:/SkiesPro/frontend/src/pages/admin/FinanceOverviewPage.tsx)` | `finance`, `admin`, `super_admin` | Implemented |
| `/admin/approvals` | `[FourEyesApprovalPage](file:///C:/SkiesPro/frontend/src/pages/admin/FourEyesApprovalPage.tsx)` | `super_admin` | Stubbed / Code-Only (Data hardcoded to empty array) |
| `/admin/audit` | `[AuditLogsPage](file:///C:/SkiesPro/frontend/src/pages/admin/AuditLogsPage.tsx)` | `compliance`, `admin`, `super_admin` | Implemented |
| `/admin/risk` | `[RiskDashboardPage](file:///C:/SkiesPro/frontend/src/pages/admin/RiskDashboardPage.tsx)` | `risk_manager`, `admin`, `super_admin` | Implemented |
| `/admin/support` | `[SupportTicketsPage](file:///C:/SkiesPro/frontend/src/pages/admin/SupportTicketsPage.tsx)` | `support`, `admin`, `super_admin` | Implemented |
| `/admin/reports` | `[ReportsDashboardPage](file:///C:/SkiesPro/frontend/src/pages/admin/ReportsDashboardPage.tsx)` | `finance`, `admin`, `super_admin` | Implemented |
| `/admin/settings` | `[PlatformSettingsPage](file:///C:/SkiesPro/frontend/src/pages/admin/PlatformSettingsPage.tsx)` | `admin`, `super_admin` | Implemented |
| `/admin-mfa-enrollment` | `[AdminMfaEnrollmentPage](file:///C:/SkiesPro/frontend/src/pages/auth/AdminMfaEnrollmentPage.tsx)` | Unprotected (Top-level MFA enrollment route) | Implemented |

---

## 2. Page Inventory

| File Name | One-Line Purpose | Real API Data? | Loading State? | Error State? | Empty State? | Filter/Status Tabs? | Renders in Browser? |
|-----------|------------------|----------------|----------------|--------------|--------------|---------------------|---------------------|
| `AdminLayout.tsx` | Master container layout providing sidebar navigation, header, and route outlet | N/A (Layout) | No | No | No | N/A | Yes |
| `UserManagementPage.tsx` | Search, filter, inspect, and manage user accounts, status, and view wallet ledger | Yes | Yes | Yes | Yes | Partial (`<select>` dropdowns) | Yes |
| `KycReviewPage.tsx` | KYC application queue review, document inspection, and decision dispatch | Yes | Yes | Yes | Yes | Yes (Bespoke inline buttons) | Yes |
| `FinanceOverviewPage.tsx` | M-Pesa pending withdrawal management and manual wallet balance adjustments | Yes | Yes | Yes | Yes | No | Yes |
| `FourEyesApprovalPage.tsx` | Secondary approval queue for high-value (> $500) administrative operations | Partial (Stubbed) | Partial (Button spin only) | Yes | Yes | N/A | Yes (Always empty) |
| `AuditLogsPage.tsx` | Audit log trail inspection and SHA-256 cryptographic chain integrity verification | Yes | Yes | Yes | Yes | No (Form inputs) | Yes |
| `RiskDashboardPage.tsx` | Live trading risk oversight, position exposure monitoring, and payout rate config | Yes | Partial (Button spin only) | Yes | No | No | Yes |
| `SupportTicketsPage.tsx` | Customer support ticket inbox, priority/status updating, and message replies | Yes | Partial (Button spin only) | Yes | No | Partial (`<select>` dropdowns) | Yes |
| `ReportsDashboardPage.tsx` | Analytics dashboard for revenue, trade volume, registrations, and settlement latency | Yes | Partial (Button spin only) | Yes | Yes | Yes (Metric selection tabs) | Yes |
| `PlatformSettingsPage.tsx` | Configure platform feature flags, payment gateway parameters, and system thresholds | Yes | Partial (Button spin only) | Yes | Yes | N/A | Yes |

---

## 3. Hook & API Client Inventory

### `useAdmin*` Custom Hooks

1. **`useAdminUsers`** (`[useAdminUsers.ts](file:///C:/SkiesPro/frontend/src/hooks/admin/useAdminUsers.ts)`)
   - **Consuming Pages**: `UserManagementPage.tsx`
   - **Endpoints Called**:
     - `GET /api/v1/admin/users?search=...&status=...&role=...`
     - `GET /api/v1/admin/users/:id`
     - `PUT /api/v1/admin/users/:id/status`
     - `GET /api/v1/admin/users/:id/ledger`
   - **Response Unwrapping**: Yes (handles `res.data.rows` and array fallbacks).
   - **Loading Cleanup**: Yes (uses `finally` block for `setIsLoading(false)`, `setIsDrawerLoading(false)`, `setIsLedgerLoading(false)`).

2. **`useAdminKyc`** (`[useAdminKyc.ts](file:///C:/SkiesPro/frontend/src/hooks/admin/useAdminKyc.ts)`)
   - **Consuming Pages**: `KycReviewPage.tsx`
   - **Endpoints Called**:
     - `GET /api/v1/admin/kyc?status=...`
     - `GET /api/v1/admin/kyc/:id`
     - `PUT /api/v1/admin/kyc/:id/review`
   - **Response Unwrapping**: Yes (`res.data?.rows || []`).
   - **Loading Cleanup**: Yes (uses `requestSequence` ref and `finally` block).

3. **`useAdminFinance`** (`[useAdminFinance.ts](file:///C:/SkiesPro/frontend/src/hooks/admin/useAdminFinance.ts)`)
   - **Consuming Pages**: `FinanceOverviewPage.tsx`
   - **Endpoints Called**:
     - `GET /api/v1/admin/withdrawals/pending`
     - `GET /api/v1/admin/withdrawals/:id`
     - `PUT /api/v1/admin/withdrawals/:id/approve`
     - `PUT /api/v1/admin/withdrawals/:id/reject`
     - `POST /api/v1/admin/wallets/adjust`
     - `PUT /api/v1/admin/actions/:id/approve`
   - **Response Unwrapping**: Yes (`res.data?.rows || []`).
   - **Loading Cleanup**: Yes (`finally { setIsLoading(false); }`).

4. **`useAdminAudit`** (`[useAdminAudit.ts](file:///C:/SkiesPro/frontend/src/hooks/admin/useAdminAudit.ts)`)
   - **Consuming Pages**: `AuditLogsPage.tsx`
   - **Endpoints Called**:
     - `GET /api/v1/admin/audit-logs?actor_id=...&action=...`
     - `GET /api/v1/admin/audit-chain/verify`
   - **Response Unwrapping**: Yes (`res.data || { rows: [], total: 0 }`).
   - **Loading Cleanup**: Yes (`finally { setIsLoading(false); }`, `finally { setIsVerifying(false); }`).

5. **`useAdminRisk`** (`[useAdminRisk.ts](file:///C:/SkiesPro/frontend/src/hooks/admin/useAdminRisk.ts)`)
   - **Consuming Pages**: `RiskDashboardPage.tsx`
   - **Endpoints Called**:
     - `GET /api/v1/admin/risk/dashboard`
     - `GET /api/v1/admin/risk/exposure`
     - `PUT /api/v1/admin/risk/asset-config/:symbol`
   - **Response Unwrapping**: Yes (maps metrics and symbol exposure array).
   - **Loading Cleanup**: Yes (`finally { setIsLoading(false); }`).

6. **`useAdminSupport`** (`[useAdminSupport.ts](file:///C:/SkiesPro/frontend/src/hooks/admin/useAdminSupport.ts)`)
   - **Consuming Pages**: `SupportTicketsPage.tsx`
   - **Endpoints Called**:
     - `GET /api/v1/admin/support/tickets?status=...&priority=...`
     - `GET /api/v1/admin/support/tickets/:id`
     - `PUT /api/v1/admin/support/tickets/:id`
   - **Response Unwrapping**: Yes (`res.data?.rows || []`).
   - **Loading Cleanup**: Yes (`finally { setIsLoading(false); }`).

7. **`useAdminReports`** (`[useAdminReports.ts](file:///C:/SkiesPro/frontend/src/hooks/admin/useAdminReports.ts)`)
   - **Consuming Pages**: `ReportsDashboardPage.tsx`
   - **Endpoints Called**:
     - `GET /api/v1/admin/reports/daily-revenue`
     - `GET /api/v1/admin/reports/trade-volume`
     - `GET /api/v1/admin/reports/user-registrations`
     - `GET /api/v1/admin/reports/settlement-performance`
   - **Response Unwrapping**: Yes (maps revenue, volume, registration, and settlement arrays).
   - **Loading Cleanup**: Yes (`finally { setIsLoading(false); }`).

> [!WARNING]
> `PlatformSettingsPage.tsx` bypasses the hook layer completely and calls `adminApiClient.getSettings()` and `adminApiClient.updateSettings()` directly inside page state.

---

## 4. Component Reuse Map

### Tables
- **Dedicated Components**:
  - `UserTable.tsx` (used by `UserManagementPage.tsx`)
  - `KycQueueTable.tsx` (used by `KycReviewPage.tsx`)
  - `PendingWithdrawalsTable.tsx` (used by `FinanceOverviewPage.tsx`)
  - `AuditLogsTable.tsx` (used by `AuditLogsPage.tsx`)
- **Inline Tables**:
  - `RiskDashboardPage.tsx` (renders `<table>` inline for Symbol Exposure)
  - `SupportTicketsPage.tsx` (renders `<table>` inline for Support Tickets)
- **Shared Generic Table**: **None**. Every table is custom-written.

### Drawers & Modals
- **Drawers**:
  - `UserDetailDrawer.tsx` (User details & ledger history)
  - `TicketDetailDrawer.tsx` (Support thread & response composer)
  - `KycDocumentViewer.tsx` (4-panel side-by-side KYC document viewer)
- **Modals**:
  - `UserStatusModal.tsx` (Change user status)
  - `KycDecisionModal.tsx` (Approve/reject KYC)
  - `WithdrawalActionModal.tsx` (Approve/reject M-Pesa withdrawal)
  - `WalletAdjustmentModal.tsx` (Manual credit/debit adjustment)
  - `AssetConfigModal.tsx` (Payout rate & stake limits)
- **Shared Modal**: `MfaStepUpModal.tsx` is consistently reused across all modals, pages, and route guards for MFA TOTP step-up verification.

### Status & Role Badges
- `RoleBadge` (exported from `UserTable.tsx`): Used in `UserTable.tsx` and `UserDetailDrawer.tsx`.
- `AdminHeader.tsx`: Re-implements role badge rendering with a local `ROLE_COLOR_MAP` object instead of using `RoleBadge`.
- `HasRole.tsx`: Shared wrapper component for role-gating UI elements.
- Status badges: Re-implemented inline across almost every table/page with slightly differing Tailwind styling combinations.

### Formatters
- `safeFormatNumber` (`shared/utils/safeFormatters.ts`): Reused across 9 admin pages/components.
- `safeFormatDate` (`shared/utils/safeFormatters.ts`): Reused across 9 admin pages/components.
- `formatKES` (`shared/utils/currencyUtils.ts`): **Unused in admin console**. Admin components construct `KES ${safeFormatNumber(...)}` manually.

### Filter Tabs
- **Shared `FilterTabs` Component**: **None**.
- `KycReviewPage.tsx` and `ReportsDashboardPage.tsx` construct bespoke inline button bars.

---

## 5. Pattern Consistency Matrix (KEY DELIVERABLE)

| Page | Filter Tabs | Role Badge | Money Formatter | Date Formatter | Loading Spinner | Error Banner | Empty State | Live Data |
|------|-------------|------------|-----------------|----------------|-----------------|--------------|-------------|-----------|
| `users` | ❌ (`<select>`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `kyc` | ✅ (Inline) | N/A | N/A | ✅ | ✅ | ✅ | ✅ | ✅ |
| `finance` | ❌ | N/A | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `approvals` | N/A | N/A | ✅ | ✅ | ❌ (Header only) | ✅ | ✅ | ❌ (Stubbed) |
| `audit` | ❌ (Inputs) | N/A | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `risk` | N/A | N/A | ✅ | N/A | ❌ (Header only) | ✅ | ❌ | ✅ |
| `support` | ❌ (`<select>`) | N/A | N/A | ✅ | ❌ (Header only) | ✅ | ❌ | ✅ |
| `reports` | ✅ (Inline) | N/A | ✅ | N/A | ❌ (Header only) | ✅ | ✅ | ✅ |
| `settings` | N/A | N/A | N/A | N/A | ❌ (Header only) | ✅ | ✅ | ✅ |

---

## 6. Confirmed & Suspected Issues

### Confirmed Issues (Code-Verifiable)

1. **KYC Status Filter Tabs Reset Behavior (Reference Signal Analysis)**
   - **Files**: `[KycReviewPage.tsx](file:///C:/SkiesPro/frontend/src/pages/admin/KycReviewPage.tsx#L61-L82)`, `[useAdminKyc.ts](file:///C:/SkiesPro/frontend/src/hooks/admin/useAdminKyc.ts#L35)`
   - **Finding**: In `KycReviewPage.tsx`, 4 filter tab buttons exist in the layout (`pending`, `approved`, `rejected`, `all`). However, in `useAdminKyc.ts` line 35, `useEffect(() => { void fetchPendingKyc('pending'); }, [fetchPendingKyc]);` hardcodes `'pending'` on mount and hook updates.
   - **Impact**: Switching tabs triggers `selectStatusFilter`, but any hook re-execution or parent re-render resets the active query to `'pending'`. Tabs are also non-reusable bespoke inline JSX buttons.

2. **`FourEyesApprovalPage.tsx` Data Hardcoding**
   - **File**: `[FourEyesApprovalPage.tsx](file:///C:/SkiesPro/frontend/src/pages/admin/FourEyesApprovalPage.tsx#L11-L21)`
   - **Finding**: `fetchApprovals` calls `adminApiClient.getPendingWithdrawals()` and then immediately executes `setPendingActions([])` on line 18.
   - **Impact**: The page never displays pending 4-eyes actions and always shows the empty state ("Four-Eyes Queue Clear").

3. **`PlatformSettingsPage.tsx` Direct API Client Bypassing Hook Layer**
   - **File**: `[PlatformSettingsPage.tsx](file:///C:/SkiesPro/frontend/src/pages/admin/PlatformSettingsPage.tsx#L15)`
   - **Finding**: Unlike all other admin pages, `PlatformSettingsPage.tsx` calls `adminApiClient.getSettings()` and `adminApiClient.updateSettings()` directly inside `useState`/`useEffect` rather than consuming a `useAdminSettings` hook.
   - **Impact**: Architectural inconsistency in data fetching patterns.

4. **Missing Content Loading Spinners on 5 Admin Pages**
   - **Files**: `RiskDashboardPage.tsx`, `SupportTicketsPage.tsx`, `ReportsDashboardPage.tsx`, `PlatformSettingsPage.tsx`, `FourEyesApprovalPage.tsx`
   - **Finding**: While `UserTable`, `KycQueueTable`, `PendingWithdrawalsTable`, and `AuditLogsTable` render internal loading indicators when `isLoading` is true, the remaining 5 pages only animate the header refresh button icon.
   - **Impact**: Content area remains blank or static during initial load/refetch with no skeleton or spinner indicator.

5. **Missing Empty States on `RiskDashboardPage.tsx` & `SupportTicketsPage.tsx`**
   - **Files**: `[RiskDashboardPage.tsx](file:///C:/SkiesPro/frontend/src/pages/admin/RiskDashboardPage.tsx#L122-L159)`, `[SupportTicketsPage.tsx](file:///C:/SkiesPro/frontend/src/pages/admin/SupportTicketsPage.tsx#L105-L163)`
   - **Finding**: Both pages render `<tbody ...>{items.map(...)}</tbody>` directly without checking if the array length is 0.
   - **Impact**: If no risk exposures or tickets exist, an empty table with headers is displayed without an informative empty state message.

6. **Inconsistent Role Badge Implementation**
   - **Files**: `[UserTable.tsx](file:///C:/SkiesPro/frontend/src/components/admin/UserTable.tsx#L36)`, `[AdminHeader.tsx](file:///C:/SkiesPro/frontend/src/components/admin/AdminHeader.tsx#L11)`
   - **Finding**: `UserTable.tsx` exports `<RoleBadge />`, but `AdminHeader.tsx` defines a duplicate local `ROLE_COLOR_MAP` object and renders an inline badge.

---

### Suspected Issues (Pattern Inconsistencies)

1. **Unused `formatKES` Utility**
   - **File**: `[currencyUtils.ts](file:///C:/SkiesPro/frontend/src/shared/utils/currencyUtils.ts#L7)`
   - **Finding**: `formatKES` is exported from shared utils but not imported by any admin page. All admin pages manually assemble `KES ${safeFormatNumber(...)}`.

2. **Inconsistent Date Format Options**
   - **Files**: `AuditLogsTable.tsx` (`{ utc: true }`), `UserTable.tsx` (`{ dateOnly: true }`), `PendingWithdrawalsTable.tsx` (default local string).
   - **Finding**: Different tables use varying options when calling `safeFormatDate`, causing mixed date formatting across admin views.

---

## 7. Stub / TODO Sweep

Search terms scanned: `TODO`, `FIXME`, `mock`, `stub`, `dummy`, `placeholder`, `coming soon`, `not implemented`.

| File Path | Line Number | Code Snippet / Context |
|-----------|-------------|------------------------|
| `[AdminHeader.tsx](file:///C:/SkiesPro/frontend/src/components/admin/AdminHeader.tsx#L62)` | Line 62 | `placeholder="Quick search users, tickets, transactions..."` |
| `[KycDocumentViewer.tsx](file:///C:/SkiesPro/frontend/src/components/admin/KycDocumentViewer.tsx#L57)` | Line 57 | `<div className="text-xs text-slate-500 font-mono">Image Not Available / Mock View</div>` |
| `[KycDocumentViewer.tsx](file:///C:/SkiesPro/frontend/src/components/admin/KycDocumentViewer.tsx#L76)` | Line 76 | `<div className="text-xs text-slate-500 font-mono">Image Not Available / Mock View</div>` |
| `[KycDocumentViewer.tsx](file:///C:/SkiesPro/frontend/src/components/admin/KycDocumentViewer.tsx#L95)` | Line 95 | `<div className="text-xs text-slate-500 font-mono">Selfie Not Available / Mock View</div>` |
| `[FourEyesApprovalPage.tsx](file:///C:/SkiesPro/frontend/src/pages/admin/FourEyesApprovalPage.tsx#L17)` | Line 17 | `await adminApiClient.getPendingWithdrawals(); // Fallback/reuse or custom getApprovals if available` |
| `[FourEyesApprovalPage.tsx](file:///C:/SkiesPro/frontend/src/pages/admin/FourEyesApprovalPage.tsx#L18)` | Line 18 | `setPendingActions([]);` |
| `[adminApiClient.ts](file:///C:/SkiesPro/frontend/src/services/admin/adminApiClient.ts#L251)` | Line 251 | `platform_win_loss_ratio: 0.5` (Hardcoded fallback metric) |
| `[adminApiClient.ts](file:///C:/SkiesPro/frontend/src/services/admin/adminApiClient.ts#L356)` | Line 356 | `avg_latency_ms: 120` (Hardcoded settlement latency fallback) |
| `[adminApiClient.ts](file:///C:/SkiesPro/frontend/src/services/admin/adminApiClient.ts#L357)` | Line 357 | `error_count: 0` (Hardcoded settlement error fallback) |
| `[MfaStepUpModal.tsx](file:///C:/SkiesPro/frontend/src/components/admin/MfaStepUpModal.tsx#L99)` | Line 99 | `placeholder="123456"` |
| `[WalletAdjustmentModal.tsx](file:///C:/SkiesPro/frontend/src/components/admin/WalletAdjustmentModal.tsx#L142)` | Line 142 | `placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"` |
| `[AuditLogsPage.tsx](file:///C:/SkiesPro/frontend/src/pages/admin/AuditLogsPage.tsx#L60)` | Line 60 | `placeholder="Filter by Actor ID / Email..."` |
| `[UserManagementPage.tsx](file:///C:/SkiesPro/frontend/src/pages/admin/UserManagementPage.tsx#L77)` | Line 77 | `placeholder="Search by Email, Name, or ID..."` |

---

## 8. Navigation & Sidebar Map

Defined in `[AdminSidebar.tsx](file:///C:/SkiesPro/frontend/src/components/admin/AdminSidebar.tsx#L23-L80)` (`SIDEBAR_NAV_ITEMS`):

| Menu Label | Target Route | Target Route Exists? | Target Page Functional? | Required Roles |
|------------|--------------|----------------------|-------------------------|----------------|
| User Directory | `/admin/users` | Yes | Yes | `admin`, `super_admin` |
| KYC Verification | `/admin/kyc` | Yes | Yes | `compliance`, `admin`, `super_admin` |
| Finance & Wallets | `/admin/finance` | Yes | Yes | `finance`, `admin`, `super_admin` |
| 4-Eyes Approvals | `/admin/approvals` | Yes | Partial (Stubbed data) | `super_admin` |
| Audit Trail & Chain | `/admin/audit` | Yes | Yes | `compliance`, `admin`, `super_admin` |
| Risk & Exposure | `/admin/risk` | Yes | Yes | `risk_manager`, `admin`, `super_admin` |
| Support Tickets | `/admin/support` | Yes | Yes | `support`, `admin`, `super_admin` |
| Reports & Analytics | `/admin/reports` | Yes | Yes | `finance`, `admin`, `super_admin` |
| Platform Settings | `/admin/settings` | Yes | Yes | `admin`, `super_admin` |

---

## Summary Recommendation
The frontend admin console is structurally complete with robust MFA step-up security integration across all pages and modals. However, systemic inconsistencies exist around:
1. **Filter Tabs**: No shared `FilterTabs` component; inline implementations exhibit state reset quirks (e.g. `KycReviewPage.tsx`).
2. **Data Integration**: `FourEyesApprovalPage.tsx` hardcodes an empty array; `PlatformSettingsPage.tsx` bypasses the hook layer.
3. **UI Feedback**: Missing content loading indicators and empty states on `RiskDashboardPage.tsx` and `SupportTicketsPage.tsx`.

No files outside `reports/WP20_ADMIN_FRONTEND_AUDIT.md` were created or modified during this read-only audit.
