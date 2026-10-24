# WP-20 Read-Only Diagnosis Report: 4-Eyes 500 Error & Role Permission Mismatches

## Executive Summary

1. **4-Eyes Approve 500 Root Cause**: Approving action `3344a308-8b1e-4142-95ea-0e450e29c91c` failed with HTTP 500 `ADMIN_ACTION_FAILED` because target user `2b9a1249-629a-4ddc-a101-38d9ef8a7cd5` (`ryan41rays@gmail.com`) **does not have a real wallet record in `wallet.wallets`** (`wallet_count = 0`). When `AdminWalletService.approveAction` called `WalletService.credit()`, it threw `Error('Wallet not found')`, rolling back the transaction.
2. **Finance Role "Manual Adjust" Restriction**: Both frontend ([FinanceOverviewPage.tsx](file:///C:/SkiesPro/frontend/src/pages/admin/FinanceOverviewPage.tsx#L76)) and backend ([admin.routes.ts](file:///C:/SkiesPro/src/modules/admin/admin.routes.ts#L321)) explicitly restrict manual wallet adjustments to `super_admin` only.
3. **Reports Page Permission Mismatch**: Frontend [AdminSidebar.tsx](file:///C:/SkiesPro/frontend/src/components/admin/AdminSidebar.tsx#L68) and [adminRoutes.tsx](file:///C:/SkiesPro/frontend/src/routes/adminRoutes.tsx#L98) allow the `finance` role to view `/admin/reports`. However, backend routes for `/reports/user-registrations` and `/reports/settlement-performance` in [admin.routes.ts](file:///C:/SkiesPro/src/modules/admin/admin.routes.ts#L268) restrict access to `['admin', 'super_admin']`. When `finance` users load the page, `useAdminReports` calls `Promise.all` across all 4 report endpoints, causing the 2 restricted endpoints to reject with HTTP 403 `FORBIDDEN_INSUFFICIENT_ROLE` and failing the entire page.

---

## Task 1 — The 4-Eyes Approve 500 Error Diagnosis

### 1. Database Row for Action `3344a308-8b1e-4142-95ea-0e450e29c91c`
```json
{
  "id": "3344a308-8b1e-4142-95ea-0e450e29c91c",
  "action_type": "wallet_adjustment",
  "target_user_id": "2b9a1249-629a-4ddc-a101-38d9ef8a7cd5",
  "details": {
    "type": "credit",
    "amount": 5000,
    "reason": "unsettled deposit",
    "user_id": "2b9a1249-629a-4ddc-a101-38d9ef8a7cd5",
    "idempotency_key": "adj_1792838242290_lrlxo20"
  },
  "status": "pending",
  "created_at": "2026-10-24 10:37:22.974518+00"
}
```

### 2. Payload & Execution Analysis
- `action.details` contains: `{ type: 'credit', amount: 5000, reason: 'unsettled deposit', user_id: '2b9a1249-629a-4ddc-a101-38d9ef8a7cd5', idempotency_key: '...' }`.
- [AdminWalletService.approveAction](file:///C:/SkiesPro/src/modules/admin/services/AdminWalletService.ts#L145) correctly parses `details.user_id` (`'2b9a1249-629a-4ddc-a101-38d9ef8a7cd5'`), `details.type` (`'credit'`), and `details.amount` (`5000`).
- `approveAction` calls `applyWalletAdjustment` $\rightarrow$ `wallet.credit('2b9a1249-629a-4ddc-a101-38d9ef8a7cd5', 'real', 5000, ...)`
- In [walletService.ts](file:///C:/SkiesPro/src/modules/wallet/services/walletService.ts#L115):
  ```typescript
  const wallet = await walletRepo.findByUserIdForUpdate(userId, accountType);
  if (!wallet) throw new Error('Wallet not found');
  ```
- **Error Cause**: Target user `2b9a1249-629a-4ddc-a101-38d9ef8a7cd5` (`ryan41rays@gmail.com`) was created without a real wallet record in `wallet.wallets` (`wallet_count = 0`).
- `WalletService.credit` throws `Error('Wallet not found')`. `withMoneyTransaction` catches the error, executes `ROLLBACK`, and `AdminController.approveAction` responds with HTTP 500 `ADMIN_ACTION_FAILED`.

---

## Task 2 — Finance Role "Manual Adjust" Button Diagnosis

### 1. Frontend Visibility Logic ([FinanceOverviewPage.tsx:76](file:///C:/SkiesPro/frontend/src/pages/admin/FinanceOverviewPage.tsx#L76))
```tsx
<HasRole roles={['super_admin']}>
  <button
    onClick={() => setIsAdjustModalOpen(true)}
    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-lg shadow-blue-600/20"
  >
    <PlusCircle className="w-4 h-4" />
    Manual Wallet Adjustment
  </button>
</HasRole>
```

### 2. Backend Route Permissions ([admin.routes.ts:321](file:///C:/SkiesPro/src/modules/admin/admin.routes.ts#L321))
```typescript
router.post(
  '/wallets/adjust',
  requireAdminRole(['super_admin']),
  requireAdminMFA,
  validateWalletAdjustment,
  validate,
  (req: Request, res: Response) => controller.adjustWallet(req, res)
);
```

### 3. Diagnosis
Both frontend and backend intentionally restrict manual wallet adjustments exclusively to `super_admin`. Users with the `finance` role are explicitly excluded from performing manual wallet adjustments in both layers.

---

## Task 3 — Admin Role "Reports" Access Diagnosis

### 1. Permission Matrix Across Layers

| Layer | File Path | Allowed Roles for Reports |
| :--- | :--- | :--- |
| **Sidebar Menu** | [AdminSidebar.tsx:68](file:///C:/SkiesPro/frontend/src/components/admin/AdminSidebar.tsx#L68) | `['finance', 'admin', 'super_admin']` |
| **Frontend Route Guard** | [adminRoutes.tsx:98](file:///C:/SkiesPro/frontend/src/routes/adminRoutes.tsx#L98) | `['finance', 'admin', 'super_admin']` |
| **Backend Daily Revenue Route** | [admin.routes.ts:256](file:///C:/SkiesPro/src/modules/admin/admin.routes.ts#L256) | `['finance', 'admin', 'super_admin']` |
| **Backend Trade Volume Route** | [admin.routes.ts:262](file:///C:/SkiesPro/src/modules/admin/admin.routes.ts#L262) | `['finance', 'admin', 'super_admin']` |
| **Backend User Registrations Route** | [admin.routes.ts:268](file:///C:/SkiesPro/src/modules/admin/admin.routes.ts#L268) | `['admin', 'super_admin']` |
| **Backend Settlement Latency Route** | [admin.routes.ts:274](file:///C:/SkiesPro/src/modules/admin/admin.routes.ts#L274) | `['admin', 'super_admin']` |

### 2. Mismatch Analysis
- **For `finance` Role**: Frontend allows `finance` to open `/admin/reports`. However, when `useAdminReports` loads, it executes `Promise.all` across all 4 report endpoints. Routes `/reports/user-registrations` and `/reports/settlement-performance` reject with **HTTP 403 Forbidden** (`FORBIDDEN_INSUFFICIENT_ROLE`) for `finance` staff, causing `Promise.all` to fail and locking `finance` users out of the entire reports page with an "Insufficient privileges" error banner.
- **For `admin` Role**: Backend routes allow `admin` across all 4 endpoints (`daily-revenue`, `trade-volume`, `user-registrations`, `settlement-performance`).

Read-Only Diagnosis Complete

## Follow-up: Fixes Applied

Status: Executed & Verified

### Wallet auto-creation in transactional credit/debit

Updated `src/modules/wallet/services/walletService.ts`. Within the existing wallet transaction, both `credit()` and `debit()` now call `createIfAbsent(userId, 'KES', accountType)` when no wallet row is found, then re-read the wallet with `findByUserIdForUpdate()` before continuing. The repository uses `ON CONFLICT (user_id, account_type) DO NOTHING` to safely handle concurrent creation.

In both methods, the former missing-wallet exception was replaced with:

```typescript
let wallet = await walletRepo.findByUserIdForUpdate(userId, accountType);
if (!wallet) {
  await walletRepo.createIfAbsent(userId, 'KES', accountType);
  wallet = await walletRepo.findByUserIdForUpdate(userId, accountType);
}
if (!wallet) throw new Error('Unable to create wallet');
```

Insufficient-funds validation remains unchanged. A debit against a new zero-balance wallet fails and rolls back the transaction.

### Role permission updates

In `src/modules/admin/admin.routes.ts`:

```diff
-requireAdminRole(['admin', 'super_admin'])
+requireAdminRole(['finance', 'admin', 'super_admin'])
```

This was applied to `/reports/user-registrations` and `/reports/settlement-performance`.

```diff
-requireAdminRole(['super_admin'])
+requireAdminRole(['finance', 'super_admin'])
```

This was applied to `POST /wallets/adjust`. In `frontend/src/pages/admin/FinanceOverviewPage.tsx`, the Manual Wallet Adjustment button now uses `<HasRole roles={['finance', 'super_admin']}>`. No change was needed in `frontend/src/routes/adminRoutes.tsx`: its finance page guard already permits `finance`, `admin`, and `super_admin`.

### Integration test

Added a database integration case to `tests/admin/adminWalletService.integration.test.ts`. It creates a test user without a wallet, runs a small credit adjustment, and verifies the resulting real wallet has a 250 balance. Cleanup is scoped to generated test user IDs, their wallets and ledger entries, and created action IDs.

Focused test result: **1 suite passed, 2 tests passed**.

### Typecheck results

- Backend `npm run typecheck`: passed (0 errors).
- Frontend `npx tsc --noEmit -p frontend\tsconfig.json`: passed (0 errors).

### Full suite run 1

```text
Test Suites: 61 passed, 61 total
Tests:       395 passed, 395 total
Snapshots:   0 total
Time:        318.388 s, estimated 333 s
Ran all test suites.
```

### Full suite run 2

```text
Test Suites: 61 passed, 61 total
Tests:       395 passed, 395 total
Snapshots:   0 total
Time:        302.912 s, estimated 314 s
Ran all test suites.
```
