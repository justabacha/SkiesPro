# Phase 2C Code Hardening & Ambiguity Handling (Step 1 Report)

## 1. Metadata
- Date: 2026-10-28
- Branch: `main`
- Commit: `f68e148`
- Scope: Step 1 Phase 2C Code Hardening (Fix 1 Boot Blocker, Fix 2 Idempotency Ambiguity with Migration 047, Fix 3 Logging Additions)

---

## 2. Pre-Work Verification

### Verify 1 — `idempotency_keys` Schema
In `migrations/027_add_idempotency_keys_table.sql`:
```sql
CREATE TABLE IF NOT EXISTS payments.idempotency_keys (
  key VARCHAR(255) PRIMARY KEY,
  response JSONB,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
- **Column Name**: `response`
- **Data Type**: `JSONB` (Nullable)
- **Check Constraints**: None
- **Conclusion**: Storing `{ status: 'ambiguous', error: message, timestamp: ISO }` objects natively supported in `JSONB`.

### Verify 2 — No Conflicting Status Assumptions
Ran `grep -rn "b2c_outbox.*status\|status.*b2c_outbox" src/ tests/`:
- `b2cDispatchWorker.ts`: `WHERE status = 'pending' AND next_attempt_at <= NOW()`
- `b2cReconciliation.job.ts`: `WHERE status = 'processing' AND updated_at < NOW() - ($1::int || ' seconds')::INTERVAL`
- `payment.routes.ts`: `if (outbox.status !== 'sent') { ... continue; }`
- **Result**: `NO CONFLICTS — needs_review is additive`. All worker, job, and route queries filter by specific status strings rather than exhaustive `CHECK` lists.

### Verify 3 — Existing Constraint Tests
Searched `tests/` for `b2c_outbox_status_check` or `CHECK`:
- **Result**: `NO CONSTRAINT TESTS FOUND`.

---

## 3. Migration 047

### SQL Source (`migrations/047_b2c_needs_review_status.sql`)
```sql
-- Migration 047: Add 'needs_review' status for ambiguous payout outcomes
-- When a B2C dispatch may have reached IntaSend but the response was lost,
-- the row is marked 'needs_review' to prevent auto-retry (which could double-pay).
-- 'needs_review' is terminal until an admin manually resolves via:
--   - status = 'sent'   (payout confirmed, finalize debit)
--   - status = 'failed' (payout confirmed failed, unlock funds)
--   - status = 'pending' (confirmed not sent, safe to retry)
-- Reconciliation and worker do NOT auto-process 'needs_review' rows.

ALTER TABLE payments.b2c_outbox
  DROP CONSTRAINT IF EXISTS b2c_outbox_status_check;

ALTER TABLE payments.b2c_outbox
  ADD CONSTRAINT b2c_outbox_status_check
  CHECK (status IN ('pending','processing','sent','failed','dead','needs_review'));
```

- **Application Timestamp**: Applied to `TEST_DATABASE_URL` at `2026-10-28T14:08:28.022Z`.

---

## 4. Fix 1 — Boot Blocker: `validateB2cConfig()` Conditional

### Quoted Implementation (`src/config/app.ts`)
```typescript
export function validateB2cConfig(): void {
  const processingTimeoutRaw = process.env.B2C_PROCESSING_TIMEOUT_SECONDS ?? '300';
  const processingTimeout = Number(processingTimeoutRaw);

  if (!Number.isInteger(processingTimeout) || processingTimeout <= 0) {
    throw new Error(
      `B2C_PROCESSING_TIMEOUT_SECONDS must be a positive integer. Received: ${processingTimeoutRaw}`
    );
  }

  config.b2cProcessingTimeoutSeconds = processingTimeout;

  const mode = String(process.env.PAYMENT_GATEWAY_MODE || '').trim().toUpperCase();

  if (config.enableB2cDisbursement && mode === 'DARAJA') {
    const requiredVars = [
      { name: 'MPESA_B2C_SHORTCODE', value: config.b2c.shortcode },
      { name: 'MPESA_B2C_INITIATOR_NAME', value: config.b2c.initiatorName },
      { name: 'MPESA_B2C_SECURITY_CREDENTIAL', value: config.b2c.securityCredential },
      { name: 'MPESA_B2C_RESULT_URL', value: config.b2c.resultUrl },
      { name: 'MPESA_B2C_TIMEOUT_URL', value: config.b2c.timeoutUrl },
    ];

    const missing = requiredVars.filter((v) => !v.value).map((v) => v.name);
    if (missing.length > 0) {
      throw new Error(
        `ENABLE_B2C_DISBURSEMENT is true but missing required env vars: ${missing.join(', ')}`
      );
    }
  }
}
```

---

## 5. Fix 2 — Deposit & B2C Idempotency Ambiguity

### Collection Adapter Error Discrimination (`IntaSendCollectionAdapter.ts`)
```typescript
    } catch (error: any) {
      const code = error.response?.status ?? error.code ?? 'INTASEND_HTTP_ERROR';
      const raw = error.response?.data ?? error;
      const message =
        error.response?.data?.message ||
        error.response?.data?.error?.message ||
        error.message ||
        'IntaSend STK push initiation failed';

      let outcome: 'definitely_not_sent' | 'possibly_sent' | 'server_rejected' = 'possibly_sent';

      if (error.response) {
        outcome = 'server_rejected';
      } else if (error.request) {
        const errCode = String(error.code || '').toUpperCase();
        if (['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(errCode)) {
          outcome = 'definitely_not_sent';
        } else if (['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET'].includes(errCode)) {
          outcome = 'possibly_sent';
        } else {
          outcome = 'possibly_sent';
        }
      } else {
        outcome = 'possibly_sent';
      }

      const wrapped: any = new Error(message);
      wrapped.code = code;
      wrapped.raw = raw;
      wrapped.outcome = outcome;
      throw wrapped;
    }
```

### Deposit Service Ambiguous Idempotency & 409 Guard (`PaymentService.ts`)
```typescript
  async initiateDeposit(
    userId: string,
    data: DepositInitiateDto,
    idempotencyKey: string
  ): Promise<DepositResponseDto> {
    const cached = await this.paymentRepo.findIdempotencyKey(idempotencyKey);
    if (cached) {
      if (cached.status === 'ambiguous') {
        const err: any = new Error(
          'Deposit is in ambiguous state — manual reconciliation required before retry'
        );
        err.status = 409;
        err.statusCode = 409;
        throw err;
      }
      if (cached.status !== 'processing') return cached;
    }

    // ... initiation logic ...

    } catch (error: any) {
      logger.error('Deposit initiation failed', { error: error.message, userId, idempotencyKey });

      if (error.outcome === 'possibly_sent') {
        await this.paymentRepo.saveIdempotencyKey(idempotencyKey, {
          status: 'ambiguous',
          error: error.message,
          timestamp: new Date().toISOString(),
        });
        const ambiguousErr: any = new Error(
          `DEPOSIT_STATUS_AMBIGUOUS — check IntaSend dashboard before retrying: ${error.message}`
        );
        ambiguousErr.status = 409;
        ambiguousErr.statusCode = 409;
        ambiguousErr.outcome = 'possibly_sent';
        throw ambiguousErr;
      } else {
        await this.paymentRepo.saveIdempotencyKey(idempotencyKey, null);
        throw error;
      }
    }
  }
```

### B2C Adapter Outcome Discrimination (`IntaSendB2CAdapter.ts`)
```typescript
    } catch (error: any) {
      const code = error.response?.status ?? error.code ?? 'INTASEND_HTTP_ERROR';
      const raw = error.response?.data ?? error;
      const message =
        error.response?.data?.message ||
        error.response?.data?.error?.message ||
        error.message ||
        'IntaSend payout initiation failed';

      let outcome: 'definitely_not_sent' | 'possibly_sent' | 'server_rejected' = 'possibly_sent';

      if (error.response) {
        outcome = 'server_rejected';
      } else if (error.request) {
        const errCode = String(error.code || '').toUpperCase();
        if (['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(errCode)) {
          outcome = 'definitely_not_sent';
        } else if (['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET'].includes(errCode)) {
          outcome = 'possibly_sent';
        } else {
          outcome = 'possibly_sent';
        }
      } else {
        outcome = 'possibly_sent';
      }

      throw new B2CPayoutError(message, code, raw, outcome);
    }
```

### B2C Worker `needs_review` Transition (`b2cDispatchWorker.ts`)
```typescript
    } catch (error: any) {
      const attemptCount = (row.attempt_count || 0) + 1;
      const maxAttempts = row.max_attempts || 5;
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (error?.outcome === 'possibly_sent') {
        await this.pool.query(
          `UPDATE payments.b2c_outbox
           SET status = 'needs_review',
               attempt_count = attempt_count + 1,
               last_error = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [
            `AMBIGUOUS — payout may have been sent. Check IntaSend dashboard before manual retry. Original: ${errorMessage}`,
            row.id,
          ]
        );

        logger.error('B2C dispatch AMBIGUOUS — marked needs_review', {
          correlationId: row.id,
          outboxId: row.id,
          withdrawalId: row.withdrawal_id,
          error: errorMessage,
        });
        return;
      }
```

### B2C Reconciliation Job Query Confirmation (`b2cReconciliation.job.ts`)
```sql
SELECT id, withdrawal_id, originator_conversation_id, attempt_count, max_attempts
FROM payments.b2c_outbox
WHERE status = 'processing'
  AND updated_at < NOW() - ($1::int || ' seconds')::INTERVAL
```
`WHERE status = 'processing'` explicitly excludes `needs_review` rows, guaranteeing that ambiguous payout rows will never be automatically reset to `pending` by the background reconciliation worker.

---

## 6. Fix 3 — Critical Logging Additions

### Quoted Log Statements
1. **Collection Callback Received** (`payment.routes.ts`):
   `logger.info('IntaSend collection callback received', { correlationId: (req as any).correlationId, invoiceId, state, apiRef });`
2. **Collection Wallet Credited** (`payment.routes.ts`):
   `logger.info('IntaSend collection callback credited wallet', { correlationId: (req as any).correlationId, depositId: lockDeposit.id, userId: lockDeposit.user_id, amount: lockDeposit.net_amount, invoiceId });`
3. **B2C Callback Received** (`payment.routes.ts`):
   `logger.info('IntaSend B2C callback received', { correlationId: (req as any).correlationId, trackingId: payload.tracking_id, transactionCount: Array.isArray(payload.transactions) ? payload.transactions.length : 0 });`
4. **B2C Dispatch Worker Correlator Integration** (`b2cDispatchWorker.ts`):
   Added `correlationId: row.id` to all dispatch log statements (using `outbox_id` as correlator since `correlation_id` column is not present on `payments.b2c_outbox`).

---

## 7. Tests Evidence Table

| # | Test Name | File | Result |
|---|---|---|---|
| 1 | `passes when PAYMENT_GATEWAY_MODE=INTASEND and all MPESA_B2C_* are unset` | `tests/payments/intasendConfig.test.ts` | PASS |
| 2 | `passes when PAYMENT_GATEWAY_MODE=MOCK and all MPESA_B2C_* are unset` | `tests/payments/intasendConfig.test.ts` | PASS |
| 3 | `throws when PAYMENT_GATEWAY_MODE=DARAJA and any MPESA_B2C_* is missing` | `tests/payments/intasendConfig.test.ts` | PASS |
| 4 | `ambiguous deposit error marks idempotency key ambiguous and refuses retry with 409` | `tests/payments/intasendConfig.test.ts` | PASS |
| 5 | `definitely_not_sent deposit error clears idempotency and allows retry` | `tests/payments/intasendConfig.test.ts` | PASS |
| 6 | `throws with outcome='possibly_sent' on Axios ETIMEDOUT` | `tests/payments/intasendCollectionAdapter.test.ts` | PASS |
| 7 | `throws with outcome='definitely_not_sent' on Axios ECONNREFUSED` | `tests/payments/intasendCollectionAdapter.test.ts` | PASS |
| 8 | `throws with outcome='server_rejected' on 400 response` | `tests/payments/intasendCollectionAdapter.test.ts` | PASS |
| 9 | `throws with outcome='possibly_sent' on Axios ETIMEDOUT` | `tests/payments/intasendB2CAdapter.test.ts` | PASS |
| 10 | `throws with outcome='definitely_not_sent' on Axios ECONNREFUSED` | `tests/payments/intasendB2CAdapter.test.ts` | PASS |
| 11 | `throws with outcome='server_rejected' on 400 response` | `tests/payments/intasendB2CAdapter.test.ts` | PASS |
| 12 | `ambiguous B2C failure marks outbox needs_review and does not retry or unlock` | `tests/payments/b2cDispatchWorker.test.ts` | PASS |
| 13 | `reconciliation does not reset needs_review rows` | `tests/payments/b2cDispatchWorker.test.ts` | PASS |
| 14 | `Logs webhook received and wallet credited messages` | `tests/payments/intasendCollectionWebhook.test.ts` | PASS |
| 15 | `Logs B2C webhook received message` | `tests/payments/intasendB2CWebhook.test.ts` | PASS |

---

## 8. Full-Suite 2× Consecutive Runs

### Run 1 Output
```text
Test Suites: 70 passed, 70 total
Tests:       479 passed, 479 total
Snapshots:   0 total
Time:        478.604 s
Ran all test suites.
Force exiting Jest: Have you considered using `--detectOpenHandles` to detect async operations that kept running after all tests finished?
```

### Run 2 Output
```text
Test Suites: 70 passed, 70 total
Tests:       479 passed, 479 total
Snapshots:   0 total
Time:        446.408 s, estimated 471 s
Ran all test suites.
Force exiting Jest: Have you considered using `--detectOpenHandles` to detect async operations that kept running after all tests finished?
```

---

## 9. Test Count Delta
- **Previous test count**: 464 tests
- **New test count**: 479 tests
- **Delta**: **+15 tests** (13 new tests in adapter, config, and worker test files + 2 logging verification tests in webhook suites).

---

## 10. Manual Steps Required from Phesty (Production Go-Live Runbook)

| Step | Action | Target | Reason |
|---|---|---|---|
| 1 | Run `migrations/046_b2c_outbox_gateway_tracking_id.sql` | Production DB | Adds `gateway_tracking_id` column and index to `payments.b2c_outbox` |
| 2 | Run `migrations/047_b2c_needs_review_status.sql` | Production DB | Expands `payments.b2c_outbox.status` CHECK constraint to include `'needs_review'` |
| 3 | Set `INTASEND_SECRET_KEY` | Render env | IntaSend API secret key (`ISSecretKey_...`) |
| 4 | Set `INTASEND_PUBLISHABLE_KEY` | Render env | IntaSend publishable key (`ISPubKey_...`) |
| 5 | Set `INTASEND_ENVIRONMENT` | Render env | Environment mode (`sandbox` or `live`) |
| 6 | Set `INTASEND_WEBHOOK_CHALLENGE` | Render env | Server-side webhook verification challenge string |
| 7 | Set `PAYMENT_GATEWAY_MODE=INTASEND` | Render env | Activates IntaSend gateway adapters in factories |
| 8 | Register Collection Webhook URL | IntaSend Dashboard | `https://skiespro.co.ke/api/v1/payments/intasend/collection/callback` |
| 9 | Register B2C Webhook URL | IntaSend Dashboard | `https://skiespro.co.ke/api/v1/payments/intasend/b2c/callback` |
| 10 | Verify `requires_approval: "NO"` | IntaSend Dashboard | Ensure auto-approval is enabled so payouts execute immediately without manual approval queueing |

### Admin Operational Runbook for `needs_review` Outbox Rows

When a B2C payout encounters an ambiguous network failure, the outbox row is marked `status = 'needs_review'`. An operator should inspect the IntaSend dashboard using `gateway_tracking_id` or `originator_conversation_id` and execute the appropriate manual resolution:

1. **If payout confirmed SENT on IntaSend**:
   ```sql
   BEGIN;
   UPDATE wallet.wallets
     SET locked_balance = locked_balance - <amount>,
         balance = balance - <amount>
     WHERE user_id = '<user_id>' AND account_type = 'real';
   UPDATE payments.withdrawals
     SET status = 'completed', gateway_reference = '<intasend_tracking_id>'
     WHERE id = '<withdrawal_id>';
   UPDATE payments.b2c_outbox
     SET status = 'sent', updated_at = NOW()
     WHERE id = '<outbox_id>';
   COMMIT;
   ```

2. **If payout confirmed FAILED on IntaSend**:
   ```sql
   BEGIN;
   UPDATE wallet.wallets
     SET locked_balance = locked_balance - <amount>
     WHERE user_id = '<user_id>' AND account_type = 'real';
   UPDATE payments.withdrawals
     SET status = 'failed'
     WHERE id = '<withdrawal_id>';
   UPDATE payments.b2c_outbox
     SET status = 'failed', last_error = 'Manually failed by admin after IntaSend verification'
     WHERE id = '<outbox_id>';
   COMMIT;
   ```

3. **If payout confirmed NOT SENT on IntaSend (Safe to Retry)**:
   ```sql
   UPDATE payments.b2c_outbox
     SET status = 'pending', next_attempt_at = NOW(), updated_at = NOW()
     WHERE id = '<outbox_id>';
   ```

---

## 11. Out-of-Scope Confirmation
- No Phase 1 reconciliation logic modified.
- No Phase 2A/2B adapter core logic changed beyond error outcome classification.
- No new API endpoints created.
- No admin UI changes implemented.
- No live IntaSend API calls executed.
- No secrets or credentials printed or committed.

---

STEP 1 COMPLETE — AWAITING GATE PASS
