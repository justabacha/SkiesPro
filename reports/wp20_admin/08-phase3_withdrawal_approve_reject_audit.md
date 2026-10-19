# PHASE 3 AUDIT REPORT — WITHDRAWAL APPROVE/REJECT FUND FLOW

**Date**: May 2024  
**Scope**: Withdrawal Approval & Rejection Lifecycle (`AdminComplianceService.ts`, `WalletService.ts`, `AdminRepository.ts`)  
**Status**: Read-Only Audit Completed

---

## 1. Executive Summary

While the withdrawal **rejection** path correctly refunds locked funds back to the user's available balance via `WalletService.unlockFunds()`, the withdrawal **approval** path suffers from a critical architectural omission. Specifically, `AdminComplianceService.approveWithdrawal` only updates the withdrawal status in `payments.withdrawals` to `'approved'`, completely omitting the necessary wallet operations: deducting the net/total withdrawal amount from the user's total wallet balance (`balance`), clearing the corresponding amount from `locked_balance`, and recording an immutable debit entry in `wallet.ledger_entries`. Consequently, approved withdrawals leave funds permanently orphaned in the user's locked balance.

---

## 2. Reject Path Findings

- **File Path**: `[AdminComplianceService.ts](file:///C:/SkiesPro/src/modules/admin/services/AdminComplianceService.ts#L39-L74)`
- **Function Name**: `rejectWithdrawal(id, reviewedBy, reason)`
- **Behavior**:
  1. Opens a database transaction (`BEGIN`).
  2. Fetches the withdrawal record (`AdminRepository.getWithdrawalById`).
  3. Validates that the withdrawal status is `'pending'`.
  4. Calls `WalletService.unlockFunds(withdrawal.user_id, 'real', new Decimal(withdrawal.amount))` to release the locked funds back to available balance.
  5. Updates the withdrawal status to `'rejected'` (`AdminRepository.updateWithdrawalStatus`).
  6. Commits transaction (`COMMIT`) or rolls back on error (`ROLLBACK`).
- **Contract Adherence**: Matches the expected fund contract (locked balance decreases, available balance increases by the exact amount).

---

## 3. Approve Path Findings

- **File Path**: `[AdminComplianceService.ts](file:///C:/SkiesPro/src/modules/admin/services/AdminComplianceService.ts#L34-L37)`
- **Function Name**: `approveWithdrawal(id, reviewedBy, note)`
- **Behavior**:
  1. Calls `AdminRepository.updateWithdrawalStatus(id, 'approved', note, reviewedBy)`.
  2. Returns `{ id, status: 'approved', reviewedBy, note, item }`.
- **Contract Adherence**: **Fails the contract**. It performs zero wallet balance adjustments, zero locked balance clearances, and writes zero ledger entries. Funds remain trapped in `locked_balance`.

---

## 4. Database State Snapshot (`just1abacha@gmail.com`)

Query execution against PostgreSQL captured the following live state:

- **User**: `Abacha Trade Test` (`9bde8491-cd19-4b3a-b807-303c99854142`)
- **Real Wallet ID**: `b3cdbc23-fee6-48c6-9b15-f8e18d5f931f`
  - `balance`: `19860.0000`
  - `locked_balance`: `1500.0000` *(Stuck due to approved withdrawal)*
  - `available_balance`: `18360.0000`
- **Withdrawals Table**:
  - `id`: `235d9ef4-8cde-42c9-be63-9accc9ac09d0`
  - `amount`: `1500.0000`
  - `status`: `approved`
  - `created_at`: `2026-10-19T11:44:33.318Z`

---

## 5. Gap Matrix

| Step | Expected | Actual | File & Line Reference | Severity |
|---|---|---|---|---|
| **Admin Approve** | Update status to `approved`, deduct balance, unlock/clear locked balance, write ledger debit | Updates status to `approved` only; leaves balance and locked balance untouched | `[AdminComplianceService.ts](file:///C:/SkiesPro/src/modules/admin/services/AdminComplianceService.ts#L34-L37)` | **CRITICAL** |
| **Admin Reject** | Update status to `rejected`, unlock locked balance, write refund | Updates status to `rejected` and unlocks locked balance transactionally | `[AdminComplianceService.ts](file:///C:/SkiesPro/src/modules/admin/services/AdminComplianceService.ts#L39-L74)` | **OK** |

---

## 6. Root Cause Hypothesis

The approval path was implemented as a simple metadata status toggle (`updateWithdrawalStatus`) rather than a financial transaction. Because funds were locked during request initiation (`PaymentService.requestWithdrawal` via `WalletService.lockFunds`), approval requires explicitly debiting the user's total wallet balance (`balance`), clearing the locked amount (`locked_balance`), and inserting an immutable debit record into `wallet.ledger_entries`.

---

## 7. Recommended Fix Scope (Read-Only Proposal)

To fix the approval flow, `AdminComplianceService.approveWithdrawal` must be refactored to execute within a database transaction:
1. Fetch and validate the pending withdrawal.
2. Deduct the withdrawal amount from the user's wallet (`WalletService.debit` or direct balance update) and clear the locked balance (`WalletService.unlockFunds` or balance update).
3. Record a debit transaction in `wallet.ledger_entries` with reference type `'withdrawal'`.
4. Update the withdrawal status to `'approved'` (or `'dispatched'` / `'completed'`).

---

## 8. Risks Observed

- **Orphaned Locked Funds**: Approved withdrawals currently trap funds indefinitely in `locked_balance`.
- **Transaction Atomicity**: Approvals currently lack database transactions, meaning partial failures could leave records inconsistent.
- **Ledger Audit Trail**: Missing ledger entries for approved payouts break the fundamental rule that the ledger is the source of truth.
