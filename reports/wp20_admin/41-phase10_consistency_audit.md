# WP-20 Phase 10 Audit Report: Cross-Page Consistency & Systemic Bugs

## 1. Executive Summary

- **Top Bug #1 (The 4-Eyes Placebo — Financial Mutation Bug)**: Approving a `wallet_adjustment` action in [AdminWalletService.approveAction](file:///C:/SkiesPro/src/modules/admin/services/AdminWalletService.ts#L86) marks the `admin_actions` row status as `'approved'`, but **no money moves**. `WalletService.credit` or `WalletService.debit` is never called. Direct wallet adjustments (`adjustWallet`) also fail to mutate wallet balances in `wallet.wallets`.
- **Top Bug #2 (The TOTP 401 Trap — Systemic Auth Bug)**: In [authController.adminMfaStepUp](file:///C:/SkiesPro/src/modules/auth/controllers/authController.ts#L237), when an administrator enters a wrong 6-digit TOTP code in a step-up modal, the endpoint returns **HTTP 401 Unauthorized**. The frontend Axios response interceptor interprets 401 as session expiry and **logs the administrator out of the entire dashboard**.
- **Top Bug #3 (16 Controller Methods Missing Try/Catch)**: 16 methods in [AdminController.ts](file:///C:/SkiesPro/src/modules/admin/controllers/AdminController.ts) (`listUsers`, `getUserById`, `updateUserStatus`, `reviewKyc`, `approveWithdrawal`, `adjustWallet`, `approveAction`, etc.) lack `try/catch` blocks, causing unhandled database rejections and hung HTTP sockets during query failures.
- **Top Bug #4 (Date Formatting Inconsistencies)**: 8 admin components/pages (e.g., `UserTable.tsx`, `KycQueueTable.tsx`, `PendingWithdrawalsTable.tsx`, `FourEyesActionCard.tsx`, `SupportTicketsPage.tsx`) use `safeFormatDate` producing standard locale dates instead of standardized EAT local time via `formatDateEAT` or `formatDateOnlyEAT`.
- **Top Bug #5 (Shared Component Gaps & Raw DB Strings)**: `SupportTicketsPage.tsx` uses native `<select>` dropdowns instead of `FilterTabs`. `PlatformSettingsPage.tsx` lacks loading skeletons and empty states. `FourEyesActionCard.tsx` and `AuditLogsTable.tsx` render raw DB strings (`HIGH_VALUE_WALLET_ADJUSTMENT`, `USER_STATUS_CHANGE`) directly without title casing.

---

## 2. Part A — 4-Eyes Placebo Findings

### A1. Full `AdminWalletService.approveAction` Method Code
```typescript
  async approveAction(
    actionId: string,
    approvedBy: string
  ): Promise<{ status: string; actionId: string; approvedBy: string }> {
    const action = await this.repo.getAdminActionForUpdate(actionId);
    if (!action) {
      throw new Error('Action not found');
    }
    const currentStatus =
      action.status ||
      (action.approved_at ? 'approved' : action.rejected_at ? 'rejected' : 'pending');
    if (currentStatus !== 'pending') {
      throw new Error(`Cannot approve action with status '${currentStatus}'`);
    }

    const updated = await this.repo.approveAdminAction(actionId, approvedBy);
    if (!updated) {
      throw new Error('Cannot approve action');
    }

    await this.audit.createEntry({
      actorId: approvedBy,
      action: 'admin_action_approved',
      affectedEntity: 'admin_action',
      entityId: actionId,
      details: {
        approved_by: approvedBy,
        action_type: updated.action_type,
      },
    });

    return {
      status: 'approved',
      actionId,
      approvedBy,
    };
  }
```

### A2 & A3. Execution Trace & Root Cause
- When a 4-eyes `wallet_adjustment` action is approved, `approveAction` updates `admin.admin_actions.status` to `'approved'` and writes an audit log.
- **It NEVER parses `action.details` or calls `WalletService.credit()` / `WalletService.debit()`.**
- Furthermore, in [AdminWalletService.adjustWallet](file:///C:/SkiesPro/src/modules/admin/services/AdminWalletService.ts#L20), direct adjustments (where amount $\le$ $500, returning `status: 'applied'`) also only record an `admin_actions` row without calling `WalletService`.
- **Engine Gap**: `AdminWalletService` must inject `WalletService`. Upon applying a direct adjustment or approving a 4-eyes `wallet_adjustment` action, `approveAction` must parse `action.details` (`user_id`, `amount`, `type`, `reason`, `idempotency_key`) and execute `walletService.credit` / `walletService.debit` within the approval transaction.

---

## 3. Part B — TOTP 401 Trap Findings

### B1. Endpoint Trace & Root Cause
- In [authController.ts:237](file:///C:/SkiesPro/src/modules/auth/controllers/authController.ts#L237):
  ```typescript
  async adminMfaStepUp(req: Request, res: Response): Promise<void> {
    const authReq = req as AuthenticatedRequest;
    try {
      const adminMfaToken = await this.authService.verifyAdminStepUp(
        authReq.user.sub,
        authReq.user.role,
        req.body.totp_code
      );
      ...
    } catch (error) {
      const code = (error as Error).message;
      const status = code === 'FORBIDDEN_NOT_ADMIN' ? 403 : 401; // ← BUG: Returns 401
      res.status(status).json({ error: code, code });
    }
  }
  ```
- **The Logout Trap**: Returning HTTP 401 triggers the global Axios response interceptor in `apiClient.ts`, which clears `access_token` and forces a redirect to `/login`.
- **Endpoints Flagged**:
  - `POST /api/v1/auth/admin-mfa/step-up` (`adminMfaStepUp`): Returns **401** on invalid TOTP code (Must return **400 Bad Request** / **403 Forbidden** with `code: 'INVALID_TOTP'`).

---

## 4. Part C — Date Formatting Matrix

| File / Component | Field Rendered | Current Formatter | Standard Formatter Required | Status |
| :--- | :--- | :--- | :--- | :--- |
| `ReportsDashboardPage.tsx` | `item.date` & `item.timestamp` | `formatDateOnlyEAT` | `formatDateOnlyEAT` | **CORRECT** |
| `AuditLogsTable.tsx` | `log.created_at` | `formatDateEAT` | `formatDateEAT` | **CORRECT** |
| `UserTable.tsx` | `user.created_at` | `safeFormatDate(..., { dateOnly: true })` | `formatDateOnlyEAT` | **FLAGGED** |
| `UserDetailDrawer.tsx` | `trade.created_at` & `entry.created_at` | `safeFormatDate` | `formatDateEAT` | **FLAGGED** |
| `KycQueueTable.tsx` | `app.submitted_at` | `safeFormatDate` | `formatDateEAT` | **FLAGGED** |
| `KycDocumentViewer.tsx` | `application.submitted_at` | `safeFormatDate` | `formatDateEAT` | **FLAGGED** |
| `PendingWithdrawalsTable.tsx` | `item.created_at` | `safeFormatDate` | `formatDateEAT` | **FLAGGED** |
| `FourEyesActionCard.tsx` | `action.created_at` | `safeFormatDate` | `formatDateEAT` | **FLAGGED** |
| `SupportTicketsPage.tsx` | `ticket.updated_at` | `safeFormatDate` | `formatDateEAT` | **FLAGGED** |
| `TicketDetailDrawer.tsx` | `msg.created_at` | `safeFormatDate(..., { timeOnly: true })` | `formatDateEAT` | **FLAGGED** |
| `TransactionHistory.tsx` (User) | `entry.created_at` | `new Date(...).toLocaleString()` | `formatDateEAT` | **FLAGGED** |

---

## 5. Part D — Shared UI Components Checklist

| Admin Page | TableLoading Used? | TableEmpty Used? | FilterTabs Used? | Notes |
| :--- | :--- | :--- | :--- | :--- |
| User Management | Yes | Yes | Yes | Fully compliant |
| KYC Review | Yes | Yes | Yes | Fully compliant |
| Finance Overview | Yes | Yes | Yes | Fully compliant |
| 4-Eyes Approvals | Yes | Yes | N/A | Single queue view |
| Audit Trail | Yes | Yes | N/A | Uses search/action text inputs |
| Risk Dashboard | Yes | Yes | Yes | Fully compliant |
| Support Tickets | Yes | Yes | **NO** | Uses native `<select>` dropdowns |
| Reports Dashboard | Yes | Yes | Yes | Fully compliant |
| Platform Settings | **NO** | **NO** | N/A | Missing loading skeleton & empty states |

---

## 6. Part E — Number & Raw String Findings

### E1. Unformatted Numbers & Currency
- `WithdrawalActionModal.tsx`: Renders raw numbers without comma thousand separators in modal transaction details.
- `RiskDashboardPage.tsx`: `asset.currentExposure` renders unformatted numbers.
- `PlatformSettingsPage.tsx`: Setting input values lack unit suffixes (`KES`, `%`, `seconds`).

### E2. Raw Database Strings
- `FourEyesActionCard.tsx`: Displays raw string `HIGH_VALUE_WALLET_ADJUSTMENT` or `WALLET_ADJUSTMENT`.
- `AuditLogsTable.tsx`: Displays raw action strings (`USER_STATUS_CHANGE`, `WALLET_ADJUSTMENT`) and raw entity strings (`users`, `wallets`).
- `UserTable.tsx`: Displays uncapitalized role/status strings.
- `SupportTicketsPage.tsx`: Displays raw priority strings (`open`, `in_progress`, `urgent`).
- `RiskDashboardPage.tsx`: Displays raw asset type strings (`forex`, `crypto`).

---

## 7. Part F — Missing Try/Catch Audit (16 Controller Methods)

The following 16 methods in [AdminController.ts](file:///C:/SkiesPro/src/modules/admin/controllers/AdminController.ts) are missing `try/catch` error blocks:

1. `listUsers` (lines 28–37) — `GET /api/v1/admin/users`
2. `getUserById` (lines 39–42) — `GET /api/v1/admin/users/:id`
3. `updateUserStatus` (lines 44–48) — `PUT /api/v1/admin/users/:id/status`
4. `getUserLedger` (lines 50–56) — `GET /api/v1/admin/users/:id/ledger`
5. `listPendingKyc` (lines 58–65) — `GET /api/v1/admin/kyc/pending`
6. `getKycById` (lines 67–70) — `GET /api/v1/admin/kyc/:id`
7. `reviewKyc` (lines 72–81) — `PUT /api/v1/admin/kyc/:id/review`
8. `listWithdrawals` (lines 83–90) — `GET /api/v1/admin/withdrawals`
9. `listPendingWithdrawals` (lines 92–94) — `GET /api/v1/admin/withdrawals/pending`
10. `getWithdrawalById` (lines 96–99) — `GET /api/v1/admin/withdrawals/:id`
11. `approveWithdrawal` (lines 101–109) — `PUT /api/v1/admin/withdrawals/:id/approve`
12. `rejectWithdrawal` (lines 111–119) — `PUT /api/v1/admin/withdrawals/:id/reject`
13. `updateAssetConfig` (lines 191–195) — `PUT /api/v1/admin/risk/asset-config/:symbol`
14. `adjustWallet` (lines 370–389) — `POST /api/v1/admin/finance/wallet-adjustment`
15. `approveAction` (lines 391–395) — `PUT /api/v1/admin/actions/:id/approve`
16. `listPendingActions` (lines 433–436) — `GET /api/v1/admin/actions/pending`

---

## 8. Impact Map & Recommended Fix Scope

### Files Requiring Modifications
- `src/modules/admin/services/AdminWalletService.ts`: Inject `WalletService` and execute actual credit/debit on `adjustWallet` and `approveAction`.
- `src/modules/auth/controllers/authController.ts`: Return 400 Bad Request / 403 Forbidden with `code: 'INVALID_TOTP'` in `adminMfaStepUp` error handler.
- `src/modules/admin/controllers/AdminController.ts`: Add `try/catch` error blocks to all 16 unhandled methods.
- `frontend/src/components/admin/UserTable.tsx`, `KycQueueTable.tsx`, `PendingWithdrawalsTable.tsx`, `FourEyesActionCard.tsx`, `SupportTicketsPage.tsx`, `UserDetailDrawer.tsx`, `TicketDetailDrawer.tsx`, `KycDocumentViewer.tsx`: Apply `formatDateEAT` / `formatDateOnlyEAT` and format raw DB strings.
- `frontend/src/pages/admin/SupportTicketsPage.tsx`: Replace native `<select>` dropdowns with `FilterTabs`.

Read-Only Audit Completed
