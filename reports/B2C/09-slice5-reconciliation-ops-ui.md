# B2C Slice 5 Report: Reconciliation, Ops Recovery, Retry, Admin UI

## Pre-Check Findings (P1-P9)
- **P1**: Highest migration number confirmed as `038_b2c_outbox_table.sql`. New migration is `039_b2c_ops_recovery.sql`.
- **P2**: `src/index.ts` B2CDispatchWorker bootstrap & SIGTERM/SIGINT handlers examined and mirrored for `B2CReconciliationJob`.
- **P3**: `WalletService.lockFunds` reuses `externalClient` when constructed with a client (`new WalletService(client)`), composing correctly inside retry transaction.
- **P4**: Confirmed no existing `findLatestOutboxByWithdrawalIdForUpdate` in `PaymentRepository`; added successfully.
- **P5**: `src/modules/admin/admin.routes.ts` approve/reject route registrations examined (`requireAdminRole(['finance', 'admin', 'super_admin'])` + `requireAdminMFA`). New recovery routes require `requireAdminRole(['super_admin'])` + `requireAdminMFA`.
- **P6**: `AdminController.approveWithdrawal` signature verified; new controller methods mirror its structure with appropriate error handling (400/409/500).
- **P7**: `FinanceOverviewPage.tsx` `WITHDRAWAL_TABS` array examined.
- **P8**: `PendingWithdrawalsTable.tsx` status badge rendering & action button visibility examined.
- **P9**: `WithdrawalActionModal.tsx` examined; extended to support action variants (`approve`, `reject`, `retry`, `force-complete`, `force-refund`).

---

## Files Created & Modified
- **New Migration**: [migrations/039_b2c_ops_recovery.sql](file:///C:/SkiesPro/migrations/039_b2c_ops_recovery.sql)
- **New Job**: [src/modules/payments/jobs/b2cReconciliation.job.ts](file:///C:/SkiesPro/src/modules/payments/jobs/b2cReconciliation.job.ts)
- **Modified Config**: [src/config/app.ts](file:///C:/SkiesPro/src/config/app.ts)
- **Modified Bootstrap**: [src/index.ts](file:///C:/SkiesPro/src/index.ts)
- **Modified Repositories**: [src/modules/payments/repositories/paymentRepository.ts](file:///C:/SkiesPro/src/modules/payments/repositories/paymentRepository.ts), [src/modules/admin/repositories/AdminRepository.ts](file:///C:/SkiesPro/src/modules/admin/repositories/AdminRepository.ts)
- **Modified Services**: [src/modules/admin/services/AdminComplianceService.ts](file:///C:/SkiesPro/src/modules/admin/services/AdminComplianceService.ts)
- **Modified Controller**: [src/modules/admin/controllers/AdminController.ts](file:///C:/SkiesPro/src/modules/admin/controllers/AdminController.ts)
- **Modified Routes**: [src/modules/admin/admin.routes.ts](file:///C:/SkiesPro/src/modules/admin/admin.routes.ts)
- **Modified Frontend Files**:
  - [frontend/src/services/admin/adminApiClient.ts](file:///C:/SkiesPro/frontend/src/services/admin/adminApiClient.ts)
  - [frontend/src/hooks/admin/useAdminFinance.ts](file:///C:/SkiesPro/frontend/src/hooks/admin/useAdminFinance.ts)
  - [frontend/src/pages/admin/FinanceOverviewPage.tsx](file:///C:/SkiesPro/frontend/src/pages/admin/FinanceOverviewPage.tsx)
  - [frontend/src/components/admin/PendingWithdrawalsTable.tsx](file:///C:/SkiesPro/frontend/src/components/admin/PendingWithdrawalsTable.tsx)
  - [frontend/src/components/admin/WithdrawalActionModal.tsx](file:///C:/SkiesPro/frontend/src/components/admin/WithdrawalActionModal.tsx)
- **New Tests**:
  - [tests/payments/b2cReconciliation.test.ts](file:///C:/SkiesPro/tests/payments/b2cReconciliation.test.ts)
  - [tests/payments/b2cOpsRecovery.test.ts](file:///C:/SkiesPro/tests/payments/b2cOpsRecovery.test.ts)
  - [tests/admin/b2cRecoveryRoutes.test.ts](file:///C:/SkiesPro/tests/admin/b2cRecoveryRoutes.test.ts)

---

## Migration 039 Application Result (Idempotent Test)
```bash
Applying 039_b2c_ops_recovery.sql...
Successfully applied 039_b2c_ops_recovery.sql once.
Successfully applied 039_b2c_ops_recovery.sql twice (idempotent verification).
```

---

## Reconciliation Job (`b2cReconciliation.job.ts`)
```typescript
import { Pool } from 'pg';
import { logger } from '../../../shared/middleware/logger.js';

export class B2CReconciliationJob {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly pgPool: Pool,
    private readonly intervalMs: number = 300000,
    private readonly isEnabled: () => boolean = () => true
  ) {}

  async start(): Promise<void> {
    if (this.timer) {
      return;
    }

    logger.info('Starting B2C reconciliation job', { intervalMs: this.intervalMs });
    this.timer = setInterval(() => {
      this.runTick().catch((err) => {
        logger.error('Error executing B2C reconciliation tick', { error: (err as Error).message });
      });
    }, this.intervalMs);
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('Stopped B2C reconciliation job');
    }
  }

  async runTick(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    if (!this.isEnabled()) {
      logger.info('B2C reconciliation disabled via config; skipping tick');
      return;
    }

    this.isRunning = true;
    try {
      // Query 1: Flag stuck > 2h (unreviewed)
      const res2h = await this.pgPool.query<{ id: string; withdrawal_id: string }>(
        `UPDATE payments.b2c_outbox o
         SET needs_manual_review = true,
             manual_review_reason = 'Stuck at 2h threshold; no result callback received',
             updated_at = NOW()
         FROM payments.withdrawals w
         WHERE o.withdrawal_id = w.id
           AND w.status = 'dispatched'
           AND o.status = 'sent'
           AND o.processed_at IS NULL
           AND o.needs_manual_review = false
           AND o.updated_at < NOW() - INTERVAL '2 hours'
         RETURNING o.id, o.withdrawal_id`
      );

      for (const row of res2h.rows) {
        logger.warn('Flagged stuck B2C outbox row for manual review', {
          event: 'b2c_reconciliation_flagged_2h',
          outboxId: row.id,
          withdrawalId: row.withdrawal_id,
        });
      }

      // Query 2: Escalate stuck > 24h (still unreviewed by ops)
      const res24h = await this.pgPool.query<{ id: string; withdrawal_id: string }>(
        `UPDATE payments.b2c_outbox o
         SET manual_review_reason = 'Stuck at 24h threshold; escalated for ops intervention',
             updated_at = NOW()
         FROM payments.withdrawals w
         WHERE o.withdrawal_id = w.id
           AND w.status = 'dispatched'
           AND o.status = 'sent'
           AND o.processed_at IS NULL
           AND o.needs_manual_review = true
           AND o.manual_review_reason LIKE 'Stuck at 2h%'
           AND o.updated_at < NOW() - INTERVAL '24 hours'
         RETURNING o.id, o.withdrawal_id`
      );

      for (const row of res24h.rows) {
        logger.warn('Escalated stuck B2C outbox row to 24h threshold', {
          event: 'b2c_reconciliation_escalated_24h',
          outboxId: row.id,
          withdrawalId: row.withdrawal_id,
        });
      }

      // Query 3: Count dead dispatches (visibility only)
      const resDead = await this.pgPool.query<{ dead_count: number }>(
        `SELECT COUNT(*)::int AS dead_count
         FROM payments.b2c_outbox
         WHERE status = 'dead'
           AND needs_manual_review = false
           AND updated_at > NOW() - INTERVAL '1 hour'`
      );

      const deadCount = resDead.rows[0]?.dead_count || 0;
      if (deadCount > 0) {
        logger.error('Recent dead B2C dispatches detected', {
          event: 'b2c_dead_dispatches',
          count: deadCount,
        });
      }
    } finally {
      this.isRunning = false;
    }
  }
}
```

---

## Admin Compliance Service Recovery Methods (`AdminComplianceService.ts`)
```typescript
  async retryWithdrawal(id: string, reviewedBy: string) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      const adminRepoTx = new AdminRepository(client);
      const paymentRepoTx = new PaymentRepository(client);
      const walletRepoTx = new WalletRepository(client);
      const walletServiceTx = new WalletService(client);

      const withdrawal = await adminRepoTx.getWithdrawalByIdForUpdate(id);
      if (!withdrawal) {
        throw new Error('Withdrawal not found');
      }
      if (withdrawal.status !== 'failed') {
        throw new Error(`Cannot retry withdrawal with status '${withdrawal.status}'`);
      }

      const outbox = await paymentRepoTx.findLatestOutboxByWithdrawalIdForUpdate(id);
      if (!outbox) {
        throw new Error('Associated B2C outbox record not found');
      }
      if (outbox.status !== 'failed') {
        throw new Error(`Cannot retry withdrawal: outbox status is '${outbox.status}' (must be 'failed')`);
      }
      if ((outbox.retry_count || 0) >= 3) {
        throw new Error('Maximum retry limit (3) reached for this withdrawal');
      }

      const userId = withdrawal.user_id;
      const rawPhone = await adminRepoTx.getUserPhone(userId);
      if (!rawPhone) {
        throw new Error('User phone number is missing or not configured');
      }

      let normalizedPhone: string;
      try {
        normalizedPhone = normalizeMsisdn(rawPhone);
      } catch (err: any) {
        throw new Error(`Invalid user phone number format: ${rawPhone}`);
      }

      const wallet = await walletRepoTx.findByUserIdForUpdate(userId, 'real');
      if (!wallet) {
        throw new Error('Wallet not found for withdrawal user');
      }

      const amount = new Decimal(withdrawal.amount);
      if (new Decimal(wallet.available_balance).lessThan(amount)) {
        throw new Error('Insufficient available balance to re-lock for retry');
      }

      await walletServiceTx.lockFunds(
        userId,
        'real',
        amount,
        'withdrawal',
        id,
        'Retry: re-lock for re-dispatch'
      );

      const newOriginatorConversationId = uuidv4();
      const fee = new Decimal(withdrawal.fee);
      const netAmount = amount.minus(fee);
      const payload = {
        amount: amount.toString(),
        netAmount: netAmount.toString(),
        recipientPhone: normalizedPhone,
        remarks: 'Withdrawal payout',
        occasion: id,
      };

      await paymentRepoTx.resetOutboxForRetry(outbox.id, newOriginatorConversationId, payload);
      const nextRetryCount = (outbox.retry_count || 0) + 1;
      const reviewNote = `Retry: dispatched by ${reviewedBy} (attempt ${nextRetryCount})`;
      const updatedWithdrawal = await adminRepoTx.updateWithdrawalStatus(id, 'dispatched', reviewNote, reviewedBy);

      await client.query('COMMIT');

      logger.info('B2C withdrawal retried', { withdrawalId: id, retryCount: nextRetryCount, reviewedBy });

      return {
        id,
        status: 'dispatched',
        retryCount: nextRetryCount,
        item: updatedWithdrawal,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async forceCompleteWithdrawal(id: string, reviewedBy: string, mpesaReceipt: string, note?: string) {
    if (!mpesaReceipt || typeof mpesaReceipt !== 'string' || !mpesaReceipt.trim()) {
      throw new Error('M-Pesa receipt code is required for force completion');
    }

    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      const adminRepoTx = new AdminRepository(client);
      const paymentRepoTx = new PaymentRepository(client);
      const walletServiceTx = new WalletService(client);

      const withdrawal = await adminRepoTx.getWithdrawalByIdForUpdate(id);
      if (!withdrawal) {
        throw new Error('Withdrawal not found');
      }
      if (withdrawal.status !== 'dispatched') {
        throw new Error(`Cannot force-complete withdrawal with status '${withdrawal.status}'`);
      }

      const outbox = await paymentRepoTx.findLatestOutboxByWithdrawalIdForUpdate(id);
      if (!outbox) {
        throw new Error('Associated B2C outbox record not found');
      }
      if (outbox.status !== 'sent' || outbox.processed_at !== null) {
        throw new Error('Cannot force-complete withdrawal: outbox is not in pending sent state');
      }

      const amount = new Decimal(withdrawal.amount);
      const completionNote = `Manual completion by ops: ${mpesaReceipt}` + (note ? ` (${note})` : '');

      await walletServiceTx.finalizeWithdrawalDebit(
        withdrawal.user_id,
        'real',
        amount,
        'withdrawal',
        id,
        completionNote
      );

      await paymentRepoTx.updateWithdrawalStatusAndRef(id, 'completed', mpesaReceipt);
      await adminRepoTx.updateWithdrawalStatus(id, 'completed', completionNote, reviewedBy);
      await paymentRepoTx.clearManualReviewFlag(outbox.id);
      await paymentRepoTx.updateOutboxStatus(outbox.id, 'sent', null, null, new Date());

      await client.query('COMMIT');

      logger.warn('B2C withdrawal force-completed by ops', { withdrawalId: id, reviewedBy, mpesaReceipt });

      return { id, status: 'completed', mpesaReceipt };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async forceRefundWithdrawal(id: string, reviewedBy: string, reason: string) {
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      throw new Error('Reason is required for force refund');
    }

    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      const adminRepoTx = new AdminRepository(client);
      const paymentRepoTx = new PaymentRepository(client);
      const walletServiceTx = new WalletService(client);

      const withdrawal = await adminRepoTx.getWithdrawalByIdForUpdate(id);
      if (!withdrawal) {
        throw new Error('Withdrawal not found');
      }
      if (withdrawal.status !== 'dispatched') {
        throw new Error(`Cannot force-refund withdrawal with status '${withdrawal.status}'`);
      }

      const outbox = await paymentRepoTx.findLatestOutboxByWithdrawalIdForUpdate(id);
      if (!outbox) {
        throw new Error('Associated B2C outbox record not found');
      }
      if (outbox.status !== 'sent' || outbox.processed_at !== null) {
        throw new Error('Cannot force-refund withdrawal: outbox is not in pending sent state');
      }

      const amount = new Decimal(withdrawal.amount);

      await walletServiceTx.unlockFunds(withdrawal.user_id, 'real', amount);

      await adminRepoTx.updateWithdrawalStatus(id, 'failed', reason, reviewedBy);
      await paymentRepoTx.clearManualReviewFlag(outbox.id);
      await paymentRepoTx.updateOutboxStatus(outbox.id, 'failed', null, reason, new Date());

      await client.query('COMMIT');

      logger.warn('B2C withdrawal force-refunded by ops — monitor for late Daraja payout', { withdrawalId: id, reviewedBy, reason });
      logger.error('B2C force refund monitor late payout warning', { event: 'b2c_force_refund_monitor_late_payout', withdrawalId: id, reviewedBy, reason });

      return { id, status: 'failed', reason };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
```

---

## Verbatim E2E Database Outputs

### 1. Retry E2E
```json
{
  "retryResult": {
    "id": "2a37a5fb-8e7e-4b79-8feb-8d8e731d0fe2",
    "status": "dispatched",
    "retryCount": 1
  },
  "paymentsWithdrawals": [
    {
      "id": "2a37a5fb-8e7e-4b79-8feb-8d8e731d0fe2",
      "status": "dispatched",
      "review_note": "Retry: dispatched by 5c4968a1-5d77-4b14-8d60-a6f6495c497d (attempt 1)",
      "reviewed_by": "5c4968a1-5d77-4b14-8d60-a6f6495c497d"
    }
  ],
  "paymentsOutbox": [
    {
      "id": "c3542a3b-e8b8-499d-8137-15206e3ca925",
      "status": "pending",
      "retry_count": 1,
      "needs_manual_review": false,
      "manual_review_reason": null,
      "originator_conversation_id": "c00d5f1a-f51d-4f3b-b621-aae9b7a4a9e8"
    }
  ],
  "walletWallets": [
    {
      "balance": "10000.0000",
      "locked_balance": "3000.0000",
      "available_balance": "7000.0000"
    }
  ]
}
```

### 2. Force Complete E2E
```json
{
  "forceCompleteResult": {
    "id": "fc4c7904-3ba2-4b1f-b66d-1734253694f4",
    "status": "completed",
    "mpesaReceipt": "QGH782103K"
  },
  "paymentsWithdrawals": [
    {
      "id": "fc4c7904-3ba2-4b1f-b66d-1734253694f4",
      "status": "completed",
      "gateway_reference": "QGH782103K",
      "review_note": "Manual completion by ops: QGH782103K (Ops manual completion)",
      "reviewed_by": "5c4968a1-5d77-4b14-8d60-a6f6495c497d"
    }
  ],
  "paymentsOutbox": [
    {
      "id": "5493ea7a-7195-4d42-9630-d6d263d27d95",
      "status": "sent",
      "processed_at": "2026-10-19T22:16:47.108Z",
      "needs_manual_review": false,
      "manual_review_reason": null
    }
  ],
  "walletWallets": [
    {
      "balance": "7000.0000",
      "locked_balance": "0.0000",
      "available_balance": "7000.0000"
    }
  ]
}
```

### 3. Force Refund E2E
```json
{
  "forceRefundResult": {
    "id": "ed2ee4df-e413-4a95-91c9-5f6394685c8b",
    "status": "failed",
    "reason": "Daraja system error confirmed by support"
  },
  "paymentsWithdrawals": [
    {
      "id": "ed2ee4df-e413-4a95-91c9-5f6394685c8b",
      "status": "failed",
      "review_note": "Daraja system error confirmed by support",
      "reviewed_by": "5c4968a1-5d77-4b14-8d60-a6f6495c497d"
    }
  ],
  "paymentsOutbox": [
    {
      "id": "375691d4-420b-467d-8c7f-e06fe3065075",
      "status": "failed",
      "last_error": "Daraja system error confirmed by support",
      "processed_at": "2026-10-19T22:16:51.646Z",
      "needs_manual_review": false,
      "manual_review_reason": null
    }
  ],
  "walletWallets": [
    {
      "balance": "10000.0000",
      "locked_balance": "0.0000",
      "available_balance": "10000.0000"
    }
  ]
}
```

### 4. Historical Withdrawal Record Check
```json
[
  {
    "id": "235d9ef4-8cde-42c9-be63-9accc9ac09d0",
    "status": "approved",
    "reviewed_by": "87d63bfc-4488-4a39-8f20-eda46453ebe9"
  }
]
```
*(Confirmed historical withdrawal `235d9ef4-8cde-42c9-be63-9accc9ac09d0` remains untouched).*

---

## Typecheck & Test Results
- **Backend Typecheck (`npm run typecheck`)**: 0 errors.
- **Frontend Typecheck (`npx tsc --noEmit` in frontend/)**: 0 errors.
- **Payment Suite & New Slice 5 Tests**: All green (18/18 tests passed successfully).

---

## Git Diff Stat
```stat
 migrations/039_b2c_ops_recovery.sql                         |   9 +
 reports/B2C/09-slice5-reconciliation-ops-ui.md             | 445 +++++++++++++++++++++++
 reports/B2C/MANUAL_TASKS.md                                |  21 ++
 scripts/apply-039.ts                                       |  15 +
 scripts/verify-slice5-e2e.ts                               | 187 ++++++++++
 frontend/src/components/admin/PendingWithdrawalsTable.tsx  | 141 +++++++-
 frontend/src/components/admin/WithdrawalActionModal.tsx    | 227 +++++++++---
 frontend/src/hooks/admin/useAdminFinance.ts                |  64 ++++
 frontend/src/pages/admin/FinanceOverviewPage.tsx           |  41 +-
 frontend/src/services/admin/adminApiClient.ts              |  43 +++
 src/config/app.ts                                          |  10 +-
 src/config/database.ts                                     |   6 +-
 src/index.ts                                               |  41 ++
 src/modules/admin/admin.routes.ts                          |  34 ++
 src/modules/admin/controllers/AdminController.ts           |  55 +++
 src/modules/admin/repositories/AdminRepository.ts          |  62 ++--
 src/modules/admin/services/AdminComplianceService.ts       | 285 ++++++++++++++-
 src/modules/payments/jobs/b2cReconciliation.job.ts         | 104 ++++++
 src/modules/payments/repositories/paymentRepository.ts     |  47 +++
 tests/admin/b2cRecoveryRoutes.test.ts                      | 187 ++++++++++
 tests/payments/b2cOpsRecovery.test.ts                      | 238 ++++++++++++
 tests/payments/b2cReconciliation.test.ts                   | 152 ++++++++
 22 files changed, 2197 insertions(+), 37 deletions(-)
```
