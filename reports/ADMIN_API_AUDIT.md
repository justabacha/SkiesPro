# READ-ONLY AUDIT REPORT: ADMIN API RESPONSE DATA UNWRAPPING & CONTRACT MISMATCHES

**Audit Date:** March 2, 2026  
**Project:** SkiesPro Admin Panel (`C:/SkiesPro`)  
**Scope:** Frontend Admin Hooks (`frontend/src/hooks/admin/`), Admin API Client (`frontend/src/services/admin/adminApiClient.ts`), Admin Pages (`frontend/src/pages/admin/`), Admin Components (`frontend/src/components/admin/`), and Backend Express Controllers/Services (`src/modules/admin/`).

---

## 1. Objective & Executive Summary

### Objective
Inspect and map the contract mismatches between backend API responses and frontend admin hooks/components across all admin pages in SkiesPro. Identify exact line numbers, data parsing failures, and request payload inconsistencies without modifying code during the audit phase.

### Executive Summary
A comprehensive read-only audit of the Admin Panel API response unwrapping pipeline was conducted. The backend API (`AdminController.ts`) standardizes all HTTP response wrappers to:

```json
{
  "data": <payload>,
  "meta": {
    "request_id": "f5392f06-37e0-402e-b62f-2c4623b20e3a"
  }
}
```

However, `adminApiClient.ts` and the associated React hooks (`useAdminUsers`, `useAdminKyc`, `useAdminFinance`, `useAdminRisk`, `useAdminAudit`, `useAdminSupport`, `useAdminReports`) contain **systemic contract mismatches across 27 distinct API touchpoints**.

Because `apiClient.get<ApiResponse<T>>()` unwraps HTTP responses to `{ data: <payload>, meta: ... }`, accessing `res.data` returns `<payload>` directly. The frontend code incorrectly assumes `<payload>` contains nested entity wrappers (such as `res.data.users`, `res.data.pending`, `res.data.withdrawals`, `res.data.logs`, `res.data.tickets`, `res.data.daily_revenue`, `res.data.settings`), whereas the backend returns either:
1. Paginated objects: `{ rows: [...], total: number }`
2. Single entities: `{ id: "...", ... }` directly
3. Flat arrays: `[ ... ]` directly

As a result, **every single admin page suffers from silent empty-state rendering, runtime `TypeError` exceptions, or invalid request payload submissions.**

---

## 2. Core Root Cause Categories

### Category A: Paginated Collections (`{ rows, total }` vs. Named Properties)
* **Backend Contract:** `AdminRepository.ts` wraps list endpoints with `{ rows: any[], total: number }`.
* **Frontend Expectation:** `adminApiClient.ts` expects custom named properties (`users`, `pending`, `withdrawals`, `logs`, `tickets`).
* **Result:** `res.data.<property>` evaluates to `undefined`, causing hooks to fall back to `[]`. All tables render 0 items.

### Category B: Single Entity Unwrapping (`res.data` vs. `res.data.<entity>`)
* **Backend Contract:** `AdminController.ts` returns the entity row object directly under `data` (e.g., `{ data: { id: "123", email: "..." } }`).
* **Frontend Expectation:** `adminApiClient.ts` attempts to access `res.data.user`, `res.data.application`, `res.data.withdrawal`, `res.data.ticket`.
* **Result:** Detail fetch functions return `undefined`, breaking detail drawers and action modals.

### Category C: Array-Direct Responses vs. Object Properties
* **Backend Contract:** Endpoints like `/api/v1/admin/risk/exposure` and `/api/v1/admin/settings` return flat arrays directly in `data` (e.g. `{ data: [ {...}, {...} ] }`).
* **Frontend Expectation:** `adminApiClient.ts` expects `{ exposure: [...] }` or `{ settings: [...] }`.
* **Result:** `res.data.exposure` and `res.data.settings` are `undefined`, returning empty arrays.

### Category D: Request Payload & Field Key Mismatches
* **Backend Expectations:**
  * KYC Review: `req.body.action` ('approved'|'rejected') & `req.body.note`
  * Wallet Adjustment: `req.body.type` ('credit'|'debit')
  * Support Ticket Update: `req.body.response`
  * Platform Settings Update: `req.body.key`, `req.body.value`, `req.body.reason`
* **Frontend Submissions:**
  * KYC Review sends `{ status, review_notes }` (causing rejection fallback).
  * Wallet Adjustment sends `{ direction }` (causing `type` to be `undefined`).
  * Ticket Update sends `{ response_message }` (causing responses to be omitted).
  * Settings Update sends `{ settings: { key: value } }` (causing SQL/validation failure).

---

## 3. Comprehensive Diagnostic Mapping Table

| Endpoint Path | Backend Return Structure (`AdminController.ts`) | `adminApiClient.ts` Expectation & Parsing | Hook / Page Location | Failure Symptom |
| :--- | :--- | :--- | :--- | :--- |
| `GET /api/v1/admin/users` | `{ data: { rows: [...], total: N } }` | Expects `res.data.users` (Line 191) | `useAdminUsers.ts` L21 | Table is always empty (`setUsers([])`) |
| `GET /api/v1/admin/users/:id` | `{ data: { id, email, status, ... } }` | Returns `res.data.user` (Line 199) | `useAdminUsers.ts` L33 | User drawer fails to render profile (`selectedUser` is `undefined`) |
| `PUT /api/v1/admin/users/:id/status` | `{ data: { id, status, ... } }` | Unwraps `res.data` (Line 204) | `useAdminUsers.ts` L48 | Throws `TypeError: Cannot read properties of undefined (reading 'status')` when reading `res.user.status` |
| `GET /api/v1/admin/users/:id/ledger` | `{ data: { rows: [...], total: N } }` | Returns `res.data.ledger` (Line 217) | `useAdminUsers.ts` L59 | Wallet ledger history tab is always empty |
| `GET /api/v1/admin/kyc/pending` | `{ data: { rows: [...], total: N } }` | Returns `res.data.pending` (Line 229) | `useAdminKyc.ts` L13 | KYC Queue shows "Queue Clear" (0 pending) |
| `GET /api/v1/admin/kyc/:id` | `{ data: { id, user_id, doc_type, ... } }` | Returns `res.data.application` (Line 238) | `useAdminKyc.ts` L28 | KYC Document Viewer drawer fails to open |
| `PUT /api/v1/admin/kyc/:id/review` | Expects `{ action, note }` | Sends `{ status, review_notes }` (Line 247) | `useAdminKyc.ts` L39 | Backend `req.body.action` is `undefined`, defaulting to decision rejection |
| `GET /api/v1/admin/withdrawals/pending` | `{ data: { rows: [...], total: N } }` | Returns `res.data.withdrawals` (Line 258) | `useAdminFinance.ts` L13 | Pending M-Pesa withdrawal table is always empty |
| `GET /api/v1/admin/withdrawals/:id` | `{ data: { id, amount_kes, ... } }` | Returns `res.data.withdrawal` (Line 267) | `useAdminFinance.ts` L28 | Withdrawal action modal receives `undefined` |
| `POST /api/v1/admin/wallets/adjust` | Expects `{ type: 'credit'\|'debit' }`. Returns `{ status: 'pending_second_approval'\|'applied' }` | Sends `{ direction }` (Line 296). Modal checks `res.pending_four_eyes` | `WalletAdjustmentModal.tsx` L52, L61 | `req.body.type` is `undefined`. Modal shows "executed successfully" even when routed to 4-eyes queue |
| `GET /api/v1/admin/risk/dashboard` | `{ data: { open_contracts, settled_contracts, total_exposure } }` | Returns `res.data.risk_metrics` (Line 326) | `RiskDashboardPage.tsx` L44-L77 | `metrics` is `null`. Metrics cards show 0s/N/A due to property name mismatch |
| `GET /api/v1/admin/risk/exposure` | `{ data: [ { symbol, exposure }, ... ] }` | Returns `res.data.exposure` (Line 335) | `useAdminRisk.ts` L16 | Symbol exposure table is always empty |
| `GET /api/v1/admin/audit-logs` | `{ data: { rows: [...], total: N } }` | Returns `res.data` (Line 355) | `useAdminAudit.ts` L20 | Audit trail table is always empty (`res.logs` is `undefined`) |
| `GET /api/v1/admin/audit-chain/verify` | `{ data: { valid, checked, mismatches } }` | Returns `res.data` (Line 365) | `AuditChainStatusBanner.tsx` L44, L45 | Displays `undefined` record ID and `undefined` verification count |
| `GET /api/v1/admin/support/tickets` | `{ data: { rows: [...], total: N } }` | Returns `res.data.tickets` (Line 375) | `useAdminSupport.ts` L22 | Support ticket inbox is always empty |
| `GET /api/v1/admin/support/tickets/:id` | `{ data: { id, subject, ... } }` | Returns `res.data.ticket` (Line 385) | `useAdminSupport.ts` L37 | Support ticket drawer fails to open |
| `PUT /api/v1/admin/support/tickets/:id` | Expects `{ response, status, assigned_to }` | Sends `{ response_message }` (Line 394) | `useAdminSupport.ts` L57 | Agent reply text is ignored by backend |
| `GET /api/v1/admin/reports/daily-revenue` | `{ data: { revenue: [ { revenue, day }, ... ] } }` | Returns `res.data.daily_revenue` (Line 409) | `ReportsDashboardPage.tsx` L101 | Returns `[]` ("No revenue data reported"). Property names mismatch (`revenue` & `day` vs `revenue_kes` & `date`) |
| `GET /api/v1/admin/reports/trade-volume` | `{ data: { volume: [ { volume, day }, ... ] } }` | Returns `res.data.trade_volume` (Line 418) | `ReportsDashboardPage.tsx` L118 | Returns `[]` ("No trade volume reported"). Property names mismatch (`volume` & `day` vs `volume_kes` & `date`) |
| `GET /api/v1/admin/reports/user-registrations` | `{ data: { registrations: [ { users, day }, ... ] } }` | Returns `res.data.registrations` (Line 427) | `ReportsDashboardPage.tsx` L133 | Array is present, but renders `+undefined new registrations` on `undefined` date due to field mismatch (`users`/`day` vs `count`/`date`) |
| `GET /api/v1/admin/reports/settlement-performance` | `{ data: { settlement: [ { total_settlements, day }, ... ] } }` | Returns `res.data.settlement_metrics` (Line 436) | `ReportsDashboardPage.tsx` L146 | Returns `[]` ("No settlement worker metrics reported") |
| `GET /api/v1/admin/settings` | `{ data: [ { key, value, ... }, ... ] }` | Returns `res.data.settings` (Line 446) | `PlatformSettingsPage.tsx` L16 | Settings list is always empty |
| `PUT /api/v1/admin/settings` | Expects `{ key, value, reason }` | Sends `{ settings: { ... } }` (Line 454) | `PlatformSettingsPage.tsx` L38 | Backend fails to read `req.body.key` |

---

## 4. Detailed Module Diagnostic Breakdown

### 4.1 User Management Module
* **Files Affected:** `src/services/admin/adminApiClient.ts`, `src/hooks/admin/useAdminUsers.ts`, `src/pages/admin/UserManagementPage.tsx`, `src/components/admin/UserTable.tsx`, `src/components/admin/UserDetailDrawer.tsx`
* **Diagnostic Breakdown:**
  1. **Listing Users (`getUsers`):**
     * `AdminRepository.ts` (L48): `return { rows: rowsResult.rows, total: countResult.rows[0]?.count || 0 };`
     * `adminApiClient.ts` (L191): `return res.data;` (returns `{ rows: [...], total: count }`).
     * `useAdminUsers.ts` (L21): `setUsers(data.users || []);` -> `data.users` is `undefined`. Table renders empty.
  2. **Getting User By ID (`getUserById`):**
     * `AdminRepository.ts` (L57): `return result.rows[0] || null;`
     * `adminApiClient.ts` (L199): `return res.data.user;` -> `res.data` is the user object directly; `res.data.user` is `undefined`. `UserDetailDrawer` displays empty state.
  3. **Updating User Status (`updateUserStatus`):**
     * `useAdminUsers.ts` (L48): `setSelectedUser((prev) => (prev ? { ...prev, status: res.user.status } : null));` -> `res` is `{ id, status, ... }`. `res.user` is `undefined`, causing a `TypeError`.
  4. **Ledger Entries (`getUserLedger`):**
     * `AdminRepository.ts` (L92): `return { rows: rowsResult.rows, total: totalResult.rows[0]?.count || 0 };`
     * `adminApiClient.ts` (L217): `return res.data.ledger || [];` -> `res.data.ledger` is `undefined`, returning `[]`. Wallet ledger history tab is always empty.

### 4.2 KYC Verification Module
* **Files Affected:** `src/services/admin/adminApiClient.ts`, `src/hooks/admin/useAdminKyc.ts`, `src/pages/admin/KycReviewPage.tsx`, `src/components/admin/KycQueueTable.tsx`, `src/components/admin/KycDocumentViewer.tsx`
* **Diagnostic Breakdown:**
  1. **Pending Queue (`getPendingKyc`):**
     * `AdminRepository.ts` (L111): Returns `{ rows, total }`.
     * `adminApiClient.ts` (L229): Returns `res.data.pending || []` -> `res.data.pending` is `undefined`. Queue is always empty.
  2. **KYC Detail (`getKycById`):**
     * `AdminRepository.ts` (L128): Returns kyc document row directly.
     * `adminApiClient.ts` (L238): Returns `res.data.application` -> `undefined`.
  3. **Review Action (`reviewKyc`):**
     * `AdminController.ts` (L66): Expects `req.body.action` ('approved'|'rejected') and `req.body.note`.
     * `adminApiClient.ts` (L247): Sends `{ status, review_notes, totp_code }`. `req.body.action` evaluates to `undefined`, defaulting every review attempt to rejection.

### 4.3 Finance & Wallet Operations Module
* **Files Affected:** `src/services/admin/adminApiClient.ts`, `src/hooks/admin/useAdminFinance.ts`, `src/pages/admin/FinanceOverviewPage.tsx`, `src/components/admin/PendingWithdrawalsTable.tsx`, `src/components/admin/WalletAdjustmentModal.tsx`
* **Diagnostic Breakdown:**
  1. **Pending Withdrawals (`getPendingWithdrawals`):**
     * `AdminRepository.ts` (L155): Returns `{ rows, total }`.
     * `adminApiClient.ts` (L258): Returns `res.data.withdrawals || []` -> `undefined`.
  2. **Withdrawal Detail (`getWithdrawalById`):**
     * `adminApiClient.ts` (L267): Returns `res.data.withdrawal` -> `undefined`.
  3. **Wallet Adjustment (`adjustWallet`):**
     * `AdminController.ts` (L151): Expects `req.body.type` ('credit'|'debit'). Returns `{ status: 'pending_second_approval' | 'applied', actionId, ... }`.
     * `adminApiClient.ts` (L296): Sends `direction` instead of `type`.
     * `WalletAdjustmentModal.tsx` (L52, L61): Checks `if (res?.pending_four_eyes)`. Since backend returns `{ status: 'pending_second_approval' }`, `res.pending_four_eyes` is `undefined`. The modal incorrectly informs the admin that the balance adjustment was executed immediately.

### 4.4 Four-Eyes Approvals Module
* **Files Affected:** `src/pages/admin/FourEyesApprovalPage.tsx`, `src/components/admin/FourEyesActionCard.tsx`
* **Diagnostic Breakdown:**
  * `FourEyesApprovalPage.tsx` (L16): Calls `adminApiClient.getPendingWithdrawals()` as a placeholder. It never fetches pending actions from `admin.admin_actions`.
  * The approval queue remains permanently empty.

### 4.5 Risk Oversight Module
* **Files Affected:** `src/services/admin/adminApiClient.ts`, `src/hooks/admin/useAdminRisk.ts`, `src/pages/admin/RiskDashboardPage.tsx`
* **Diagnostic Breakdown:**
  1. **Risk Dashboard (`getRiskDashboard`):**
     * `AdminRepository.ts` (L191): Returns `{ open_contracts, settled_contracts, total_exposure }`.
     * `adminApiClient.ts` (L326): Returns `res.data.risk_metrics` -> `undefined`.
     * `RiskDashboardPage.tsx` (L44-L77): Accesses `metrics.total_open_positions`, `metrics.total_payout_exposure_kes`, etc., which mismatch backend keys.
  2. **Risk Exposure (`getRiskExposure`):**
     * `AdminRepository.ts` (L203): Returns array `[ { symbol, exposure }, ... ]`.
     * `adminApiClient.ts` (L335): Returns `res.data.exposure || []` -> `undefined`. Exposure table is always empty.

### 4.6 Audit Trail & Chain Integrity Module
* **Files Affected:** `src/services/admin/adminApiClient.ts`, `src/hooks/admin/useAdminAudit.ts`, `src/pages/admin/AuditLogsPage.tsx`, `src/components/admin/AuditChainStatusBanner.tsx`
* **Diagnostic Breakdown:**
  1. **Audit Logs (`getAuditLogs`):**
     * `AdminRepository.ts` (L301): Returns `{ rows, total }`.
     * `useAdminAudit.ts` (L20): `setLogs(res.logs || [])` -> `res.logs` is `undefined`. Audit trail table is always empty.
  2. **Chain Verification (`verifyAuditChain`):**
     * `AdminAuditService.ts` (L52): Returns `{ valid, checked, mismatches }`.
     * `AuditChainStatusBanner.tsx` (L44, L45): Reads `result.total_verified` and `result.broken_at_id`, both of which are `undefined`.

### 4.7 Support Ticket Management Module
* **Files Affected:** `src/services/admin/adminApiClient.ts`, `src/hooks/admin/useAdminSupport.ts`, `src/pages/admin/SupportTicketsPage.tsx`, `src/components/admin/TicketDetailDrawer.tsx`
* **Diagnostic Breakdown:**
  1. **Ticket Inbox (`getTickets`):**
     * `AdminRepository.ts` (L395): Returns `{ rows, total }`.
     * `adminApiClient.ts` (L375): Returns `res.data.tickets || []` -> `undefined`. Ticket inbox is empty.
  2. **Ticket Detail (`getTicketById`):**
     * `adminApiClient.ts` (L385): Returns `res.data.ticket` -> `undefined`.
  3. **Updating Ticket (`updateTicket`):**
     * `adminApiClient.ts` (L394): Sends `response_message` instead of `response`. Agent responses are ignored by backend.

### 4.8 Platform Settings & Business Analytics
* **Files Affected:** `src/services/admin/adminApiClient.ts`, `src/pages/admin/PlatformSettingsPage.tsx`, `src/hooks/admin/useAdminReports.ts`, `src/pages/admin/ReportsDashboardPage.tsx`
* **Diagnostic Breakdown:**
  1. **Platform Settings:**
     * `AdminRepository.ts` (L231): Returns array `[ { key, value, ... } ]`.
     * `adminApiClient.ts` (L446): Returns `res.data.settings` -> `undefined`. Settings page renders empty.
     * `adminApiClient.ts` (L454): `updateSettings` sends `{ settings: { key: value } }` instead of `{ key, value, reason }`.
  2. **Daily Revenue Report:**
     * `AdminReportService.ts` (L11): Returns `{ revenue: [ { revenue, day } ] }`.
     * `adminApiClient.ts` (L409): Returns `res.data.daily_revenue || []` -> `undefined`.
  3. **Trade Volume Report:**
     * `AdminReportService.ts` (L16): Returns `{ volume: [ { volume, day } ] }`.
     * `adminApiClient.ts` (L418): Returns `res.data.trade_volume || []` -> `undefined`.
  4. **User Registrations Report:**
     * `AdminReportService.ts` (L21): Returns `{ registrations: [ { users, day } ] }`.
     * `ReportsDashboardPage.tsx` (L133): Accesses `item.date` and `item.count`, rendering `+undefined new registrations`.
  5. **Settlement Performance Report:**
     * `AdminReportService.ts` (L26): Returns `{ settlement: [ { total_settlements, day } ] }`.
     * `adminApiClient.ts` (L436): Returns `res.data.settlement_metrics || []` -> `undefined`.

---

## 5. Recommended Remediation Strategy

When authorized to execute repairs:
1. **Standardize `adminApiClient.ts` Response Unwrapping:** Update all methods in `adminApiClient.ts` so that:
   * Paginated responses extract `.rows` (e.g. `res.data.rows`).
   * Single entity responses return `res.data` directly.
   * Direct array responses return `res.data` directly.
2. **Align Request Body Payloads:**
   * KYC Review: Send `{ action, note }`.
   * Wallet Adjustment: Send `{ type }` instead of `{ direction }`.
   * Support Ticket: Send `{ response }` instead of `{ response_message }`.
   * Platform Settings: Send `{ key, value, reason }`.
3. **Align Data Models and Field Mapping:**
   * Map report structures (`revenue`/`day` $\rightarrow$ `revenue_kes`/`date`, `users`/`day` $\rightarrow$ `count`/`date`, `volume`/`day` $\rightarrow$ `volume_kes`/`date`).
   * Map risk metrics (`open_contracts` $\rightarrow$ `total_open_positions`, `total_exposure` $\rightarrow$ `total_payout_exposure_kes`).
   * Map audit chain verification results (`checked` $\rightarrow$ `total_verified`, `mismatches[0]` $\rightarrow$ `broken_at_id`).
   * Map 4-eyes adjustment check (`res.data.status === 'pending_second_approval'`).
