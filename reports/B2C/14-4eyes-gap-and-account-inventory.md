# Read-Only Audit Report: 4-Eyes Approvals Gap & Test Account Inventory

## 1. Executive Summary

- **4-Eyes Approvals Page Audit**: Rejection is genuinely missing from both the frontend UI and the backend. While `AdminWalletService` and `AdminController` provide `approveAction` (`PUT /api/v1/admin/actions/:id/approve`), there is no corresponding `rejectAction` service method, controller action, or API route (`/api/v1/admin/actions/:id/reject`), and no Reject button in `FourEyesActionCard.tsx`. This is classified as a **Backend Gap — needs build** (plus frontend UI wiring).
- **Test Account Inventory**: Out of 22 user accounts in the database, **9 accounts are classified as KEEP** (system internal, operational staff roles, designated test accounts `just1abacha@gmail.com` and `ryan41rays@gmail.com`, and historical user `itsphestone@gmail.com`), and **13 accounts are classified as DELETE** (test fixtures created during automated test runs across Slices 1–5). All 13 DELETE candidates are confirmed test fixtures (`*@example.com`) without real funds. Historical withdrawal `235d9ef4-8cde-42c9-be63-9accc9ac09d0` and its user (`itsphestone@gmail.com`) are strictly protected and preserved.

---

## 2. Part A — 4-Eyes Approvals Audit (A1-A5)

### A1. Page Location
- **Component File**: [FourEyesApprovalPage.tsx](file:///C:/SkiesPro/frontend/src/pages/admin/FourEyesApprovalPage.tsx)
- **Route Path**: `/admin/approvals` (wired in [adminRoutes.tsx](file:///C:/SkiesPro/frontend/src/routes/adminRoutes.tsx))
- **Card Component**: [FourEyesActionCard.tsx](file:///C:/SkiesPro/frontend/src/components/admin/FourEyesActionCard.tsx)

### A2. Available Actions in Current UI
- **Authorize Action (Super Admin MFA)**: Triggers `handleApproveAction` via `adminApiClient.approveAction(id, { totp_code: totpCode })`.
- **Reject / Decline / Cancel**: **Not present.** There is no reject button, modal, or API client method for rejecting pending 4-eyes actions.

### A3. Backend Endpoint Verification
- **Approve Endpoint**: `PUT /api/v1/admin/actions/:id/approve` (handled by `AdminController.approveAction` $\rightarrow$ `AdminWalletService.approveAction`).
- **Reject Endpoint**: **Does not exist.** There is no `/actions/:id/reject` route, controller method, or service method.
- **Classification**: **BACKEND GAP — needs build**.
- **Scope of 4-Eyes Items**: High-value wallet adjustments exceeding USD $500 threshold (`AdminWalletService.requiresSecondApproval`).

### A4. Schema Backing 4-Eyes
- Table: `admin.approval_requests` or `admin.admin_actions` (managed via `AdminRepository.createAdminAction` / `approveAdminAction`).

### A5. Gap Summary
- **Approve Path**: Fully implemented end-to-end (UI button $\rightarrow$ `adminApiClient.approveAction` $\rightarrow$ `PUT /actions/:id/approve` $\rightarrow$ `AdminWalletService.approveAction` $\rightarrow$ DB $\rightarrow$ Audit Log).
- **Reject Path**: Missing across all layers (Backend endpoint, service method, repository update, and UI button).

---

## 3. Part B — Test Account Inventory (B1-B6)

### B1 & B2. User Account Inventory & Classification

| ID | Email | Status | KYC | Created At | Wallets | Withdrawals | Deposits | Contracts | Classification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `00000000-...` | `system@skiespro.internal` | active | unverified | 2026-07-29 | 0 | 0 | 0 | 0 | **KEEP** (System) |
| `87d63bfc-...` | `itsphestone@gmail.com` | active | verified | 2026-10-05 | 1 | 0 | 0 | 0 | **KEEP** (Historical User / B6 Protected) |
| `c5403482-...` | `admin@skiespro.internal` | active | verified | 2026-10-05 | 0 | 0 | 0 | 0 | **KEEP** (SUPER_ADMIN) |
| `0b17c1b8-...` | `support@skiespro.internal` | active | verified | 2026-10-05 | 0 | 0 | 0 | 0 | **KEEP** (Operational Staff) |
| `de3646eb-...` | `finance@skiespro.internal` | active | verified | 2026-10-05 | 0 | 0 | 0 | 0 | **KEEP** (Operational Staff) |
| `b67821d5-...` | `risk@skiespro.internal` | active | verified | 2026-10-05 | 0 | 0 | 0 | 0 | **KEEP** (Operational Staff) |
| `18453f41-...` | `compliance@skiespro.internal` | active | verified | 2026-10-05 | 0 | 0 | 0 | 0 | **KEEP** (Operational Staff) |
| `9bde8491-...` | `just1abacha@gmail.com` | active | verified | 2026-10-05 | 2 | 2 | 2 | 5 | **KEEP** (Designated Test Account) |
| `2b9a1249-...` | `ryan41rays@gmail.com` | active | unverified | 2026-10-07 | 0 | 3 | 0 | 0 | **KEEP** (Designated Test Account) |
| `57b546b1-...` | `nophone-...@example.com` | active | verified | 2026-10-19 | 1 | 0 | 0 | 0 | **DELETE** (Test Fixture) |
| `86191bff-...` | `badphone-...@example.com` | active | verified | 2026-10-19 | 1 | 0 | 0 | 0 | **DELETE** (Test Fixture) |
| `e033f46c-...` | `admin-verify-...@example.com` | active | verified | 2026-10-19 | 0 | 0 | 0 | 0 | **DELETE** (Test Fixture) |
| `9a29643a-...` | `user-verify-...@example.com` | active | verified | 2026-10-19 | 1 | 1 | 0 | 0 | **DELETE** (Test Fixture) |
| `fd1e98b0-...` | `b2c-recon-...@example.com` | active | verified | 2026-10-19 | 0 | 3 | 0 | 0 | **DELETE** (Test Fixture) |
| `1eb94e6c-...` | `demo-isolation-...@example.com` | active | verified | 2026-10-20 | 2 | 0 | 0 | 0 | **DELETE** (Test Fixture) |
| `939279e8-...` | `demo-security-...@example.com` | active | verified | 2026-10-20 | 2 | 0 | 0 | 0 | **DELETE** (Test Fixture) |
| `2bfc229b-...` | `unverified-...@example.com` | active | unverified | 2026-10-22 | 0 | 0 | 0 | 0 | **DELETE** (Test Fixture) |
| `49fd3eb0-...` | `zerofee-...@example.com` | active | verified | 2026-10-22 | 1 | 0 | 0 | 0 | **DELETE** (Test Fixture) |
| `f3201282-...` | `lowlock-...@example.com` | active | verified | 2026-10-22 | 1 | 0 | 0 | 0 | **DELETE** (Test Fixture) |
| `56086c69-...` | `unverified-...@example.com` | active | unverified | 2026-10-22 | 0 | 0 | 0 | 0 | **DELETE** (Test Fixture) |
| `96d9be48-...` | `zerofee-...@example.com` | active | verified | 2026-10-22 | 1 | 0 | 0 | 0 | **DELETE** (Test Fixture) |
| `a8940f6e-...` | `lowlock-...@example.com` | active | verified | 2026-10-22 | 1 | 0 | 0 | 0 | **DELETE** (Test Fixture) |

---

### B3. Related-Rows Matrix for DELETE Candidates (13 Users)

| Table | Associated Rows Count |
| :--- | :--- |
| `wallet.ledger_entries` | 12 |
| `wallet.wallets` | 11 |
| `payments.b2c_outbox` | 4 |
| `payments.withdrawals` | 4 |
| `payments.deposits` | 0 |
| `trading.contract_events` | 0 |
| `trading.binary_contracts` | 0 |
| `app_auth.user_roles` | 0 |
| `app_auth.users` | 13 |

---

### B4. Financial Safety Check
- **Real Funds**: None. All balances belong to test fixtures (`*@example.com`) created for automated testing.
- **Pending/Dispatched Withdrawals**: Some test fixtures contain test withdrawals in `dispatched` state from mock tests, which are fully safe to prune as part of test database cleanup.
- **Completed Withdrawals with Real Gateway Reference**: None.
- **Safety Verdict**: **SAFE TO CLEANUP** upon explicit future prompt approval. No real user funds or live production assets are impacted.

---

### B5. Proposed FK-Safe Deletion Order (SQL Proposal - NOT Executed)
```sql
-- 1. Trading contract events & binary contracts
DELETE FROM trading.contract_events WHERE contract_id IN (SELECT id FROM trading.binary_contracts WHERE user_id IN (SELECT id FROM delete_ids));
DELETE FROM trading.binary_contracts WHERE user_id IN (SELECT id FROM delete_ids);

-- 2. Payments outbox & withdrawals & deposits
DELETE FROM payments.b2c_outbox WHERE withdrawal_id IN (SELECT id FROM payments.withdrawals WHERE user_id IN (SELECT id FROM delete_ids));
DELETE FROM payments.withdrawals WHERE user_id IN (SELECT id FROM delete_ids);
DELETE FROM payments.deposits WHERE user_id IN (SELECT id FROM delete_ids);

-- 3. Wallet ledger entries & wallets
DELETE FROM wallet.ledger_entries WHERE wallet_id IN (SELECT id FROM wallet.wallets WHERE user_id IN (SELECT id FROM delete_ids));
DELETE FROM wallet.wallets WHERE user_id IN (SELECT id FROM delete_ids);

-- 4. Auth roles & users
DELETE FROM app_auth.user_roles WHERE user_id IN (SELECT id FROM delete_ids);
DELETE FROM app_auth.users WHERE id IN (SELECT id FROM delete_ids);
```

---

### B6. Historical Withdrawal Protection
- **User**: `87d63bfc-4488-4a39-8f20-eda46453ebe9` (`itsphestone@gmail.com`)
- **Withdrawal**: `235d9ef4-8cde-42c9-be63-9accc9ac09d0`
- **Confirmation**: Strictly classified as **KEEP**. Verified absent from all DELETE lists.

---

## 4. Recommended Next Prompts
1. **4-Eyes Rejection Feature Prompt**: Implement `PUT /api/v1/admin/actions/:id/reject`, backend service/controller methods, and frontend Reject modal/button in `FourEyesApprovalPage.tsx`.
2. **Test Account Cleanup Prompt**: Execute the FK-safe SQL cleanup script to prune the 13 test fixture accounts while preserving all KEEP accounts.

Read-Only Audit Completed
