# WP-20 Phase 10 Systemic Fixes

Status: Executed & Verified

## Summary
This pass fixed the high-risk transactional wallet path, corrected invalid admin MFA step-up error handling, hardened the admin controller with shared error responses, and standardized date/label/number formatting across the admin surfaces. The final code was typechecked and the full suite passed twice on the final branch state.

## 1) Money engine fix: transactional wallet mutation and approval flow

### Diff: `src/modules/admin/services/AdminWalletService.ts`
```diff
+import { PoolClient } from 'pg';
+import { Decimal } from 'decimal.js';
+import { pgPool } from '../../../config/database.js';
 import { AdminAuditService } from './AdminAuditService.js';
 import { AdminRepository } from '../repositories/AdminRepository.js';
 import { TokenService } from '../../auth/services/tokenService.js';
 import { MfaService } from '../../auth/services/mfaService.js';
 import { MfaRepository } from '../../auth/repositories/mfaRepository.js';
+import { WalletService } from '../../wallet/services/walletService.js';
 
 export class AdminWalletService {
   private readonly repo: AdminRepository;
   private readonly audit: AdminAuditService;
+  private readonly walletServiceFactory: (client: PoolClient) => WalletService;
 
-  constructor(repo?: AdminRepository, audit?: AdminAuditService) {
+  constructor(
+    repo?: AdminRepository,
+    audit?: AdminAuditService,
+    walletServiceFactory: (client: PoolClient) => WalletService = (client) => new WalletService(client)
+  ) {
     this.repo = repo || new AdminRepository();
     this.audit = audit || new AdminAuditService();
+    this.walletServiceFactory = walletServiceFactory;
   }
+
+  private async withMoneyTransaction<T>(
+    operation: (
+      client: PoolClient,
+      repository: AdminRepository,
+      audit: AdminAuditService,
+      wallet: WalletService
+    ) => Promise<T>
+  ): Promise<T> {
+    const client = await pgPool.connect();
+    try {
+      await client.query('BEGIN');
+      const repository = new AdminRepository(client);
+      const result = await operation(
+        client,
+        repository,
+        new AdminAuditService(repository),
+        this.walletServiceFactory(client)
+      );
+      await client.query('COMMIT');
+      return result;
+    } catch (error) {
+      await client.query('ROLLBACK');
+      throw error;
+    } finally {
+      client.release();
+    }
+  }
+
+  private async applyWalletAdjustment(
+    wallet: WalletService,
+    userId: string,
+    amount: Decimal,
+    type: 'credit' | 'debit',
+    referenceId: string,
+    description: string
+  ): Promise<void> {
+    if (type === 'credit') {
+      await wallet.credit(userId, 'real', amount, 'admin_adjustment', referenceId, description);
+    } else {
+      await wallet.debit(userId, 'real', amount, 'admin_adjustment', referenceId, description);
+    }
+  }
@@
-    const requiresApproval = AdminWalletService.requiresSecondApproval(input.amount);
-
-    const action = await this.repo.createAdminAction({
+    const amount = new Decimal(input.amount);
+    if (!amount.isFinite() || !amount.greaterThan(0)) {
+      throw new Error('Wallet adjustment amount must be positive');
+    }
+    return this.withMoneyTransaction(async (client, repository, audit, wallet) => {
+      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [input.idempotencyKey]);
+      const existing = await repository.getAdminActionByIdempotencyKey(input.idempotencyKey);
+      if (existing) {
+        ...
+      }
+
+      const requiresApproval = AdminWalletService.requiresSecondApproval(input.amount);
+      const action = await repository.createAdminAction({
         adminId: input.actorId,
         actionType: 'wallet_adjustment',
         targetUserId: input.userId,
@@
-      if (requiresApproval) {
-        await this.audit.createEntry({ ... });
+      if (requiresApproval) {
+        await audit.createEntry({ ... });
         return { status: 'pending_second_approval', ... };
       }
 
-      await this.audit.createEntry({ ... as applied ... });
+      await this.applyWalletAdjustment(wallet, input.userId, amount, input.type, action.id, input.reason);
+      const completedAction = await repository.approveAdminAction(action.id, input.actorId);
+      if (!completedAction) throw new Error('Unable to mark wallet adjustment as completed');
+      await audit.createEntry({ ...wallet_adjustment_applied... });
       return {
         status: 'applied',
         actionId: action.id,
         amount: input.amount,
         type: input.type,
         userId: input.userId,
       };
-    }
+    });
   }
@@
-    const action = await this.repo.getAdminActionForUpdate(actionId);
+    return this.withMoneyTransaction(async (_client, repository, audit, wallet) => {
+      const action = await repository.getAdminActionForUpdate(actionId);
       if (!action) throw new Error('Action not found');
       ...
       if (String(action.action_type).toLowerCase() === 'wallet_adjustment') {
         const details = ...
         ...
-        await this.applyWalletAdjustment(
+        await this.applyWalletAdjustment(
           wallet,
           userId,
           amount,
           type,
           actionId,
           details.reason || 'Approved admin wallet adjustment'
         );
       }
 
-      const updated = await this.repo.approveAdminAction(actionId, approvedBy);
+      const updated = await repository.approveAdminAction(actionId, approvedBy);
       if (!updated) throw new Error('Cannot approve action');
-      await this.audit.createEntry({ ... });
+      await audit.createEntry({ ... });
       return { status: 'approved', actionId, approvedBy };
+    });
   }
```

### Result
- Immediate wallet adjustments now execute real wallet mutations in the same PostgreSQL transaction as the admin action.
- Four-eyes approval actions now apply the wallet change before approval is finalized, and all writes roll back together if any step fails.
- Duplicate `idempotencyKey` retries are recognized and guarded against cross-request mutation.

## 2) Invalid TOTP no longer returns 401

### Diff: `src/modules/auth/controllers/authController.ts`
```diff
-  constructor() {
-    this.authService = new AuthService();
+  constructor(authService = new AuthService()) {
+    this.authService = authService;
   }
@@
-      const status = code === 'FORBIDDEN_NOT_ADMIN' ? 403 : 401;
+      const isInvalidTotp = code === 'INVALID_TOTP';
+      const isForbidden = code === 'FORBIDDEN_NOT_ADMIN';
+      const isMfaNotConfigured = code === 'MFA_NOT_CONFIGURED';
+      const status = isForbidden || isMfaNotConfigured ? 403 : isInvalidTotp ? 400 : 500;
+      const responseCode = isInvalidTotp
+        ? 'INVALID_TOTP'
+        : isMfaNotConfigured
+          ? 'MFA_NOT_CONFIGURED'
+          : isForbidden
+            ? code
+            : 'ADMIN_MFA_STEP_UP_FAILED';
@@
-      res.status(status).json({ error: code, code });
+      res.status(status).json({
+        error: isInvalidTotp
+          ? 'Invalid TOTP code'
+          : isMfaNotConfigured
+            ? 'Administrator MFA is not configured'
+            : isForbidden
+              ? code
+              : 'Internal server error',
+        code: responseCode,
+      });
```

### Result
- Invalid TOTP now returns `400` with `{ error: 'Invalid TOTP code', code: 'INVALID_TOTP' }`.
- MFA-not-configured and non-admin cases remain `403`.
- Unexpected server failures still return `500`.

## 3) Shared admin controller error handling and 16 method hardening

### Summary of controller changes
The admin controller now routes all of the requested actions through a shared `respondToAdminAction` helper that:
- wraps each operation in `try/catch`
- logs the error with `logger.error`
- returns `500 { error: 'Internal server error', code: 'ADMIN_ACTION_FAILED' }`

Covered methods:
- `listUsers`
- `getUserById`
- `updateUserStatus`
- `getUserLedger`
- `listPendingKyc`
- `getKycById`
- `reviewKyc`
- `listWithdrawals`
- `listPendingWithdrawals`
- `getWithdrawalById`
- `approveWithdrawal`
- `rejectWithdrawal`
- `updateAssetConfig`
- `adjustWallet`
- `approveAction`
- `listPendingActions`

### Diff snippet: `src/modules/admin/controllers/AdminController.ts`
```diff
 export class AdminController {
@@
   private async respondToAdminAction<T>(
     req: Request,
     res: Response,
     action: string,
     operation: () => Promise<T>,
     status: number | ((result: T) => number) = 200
   ): Promise<void> {
     try {
       const result = await operation();
       const responseStatus = typeof status === 'function' ? status(result) : status;
       res.status(responseStatus).json({ data: result, meta: { request_id: req.correlationId } });
     } catch (error) {
       logger.error(`${action} failed`, {
         error: error instanceof Error ? error.message : String(error),
         request_id: req.correlationId,
       });
       res.status(500).json({ error: 'Internal server error', code: 'ADMIN_ACTION_FAILED' });
     }
   }
```

## 4) Date and label formatting

The requested date surfaces were standardized to Kenyan EAT formatting and the shared label formatter was applied across admin UI.

### Formatting helper diff: `frontend/src/shared/utils/safeFormatters.ts`
```diff
+export const formatLabel = (value: unknown): string => {
+  if (value == null || value === '') return 'N/A';
+  return String(value)
+    .replace(/[_\s]+/g, ' ')
+    .trim()
+    .toLowerCase()
+    .replace(/\b\w/g, (character) => character.toUpperCase());
+};
```

Updated files include:
- `frontend/src/components/admin/UserTable.tsx`
- `frontend/src/components/admin/UserDetailDrawer.tsx`
- `frontend/src/components/admin/KycQueueTable.tsx`
- `frontend/src/components/admin/KycDocumentViewer.tsx`
- `frontend/src/components/admin/PendingWithdrawalsTable.tsx`
- `frontend/src/components/admin/FourEyesActionCard.tsx`
- `frontend/src/pages/admin/SupportTicketsPage.tsx`
- `frontend/src/components/admin/TicketDetailDrawer.tsx`
- `frontend/src/pages/wallet/components/TransactionHistory.tsx`

Also updated:
- `frontend/src/pages/admin/PlatformSettingsPage.tsx` to show loading and empty states, plus numeric value formatting with units.
- `frontend/src/pages/admin/SupportTicketsPage.tsx` priority filter migrated to shared filter tabs.
- `frontend/src/pages/admin/RiskDashboardPage.tsx` and `frontend/src/components/admin/AuditLogsTable.tsx` now use `formatLabel` for raw action/entity names.

## 5) Integration tests added

Added regression coverage for the financial and MFA fixes:
- `tests/admin/adminWalletService.integration.test.ts`
- `tests/auth/adminMfaStepUp.test.ts`

These cover:
- transactional wallet adjustment
- approval path changes wallet balance
- invalid TOTP returns `400` and `INVALID_TOTP`

## 6) Typecheck results

```text
> skiespro@1.0.0 typecheck
> tsc --noEmit

(exit code 0)
```

```text
> npx.cmd tsc --noEmit -p frontend\tsconfig.json

(exit code 0)
```

## 7) Full suite run 1
```text
PASS tests/config/config.controller.test.ts
  Public config controller
    √ returns only the allow-listed trader settings (2 ms)

...
Test Suites: 61 passed, 61 total
Tests:       394 passed, 394 total
Snapshots:   0 total
Time:        320.181 s, estimated 431 s
Ran all test suites.
Force exiting Jest: Have you considered using `--detectOpenHandles` to detect async operations that kept running after all tests finished?
```

## 8) Full suite run 2
```text
...
PASS tests/pricing/validation.test.ts
  PriceValidationService
    √ should validate first tick successfully (3 ms)
    √ should validate tick within 5% successfully (2 ms)
    √ should reject tick with > 5% deviation (13 ms)
    √ should reject stale (older) tick (6 ms)
    √ should detect stale price based on threshold (1 ms)
    √ should not mark fresh price as stale (1 ms)

Test Suites: 61 passed, 61 total
Tests:       394 passed, 394 total
Snapshots: 0 total
Time:        320.639 s
Ran all test suites.
Force exiting Jest: Have you considered using `--detectOpenHandles` to detect async operations that kept running after all tests finished?
```

## Final note
The high-risk financial flows were fixed in production code, invalid MFA step-up codes no longer log admins out with a misleading 401, and the admin UI now uses consistent date/label/number displays. The final code was validated with backend/frontend typecheck and passed the full suite twice on the final branch state.
