# Slice 5 Correction Report: Test Infra Fix, Revert Scope Creep, Full Suite Verification

## Task 1: Historical Migration Revert Confirmation
- Reverted `migrations/026_add_available_balance_trigger.sql` and `migrations/035_admin_schema_and_views.sql`.
- Verification command `git diff migrations/026* migrations/035*` returned empty output.
- **Necessity Analysis**: Neither historical migration modification was genuinely needed for Slice 5 functionality. Slice 5 functionality relies exclusively on `migrations/039_b2c_ops_recovery.sql`. Reverting historical files restores schema history integrity.

---

## Task 2: `src/config/database.ts` Revert Confirmation
- Reverted `src/config/database.ts`.
- Verification command `git diff src/config/database.ts` returned empty output.
- **Reasoning**: Production credentials configuration must fail fast on missing environment variables rather than falling back to placeholder strings.

---

## Task 3: Scratch Scripts Decision & Execution
- `scripts/apply-039.ts`: Deleted (redundant one-off helper; standard `npm run migrate` executes `run-migrations.ts`).
- `scripts/verify-slice5-e2e.ts`: Renamed to `scripts/dev-verify-slice5-e2e.ts` and updated with a top-level documentation header explaining developer usage.

---

## Task 4: Test Infrastructure Fixes (Dynamic Phones & Teardown)

### Files Updated
1. `tests/payments/withdrawal.test.ts`
2. `tests/payments/b2cCallback.test.ts`
3. `tests/payments/b2cOpsRecovery.test.ts`
4. `tests/admin/b2cRecoveryRoutes.test.ts`
5. `tests/payments/b2cDispatchWorker.test.ts`

### Code Snippets

#### Dynamic Phone Generator
```typescript
function generateUniquePhone(): string {
  const random8 = Math.floor(10000000 + Math.random() * 90000000);
  return `07${random8}`;
}
```

#### Scoped Teardown Pattern (`afterAll`)
```typescript
afterAll(async () => {
  if (skipDatabaseTests) return;

  if (createdOutboxIds.length > 0) {
    await pgPool.query('DELETE FROM payments.b2c_outbox WHERE id = ANY($1::uuid[])', [createdOutboxIds]);
  }
  if (createdWithdrawalIds.length > 0) {
    await pgPool.query('DELETE FROM payments.withdrawals WHERE id = ANY($1::uuid[])', [createdWithdrawalIds]);
  }
  if (createdIdempotencyKeys.length > 0) {
    await pgPool.query('DELETE FROM payments.idempotency_keys WHERE key = ANY($1::text[])', [createdIdempotencyKeys]);
  }
  if (testUserId) {
    await pgPool.query('DELETE FROM wallet.ledger_entries WHERE wallet_id IN (SELECT id FROM wallet.wallets WHERE user_id = $1)', [testUserId]);
    await pgPool.query('DELETE FROM wallet.wallets WHERE user_id = $1', [testUserId]);
    await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [testUserId]);
  }
  if (adminUserId) {
    await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [adminUserId]);
  }
});
```

---

## Task 5: Stale Test Data Cleanup

### SELECT Output (Identified Stale Users)
```json
[
  {
    "id": "7068666c-9b90-4fea-835e-1375a2ed4019",
    "email": "test-admin-1792448869798@example.com",
    "phone": "0788888888"
  },
  {
    "id": "06ac0a7f-cf65-4e0b-99e0-56597bfc85cd",
    "email": "test-withdrawal-1792448871000@example.com",
    "phone": "0712345678"
  },
  {
    "id": "58ff0d82-3982-4c5f-aad9-3064b6af280d",
    "email": "test-settle-58ff0d82-3982-4c5f-aad9-3064b6af280d@example.com",
    "phone": null
  }
]
```
*(Verified: Historical withdrawal `235d9ef4-8cde-42c9-be63-9accc9ac09d0` and user `87d63bfc-4488-4a39-8f20-eda46453ebe9` were NOT in this list).*

### Deletion SQL Executed
```sql
DELETE FROM trading.contract_events WHERE contract_id IN (SELECT id FROM trading.binary_contracts WHERE user_id IN ('7068666c-9b90-4fea-835e-1375a2ed4019', '06ac0a7f-cf65-4e0b-99e0-56597bfc85cd', '58ff0d82-3982-4c5f-aad9-3064b6af280d'));
DELETE FROM trading.binary_contracts WHERE user_id IN ('7068666c-9b90-4fea-835e-1375a2ed4019', '06ac0a7f-cf65-4e0b-99e0-56597bfc85cd', '58ff0d82-3982-4c5f-aad9-3064b6af280d');
DELETE FROM payments.b2c_outbox WHERE withdrawal_id IN (SELECT id FROM payments.withdrawals WHERE user_id IN ('7068666c-9b90-4fea-835e-1375a2ed4019', '06ac0a7f-cf65-4e0b-99e0-56597bfc85cd', '58ff0d82-3982-4c5f-aad9-3064b6af280d'));
DELETE FROM payments.withdrawals WHERE user_id IN ('7068666c-9b90-4fea-835e-1375a2ed4019', '06ac0a7f-cf65-4e0b-99e0-56597bfc85cd', '58ff0d82-3982-4c5f-aad9-3064b6af280d');
DELETE FROM wallet.ledger_entries WHERE wallet_id IN (SELECT id FROM wallet.wallets WHERE user_id IN ('7068666c-9b90-4fea-835e-1375a2ed4019', '06ac0a7f-cf65-4e0b-99e0-56597bfc85cd', '58ff0d82-3982-4c5f-aad9-3064b6af280d'));
DELETE FROM wallet.wallets WHERE user_id IN ('7068666c-9b90-4fea-835e-1375a2ed4019', '06ac0a7f-cf65-4e0b-99e0-56597bfc85cd', '58ff0d82-3982-4c5f-aad9-3064b6af280d');
DELETE FROM app_auth.user_roles WHERE user_id IN ('7068666c-9b90-4fea-835e-1375a2ed4019', '06ac0a7f-cf65-4e0b-99e0-56597bfc85cd', '58ff0d82-3982-4c5f-aad9-3064b6af280d');
DELETE FROM app_auth.users WHERE id IN ('7068666c-9b90-4fea-835e-1375a2ed4019', '06ac0a7f-cf65-4e0b-99e0-56597bfc85cd', '58ff0d82-3982-4c5f-aad9-3064b6af280d');
```

---

## Task 6: Consecutive Full Test Suite Runs

### Run 1 Summary Line
```
Test Suites: 54 passed, 54 total
Tests:       367 passed, 367 total
Snapshots:   0 total
Time:        129.86 s
```

### Run 2 Summary Line
```
Test Suites: 54 passed, 54 total
Tests:       367 passed, 367 total
Snapshots:   0 total
Time:        131.036 s
```

---

## Task 7: `MANUAL_TASKS.md` Excerpt
```markdown
## CRITICAL tech debt: Tests run against production database

`npm test` uses `DATABASE_URL` from `.env`, which points to the LIVE Supabase database
(`aws-0-us-east-1.pooler.supabase.com:6543`). There is no separate test database.

Implications:
- Every test run writes users/wallets/withdrawals to production
- Test data has been mixed with real data
- Historical withdrawal `235d9ef4-8cde-42c9-be63-9accc9ac09d0` is real and must never be touched by tests
- Unique constraint `app_auth_users_phone_idx` causes re-run failures if cleanup incomplete

Mitigation (added in Slice 5 correction):
- Tests now use dynamic phone numbers + proper teardown
- Full suite passes 2x consecutively

**Long-term fix (deferred)**: Provision a dedicated test database (Supabase free tier project, or local Docker Postgres). Point `TEST_DATABASE_URL` at it. Update test setup to use `TEST_DATABASE_URL` if set. This is a launch-blocking change for any future scaling and should land before public beta.
```

---

## Typecheck Verification
- **Backend Typecheck (`npm run typecheck`)**: Exit code `0` (0 errors).
- **Frontend Typecheck (`npx tsc --noEmit` in frontend/)**: Exit code `0` (0 errors).

---

## Git Diff Stat
```
 frontend/src/components/admin/PendingWithdrawalsTable.tsx | 117 +++++++++++++++++++++---
 frontend/src/components/admin/WithdrawalActionModal.tsx   | 165 +++++++++++++++++++++++++++------
 frontend/src/hooks/admin/useAdminFinance.ts               |  60 ++++++++++++
 frontend/src/pages/admin/FinanceOverviewPage.tsx          |  39 +++++---
 frontend/src/services/admin/adminApiClient.ts             |  49 +++++++++-
 reports/B2C/MANUAL_TASKS.md                               |  27 ++++++
 src/config/app.ts                                         |   2 +
 src/index.ts                                              |  25 +++++
 src/modules/admin/admin.routes.ts                         |  34 +++++++
 src/modules/admin/controllers/AdminController.ts          |  55 +++++++++++
 src/modules/admin/repositories/AdminRepository.ts         |  34 +++++--
 src/modules/admin/services/AdminComplianceService.ts      | 285 ++++++++++++++++++++++++++++++++++++++++++++++++++++++++--
 src/modules/payments/repositories/paymentRepository.ts    |  47 ++++++++++
 tests/admin/b2cRecoveryRoutes.test.ts                     | 188 +++++++++++++++++++++++++++++++++++++
 tests/payments/b2cCallback.test.ts                        |  16 ++--
 tests/payments/b2cDispatchWorker.test.ts                 |  10 +-
 tests/payments/b2cOpsRecovery.test.ts                     | 239 ++++++++++++++++++++++++++++++++++++++++++++++++
 tests/payments/b2cReconciliation.test.ts                  | 152 ++++++++++++++++++++++++++++++
 tests/payments/withdrawal.test.ts                         |  27 ++++--
 19 files changed, 1421 insertions(+), 150 deletions(-)
```
*(Notice: `migrations/026`, `migrations/035`, and `src/config/database.ts` are completely absent from the diff).*

---

Executed & Verified
