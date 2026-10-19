# B2C DISBURSEMENT SLICE 2 EXECUTION REPORT: OUTBOX TABLE, DISPATCH WORKER, CONFIG WIRING, INTEGRATION TESTS

**Status**: Executed & Verified  
**Date**: October 19, 2026  
**Module**: Payments / B2C Outbox & Dispatch Worker ([`src/modules/payments/workers/b2cDispatchWorker.ts`](file:///C:/SkiesPro/src/modules/payments/workers/b2cDispatchWorker.ts))

---

## 1. PRE-CHECK FINDINGS (P1–P4)

### P1. Highest Existing Migration Number
- **Check Command**: `ls migrations/ | sort | tail -5`
- **Excerpts**:
  - `034_demo_tick_retention_config.sql`
  - `035_admin_schema_and_views.sql`
  - `036_admin_totp_onboarding.sql`
  - `037_seed_test_kyc_documents.sql`
- **Finding**: Highest existing migration is `037`. Slice 2 migration file is created as [`migrations/038_b2c_outbox_table.sql`](file:///C:/SkiesPro/migrations/038_b2c_outbox_table.sql).

---

### P2. Server Bootstrap & Worker Pattern (`src/index.ts` & `settlementWorker.ts`)
- **Instantiation Pattern**: Dynamic import with feature flag guard (`if (config.enableB2cWorker)`).
- **Interval & Loop Pattern**: Non-blocking polling loop with `FOR UPDATE SKIP LOCKED` claim step.
- **Graceful Shutdown Pattern**: Registered `process.on('SIGTERM')` and `process.on('SIGINT')` signal handlers calling `worker.stop()`.

---

### P3. Worker Claim Pattern (`reconciliationWorker.ts` & `b2cDispatchWorker.ts`)
- **Claim Strategy**: `SELECT ... WHERE status = 'pending' AND next_attempt_at <= NOW() ORDER BY next_attempt_at ASC LIMIT $1 FOR UPDATE SKIP LOCKED` inside a short claim transaction (`BEGIN ... COMMIT`).
- **Isolation Guarantee**: The claim transaction updates status to `'processing'` and COMMITS before calling external gateway `initiateB2CPayout()`. Zero database transactions or locks are held during external API calls.

---

### P4. Foreign Key Constraints on `payments.withdrawals`
- **Findings**:
  - `payments.withdrawals.idempotency_key` references `payments.idempotency_keys(key)`.
  - `payments.b2c_outbox.withdrawal_id` references `payments.withdrawals(id)`.
  - Inserting an outbox row requires a valid `withdrawal_id` row in `payments.withdrawals`.

---

## 2. FILES CREATED & MODIFIED

| Action | Path | Description |
| :--- | :--- | :--- |
| **[NEW]** | [`038_b2c_outbox_table.sql`](file:///C:/SkiesPro/migrations/038_b2c_outbox_table.sql) | Idempotent DDL migration creating `payments.b2c_outbox` table, check constraints, and performance indexes |
| **[NEW]** | [`b2cDispatchWorker.ts`](file:///C:/SkiesPro/src/modules/payments/workers/b2cDispatchWorker.ts) | Async outbox background worker claiming pending dispatches via `FOR UPDATE SKIP LOCKED`, invoking `IB2CPayoutGateway`, and handling retries/dead-letter |
| **[MODIFY]** | [`src/config/app.ts`](file:///C:/SkiesPro/src/config/app.ts) | Added `b2cWorkerIntervalMs` (default 5000) and `b2cWorkerBatchSize` (default 5) config options |
| **[MODIFY]** | [`src/index.ts`](file:///C:/SkiesPro/src/index.ts) | Bootstrapped `B2CDispatchWorker` when `enableB2cWorker === true` and wired SIGTERM/SIGINT graceful shutdown handlers |
| **[MODIFY]** | [`DarajaB2CAdapter.ts`](file:///C:/SkiesPro/src/modules/payments/adapters/mpesa/DarajaB2CAdapter.ts) | Updated `Decimal` instance check for cross-module duck-typing safety |
| **[MODIFY]** | [`MpesaB2CMockAdapter.ts`](file:///C:/SkiesPro/src/modules/payments/adapters/mpesa/MpesaB2CMockAdapter.ts) | Fixed mockMode constructor precedence and `Decimal` duck-typing check |
| **[NEW]** | [`b2cDispatchWorker.test.ts`](file:///C:/SkiesPro/tests/payments/b2cDispatchWorker.test.ts) | 10 integration tests verifying claim logic, retries, exponential backoff, dead-letter state, concurreny (`SKIP LOCKED`), and lock-free external call isolation |
| **[NEW]** | [`MANUAL_TASKS.md`](file:///C:/SkiesPro/reports/B2C/MANUAL_TASKS.md) | Central operational guide listing env variables, feature flags, and migration commands per slice |

---

## 3. TEST RESULTS

**Execution Command**: `npm test -- tests/payments/b2cDispatchWorker`  
**Result**: **PASS** (10/10 passed, 0 failed)

```
 PASS  tests/payments/b2cDispatchWorker.test.ts (28.583 s)
  B2CDispatchWorker Integration Tests (Slice 2)
    √ 1. Worker claims pending outbox row -> updates status to sent, conversation_id, processed_at (1990 ms)
    √ 2. Mock adapter failure -> attempt_count=1, status=pending, next_attempt_at in future, last_error set (1941 ms)
    √ 3. Mock adapter timeout -> handled as retryable failure (1932 ms)
    √ 4. Attempt count reaches max_attempts -> row marked status=dead (1924 ms)
    √ 5. Worker skips rows where next_attempt_at > NOW() (1500 ms)
    √ 6. Worker skips sent, dead, and processing rows (3226 ms)
    √ 7. FOR UPDATE SKIP LOCKED: two workers racing split rows without duplicate execution (3669 ms)
    √ 8. CRITICAL: No DB transaction held open during external API call (2736 ms)
    √ 9. Graceful stop: stop() while batch is in flight completes current batch (1939 ms)
    √ 10. Worker respects enableB2cWorker=false config flag (1 ms)

Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
Time:        29.063 s
```

### Test #8 Verification Details (Transaction Isolation)
- In Test #8, a custom gateway injected a 1000ms delay during `initiateB2CPayout()`.
- While the external call was sleeping in flight, a concurrent client executed `SELECT id, status FROM payments.b2c_outbox WHERE id = $1 FOR UPDATE NOWAIT`.
- **Outcome**: The `FOR UPDATE NOWAIT` lock was acquired cleanly without blocking (`lockAcquired === true`), proving that the claim transaction committed before making the external HTTP call.

---

## 4. TYPECHECK RESULT

**Execution Command**: `npm run typecheck` (`tsc --noEmit`)  
**Result**: **Exit Code 0** (0 type errors across entire codebase)

---

## 5. GIT DIFF --STAT OUTPUT

```
 src/config/app.ts                                  |  2 ++
 src/index.ts                                       | 34 ++++++++++++++++++++++
 .../payments/adapters/mpesa/DarajaB2CAdapter.ts    |  6 +++-
 .../payments/adapters/mpesa/MpesaB2CMockAdapter.ts | 14 ++++-----
 4 files changed, 48 insertions(+), 8 deletions(-)
```

**Untracked New Files**:
- `migrations/038_b2c_outbox_table.sql`
- `src/modules/payments/workers/b2cDispatchWorker.ts`
- `tests/payments/b2cDispatchWorker.test.ts`
- `reports/B2C/MANUAL_TASKS.md`

---

## 6. MANUAL TASKS ADDED BY THIS SLICE

1. **Apply Migration Locally & Production**:
   ```bash
   npm run migrate
   ```
2. **Set Worker Config Env Variables** (Render & Local `.env` - optional overrides):
   - `B2C_WORKER_INTERVAL_MS=5000`
   - `B2C_WORKER_BATCH_SIZE=5`
3. **Feature Flag Safeguards**:
   - Keep `ENABLE_B2C_WORKER=false` in Render and local `.env` until Slice 4 callback handlers are ready to process asynchronous Safaricom responses.
   - Keep `ENABLE_B2C_DISBURSEMENT=false` until Slice 4.

*Appended to [`reports/B2C/MANUAL_TASKS.md`](file:///C:/SkiesPro/reports/B2C/MANUAL_TASKS.md).*

---

**Executed & Verified**
