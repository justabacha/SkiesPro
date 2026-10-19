# B2C DISBURSEMENT SLICE 4 CORRECTION REPORT: REMOVE MISLEADING LEDGER ENTRY & VERIFY TEST MOCK

**Status**: Executed & Verified  
**Date**: October 19, 2026  
**Module**: Payments / B2C Callback Service & Tests Correction

---

## TASK 1 — Remove Failure-Path Misleading Ledger Entry

### Before / After Diff (`src/modules/payments/services/b2cCallbackService.ts`)
```diff
       } else {
         // FAILURE
         const amount = new Decimal(withdrawal.amount);
         await walletServiceTx.unlockFunds(withdrawal.user_id, 'real', amount);
 
-        // Record refund ledger entry
-        const wallet = await walletServiceTx.getBalance(withdrawal.user_id, 'real');
-        const balanceVal = new Decimal(wallet.balance);
-        await ledgerServiceTx.recordEntry({
-          transactionId: uuidv4(),
-          walletId: wallet.id,
-          entryType: 'credit',
-          amount,
-          balanceBefore: balanceVal,
-          balanceAfter: balanceVal,
-          referenceType: 'withdrawal',
-          referenceId: withdrawal.id,
-          description: `Withdrawal payout failed and refunded: ${resultDesc}`,
-        });
-
         await paymentRepoTx.updateWithdrawalStatusAndRef(withdrawal.id, 'failed', transactionId);
         await paymentRepoTx.updateOutboxStatus(outbox.id, 'failed', conversationId, resultDesc, null);
 
-        logger.warn('B2C payout failed, funds refunded', {
+        logger.info('B2C payout failed, funds unlocked to available balance (no ledger entry — mirrors reject path; ledger completeness tracked for Slice 6)', {
           withdrawalId: withdrawal.id,
           outboxId: outbox.id,
           resultCode,
           resultDesc,
+          amount: amount.toString(),
         });
       }
```
- `LedgerService` and `uuidv4` imports were removed from [`b2cCallbackService.ts`](file:///C:/SkiesPro/src/modules/payments/services/b2cCallbackService.ts) as they are no longer used.
- `rg -n "recordEntry" src/modules/payments/services/b2cCallbackService.ts` returns **0 hits**.

---

## TASK 2 — Update Test #2 (`tests/payments/b2cCallback.test.ts`)

- Test #2 was updated to assert that no ledger entry is written on failure (`COUNT = 0` for `wallet.ledger_entries`), matching the Slice 3 reject path.
- **Test Suite Results**: `npm test -- tests/payments/b2cCallback` passed successfully (**10/10 tests passed**).

---

## TASK 3 — Verify `mockResolved` vs `mockResolvedValue`

- **Finding**: In [`tests/payments/b2cAdapter.test.ts`](file:///C:/SkiesPro/tests/payments/b2cAdapter.test.ts), `mockedAxios.get.mockResolved(...)` was present on line 200. This was a non-standard Jest method name (typographical error).
- **Correction**: Replaced `mockResolved` with standard Jest `mockResolvedValue`. All adapter tests pass cleanly.

---

## TASK 4 — Update `MANUAL_TASKS.md` (Deferred Ledger Completeness)

Appended section to [`reports/B2C/MANUAL_TASKS.md`](file:///C:/SkiesPro/reports/B2C/MANUAL_TASKS.md):
```markdown
## Deferred: Ledger Completeness (Slice 6)

The following is tracked as tech debt for a dedicated phase AFTER B2C ships:

**Problem**: `wallet.ledger_entries` only tracks `balance_before`/`balance_after` (total balance). It does NOT track `available_balance` or `locked_balance` snapshots. Therefore unlock/refund events (which change locked→available without changing total) cannot be recorded faithfully.

**Consequence**:
- `rejectWithdrawal` unlocks funds with NO ledger entry (Slice 3 path).
- B2C failure callback unlocks funds with NO ledger entry (Slice 4 path, corrected to mirror reject).

**Required fix**:
1. Migration: add `available_before`, `available_after`, `locked_before`, `locked_after` columns to `wallet.ledger_entries`.
2. Update `LedgerService.recordEntry` to accept those values.
3. Update all existing ledger writers to populate the new columns.
4. Add proper refund ledger entries to reject path AND B2C failure path.
5. Consider backfill of historical entries (or leave null with a documented "pre-migration" note).

**Do NOT attempt this during B2C slices.** Track for post-launch or a dedicated Ledger Completeness phase.
```

---

## VERIFICATION RESULTS

1. **Typecheck (`npm run typecheck`)**: **Exit Code 0** (0 type errors).
2. **Payment Suite (`npm test -- tests/payments/`)**: All 57 payment tests passed (including the 10 B2C callback tests).
3. **`git diff --stat`**:
```
 reports/B2C/MANUAL_TASKS.md                  | 21 +++++++++++++++++++++
 src/modules/payments/services/b2cCallbackService.ts | 25 +------------------------
 tests/payments/b2cAdapter.test.ts            |  2 +-
 tests/payments/b2cCallback.test.ts           |  5 +++--
 4 files changed, 26 insertions(+), 27 deletions(-)
```

---

**Executed & Verified**
