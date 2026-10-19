# B2C DISBURSEMENT SLICE 3 COVERAGE COMPLETION REPORT

**Status**: Executed & Verified  
**Date**: October 19, 2026  
**Module**: Admin Compliance & Payments / Withdrawal Approval ([`src/modules/admin/services/AdminComplianceService.ts`](file:///C:/SkiesPro/src/modules/admin/services/AdminComplianceService.ts))

---

## TASK 1 — TEST INVENTORY OUTPUT & GAP ANALYSIS

### Command Output (`rg -n "^\s*(it|test)\(" tests/payments/withdrawal.test.ts`)
```
53:  it('should fail if KYC is not verified', async () => {
79:  it('should process a valid withdrawal request and lock funds with 2% fee', async () => {
96:  it('should approve withdrawal successfully (Slice 3: sets status to dispatched, enqueues b2c_outbox, leaves wallet unchanged)', async () => {
133: it('should enforce idempotency on sequential approve calls', async () => {
155: it('should handle concurrent racy approve calls cleanly (only one succeeds, exactly one outbox row)', async () => {
186: it('should fail approval if user phone is missing', async () => {
218: it('should fail approval if user phone format is invalid', async () => {
244: it('should fail approval if netAmount is less than or equal to zero (fee >= amount)', async () => {
272: it('should fail approval if locked_balance is less than withdrawal amount', async () => {
305: it('should fail if amount is below minimum (1500 KES)', async () => {
318: it('should fail if amount exceeds maximum (60000 KES)', async () => {
331: it('should process withdrawal rejection correctly (refund + ledger + status rejected)', async () => {
```

### Gap Analysis Against Required Approval Flow Test Inventory
| # | Required Test Scenario | Status Before Task 2 | Status After Task 2 |
| :- | :--- | :--- | :--- |
| 1 | Approve success $\rightarrow$ `'dispatched'` + outbox row + wallet unchanged + no ledger entry | Existed | **PASS** |
| 2 | Approve idempotency $\rightarrow$ second approve throws, still 1 outbox row | Existed | **PASS** |
| 3 | **Concurrent race** $\rightarrow$ parallel approves $\rightarrow$ 1 succeeds, 1 throws, 1 outbox row | **Added in Task 2** | **PASS** |
| 4 | Missing phone $\rightarrow$ throws, no outbox row, wallet unchanged, status `'pending'` | Existed | **PASS** |
| 5 | Invalid phone format $\rightarrow$ throws, no outbox row, wallet unchanged, status `'pending'` | Existed | **PASS** |
| 6 | `netAmount <= 0` (fee >= amount) $\rightarrow$ throws, no outbox row, wallet unchanged | **Added in Task 2** | **PASS** |
| 7 | Insufficient locked balance $\rightarrow$ throws, no outbox row, wallet unchanged | **Added in Task 2** | **PASS** |
| 8 | Reject unchanged $\rightarrow$ refund + ledger + status `'rejected'` | Existed | **PASS** |

---

## TASK 2 — NEW TESTS ADDED & FINAL TEST SUITE RESULTS

### Summary of Added Test Cases in `tests/payments/withdrawal.test.ts`
1. **Concurrent Race (`Promise.allSettled`)**:
   - Triggers two simultaneous `approveWithdrawal` calls on the same pending withdrawal ID.
   - Asserts exactly 1 promise is fulfilled and 1 promise is rejected.
   - Confirms withdrawal status is `'dispatched'` and `SELECT COUNT(*)` on `payments.b2c_outbox` returns `1`.
2. **Zero / Negative Net Amount Guard**:
   - Updates withdrawal fee to equal total amount ($2000$), resulting in `netAmount = 0`.
   - Asserts `approveWithdrawal` throws `Invalid withdrawal fee configuration (net amount must be positive)`.
   - Confirms withdrawal stays `'pending'` and zero outbox rows are inserted.
3. **Insufficient Locked Balance Guard**:
   - Artificially sets wallet `locked_balance = 0`.
   - Asserts `approveWithdrawal` throws `Locked balance is less than withdrawal amount`.
   - Confirms withdrawal stays `'pending'` and zero outbox rows are inserted.

### Full Test Run Output (`npm test -- tests/payments/`)
```
Test Suites: 5 passed, 5 total
Tests:       44 passed, 44 total
Snapshots:   0 total
Time:        68.961 s
```

---

## TASK 3 — REAL MANUAL DB VERIFICATION (VERBATIM OUTPUTS)

Executed against a live test withdrawal (`d053aa7e-bfe9-4fc9-bfd1-02b17af84f0e`) created by `PaymentService.requestWithdrawal` and approved via `AdminComplianceService.approveWithdrawal`:

### Query 1: Withdrawal Status & Reference
```sql
SELECT id, status, reviewed_by, gateway_reference
FROM payments.withdrawals WHERE id = 'd053aa7e-bfe9-4fc9-bfd1-02b17af84f0e';
```
**Verbatim Output**:
```json
[
  {
    "id": "d053aa7e-bfe9-4fc9-bfd1-02b17af84f0e",
    "status": "dispatched",
    "reviewed_by": "e033f46c-f6a6-487b-b29f-4d1cd60020ea",
    "gateway_reference": null
  }
]
```

### Query 2: B2C Outbox Record & Payload
```sql
SELECT id, status, attempt_count, payload
FROM payments.b2c_outbox WHERE withdrawal_id = 'd053aa7e-bfe9-4fc9-bfd1-02b17af84f0e';
```
**Verbatim Output**:
```json
[
  {
    "id": "2ec1c864-7c7c-47fe-8432-f5b39522def8",
    "status": "pending",
    "attempt_count": 0,
    "payload": {
      "amount": "3000",
      "netAmount": "2940",
      "recipientPhone": "254722334455",
      "remarks": "Withdrawal payout",
      "occasion": "d053aa7e-bfe9-4fc9-bfd1-02b17af84f0e"
    }
  }
]
```

### Query 3: Wallet Balances (Unchanged & Locked)
```sql
SELECT w.user_id, w.balance, w.locked_balance
FROM wallet.wallets w
JOIN payments.withdrawals wd ON wd.user_id = w.user_id
WHERE wd.id = 'd053aa7e-bfe9-4fc9-bfd1-02b17af84f0e' AND w.account_type = 'real';
```
**Verbatim Output**:
```json
[
  {
    "user_id": "9a29643a-b294-48cf-a187-4bbb7efcb5c6",
    "balance": "10000.0000",
    "locked_balance": "3000.0000"
  }
]
```

---

## TASK 4 — `MANUAL_TASKS.MD` TAIL OUTPUT

```markdown
## Slice 2: Outbox Table & Dispatch Worker
- **Database Migrations**:
  - Apply [`migrations/038_b2c_outbox_table.sql`](file:///C:/SkiesPro/migrations/038_b2c_outbox_table.sql) locally and in production database:
    ```bash
    npm run migrate
    ```
- **Worker Configuration (Optional Overrides in Render & Local `.env`)**:
  - `B2C_WORKER_INTERVAL_MS=5000` (Defaults to 5000ms)
  - `B2C_WORKER_BATCH_SIZE=5` (Defaults to 5 rows per batch)
- **Feature Flag Safeguards**:
  - Keep `ENABLE_B2C_WORKER=false` in Render and local `.env` until Slice 4 callback handlers are ready to process asynchronous Safaricom responses.
  - Keep `ENABLE_B2C_DISBURSEMENT=false` until Slice 4.

---

## Slice 3: Refactor approveWithdrawal to Enqueue Outbox + Dispatch
- **Operational Rule (Post-Slice 3)**:
  - Do NOT enable `ENABLE_B2C_WORKER=true` or `ENABLE_B2C_DISBURSEMENT=true` in Render or local `.env` until Slice 4 (callback handler) has been completed and verified. Enabling them now will cause the worker to dispatch real Daraja sandbox B2C calls to an endpoint whose callback route does not yet exist, leaving withdrawals stuck in `dispatched` with locked funds.
- **Historical Record Note**:
  - Pre-existing pre-B2C withdrawal `235d9ef4-8cde-42c9-be63-9accc9ac09d0` (already set to `'approved'` from pre-B2C verification) has been left as-is intentionally as a historical record. All future approvals follow the `dispatched` $\rightarrow$ `completed` lifecycle.
```

---

## 5. TYPECHECK RESULT

**Execution Command**: `npm run typecheck` (`tsc --noEmit`)  
**Result**: **Exit Code 0** (0 type errors across codebase).

---

## 6. GIT DIFF --STAT OUTPUT

```
 reports/B2C/MANUAL_TASKS.md         | 10 ++++++++++
 tests/payments/withdrawal.test.ts   | 87 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++--------
 2 files changed, 89 insertions(+), 8 deletions(-)
```

---

**Executed & Verified**
