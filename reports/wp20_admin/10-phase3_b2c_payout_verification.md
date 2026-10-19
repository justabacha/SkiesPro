# PHASE 3 AUDIT REPORT — B2C / PAYOUT DISPATCH VERIFICATION

**Date**: May 2024  
**Scope**: Withdrawal Approval & Payout Dispatch Integration (`DarajaMpesaAdapter.ts`, `AdminComplianceService.ts`, `payments.withdrawals`)  
**Status**: Read-Only Audit Completed

---

## Verdict
**Is B2C wired on approval — NO.**

---

## 1. B2C / Disbursement Integration Findings
- **Integration Status**: There is **zero** B2C (Business-to-Customer) disbursement, payout, or mobile money payout integration in the codebase.
- **Found Providers / Adapters**: 
  - `[DarajaMpesaAdapter.ts](file:///C:/SkiesPro/src/modules/payments/adapters/mpesa/DarajaMpesaAdapter.ts)` and `[IPaymentGateway.ts](file:///C:/SkiesPro/src/modules/payments/adapters/mpesa/IPaymentGateway.ts)` implement STK Push (`initiateStkPush` / `CustomerPayBillOnline`) and transaction querying strictly for **inbound deposits**. There are no B2C API calls, payout endpoints, or disbursement adapters anywhere in the source tree.

---

## 2. Call-Graph Trace for Withdrawal Approval
1. **Admin UI**: Admin clicks "Approve Payout" on `FinanceOverviewPage.tsx` → `WithdrawalActionModal.tsx` → `useAdminFinance.approveWithdrawal()`.
2. **API Request**: `PUT /api/v1/admin/withdrawals/:id/approve` (guarded by `requireAdminRole(['finance', 'admin', 'super_admin'])` and `requireAdminMFA`).
3. **Controller**: `AdminController.approveWithdrawal` → `AdminComplianceService.approveWithdrawal`.
4. **Service Execution**:
   - Opens database transaction (`BEGIN`).
   - Validates withdrawal is `'pending'`.
   - Deducts amount from wallet balance (`balance` ↓, `locked_balance` ↓).
   - Writes immutable debit entry to `wallet.ledger_entries` (`reference_type: 'withdrawal'`).
   - Updates withdrawal status to `'approved'` in `payments.withdrawals`.
   - Commits transaction (`COMMIT`).
5. **External Dispatch**: **Nothing.** The call graph terminates at internal accounting settlement (`status = 'approved'`). No external payment API is invoked.

---

## 3. Withdrawal Status Lifecycle
- **Database Schema Constraint (`payments.withdrawals.status`)**:
  `CHECK (status IN ('pending', 'approved', 'dispatched', 'completed', 'failed', 'rejected'))`
- **Active Application States**: Only `'pending'`, `'approved'`, and `'rejected'` are used by the current admin/finance module workflow.
- **Unused States**: `'dispatched'`, `'completed'`, and `'failed'` are defined in the database check constraint but have no active queue consumers, cron jobs, or gateway webhook handlers updating to them.
- **State Representing External Payout**: None of the current states automatically represent money leaving the platform via an API call; `'approved'` currently only represents internal accounting settlement.

---

## 4. Post-Approval Behavior
- The workflow ends entirely at `status = 'approved'`. There are no asynchronous queue workers, cron jobs, or webhook reconciliation handlers processing approved withdrawals.

---

## 5. TODO / Stub / Placeholder Comments
- No TODO or stub comments related to B2C or payout dispatch were found in the codebase.

---

## 6. Admin UI Indicators
- The admin UI displays an "Approve Payout" button and modal copy stating: `"Approving will dispatch M-Pesa B2C payout of KES ..."` — this is purely static UI label text and does not execute any external disbursement.

---

## 7. Gap Statement
To enable automated B2C payout dispatch upon admin approval, the platform requires:
1. A Safaricom Daraja B2C (Business-to-Customer) API adapter implementing payment disbursement (e.g., `B2CPaymentRequest`, security credentials encryption, timeout/result callback URLs).
2. An asynchronous queue or background worker triggered upon successful transaction commit in `AdminComplianceService.approveWithdrawal`.
3. A webhook results handler to reconcile Daraja B2C asynchronous response callbacks, updating withdrawal status to `'dispatched'` or `'completed'` (or `'failed'` with automatic wallet reversal/refund).

---

## 8. Risks Observed
- **Financial Discrepancy**: Because approval deducts funds from the platform's user wallet balance without dispatching an actual M-Pesa B2C payment, internal accounting records show money paid out while no external funds actually moved.
- **Missing Provider Reference**: Approved withdrawals lack gateway reference IDs (`gateway_reference`) from external payment providers.
- **No Reconciliation / Retry**: Without B2C callbacks or retry mechanisms, there is no automation for handling network timeouts or Daraja API rejection codes during disbursement.
