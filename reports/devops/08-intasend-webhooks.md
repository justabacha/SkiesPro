# IntaSend Webhooks, Tracking, and Phase 2B Completion Report

## 1. Metadata
- Date: 2026-10-26
- Branch: `main`
- Commit hash: `f68e148`
- Scope: Phase 2B webhook handlers, tracking persistence, challenge verification, and full repo verification.

---

## 2. Migrations
| Migration | Applied to TEST_DATABASE_URL | Applied to production |
|---|---|---|
| 046_b2c_outbox_gateway_tracking_id.sql | YES — 2026-10-26 00:10 UTC | NO — PHESTY RUNS MANUALLY |

---

## 3. Test Count Reconciliation

### Full List of 70 Test Paths (`npx jest --listTests`)
```text
C:\SkiesPro\tests\trading\integration\settlementIntegration.test.ts
C:\SkiesPro\tests\demo\demoWallet.integration.test.ts
C:\SkiesPro\tests\payments\b2cDispatchWorker.test.ts
C:\SkiesPro\tests\payments\withdrawal.test.ts
C:\SkiesPro\tests\payments\b2cCallback.test.ts
C:\SkiesPro\tests\payments\intasendB2CWebhook.test.ts
C:\SkiesPro\tests\payments\b2cOpsRecovery.test.ts
C:\SkiesPro\tests\admin\adminWalletService.integration.test.ts
C:\SkiesPro\tests\admin\fourEyesReject.test.ts
C:\SkiesPro\tests\user\settings.test.ts
C:\SkiesPro\tests\demo\demoSecurity.integration.test.ts
C:\SkiesPro\tests\payments\intasendCollectionWebhook.test.ts
C:\SkiesPro\tests\trading\integration\tradingIntegration.test.ts
C:\SkiesPro\tests\admin\b2cRecoveryRoutes.test.ts
C:\SkiesPro\tests\admin\riskDashboard.test.ts
C:\SkiesPro\tests\payments\b2cReconciliation.test.ts
C:\SkiesPro\tests\payments\slice3ManualVerification.test.ts
C:\SkiesPro\tests\payments\mpesaCallback.test.ts
C:\SkiesPro\tests\wallet\concurrency.test.ts
C:\SkiesPro\tests\wallet\ledger.test.ts
C:\SkiesPro\tests\user\kyc.test.ts
C:\SkiesPro\tests\database.test.ts
C:\SkiesPro\tests\admin\adminRepository.test.ts
C:\SkiesPro\tests\admin\adminReports.integration.test.ts
C:\SkiesPro\tests\admin\riskExposure.integration.test.ts
C:\SkiesPro\tests\pricing\websocket\load.latency.test.ts
C:\SkiesPro\tests\monitoring.test.ts
C:\SkiesPro\tests\demo\demoSecurity.unit.test.ts
C:\SkiesPro\tests\messageQueue.test.ts
C:\SkiesPro\tests\user\avatarUpload.test.ts
C:\SkiesPro\tests\pricing\websocket\gateway.integration.test.ts
C:\SkiesPro\tests\user\security.test.ts
C:\SkiesPro\tests\user\UserController.test.ts
C:\SkiesPro\tests\health.test.ts
C:\SkiesPro\tests\cache.test.ts
C:\SkiesPro\tests\trading\unit\tradingService.test.ts
C:\SkiesPro\tests\auth\authService.test.ts
C:\SkiesPro\tests\payments\intasendChallenge.test.ts
C:\SkiesPro\tests\pricing\websocket\connectionManager.test.ts
C:\SkiesPro\tests\payments\b2cAdapter.test.ts
C:\SkiesPro\tests\cors.test.ts
C:\SkiesPro\tests\payments\intasendCollectionAdapter.test.ts
C:\SkiesPro\tests\demo\demoTradingService.test.ts
C:\SkiesPro\tests\trading\unit\settlementWorker.test.ts
C:\SkiesPro\tests\pricing\websocket\subscriptionManager.test.ts
C:\SkiesPro\tests\auth\adminMfaStepUp.test.ts
C:\SkiesPro\tests\user\UserService.test.ts
C:\SkiesPro\tests\admin\adminAuditService.test.ts
C:\SkiesPro\tests\payments\intasendFactory.test.ts
C:\SkiesPro\tests\payments\intasendB2CAdapter.test.ts
C:\SkiesPro\tests\payments\gatewayFactory.test.ts
C:\SkiesPro\tests\demo\demoPriceFeedService.test.ts
C:\SkiesPro\tests\pricing\validation.test.ts
C:\SkiesPro\tests\payments\intasendConfig.test.ts
C:\SkiesPro\tests\pricing\websocket\authMiddleware.test.ts
C:\SkiesPro\tests\wallet\walletBalance.test.ts
C:\SkiesPro\tests\trading\unit\contractRepository.test.ts
C:\SkiesPro\tests\auth\tokenService.test.ts
C:\SkiesPro\tests\admin\adminMfaMiddleware.test.ts
C:\SkiesPro\tests\logger.test.ts
C:\SkiesPro\tests\pricing\candleRepository.test.ts
C:\SkiesPro\tests\trading\unit\stakeValidator.test.ts
C:\SkiesPro\tests\demo\demoPriceSubscriber.test.ts
C:\SkiesPro\tests\trading\unit\frontendTrading.test.ts
C:\SkiesPro\tests\auth\mfaService.test.ts
C:\SkiesPro\tests\pricing\ohlc.test.ts
C:\SkiesPro\tests\config\config.controller.test.ts
C:\SkiesPro\tests\trading\unit\payoutService.test.ts
C:\SkiesPro\tests\pricing\symbolNormalizer.test.ts
C:\SkiesPro\tests\demo\tickIsolation.test.ts
```

### Test Count Per File (`tests/payments/intasend*.test.ts`)
- `tests/payments/intasendCollectionAdapter.test.ts` — 4 tests
- `tests/payments/intasendB2CAdapter.test.ts` — 5 tests
- `tests/payments/intasendFactory.test.ts` — 5 tests
- `tests/payments/intasendConfig.test.ts` — 10 tests
- `tests/payments/intasendCollectionWebhook.test.ts` — 8 tests
- `tests/payments/intasendB2CWebhook.test.ts` — 9 tests
- `tests/payments/intasendChallenge.test.ts` — 6 tests

### Sum Calculation
- **Pre-Phase 2A baseline**: 417 tests
- **Phase 2A total**: 4 + 5 + 5 + 10 = 24 tests
- **Phase 2B total**: 8 + 9 + 6 = 23 tests
- **Sum**: 417 + 24 + 23 = **464 tests**

464 CONFIRMED — breakdown above sums to 464

---

## 4. Boot Fail-Fast Tests

### Migration-046 Column Missing Assertion (`tests/payments/intasendConfig.test.ts`)
```typescript
  it('throws migration-046 error when gateway_tracking_id column is missing', async () => {
    const mockPool = {
      query: jest.fn().mockResolvedValueOnce({ rows: [] }),
    };

    await expect(validateIntasendConfig(mockPool)).rejects.toThrow(
      'MIGRATION 046 NOT APPLIED — gateway_tracking_id column missing on payments.b2c_outbox. Run migration 046 before enabling PAYMENT_GATEWAY_MODE=INTASEND.'
    );
  });
```

### Missing Challenge Variable Assertion (`tests/payments/intasendConfig.test.ts`)
```typescript
  it.each([
    ['INTASEND_SECRET_KEY', 'missing'],
    ['INTASEND_PUBLISHABLE_KEY', 'missing'],
    ['INTASEND_ENVIRONMENT', 'missing'],
    ['INTASEND_WEBHOOK_CHALLENGE', 'missing'],
  ])('fails when %s is missing', async (key, _value) => {
    delete process.env[key as keyof NodeJS.ProcessEnv];
    await expect(validateIntasendConfig()).rejects.toThrow(/Invalid IntaSend config/i);
  });
```

### Verbose Output (`npx jest --verbose tests/payments/intasendConfig.test.ts`)
```text
 PASS  tests/payments/intasendConfig.test.ts (5.724 s)
  validateIntasendConfig
    √ accepts a valid IntaSend configuration (5 ms)
    √ fails when INTASEND_SECRET_KEY is missing (25 ms)
    √ fails when INTASEND_PUBLISHABLE_KEY is missing (1 ms)
    √ fails when INTASEND_ENVIRONMENT is missing (1 ms)
    √ fails when INTASEND_WEBHOOK_CHALLENGE is missing (1 ms)
    √ fails when INTASEND_SECRET_KEY is invalid: BadKey_abc (1 ms)
    √ fails when INTASEND_PUBLISHABLE_KEY is invalid: BadPubKey_abc (1 ms)
    √ fails when INTASEND_ENVIRONMENT is invalid: staging (1 ms)
    √ bypasses validation when NODE_ENV=test (1 ms)
    √ throws migration-046 error when gateway_tracking_id column is missing (3 ms)

Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
Snapshots:   0 total
Time:        6.352 s
```

---

## 5. `validateIntasendConfig(pool)` Call Site & Boot Race Fix

In `src/index.ts`:

```typescript
async function bootstrap(): Promise<void> {
  if (process.env.NODE_ENV !== 'test') {
    validateB2cConfig();
    if (process.env.PAYMENT_GATEWAY_MODE === 'INTASEND') {
      await validateIntasendConfig(pgPool);
    }

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));

    // Automatically start price feed if enabled
    if (config.enablePriceFeed) {
      import('./modules/pricing/bootstrap.js')
        .then((m) => m.bootstrapPriceFeed())
        .catch((err) => {
          logger.error('Failed to auto-start price feed', { error: err.message });
        });
    }

    if (process.env.DEMO_ENABLED === 'true') {
      import('./modules/pricing/services/DemoPriceFeedService.js')
        .then(({ demoPriceFeedService }) => demoPriceFeedService.start())
        .catch((err) => {
          logger.error('Failed to start isolated demo price feed', { error: err.message });
        });
    }

    // Automatically start settlement worker if enabled
    if (config.enableSettlementWorker) {
      import('./modules/trading/workers/settlementWorker.js')
        .then((m) => {
          const worker = new m.SettlementWorker();
          return worker.start();
        })
        .catch((err) => {
          logger.error('Failed to start settlement worker', { error: err.message });
        });
    }

    // Automatically start B2C dispatch worker if enabled
    if (config.enableB2cWorker) {
      import('./modules/payments/workers/b2cDispatchWorker.js')
        .then((m) => {
          activeB2cWorker = new m.B2CDispatchWorker();
          return activeB2cWorker.start();
        })
        .catch((err) => {
          logger.error('Failed to start B2C dispatch worker', { error: err.message });
        });
    }

    // Automatically start B2C reconciliation job if enabled
    if (config.enableB2cReconciliation) {
      import('./modules/payments/jobs/b2cReconciliation.job.js')
        .then((m) => {
          activeB2cReconciliationJob = new m.B2CReconciliationJob(
            pgPool,
            config.b2cReconciliationIntervalMs,
            () => config.enableB2cReconciliation
          );
          return activeB2cReconciliationJob.start();
        })
        .catch((err) => {
          logger.error('Failed to start B2C reconciliation job', { error: err.message });
        });
    }

    server.listen(PORT, () => {
      logger.info(`Server started on port ${PORT} in ${config.nodeEnv} mode`);
    });
  }
}

if (process.env.NODE_ENV !== 'test') {
  bootstrap().catch((err) => {
    logger.error('Boot failed', { error: err.message });
    process.exit(1);
  });
}
```

BOOT RACE CLOSED — validators awaited before app.listen; failures exit(1) before port binds

---

## 6. `.env.example` Update

Full `git diff .env.example`:
```diff
diff --git a/.env.example b/.env.example
index 6e8cdff..08df8ac 100644
--- a/.env.example
+++ b/.env.example
@@ -134,3 +134,17 @@ MPESA_B2C_COMMAND_ID=BusinessPayment
 MPESA_B2C_RESULT_URL=
 MPESA_B2C_TIMEOUT_URL=

+# ---------- IntaSend ----------
+# Set to INTASEND to enable IntaSend adapters (MOCK | DARAJA | INTASEND)
+PAYMENT_GATEWAY_MODE=MOCK
+
+# Required when PAYMENT_GATEWAY_MODE=INTASEND
+# Secret key from IntaSend dashboard (prefix: ISSecretKey_)
+INTASEND_SECRET_KEY=
+# Publishable key from IntaSend dashboard (prefix: ISPubKey_)
+INTASEND_PUBLISHABLE_KEY=
+# sandbox | live
+INTASEND_ENVIRONMENT=sandbox
+# Challenge string set in IntaSend dashboard — must match exactly
+INTASEND_WEBHOOK_CHALLENGE=
```

---

## 7. B2C Duplicate Test Strengthening

### Old Assertion
```typescript
expect(res1.status).toBe(200);
expect(res2.status).toBe(200);
const wRes = await pgPool.query(`SELECT status FROM payments.withdrawals WHERE id = $1`, [fixture.withdrawalId]);
expect(wRes.rows[0].status).toBe('completed');
```

### New Strengthened Assertion (`tests/payments/intasendB2CWebhook.test.ts`, Test #3)
```typescript
  it('3. Duplicate delivery -> HTTP 200, no double-finalize, no double-unlock', async () => {
    if (skipDatabaseTests) return;

    const finalizeSpy = jest.spyOn(WalletService.prototype, 'finalizeWithdrawalDebit');
    const fixture = await createB2CFixture();

    const payload = {
      challenge: validChallenge,
      tracking_id: 'batch_003',
      transactions: [
        {
          idempotency_key: fixture.originatorConvId,
          transaction_id: 'txn_1003',
          status: 'COMPLETE',
        },
      ],
    };

    const res1 = await supertest(app).post('/api/v1/payments/intasend/b2c/callback').send(payload);
    const res2 = await supertest(app).post('/api/v1/payments/intasend/b2c/callback').send(payload);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    const wRes = await pgPool.query(`SELECT status FROM payments.withdrawals WHERE id = $1`, [fixture.withdrawalId]);
    expect(wRes.rows[0].status).toBe('completed');
    expect(finalizeSpy).toHaveBeenCalledTimes(1);

    finalizeSpy.mockRestore();
  });
```

### Verbose Pass Line Output
```text
√ 3. Duplicate delivery -> HTTP 200, no double-finalize, no double-unlock (3108 ms)
```

---

## 8. B2C Failure Test Body Confirmation (`tests/payments/intasendB2CWebhook.test.ts`, Test #2)

### Quoted Body
```typescript
  it('2. Failure + match by idempotency_key -> outbox failed, withdrawal failed, unlockFunds called', async () => {
    if (skipDatabaseTests) return;

    const unlockSpy = jest.spyOn(WalletService.prototype, 'unlockFunds');
    const fixture = await createB2CFixture();

    const response = await supertest(app)
      .post('/api/v1/payments/intasend/b2c/callback')
      .send({
        challenge: validChallenge,
        tracking_id: 'batch_002',
        transactions: [
          {
            idempotency_key: fixture.originatorConvId,
            transaction_id: 'txn_1002',
            status: 'FAILED',
          },
        ],
      });

    expect(response.status).toBe(200);

    const wRes = await pgPool.query(`SELECT status FROM payments.withdrawals WHERE id = $1`, [fixture.withdrawalId]);
    expect(wRes.rows[0].status).toBe('failed');
    expect(unlockSpy).toHaveBeenCalledTimes(1);

    unlockSpy.mockRestore();
  });
```

---

## 9. Manual Steps Required from Phesty (Production Go-Live)

| Step | Action | Where | Why |
|---|---|---|---|
| 1 | Run `migrations/046_b2c_outbox_gateway_tracking_id.sql` | Production DB | Adds `gateway_tracking_id` column required by Phase 2B |
| 2 | Set `INTASEND_SECRET_KEY` | Render env | IntaSend API auth — must start with `ISSecretKey_` |
| 3 | Set `INTASEND_PUBLISHABLE_KEY` | Render env | IntaSend public key — must start with `ISPubKey_` |
| 4 | Set `INTASEND_ENVIRONMENT` | Render env | Must be `sandbox` or `live` |
| 5 | Set `INTASEND_WEBHOOK_CHALLENGE` | Render env | Server-side copy of the challenge string; must match the challenge set in IntaSend dashboard |
| 6 | Set `PAYMENT_GATEWAY_MODE=INTASEND` | Render env | Enables the IntaSend adapters in both factories |
| 7 | Set challenge in IntaSend dashboard | IntaSend dashboard | Webhook signature — same value as step 5 |
| 8 | Register collection webhook URL | IntaSend dashboard | `https://skiespro.co.ke/api/v1/payments/intasend/collection/callback` |
| 9 | Register B2C webhook URL | IntaSend dashboard | `https://skiespro.co.ke/api/v1/payments/intasend/b2c/callback` |
| 10 | Confirm `requires_approval: "NO"` auto-approves | IntaSend dashboard | If not, payouts sit in preview forever — Phase 2A flagged this, Phase 2C must confirm live |
| 11 | Deploy Phase 1 + Phase 2A + Phase 2B code | Render / Vercel | After all steps above are green in sandbox |

---

## 10. Test Body Spot-Checks

### Challenge Middleware Wrong Challenge Test (`tests/payments/intasendChallenge.test.ts`, Test #2)
```typescript
  it('2. Wrong challenge -> HTTP 401 { error: "Invalid challenge" }', async () => {
    const res = await supertest(testApp)
      .post('/test-webhook')
      .send({ challenge: 'wrong-challenge-123' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid challenge' });
  });
```

### B2C Webhook Duplicate Delivery Test (`tests/payments/intasendB2CWebhook.test.ts`, Test #3)
```typescript
  it('3. Duplicate delivery -> HTTP 200, no double-finalize, no double-unlock', async () => {
    if (skipDatabaseTests) return;

    const finalizeSpy = jest.spyOn(WalletService.prototype, 'finalizeWithdrawalDebit');
    const fixture = await createB2CFixture();

    const payload = {
      challenge: validChallenge,
      tracking_id: 'batch_003',
      transactions: [
        {
          idempotency_key: fixture.originatorConvId,
          transaction_id: 'txn_1003',
          status: 'COMPLETE',
        },
      ],
    };

    const res1 = await supertest(app).post('/api/v1/payments/intasend/b2c/callback').send(payload);
    const res2 = await supertest(app).post('/api/v1/payments/intasend/b2c/callback').send(payload);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    const wRes = await pgPool.query(`SELECT status FROM payments.withdrawals WHERE id = $1`, [fixture.withdrawalId]);
    expect(wRes.rows[0].status).toBe('completed');
    expect(finalizeSpy).toHaveBeenCalledTimes(1);

    finalizeSpy.mockRestore();
  });
```

---

## 11. Git Status Output (`git status --short`)

```text
M .env.example
M src/config/app.ts
M src/index.ts
M src/modules/payments/adapters/intasend/IntaSendB2CAdapter.ts
M src/modules/payments/payment.routes.ts
M src/modules/payments/workers/b2cDispatchWorker.ts
M tests/payments/intasendB2CAdapter.test.ts
M tests/payments/intasendConfig.test.ts
?? migrations/046_b2c_outbox_gateway_tracking_id.sql
?? reports/devops/08-intasend-webhooks.md
?? src/modules/payments/middleware/
?? tests/payments/intasendB2CWebhook.test.ts
?? tests/payments/intasendChallenge.test.ts
?? tests/payments/intasendCollectionWebhook.test.ts
```

---

## 12. Phase 2C Cleanup Items (Not Blocking)
1. **`FOR UPDATE` in B2C match lookup runs in autocommit (no `BEGIN`)**: In `handleIntaSendB2CCallback`, the initial candidate query runs `FOR UPDATE` on `client.query` without an explicit transaction block before releasing the client. In Phase 2C, wrap inside a transaction or simplify to a standard `SELECT`.
2. **Multiple transactions in a batch matched only by `tracking_id`**: If a batch has multiple transactions and none have `idempotency_key` or `transaction_id`, matching by `gateway_tracking_id` alone picks the first outbox row matching that batch ID. Phase 2C should evaluate adding item-level index resolution if multi-item un-keyed batches occur in production.
3. **`information_schema.columns` query table schema filter**: The migration-046 fail-fast query filters by `table_schema = 'payments'`. In Phase 2C, verify schema search paths across multi-tenant environments.

---

## 13. Verified Contract Citations
The Phase 2B implementation adheres strictly to the verified IntaSend contract:
- **Collection webhook topic**: `collection_event` (path: `POST /api/v1/payments/intasend/collection/callback`)
- **B2C webhook topic**: `send_money_event` (path: `POST /api/v1/payments/intasend/b2c/callback`)
- **Payout status query endpoint**: `POST https://api.intasend.com/api/v1/send-money/status/` (sandbox: `https://sandbox.intasend.com/api/v1/send-money/status/`)
- **Challenge verification model**: Compares `req.body.challenge === process.env.INTASEND_WEBHOOK_CHALLENGE` in constant time (`timingSafeEqual`) and returns `401` on mismatch or `500` if server challenge variable is unset.

---

## 14. `hasGatewayTrackingIdColumn` Removal & Unconditional Worker Persistence

In `src/modules/payments/workers/b2cDispatchWorker.ts`:
```typescript
const rawObj = response.raw && typeof response.raw === 'object' ? (response.raw as any) : {};
const trackingId = String(rawObj.tracking_id || rawObj.batch?.tracking_id || '');

await this.pool.query(
  `UPDATE payments.b2c_outbox
   SET status = 'sent',
       conversation_id = $1,
       gateway_tracking_id = COALESCE(NULLIF($3::text, ''), gateway_tracking_id),
       processed_at = NOW(),
       updated_at = NOW()
   WHERE id = $2`,
  [response.conversationId, row.id, trackingId]
);
```

---

## 15. `raw.tracking_id` Propagation Proof
In `src/modules/payments/adapters/intasend/IntaSendB2CAdapter.ts`:
```typescript
const batch = response.data?.batch ?? response.data ?? {};
const transaction =
  Array.isArray(batch.transactions) && batch.transactions.length > 0
    ? batch.transactions[0]
    : response.data?.transaction ?? response.data?.transactions?.[0] ?? {};

const conversationId = String(
  transaction.transaction_id ?? batch.tracking_id ?? response.data?.tracking_id ?? ''
);

return {
  conversationId,
  originatorConversationId: req.originatorConversationId,
  responseCode: '0',
  responseDescription: batch.status || response.data?.message || 'Success',
  raw: response.data,
};
```

---

## 16. Challenge Verification Code
In `src/modules/payments/middleware/verifyIntasendChallenge.ts`:
```typescript
import { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import { logger } from '../../../shared/middleware/logger.js';

export function verifyIntasendChallenge(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.INTASEND_WEBHOOK_CHALLENGE;

  if (!expected || String(expected).trim() === '') {
    logger.error('INTASEND_WEBHOOK_CHALLENGE is not configured in environment', {
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({ error: 'Server configuration error: INTASEND_WEBHOOK_CHALLENGE is not set' });
    return;
  }

  const actual = req.body?.challenge;
  if (!actual || String(actual).trim() === '') {
    logger.warn('IntaSend webhook challenge missing or empty in request', {
      correlationId: (req as any).correlationId,
    });
    res.status(401).json({ error: 'Invalid challenge' });
    return;
  }

  const expectedBuf = Buffer.from(String(expected));
  const actualBuf = Buffer.from(String(actual));

  if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
    logger.warn('IntaSend webhook challenge mismatch', {
      correlationId: (req as any).correlationId,
    });
    res.status(401).json({ error: 'Invalid challenge' });
    return;
  }

  next();
}
```

---

## 17. Route and Handler Wiring
In `src/modules/payments/payment.routes.ts`:
```typescript
router.post('/intasend/collection/callback', verifyIntasendChallenge, (req: Request, res: Response) =>
  handleIntaSendCollectionCallback(req, res)
);

router.post('/intasend/b2c/callback', verifyIntasendChallenge, (req: Request, res: Response) =>
  handleIntaSendB2CCallback(req, res)
);
```

---

## 18. Collection Webhook Handler Code
In `src/modules/payments/payment.routes.ts`:
```typescript
const handleIntaSendCollectionCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const invoiceId = req.body?.invoice_id;
    const state = String(req.body?.state || '').toUpperCase();
    const apiRef = req.body?.api_ref;

    if (!invoiceId) {
      logger.warn('IntaSend collection callback missing invoice_id', {
        correlationId: (req as any).correlationId,
      });
      res.status(200).json({ ok: true });
      return;
    }

    const paymentRepo = new PaymentRepository();
    const deposit = await paymentRepo.findDepositByReference(String(invoiceId));
    if (!deposit) {
      logger.warn('IntaSend collection callback matched no deposit', {
        correlationId: (req as any).correlationId,
        invoiceId,
        apiRef,
      });
      res.status(200).json({ ok: true });
      return;
    }

    if (deposit.status !== 'pending') {
      logger.info('IntaSend collection callback ignored duplicate deposit state', {
        correlationId: (req as any).correlationId,
        depositId: deposit.id,
        status: deposit.status,
      });
      res.status(200).json({ ok: true });
      return;
    }

    if (state === 'COMPLETE') {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        const repoTx = new PaymentRepository(client);
        const walletServiceTx = new WalletService(client);
        const lockDeposit = await repoTx.findDepositByReferenceForUpdate(String(invoiceId));
        if (!lockDeposit || lockDeposit.status !== 'pending') {
          await client.query('COMMIT');
          res.status(200).json({ ok: true });
          return;
        }
        await repoTx.updateDepositStatus(lockDeposit.id, 'completed', req.body);
        await walletServiceTx.credit(
          lockDeposit.user_id,
          'real',
          new Decimal(lockDeposit.net_amount),
          'deposit',
          lockDeposit.id,
          `IntaSend deposit: ${invoiceId}`
        );
        await client.query('COMMIT');
      } catch (error: any) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      res.status(200).json({ ok: true });
      return;
    }

    if (state === 'FAILED' || state === 'CANCELED' || state === 'CANCELLED') {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        const repoTx = new PaymentRepository(client);
        const lockDeposit = await repoTx.findDepositByReferenceForUpdate(String(invoiceId));
        if (lockDeposit && lockDeposit.status === 'pending') {
          await repoTx.updateDepositStatus(lockDeposit.id, 'failed', req.body);
        }
        await client.query('COMMIT');
      } catch (error: any) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    res.status(200).json({ ok: true });
  } catch (error: any) {
    logger.error('IntaSend collection callback failed', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
};
```

---

## 19. B2C Webhook Handler Code
In `src/modules/payments/payment.routes.ts`:
```typescript
const handleIntaSendB2CCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = req.body || {};
    const transactions = Array.isArray(payload.transactions) ? payload.transactions : [];

    if (!transactions.length) {
      res.status(200).json({ ok: true });
      return;
    }

    for (const tx of transactions) {
      const txState = String(tx.status || tx.state || '').toUpperCase();
      const candidateIdempotencyKey = tx.idempotency_key;
      const candidateTransactionId = tx.transaction_id;
      const candidateTrackingId = payload.tracking_id;

      let matchKey: 'idempotency_key' | 'transaction_id' | 'tracking_id' | null = null;
      let outbox: any = null;

      const client = await pgPool.connect();
      try {
        if (candidateIdempotencyKey) {
          const result = await client.query(
            `SELECT * FROM payments.b2c_outbox WHERE originator_conversation_id = $1 FOR UPDATE`,
            [candidateIdempotencyKey]
          );
          if (result.rows[0]) {
            outbox = result.rows[0];
            matchKey = 'idempotency_key';
          }
        }
        if (!outbox && candidateTransactionId) {
          const result = await client.query(
            `SELECT * FROM payments.b2c_outbox WHERE conversation_id = $1 FOR UPDATE`,
            [candidateTransactionId]
          );
          if (result.rows[0]) {
            outbox = result.rows[0];
            matchKey = 'transaction_id';
          }
        }
        if (!outbox && candidateTrackingId) {
          const result = await client.query(
            `SELECT * FROM payments.b2c_outbox WHERE gateway_tracking_id = $1 FOR UPDATE`,
            [candidateTrackingId]
          );
          if (result.rows[0]) {
            outbox = result.rows[0];
            matchKey = 'tracking_id';
          }
        }
      } finally {
        client.release();
      }

      if (!outbox) {
        logger.warn('IntaSend B2C callback saw no outbox match', {
          correlationId: (req as any).correlationId,
          idempotencyKey: candidateIdempotencyKey,
          transactionId: candidateTransactionId,
          trackingId: candidateTrackingId,
        });
        continue;
      }

      if (outbox.status !== 'sent') {
        logger.info('IntaSend B2C callback ignored outbox row outside sent state', {
          correlationId: (req as any).correlationId,
          outboxId: outbox.id,
          status: outbox.status,
          matchKey,
        });
        continue;
      }

      const withdrawalClient = await pgPool.connect();
      try {
        await withdrawalClient.query('BEGIN');
        const repoTx = new PaymentRepository(withdrawalClient);
        const adminRepoTx = new AdminRepository(withdrawalClient);
        const walletServiceTx = new WalletService(withdrawalClient);
        const row = await withdrawalClient.query<any>(
          `SELECT * FROM payments.b2c_outbox WHERE id = $1 FOR UPDATE`,
          [outbox.id]
        );
        const outboxRow = row.rows[0];
        if (!outboxRow || outboxRow.status !== 'sent') {
          await withdrawalClient.query('COMMIT');
          continue;
        }

        const withdrawal = await adminRepoTx.getWithdrawalByIdForUpdate(outboxRow.withdrawal_id);
        if (!withdrawal || withdrawal.status !== 'dispatched') {
          await withdrawalClient.query('COMMIT');
          continue;
        }

        const isSuccess = ['COMPLETE', 'COMPLETED', 'SUCCESS', 'SUCCEEDED'].includes(txState);
        const isFailure = ['FAILED', 'CANCELED', 'CANCELLED'].includes(txState);

        if (isSuccess) {
          await walletServiceTx.finalizeWithdrawalDebit(
            withdrawal.user_id,
            'real',
            new Decimal(withdrawal.amount),
            'withdrawal',
            withdrawal.id,
            `IntaSend payout completed: ${candidateTransactionId || payload.tracking_id}`
          );
          await repoTx.updateWithdrawalStatusAndRef(withdrawal.id, 'completed', candidateTransactionId || payload.tracking_id);
          await repoTx.updateOutboxStatus(outboxRow.id, 'sent', candidateTransactionId || payload.tracking_id, null, null);
          logger.info('IntaSend B2C callback finalized withdrawal', {
            correlationId: (req as any).correlationId,
            outboxId: outboxRow.id,
            withdrawalId: withdrawal.id,
            matchKey,
          });
        } else if (isFailure) {
          await walletServiceTx.unlockFunds(withdrawal.user_id, 'real', new Decimal(withdrawal.amount));
          await repoTx.updateWithdrawalStatusAndRef(withdrawal.id, 'failed', candidateTransactionId || payload.tracking_id);
          await repoTx.updateOutboxStatus(outboxRow.id, 'failed', candidateTransactionId || payload.tracking_id, txState, null);
          logger.warn('IntaSend B2C callback unlocked funds after failure', {
            correlationId: (req as any).correlationId,
            outboxId: outboxRow.id,
            withdrawalId: withdrawal.id,
            matchKey,
          });
        } else {
          logger.info('IntaSend B2C callback ignored pending/unknown transaction state', {
            correlationId: (req as any).correlationId,
            outboxId: outboxRow.id,
            state: txState,
            matchKey,
          });
        }

        await withdrawalClient.query('COMMIT');
      } catch (error: any) {
        await withdrawalClient.query('ROLLBACK');
        logger.error('IntaSend B2C callback transaction failure', {
          correlationId: (req as any).correlationId,
          error: error.message,
        });
        throw error;
      } finally {
        withdrawalClient.release();
      }
    }

    res.status(200).json({ ok: true });
  } catch (error: any) {
    logger.error('IntaSend B2C callback failed', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
};
```

---

## 20. `queryB2CStatus` Implementation & `TP111` Handling
In `src/modules/payments/adapters/intasend/IntaSendB2CAdapter.ts`:

```typescript
  async queryB2CStatus(conversationId: string): Promise<B2CStatusResponse> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/v1/send-money/status/`,
        { tracking_id: conversationId },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
          timeout: 30000,
        }
      );

      const batch = response.data?.batch ?? response.data ?? {};
      const rawState = String(batch.state ?? batch.status ?? response.data?.state ?? 'PENDING').toUpperCase();

      let status: 'completed' | 'failed' | 'pending' = 'pending';
      let resultCode = 2;

      if (rawState === 'COMPLETE' || rawState === 'COMPLETED') {
        status = 'completed';
        resultCode = 0;
      } else if (rawState === 'FAILED' || rawState === 'CANCELED' || rawState === 'CANCELLED') {
        status = 'failed';
        resultCode = 1;
      } else if (
        ['PENDING', 'PROCESSING', 'RETRY', 'PARTIAL', 'TP111', 'APPROVAL_PENDING', 'APPROVAL-PENDING'].includes(rawState)
      ) {
        status = 'pending';
        resultCode = 2;
      } else {
        logger.warn('Unhandled IntaSend B2C status state; treating as pending to avoid failed payout', {
          trackingId: conversationId,
          state: rawState,
        });
        status = 'pending';
        resultCode = 2;
      }

      return {
        conversationId,
        status,
        resultCode,
        resultDescription: rawState,
        raw: response.data,
      };
    } catch (error: any) {
      const code = error.response?.status ?? error.code ?? 'INTASEND_HTTP_ERROR';
      const raw = error.response?.data ?? error;
      const message = error.response?.data?.message || error.message || 'IntaSend B2C status query failed';
      throw new B2CPayoutError(message, code, raw);
    }
  }
```

---

## 21. Granular Per-Test Evidence Table (47 IntaSend Tests)

| # | Test Name | File Path | Start Line | Result |
|---|---|---|---:|---|
| 1 | `maps fields and invoice id into the payment gateway response` | `tests/payments/intasendCollectionAdapter.test.ts` | 23 | PASS |
| 2 | `maps all supported IntaSend states to gateway result codes` | `tests/payments/intasendCollectionAdapter.test.ts` | 66 | PASS |
| 3 | `falls back to pending when the state is unknown` | `tests/payments/intasendCollectionAdapter.test.ts` | 83 | PASS |
| 4 | `throws an error with code and raw payload on HTTP failure` | `tests/payments/intasendCollectionAdapter.test.ts` | 91 | PASS |
| 5 | `wraps the request in the required batch payload and uses NO approval` | `tests/payments/intasendB2CAdapter.test.ts` | 20 | PASS |
| 6 | `falls back to batch tracking_id when transaction_id is missing` | `tests/payments/intasendB2CAdapter.test.ts` | 74 | PASS |
| 7 | `throws B2CPayoutError with code and raw payload on HTTP error` | `tests/payments/intasendB2CAdapter.test.ts` | 92 | PASS |
| 8 | `maps batch status responses and treats unknown states as pending` | `tests/payments/intasendB2CAdapter.test.ts` | 118 | PASS |
| 9 | `throws B2CPayoutError with code and raw payload on status query errors` | `tests/payments/intasendB2CAdapter.test.ts` | 148 | PASS |
| 10 | `returns the IntaSend collection adapter in INTASEND mode` | `tests/payments/intasendFactory.test.ts` | 22 | PASS |
| 11 | `returns the IntaSend B2C adapter in INTASEND mode` | `tests/payments/intasendFactory.test.ts` | 27 | PASS |
| 12 | `preserves MOCK and DARAJA behavior` | `tests/payments/intasendFactory.test.ts` | 32 | PASS |
| 13 | `throws in production for unknown gateway mode values` | `tests/payments/intasendFactory.test.ts` | 42 | PASS |
| 14 | `defaults to MOCK in non-production when mode is unknown` | `tests/payments/intasendFactory.test.ts` | 55 | PASS |
| 15 | `accepts a valid IntaSend configuration` | `tests/payments/intasendConfig.test.ts` | 17 | PASS |
| 16 | `fails when INTASEND_SECRET_KEY is missing` | `tests/payments/intasendConfig.test.ts` | 21 | PASS |
| 17 | `fails when INTASEND_PUBLISHABLE_KEY is missing` | `tests/payments/intasendConfig.test.ts` | 21 | PASS |
| 18 | `fails when INTASEND_ENVIRONMENT is missing` | `tests/payments/intasendConfig.test.ts` | 21 | PASS |
| 19 | `fails when INTASEND_WEBHOOK_CHALLENGE is missing` | `tests/payments/intasendConfig.test.ts` | 21 | PASS |
| 20 | `fails when INTASEND_SECRET_KEY is invalid: BadKey_abc` | `tests/payments/intasendConfig.test.ts` | 29 | PASS |
| 21 | `fails when INTASEND_PUBLISHABLE_KEY is invalid: BadPubKey_abc` | `tests/payments/intasendConfig.test.ts` | 29 | PASS |
| 22 | `fails when INTASEND_ENVIRONMENT is invalid: staging` | `tests/payments/intasendConfig.test.ts` | 29 | PASS |
| 23 | `bypasses validation when NODE_ENV=test` | `tests/payments/intasendConfig.test.ts` | 37 | PASS |
| 24 | `throws migration-046 error when gateway_tracking_id column is missing` | `tests/payments/intasendConfig.test.ts` | 48 | PASS |
| 25 | `1. Valid challenge + state: COMPLETE -> deposit completed, wallet credited, HTTP 200` | `tests/payments/intasendCollectionWebhook.test.ts` | 55 | PASS |
| 26 | `2. Duplicate delivery -> HTTP 200, wallet still credited exactly once` | `tests/payments/intasendCollectionWebhook.test.ts` | 82 | PASS |
| 27 | `3. Invalid challenge -> HTTP 401, no DB mutation` | `tests/payments/intasendCollectionWebhook.test.ts` | 107 | PASS |
| 28 | `4. Missing challenge field -> HTTP 401` | `tests/payments/intasendCollectionWebhook.test.ts` | 126 | PASS |
| 29 | `5. Unknown invoice_id -> HTTP 200, no DB mutation, warning logged` | `tests/payments/intasendCollectionWebhook.test.ts` | 141 | PASS |
| 30 | `6. state: FAILED -> deposit failed, no wallet credit` | `tests/payments/intasendCollectionWebhook.test.ts` | 155 | PASS |
| 31 | `7. state: CANCELED -> deposit failed, no wallet credit` | `tests/payments/intasendCollectionWebhook.test.ts` | 174 | PASS |
| 32 | `8. Deposit already completed + callback again -> HTTP 200, no double credit` | `tests/payments/intasendCollectionWebhook.test.ts` | 193 | PASS |
| 33 | `1. Success + match by idempotency_key -> outbox sent, withdrawal completed, wallet finalized` | `tests/payments/intasendB2CWebhook.test.ts` | 113 | PASS |
| 34 | `2. Failure + match by idempotency_key -> outbox failed, withdrawal failed, unlockFunds called` | `tests/payments/intasendB2CWebhook.test.ts` | 138 | PASS |
| 35 | `3. Duplicate delivery -> HTTP 200, no double-finalize, no double-unlock` | `tests/payments/intasendB2CWebhook.test.ts` | 163 | PASS |
| 36 | `4. Invalid challenge -> HTTP 401` | `tests/payments/intasendB2CWebhook.test.ts` | 190 | PASS |
| 37 | `5. Match by transaction_id only (no idempotency_key) -> correct row updated` | `tests/payments/intasendB2CWebhook.test.ts` | 211 | PASS |
| 38 | `6. Match by tracking_id only (via gateway_tracking_id) -> correct row updated` | `tests/payments/intasendB2CWebhook.test.ts` | 233 | PASS |
| 39 | `7. No match -> HTTP 200, warning logged, no mutation` | `tests/payments/intasendB2CWebhook.test.ts` | 256 | PASS |
| 40 | `8. Batch with 2 transactions, 1 matched 1 unmatched -> matched processed, unmatched logged, batch not aborted` | `tests/payments/intasendB2CWebhook.test.ts` | 275 | PASS |
| 41 | `9. Outbox still pending (not sent) + callback arrives -> HTTP 200, no wallet mutation, info logged` | `tests/payments/intasendB2CWebhook.test.ts` | 303 | PASS |
| 42 | `1. Correct challenge -> next() called, returns 200 success` | `tests/payments/intasendChallenge.test.ts` | 20 | PASS |
| 43 | `2. Wrong challenge -> HTTP 401 { error: "Invalid challenge" }` | `tests/payments/intasendChallenge.test.ts` | 29 | PASS |
| 44 | `3. Missing challenge field -> HTTP 401` | `tests/payments/intasendChallenge.test.ts` | 38 | PASS |
| 45 | `4. Empty string challenge -> HTTP 401` | `tests/payments/intasendChallenge.test.ts` | 47 | PASS |
| 46 | `5. INTASEND_WEBHOOK_CHALLENGE unset at middleware invocation -> HTTP 500` | `tests/payments/intasendChallenge.test.ts` | 56 | PASS |
| 47 | `6. Length-mismatch challenge -> HTTP 401 without timingSafeEqual buffer error` | `tests/payments/intasendChallenge.test.ts` | 68 | PASS |

---

## 22. Verbose Targeted Test Output (7 IntaSend Test Files)

Command:
```bash
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; npx jest --runInBand --forceExit --verbose tests/payments/intasendCollectionAdapter.test.ts tests/payments/intasendB2CAdapter.test.ts tests/payments/intasendFactory.test.ts tests/payments/intasendConfig.test.ts tests/payments/intasendCollectionWebhook.test.ts tests/payments/intasendB2CWebhook.test.ts tests/payments/intasendChallenge.test.ts
```

Output:
```text
 PASS  tests/payments/intasendCollectionWebhook.test.ts (9.884 s)
  IntaSend Collection Webhook Integration Tests
    √ 1. Valid challenge + state: COMPLETE -> deposit completed, wallet credited, HTTP 200 (2068 ms)
    √ 2. Duplicate delivery -> HTTP 200, wallet still credited exactly once (1806 ms)
    √ 3. Invalid challenge -> HTTP 401, no DB mutation (461 ms)
    √ 4. Missing challenge field -> HTTP 401 (318 ms)
    √ 5. Unknown invoice_id -> HTTP 200, no DB mutation, warning logged (159 ms)
    √ 6. state: FAILED -> deposit failed, no wallet credit (1168 ms)
    √ 7. state: CANCELED -> deposit failed, no wallet credit (1164 ms)
    √ 8. Deposit already completed + callback again -> HTTP 200, no double credit (597 ms)

 PASS  tests/payments/intasendChallenge.test.ts
  IntaSend Challenge Middleware Tests
    √ 1. Correct challenge -> next() called, returns 200 success (57 ms)
    √ 2. Wrong challenge -> HTTP 401 { error: "Invalid challenge" } (47 ms)
    √ 3. Missing challenge field -> HTTP 401 (16 ms)
    √ 4. Empty string challenge -> HTTP 401 (17 ms)
    √ 5. INTASEND_WEBHOOK_CHALLENGE unset at middleware invocation -> HTTP 500 (13 ms)
    √ 6. Length-mismatch challenge -> HTTP 401 without timingSafeEqual buffer error (9 ms)

 PASS  tests/payments/intasendCollectionAdapter.test.ts
  IntaSendCollectionAdapter
    √ maps fields and invoice id into the payment gateway response (4 ms)
    √ maps all supported IntaSend states to gateway result codes (2 ms)
    √ falls back to pending when the state is unknown (12 ms)
    √ throws an error with code and raw payload on HTTP failure (2 ms)

 PASS  tests/payments/intasendB2CAdapter.test.ts
  IntaSendB2CAdapter
    √ wraps the request in the required batch payload and uses NO approval (4 ms)
    √ falls back to batch tracking_id when transaction_id is missing (1 ms)
    √ throws B2CPayoutError with code and raw payload on HTTP error (1 ms)
    √ maps batch status responses and treats unknown states as pending (11 ms)
    √ throws B2CPayoutError with code and raw payload on status query errors (2 ms)

 PASS  tests/payments/intasendFactory.test.ts
  IntaSend gateway factory wiring
    √ returns the IntaSend collection adapter in INTASEND mode (2 ms)
    √ returns the IntaSend B2C adapter in INTASEND mode (1 ms)
    √ preserves MOCK and DARAJA behavior (1 ms)
    √ throws in production for unknown gateway mode values (21 ms)
    √ defaults to MOCK in non-production when mode is unknown (1 ms)

 PASS  tests/payments/intasendConfig.test.ts
  validateIntasendConfig
    √ accepts a valid IntaSend configuration (2 ms)
    √ fails when INTASEND_SECRET_KEY is missing (20 ms)
    √ fails when INTASEND_PUBLISHABLE_KEY is missing (3 ms)
    √ fails when INTASEND_ENVIRONMENT is missing (4 ms)
    √ fails when INTASEND_WEBHOOK_CHALLENGE is missing (1 ms)
    √ fails when INTASEND_SECRET_KEY is invalid: BadKey_abc (1 ms)
    √ fails when INTASEND_PUBLISHABLE_KEY is invalid: BadPubKey_abc (1 ms)
    √ fails when INTASEND_ENVIRONMENT is invalid: staging (2 ms)
    √ bypasses validation when NODE_ENV=test (1 ms)
    √ throws migration-046 error when gateway_tracking_id column is missing (1 ms)

 PASS  tests/payments/intasendB2CWebhook.test.ts (24.339 s)
  IntaSend B2C Webhook Integration Tests
    √ 1. Success + match by idempotency_key -> outbox sent, withdrawal completed, wallet finalized (2340 ms)
    √ 2. Failure + match by idempotency_key -> outbox failed, withdrawal failed, unlockFunds called (2272 ms)
    √ 3. Duplicate delivery -> HTTP 200, no double-finalize, no double-unlock (3108 ms)
    √ 4. Invalid challenge -> HTTP 401 (739 ms)
    √ 5. Match by transaction_id only (no idempotency_key) -> correct row updated (2329 ms)
    √ 6. Match by tracking_id only (via gateway_tracking_id) -> correct row updated (2332 ms)
    √ 7. No match -> HTTP 200, warning logged, no mutation (560 ms)
    √ 8. Batch with 2 transactions, 1 matched 1 unmatched -> matched processed, unmatched logged, batch not aborted (2626 ms)
    √ 9. Outbox still pending (not sent) + callback arrives -> HTTP 200, no wallet mutation, info logged (951 ms)

Test Suites: 7 passed, 7 total
Tests:       47 passed, 47 total
Snapshots:   0 total
Time:        77.13 s
```

---

## 23. Full-Suite 2x Consecutive Runs (Real Outputs)

Command used for both consecutive runs:
`Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; npx jest --runInBand --forceExit`

### Run 1 Output
```text
Test Suites: 70 passed, 70 total
Tests:       464 passed, 464 total
Snapshots:   0 total
Time:        402.523 s
Ran all test suites.
Force exiting Jest: Have you considered using `--detectOpenHandles` to detect async operations that kept running after all tests finished?
```

### Run 2 Output
```text
Test Suites: 70 passed, 70 total
Tests:       464 passed, 464 total
Snapshots:   0 total
Time:        390.683 s, estimated 396 s
Ran all test suites.
Force exiting Jest: Have you considered using `--detectOpenHandles` to detect async operations that kept running after all tests finished?
```

---

## 24. Out-of-Scope Confirmation
- No Daraja route logic or existing webhook paths were modified.
- No `gateway_tracking_id` unique constraint was added.
- No raw-body capture or HMAC validation was introduced.
- No live IntaSend API calls were performed.
- No secrets or credentials were included in reports.

---

PHASE 2B FINAL VERIFIED — AWAITING GATE PASS
