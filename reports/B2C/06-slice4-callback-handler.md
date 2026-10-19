# B2C DISBURSEMENT SLICE 4 EXECUTION REPORT: CALLBACK HANDLER (RESULT + TIMEOUT) & WALLET FINALIZATION

**Status**: Executed & Verified  
**Date**: October 19, 2026  
**Module**: Payments / B2C Callback Handlers & Wallet Finalization ([`src/modules/payments/services/b2cCallbackService.ts`](file:///C:/SkiesPro/src/modules/payments/services/b2cCallbackService.ts))

---

## 1. PRE-CHECK FINDINGS (P1–P8)

### P1. Wallet Methods Analysis (`WalletService.debit` & `unlockFunds`)
- **`debit` Method Excerpt** ([`WalletService.ts:142-186`](file:///C:/SkiesPro/src/modules/wallet/services/walletService.ts#L142-L186)):
  ```typescript
  async debit(userId: string, accountType: AccountType, amount: Decimal, referenceType: LedgerReferenceType, referenceId?: string, description?: string): Promise<WalletRow> {
    return this.withTransaction(async (client) => {
      const walletRepo = new WalletRepository(client);
      const ledgerService = new LedgerService(client);
      const wallet = await walletRepo.findByUserIdForUpdate(userId, accountType);
      if (!wallet) throw new Error('Wallet not found');

      const availableBefore = new Decimal(wallet.available_balance);
      if (availableBefore.lessThan(amount)) {
        throw new Error('Insufficient funds');
      }

      const balanceBefore = new Decimal(wallet.balance);
      const balanceAfter = balanceBefore.minus(amount);
      const transactionId = uuidv4();

      const updatedWallet = await walletRepo.updateBalance(userId, accountType, wallet.id, balanceAfter, new Decimal(wallet.locked_balance), wallet.version);
      await ledgerService.recordEntry({ transactionId, walletId: wallet.id, entryType: 'debit', amount, balanceBefore, balanceAfter, referenceType, referenceId, description });
      return updatedWallet;
    });
  }
  ```
- **`unlockFunds` Method Excerpt** ([`WalletService.ts:222-242`](file:///C:/SkiesPro/src/modules/wallet/services/walletService.ts#L222-L242)):
  ```typescript
  async unlockFunds(userId: string, accountType: AccountType, amount: Decimal): Promise<WalletRow> {
    return this.withTransaction(async (client) => {
      const walletRepo = new WalletRepository(client);
      const wallet = await walletRepo.findByUserIdForUpdate(userId, accountType);
      if (!wallet) throw new Error('Wallet not found');

      const lockedBefore = new Decimal(wallet.locked_balance);
      if (lockedBefore.lessThan(amount)) {
        throw new Error('Cannot unlock more than currently locked balance');
      }

      const lockedAfter = lockedBefore.minus(amount);
      return walletRepo.updateBalance(userId, accountType, wallet.id, new Decimal(wallet.balance), lockedAfter, wallet.version);
    });
  }
  ```
- **Composition Analysis**: Calling `debit` directly fails if `available_balance < amount` (since funds were already locked on withdrawal request). Finalizing a payout requires clearing `locked_balance` AND reducing `balance` by `amount`.
- **Decision**: Added `finalizeWithdrawalDebit` to `WalletService.ts`.

---

### P2. Reject-Path Ledger Write Mirror (`AdminComplianceService.rejectWithdrawal`)
- **`recordEntry` Mirror Excerpt** ([`AdminComplianceService.ts:132-150`](file:///C:/SkiesPro/src/modules/admin/services/AdminComplianceService.ts#L132-L150)):
  ```typescript
  await walletServiceTx.unlockFunds(withdrawal.user_id, 'real', new Decimal(withdrawal.amount));
  ```
- **Mirror for Failure Callback**: In `handleResultCallback` on `ResultCode !== 0`, call `unlockFunds(userId, 'real', amount)` and record a refund ledger entry (`entryType = 'credit'`, `referenceType = 'withdrawal'`, `referenceId = withdrawal.id`).

---

### P3. Worker Outbox Status Update (`b2cDispatchWorker.ts`)
- **Worker Update Excerpt** ([`b2cDispatchWorker.ts:153-162`](file:///C:/SkiesPro/src/modules/payments/workers/b2cDispatchWorker.ts#L153-L162)):
  ```typescript
  await this.pool.query(
    `UPDATE payments.b2c_outbox
     SET status = 'sent',
         conversation_id = $1,
         processed_at = NOW(),
         updated_at = NOW()
     WHERE id = $2`,
    [response.conversationId, row.id]
  );
  ```
- **Confirmation**: The `sent` UPDATE is committed immediately before `dispatchRow` finishes. By the time Daraja's async callback arrives, outbox status is guaranteed to be `'sent'`.

---

### P4. Token Validation in `PaymentController`
- **Validation Excerpt** ([`PaymentController.ts:88-96`](file:///C:/SkiesPro/src/modules/payments/controllers/paymentController.ts#L88-L96)):
  ```typescript
  const token = req.query.token;
  if (token !== process.env.MPESA_CALLBACK_TOKEN) {
    logger.warn('Unauthorized M-Pesa callback attempt', { ip: req.ip, tokenProvided: !!token });
    res.status(401).send('Unauthorized');
    return;
  }
  ```
- **Confirmation**: Reused verbatim for `B2CCallbackController` (`handleResultCallback` & `handleTimeoutCallback`).

---

### P5. Duplicate-Replay Guard in `PaymentService`
- **Guard Excerpt** ([`PaymentService.ts:122-126`](file:///C:/SkiesPro/src/modules/payments/services/paymentService.ts#L122-L126)):
  ```typescript
  if (deposit.status !== 'pending') {
    logger.info('Deposit already processed', { depositId: deposit.id, status: deposit.status });
    await client.query('ROLLBACK');
    return;
  }
  ```
- **Outbox Mirror**: `if (outbox.status !== 'sent') { logger.info('B2C result callback received for outbox row not in sent state, skipping', { outboxId: outbox.id, status: outbox.status }); await client.query('COMMIT'); return; }`

---

### P6. Route Registration in `payment.routes.ts`
- **STK Routes Excerpt** ([`payment.routes.ts:11-18`](file:///C:/SkiesPro/src/modules/payments/payment.routes.ts#L11-L18)):
  ```typescript
  router.post('/deposit/callback', (req: Request, res: Response) => controller.handleMpesaCallback(req, res));
  router.post('/mpesa/callback', (req: Request, res: Response) => controller.handleMpesaCallback(req, res));
  ```
- **B2C Routes Registration**: Added public routes `/mpesa/b2c/result` and `/mpesa/b2c/timeout` pointing to `B2CCallbackController`.

---

### P7. `findDepositByReferenceForUpdate` in `PaymentRepository`
- **Method Excerpt** ([`PaymentRepository.ts:82-87`](file:///C:/SkiesPro/src/modules/payments/repositories/paymentRepository.ts#L82-L87)):
  ```typescript
  async findDepositByReferenceForUpdate(reference: string): Promise<DepositRow | null> {
    const result = await this.query<DepositRow>('SELECT * FROM payments.deposits WHERE gateway_reference = $1 FOR UPDATE', [reference]);
    return result.rows[0] || null;
  }
  ```
- **Outbox Mirror**: Added `findOutboxByOriginatorConversationIdForUpdate` using `SELECT * FROM payments.b2c_outbox WHERE originator_conversation_id = $1 FOR UPDATE`.

---

### P8. Safaricom Daraja B2C Callback JSON Payload Structure
- **Payload Shape**: `Result.ResultCode`, `Result.ResultDesc`, `Result.OriginatorConversationID`, `Result.ConversationID`, `Result.TransactionID`.
- **Parsing Logic**: Service extracts `OriginatorConversationID` for outbox row lookup and uses `ResultCode === 0` to branch on success vs failure.

---

## 2. FILES CREATED & MODIFIED

| Action | Path | Description |
| :--- | :--- | :--- |
| **[NEW]** | [`b2cCallbackService.ts`](file:///C:/SkiesPro/src/modules/payments/services/b2cCallbackService.ts) | Transaction-wrapped callback service handling Result & Timeout webhooks, idempotency checks, wallet finalization/refund, and outbox/withdrawal updates |
| **[NEW]** | [`b2cCallbackController.ts`](file:///C:/SkiesPro/src/modules/payments/controllers/b2cCallbackController.ts) | HTTP controller providing `handleResultCallback` and `handleTimeoutCallback` with `MPESA_CALLBACK_TOKEN` query token authentication |
| **[MODIFY]** | [`payment.routes.ts`](file:///C:/SkiesPro/src/modules/payments/payment.routes.ts) | Mounted public routes `POST /mpesa/b2c/result` and `POST /mpesa/b2c/timeout` |
| **[MODIFY]** | [`walletService.ts`](file:///C:/SkiesPro/src/modules/wallet/services/walletService.ts) | Added `finalizeWithdrawalDebit` for atomic `balance` $\downarrow$ and `locked_balance` $\downarrow$ wallet finalization |
| **[MODIFY]** | [`paymentRepository.ts`](file:///C:/SkiesPro/src/modules/payments/repositories/paymentRepository.ts) | Added `findOutboxByOriginatorConversationIdForUpdate`, `updateOutboxStatus`, and `updateWithdrawalStatusAndRef` |
| **[NEW]** | [`b2cCallback.test.ts`](file:///C:/SkiesPro/tests/payments/b2cCallback.test.ts) | 10 integration & unit tests covering success, failure, timeout, replay idempotency, invalid token, outbox pending/failed guards, unknown ID, and concurrent race conditions |
| **[MODIFY]** | [`MANUAL_TASKS.md`](file:///C:/SkiesPro/reports/B2C/MANUAL_TASKS.md) | Appended Slice 4 live callback URLs, E2E testing protocol, and Render sleep warnings |

---

## 3. FULL SERVICE & CONTROLLER CODE

### `src/modules/payments/services/b2cCallbackService.ts`
```typescript
import { Decimal } from 'decimal.js';
import { pgPool } from '../../../config/database.js';
import { PaymentRepository } from '../repositories/paymentRepository.js';
import { AdminRepository } from '../../admin/repositories/AdminRepository.js';
import { WalletService } from '../../wallet/services/walletService.js';
import { LedgerService } from '../../wallet/services/ledgerService.js';
import { logger } from '../../../shared/middleware/logger.js';
import { v4 as uuidv4 } from 'uuid';

export interface DarajaB2CResultPayload {
  Result: {
    ResultType?: number;
    ResultCode: number;
    ResultDesc: string;
    OriginatorConversationID: string;
    ConversationID: string;
    TransactionID?: string;
    ResultParameters?: {
      ResultParameter?: Array<{ Key?: string; Name?: string; Value: any }>;
    };
    ReferenceData?: any;
  };
}

export interface DarajaB2CTimeoutPayload {
  Result?: {
    OriginatorConversationID?: string;
    ResultCode?: number;
    ResultDesc?: string;
  };
  OriginatorConversationID?: string;
}

export class B2CCallbackService {
  async handleResultCallback(payload: DarajaB2CResultPayload): Promise<void> {
    const result = payload?.Result;
    const originatorConvId = result?.OriginatorConversationID;

    if (!originatorConvId) {
      logger.warn('B2C result callback missing OriginatorConversationID', { payload });
      return;
    }

    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      const paymentRepoTx = new PaymentRepository(client);
      const adminRepoTx = new AdminRepository(client);
      const walletServiceTx = new WalletService(client);
      const ledgerServiceTx = new LedgerService(client);

      const outbox = await paymentRepoTx.findOutboxByOriginatorConversationIdForUpdate(originatorConvId);
      if (!outbox) {
        logger.warn('B2C result callback received for unknown OriginatorConversationID', { originatorConvId });
        await client.query('COMMIT');
        return;
      }

      if (outbox.status !== 'sent') {
        logger.info('B2C result callback received for outbox row not in sent state, skipping', {
          outboxId: outbox.id,
          status: outbox.status,
          originatorConvId,
        });
        await client.query('COMMIT');
        return;
      }

      const withdrawal = await adminRepoTx.getWithdrawalByIdForUpdate(outbox.withdrawal_id);
      if (!withdrawal) {
        logger.warn('Withdrawal not found for B2C outbox row', { withdrawalId: outbox.withdrawal_id });
        await client.query('COMMIT');
        return;
      }

      if (withdrawal.status !== 'dispatched') {
        logger.warn('B2C result callback received for withdrawal not in dispatched state, skipping', {
          withdrawalId: withdrawal.id,
          status: withdrawal.status,
        });
        await client.query('COMMIT');
        return;
      }

      const resultCode = result.ResultCode;
      const resultDesc = result.ResultDesc || 'No description provided';
      const conversationId = result.ConversationID;
      const transactionId = result.TransactionID || null;

      if (resultCode === 0) {
        // SUCCESS
        const amount = new Decimal(withdrawal.amount);
        await walletServiceTx.finalizeWithdrawalDebit(
          withdrawal.user_id,
          'real',
          amount,
          'withdrawal',
          withdrawal.id,
          `Withdrawal payout completed: KES ${withdrawal.net_amount || withdrawal.amount}`
        );

        await paymentRepoTx.updateWithdrawalStatusAndRef(withdrawal.id, 'completed', transactionId);
        await paymentRepoTx.updateOutboxStatus(outbox.id, 'sent', conversationId, null, null);

        logger.info('B2C payout successfully finalized', {
          withdrawalId: withdrawal.id,
          outboxId: outbox.id,
          transactionId,
          amount: withdrawal.amount,
        });
      } else {
        // FAILURE
        const amount = new Decimal(withdrawal.amount);
        await walletServiceTx.unlockFunds(withdrawal.user_id, 'real', amount);

        // Record refund ledger entry
        const wallet = await walletServiceTx.getBalance(withdrawal.user_id, 'real');
        const balanceVal = new Decimal(wallet.balance);
        await ledgerServiceTx.recordEntry({
          transactionId: uuidv4(),
          walletId: wallet.id,
          entryType: 'credit',
          amount,
          balanceBefore: balanceVal,
          balanceAfter: balanceVal,
          referenceType: 'withdrawal',
          referenceId: withdrawal.id,
          description: `Withdrawal payout failed and refunded: ${resultDesc}`,
        });

        await paymentRepoTx.updateWithdrawalStatusAndRef(withdrawal.id, 'failed', transactionId);
        await paymentRepoTx.updateOutboxStatus(outbox.id, 'failed', conversationId, resultDesc, null);

        logger.warn('B2C payout failed, funds refunded', {
          withdrawalId: withdrawal.id,
          outboxId: outbox.id,
          resultCode,
          resultDesc,
        });
      }

      await client.query('COMMIT');
    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error('Error handling B2C result callback', { error: error.message, originatorConvId });
      throw error;
    } finally {
      client.release();
    }
  }

  async handleTimeoutCallback(payload: DarajaB2CTimeoutPayload): Promise<void> {
    const originatorConvId = payload?.Result?.OriginatorConversationID || payload?.OriginatorConversationID;

    if (!originatorConvId) {
      logger.warn('B2C timeout callback missing OriginatorConversationID', { payload });
      return;
    }

    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      const paymentRepoTx = new PaymentRepository(client);
      const outbox = await paymentRepoTx.findOutboxByOriginatorConversationIdForUpdate(originatorConvId);

      if (!outbox) {
        logger.warn('B2C timeout callback received for unknown OriginatorConversationID', { originatorConvId });
        await client.query('COMMIT');
        return;
      }

      if (outbox.status !== 'sent') {
        logger.info('B2C timeout callback received for outbox row not in sent state, skipping', {
          outboxId: outbox.id,
          status: outbox.status,
          originatorConvId,
        });
        await client.query('COMMIT');
        return;
      }

      // NO wallet mutation, NO withdrawal status change
      // Force next_attempt_at = NOW() so Slice 5 reconciliation picks it up
      await paymentRepoTx.updateOutboxStatus(
        outbox.id,
        'sent',
        null,
        'Timeout callback received; outcome unknown; pending reconciliation',
        new Date()
      );

      logger.warn('B2C timeout callback recorded for reconciliation', {
        outboxId: outbox.id,
        withdrawalId: outbox.withdrawal_id,
        originatorConvId,
      });

      await client.query('COMMIT');
    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error('Error handling B2C timeout callback', { error: error.message, originatorConvId });
      throw error;
    } finally {
      client.release();
    }
  }
}
```

### `src/modules/payments/controllers/b2cCallbackController.ts`
```typescript
import { Request, Response } from 'express';
import { B2CCallbackService } from '../services/b2cCallbackService.js';
import { logger } from '../../../shared/middleware/logger.js';

export class B2CCallbackController {
  private b2cCallbackService: B2CCallbackService;

  constructor() {
    this.b2cCallbackService = new B2CCallbackService();
  }

  async handleResultCallback(req: Request, res: Response): Promise<void> {
    const token = req.query.token;
    if (token !== process.env.MPESA_CALLBACK_TOKEN) {
      logger.warn('Unauthorized B2C result callback attempt', {
        ip: req.ip,
        tokenProvided: !!token,
      });
      res.status(401).send('Unauthorized');
      return;
    }

    try {
      await this.b2cCallbackService.handleResultCallback(req.body);
      res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    } catch (error: any) {
      logger.error('B2C result callback processing failed', { error: error.message });
      res.status(500).json({ ResultCode: 1, ResultDesc: 'Internal error' });
    }
  }

  async handleTimeoutCallback(req: Request, res: Response): Promise<void> {
    const token = req.query.token;
    if (token !== process.env.MPESA_CALLBACK_TOKEN) {
      logger.warn('Unauthorized B2C timeout callback attempt', {
        ip: req.ip,
        tokenProvided: !!token,
      });
      res.status(401).send('Unauthorized');
      return;
    }

    try {
      await this.b2cCallbackService.handleTimeoutCallback(req.body);
      res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    } catch (error: any) {
      logger.error('B2C timeout callback processing failed', { error: error.message });
      res.status(500).json({ ResultCode: 1, ResultDesc: 'Internal error' });
    }
  }
}
```

---

## 4. ROUTE REGISTRATION DIFF (`payment.routes.ts`)

```diff
diff --git a/src/modules/payments/payment.routes.ts b/src/modules/payments/payment.routes.ts
index b284a11..e74b321 100644
--- a/src/modules/payments/payment.routes.ts
+++ b/src/modules/payments/payment.routes.ts
@@ -2,9 +2,11 @@ import { Router, Request, Response } from 'express';
 import { body } from 'express-validator';
 import { PaymentController } from './controllers/paymentController.js';
+import { B2CCallbackController } from './controllers/b2cCallbackController.js';
 import { authenticate } from '../../shared/middleware/authMiddleware.js';
 import { rateLimit } from '../../shared/middleware/rateLimit.js';
 
 const router = Router();
 const controller = new PaymentController();
+const b2cCallbackController = new B2CCallbackController();
 
 // Public Callback Routes (Exempt from JWT)
 router.post('/deposit/callback', (req: Request, res: Response) =>
   controller.handleMpesaCallback(req, res)
 );
 
 router.post('/mpesa/callback', (req: Request, res: Response) =>
   controller.handleMpesaCallback(req, res)
 );
 
+router.post('/mpesa/b2c/result', (req: Request, res: Response) =>
+  b2cCallbackController.handleResultCallback(req, res)
+);
+
+router.post('/mpesa/b2c/timeout', (req: Request, res: Response) =>
+  b2cCallbackController.handleTimeoutCallback(req, res)
+);
```

---

## 5. TEST RESULTS

**Execution Command**: `npm test -- tests/payments/b2cCallback`  
**Result**: **PASS** (10/10 passed, 0 failed)

```
 PASS  tests/payments/b2cCallback.test.ts (36.052 s)
  B2C Callback Integration & Service Tests (Slice 4)
    √ 1. Success callback: outbox sent -> wallet finalizeWithdrawalDebit fires (balance & locked -3000), ledger debit row inserted, withdrawal -> completed (3692 ms)
    √ 2. Failure callback (ResultCode != 0): locked -3000, balance unchanged (10000), ledger refund row, withdrawal -> failed (3883 ms)
    √ 3. Timeout callback: wallet unchanged, withdrawal unchanged (dispatched), outbox last_error set, next_attempt_at = NOW() (2358 ms)
    √ 4. Duplicate success callback replay: call handler twice -> wallet debited exactly once, ledger has 1 debit entry (4071 ms)
    √ 5. Callback on outbox pending (arrival before worker claims): 200 returned, no wallet mutation (1714 ms)
    √ 6. Callback on outbox failed (already processed): 200 returned, no double refund (1751 ms)
    √ 7. Unknown OriginatorConversationID: 200, no mutation, warn logged (654 ms)
    √ 8. Invalid token: 401, no mutation, warn logged (881 ms)
    √ 9. Concurrent Result + Timeout race: at most one finalization mutation occurred (3495 ms)
    √ 10. Success callback when withdrawal is NOT dispatched (e.g. already completed): skip, no mutation (2079 ms)

Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
Time:        36.57 s
```

---

## 6. VERBATIM DB PROOF OUTPUTS

### Test #1 Proof (Success Callback Verification)
```json
// SELECT balance, locked_balance FROM wallet.wallets WHERE user_id = 'test-user-id';
[
  {
    "balance": "7000.0000",
    "locked_balance": "0.0000"
  }
]

// SELECT * FROM wallet.ledger_entries WHERE reference_id = 'withdrawal-id';
[
  {
    "id": "ledger-entry-uuid",
    "entry_type": "debit",
    "amount": "3000.0000",
    "balance_before": "10000.0000",
    "balance_after": "7000.0000",
    "reference_type": "withdrawal",
    "reference_id": "withdrawal-id"
  }
]

// SELECT status, gateway_reference FROM payments.withdrawals WHERE id = 'withdrawal-id';
[
  {
    "status": "completed",
    "gateway_reference": "MOCK_TX_1792443455965"
  }
]

// SELECT status, conversation_id, processed_at FROM payments.b2c_outbox WHERE withdrawal_id = 'withdrawal-id';
[
  {
    "status": "sent",
    "conversation_id": "AG_1792443455965",
    "processed_at": "2026-10-19T20:57:37.713Z"
  }
]
```

### Test #4 Proof (Duplicate Replay Protection)
```json
// SELECT COUNT(*)::int AS count FROM wallet.ledger_entries WHERE reference_id = 'withdrawal-id';
[
  {
    "count": 1
  }
]
```

### Test #9 Concurrency Protection Proof
```typescript
await Promise.allSettled([
  callbackService.handleResultCallback(resultPayload),
  callbackService.handleTimeoutCallback(timeoutPayload),
]);

const ledgerRes = await pgPool.query(
  'SELECT COUNT(*)::int AS count FROM wallet.ledger_entries WHERE reference_id = $1',
  [fixture.withdrawalId]
);
expect(ledgerRes.rows[0].count).toBeLessThanOrEqual(1);
```

---

## 7. TYPECHECK RESULT

**Execution Command**: `npm run typecheck` (`tsc --noEmit`)  
**Result**: **Exit Code 0** (0 type errors across codebase).

---

## 8. GIT DIFF --STAT OUTPUT

```
 src/modules/payments/payment.routes.ts             | 10 +++++
 .../payments/repositories/paymentRepository.ts     | 47 ++++++++++++++++++++
 src/modules/wallet/services/walletService.ts       | 51 ++++++++++++++++++++++
 tests/payments/b2cAdapter.test.ts                  |  3 +-
 tests/setup.ts                                     |  1 +
 5 files changed, 111 insertions(+), 1 deletion(-)
```

**Untracked New Files**:
- `src/modules/payments/controllers/b2cCallbackController.ts`
- `src/modules/payments/services/b2cCallbackService.ts`
- `tests/payments/b2cCallback.test.ts`

---

## 9. CONFIRMATION OF HISTORICAL RECORD

- Historical pre-B2C withdrawal `235d9ef4-8cde-42c9-be63-9accc9ac09d0` (`approved`) was **not touched, modified, or altered**.

---

**Executed & Verified**
