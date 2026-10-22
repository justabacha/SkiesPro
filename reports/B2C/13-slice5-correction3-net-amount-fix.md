# Slice 5 Correction 3 Report: Revert Defensive Change, Fix Net Amount Revenue Leak, Add Tests

## Task 1 — Investigation

1. **Why was the worker changed in Slice 5 Correction 2?**
   - The defensive fallbacks (`payload.amount ?? payload.netAmount ?? '0'`, `recipientPhone || phone_number || ''`) were added speculatively during test stabilization without a specific motivating failing test in the prompt ("no failing test; speculative change").
2. **What test fixture(s) contributed?**
   - In `tests/payments/b2cDispatchWorker.test.ts`, `createOutboxFixture()` created payloads with `{ amount: '980', recipientPhone: '0712345678', ... }` without a `netAmount` property because the worker previously used `payload.amount`.
3. **What does the current worker dispatch?**
   - With the fix applied, the worker dispatches `payload.netAmount` (post-fee net amount to be disbursed to the user, e.g. 1470) instead of `payload.amount` (pre-fee total locked amount, e.g. 1500).
4. **Trace the user's expected receive amount through the system:**
   - Slice 3 inserts outbox payload with `amount: '1500'` and `netAmount: '1470'`.
   - Worker dispatches `payload.netAmount` (= 1470) to Daraja so the user receives 1470 KES in M-Pesa.
   - Slice 4 success callback debits `withdrawal.amount` (= 1500) from the user's balance and locked balance.
   - User's net: balance $-1500$, M-Pesa +1470. Platform net: +30 KES (the 30 KES fee).
   - If the worker previously dispatched `payload.amount` (= 1500), the user received 1500 KES while the balance was debited 1500 KES, resulting in **0 platform fee collected (revenue leak)**.

---

## Task 2 — Revert Defensive Change & Fix Net Amount in `src/modules/payments/workers/b2cDispatchWorker.ts`

### Before (Defensive Fallbacks)
```typescript
    const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : (row.payload || {});
    const rawAmount = payload?.amount ?? payload?.netAmount ?? '0';
    const amount = new Decimal(rawAmount);
    const recipientPhone = payload?.recipientPhone || payload?.phone_number || '';
```

### After (Strict Validation & `netAmount` Revenue Fix)
```typescript
    const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid outbox payload: expected object');
    }
    const recipientPhone = payload.recipientPhone;
    if (!recipientPhone) {
      throw new Error('Invalid outbox payload: recipientPhone missing');
    }
    if (!payload.netAmount) {
      throw new Error('Invalid outbox payload: netAmount missing');
    }
    const amount = new Decimal(payload.netAmount);
```

---

## Task 3 — Payload Construction Code (`approveWithdrawal`)
From `src/modules/admin/services/AdminComplianceService.ts`:
```typescript
      const originatorConversationId = uuidv4();
      const payload = {
        amount: amount.toString(),
        netAmount: netAmount.toString(),
        recipientPhone: normalizedPhone,
        remarks: 'Withdrawal payout',
        occasion: id,
      };

      await adminRepoTx.insertB2COutboxRow(id, originatorConversationId, payload);
```

---

## Task 4 — Callback Debit Confirmation (`b2cCallbackService.handleResultCallback`)
From `src/modules/payments/services/b2cCallbackService.ts`:
- The success callback debits `withdrawal.amount` (the full locked amount, e.g. 1500) from the user's wallet via `walletService.finalizeWithdrawalDebit`.
- The 30 KES difference between withdrawal amount (1500) and outbox netAmount (1470) is correctly retained by the platform as the fee.

---

## Task 5 — New Test Bodies (`tests/payments/b2cDispatchWorker.test.ts`)

```typescript
  test('12. Worker dispatches netAmount (post-fee) to gateway, not amount', async () => {
    if (skipDatabaseTests) return;

    const withdrawalAmount = new Decimal('1500');
    const fee = new Decimal('30');
    const netAmount = withdrawalAmount.minus(fee); // 1470

    const fixture = await createOutboxFixture({
      payload: {
        amount: withdrawalAmount.toString(),
        netAmount: netAmount.toString(),
        recipientPhone: '254712345678',
        remarks: 'Withdrawal payout',
      },
    });

    await pgPool.query("DELETE FROM payments.b2c_outbox WHERE status = 'pending' AND id <> $1", [fixture.outboxId]);

    let capturedAmount: Decimal | null = null;
    const captureGateway: IB2CPayoutGateway = {
      initiateB2CPayout: async (req) => {
        capturedAmount = req.amount;
        return {
          conversationId: `AG_test_${Date.now()}`,
          originatorConversationId: req.originatorConversationId,
          responseCode: '0',
          responseDescription: 'Success',
          raw: {},
        };
      },
      queryB2CStatus: async (convId) => ({ conversationId: convId, status: 'completed', raw: {} }),
    };

    const worker = new B2CDispatchWorker(pgPool, captureGateway, 10000, 1);
    await worker.processBatch();

    expect(capturedAmount).not.toBeNull();
    expect(capturedAmount!.equals(new Decimal('1470'))).toBe(true);
  });

  test('13. Worker throws on corrupt payload (missing netAmount)', async () => {
    if (skipDatabaseTests) return;

    const fixture = await createOutboxFixture({
      payload: {
        amount: '1500',
        recipientPhone: '254712345678',
        remarks: 'Withdrawal payout',
        // missing netAmount
      },
    });

    await pgPool.query("DELETE FROM payments.b2c_outbox WHERE status = 'pending' AND id <> $1", [fixture.outboxId]);

    const mockAdapter = new MpesaB2CMockAdapter('success');
    const worker = new B2CDispatchWorker(pgPool, mockAdapter, 10000, 1);
    await worker.processBatch();

    const res = await pgPool.query(`SELECT * FROM payments.b2c_outbox WHERE id = $1`, [fixture.outboxId]);
    const row = res.rows[0];

    expect(row.last_error).toContain('netAmount missing');
  });
```

---

## Task 6 — Verification Results

### Test #12 — 5 Consecutive Runs Alone
```
=== TEST 12 RUN 1 ===
PASS tests/payments/b2cDispatchWorker.test.ts (9.348 s)
=== TEST 12 RUN 2 ===
PASS tests/payments/b2cDispatchWorker.test.ts (9.73 s)
=== TEST 12 RUN 3 ===
PASS tests/payments/b2cDispatchWorker.test.ts (9.098 s)
=== TEST 12 RUN 4 ===
PASS tests/payments/b2cDispatchWorker.test.ts (11.753 s)
=== TEST 12 RUN 5 ===
PASS tests/payments/b2cDispatchWorker.test.ts (13.867 s)
```

### Full Suite (`npm test`) — 2 Consecutive Runs

#### Run 1:
```
Test Suites: 54 passed, 54 total
Tests:       369 passed, 369 total
Snapshots:   0 total
Time:        165.047 s
```

#### Run 2:
```
Test Suites: 54 passed, 54 total
Tests:       369 passed, 369 total
Snapshots:   0 total
Time:        171.417 s
```

---

### Typecheck Results
- **Backend Typecheck (`npm run typecheck`)**: Exit code `0` (0 errors).
- **Frontend Typecheck (`npx tsc --noEmit` in frontend/)**: Exit code `0` (0 errors).

---

### Git Diff Stat
```
 frontend/src/components/admin/PendingWithdrawalsTable.tsx | 117 +++++++++++++++++++++---
 frontend/src/components/admin/WithdrawalActionModal.tsx   | 165 +++++++++++++++++++++++++++------
 frontend/src/hooks/admin/useAdminFinance.ts               |  60 ++++++++++++
 frontend/src/pages/admin/FinanceOverviewPage.tsx          |  39 +++++---
 frontend/src/services/admin/adminApiClient.ts             |  49 +++++++++-
 reports/B2C/MANUAL_TASKS.md                               |  53 +++++++++++
 src/config/app.ts                                         |   2 +
 src/index.ts                                              |  25 +++++
 src/modules/admin/admin.routes.ts                         |  34 +++++++
 src/modules/admin/controllers/AdminController.ts          |  55 +++++++++++
 src/modules/admin/repositories/AdminRepository.ts         |  34 +++++--
 src/modules/admin/services/AdminComplianceService.ts      | 285 ++++++++++++++++++++++++++++++++++++++++++++++++++++++++--
 src/modules/payments/repositories/paymentRepository.ts    |  47 ++++++++++
 src/modules/payments/workers/b2cDispatchWorker.ts         |  13 ++-
 tests/admin/b2cRecoveryRoutes.test.ts                     | 188 +++++++++++++++++++++++++++++++++++++
 tests/payments/b2cCallback.test.ts                        |  18 ++--
 tests/payments/b2cDispatchWorker.test.ts                  |  55 ++++++++++-
 tests/payments/b2cOpsRecovery.test.ts                     | 239 ++++++++++++++++++++++++++++++++++++++++++++++++
 tests/payments/b2cReconciliation.test.ts                  | 152 ++++++++++++++++++++++++++++++
 tests/payments/withdrawal.test.ts                         |  27 ++++--
 20 files changed, 1426 insertions(+), 163 deletions(-)
```

---

Executed & Verified
