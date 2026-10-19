# PHASE 3 AUDIT REPORT — B2C PRE-BUILD IMPACT ANALYSIS

**Date**: May 2024  
**Scope**: Safaricom Daraja B2C Payout Integration Impact Analysis & Pre-Build Architecture  
**Status**: Read-Only Audit Completed

---

## 1. Executive Summary
- **Biggest Risks**: Asynchronous callback loss or replay leading to double-credit/double-reversal or stuck `dispatched` withdrawal states; secure handling of Daraja B2C security credentials (initiator password encryption); database transaction isolation during high-concurrency webhook callback ingestion.
- **Biggest Unknowns**: Sandbox environment constraints for Daraja B2C test accounts (e.g., active B2C shortcodes and IP whitelisting in Safaricom developer portal); exact Daraja B2C result JSON payload structure for error code mapping.
- **Biggest Rework Areas**: Decoupling wallet balance deduction from the immediate admin approval action (`AdminComplianceService.approveWithdrawal` must shift balance debit and ledger write from "Approve" to the asynchronous Daraja success callback).

---

## 2. Existing Daraja Integration Map (A–D Findings)
1. **`src/modules/payments/adapters/mpesa/`**:
   - `DarajaMpesaAdapter.ts`: Implements `IPaymentGateway` (`initiateStkPush`, `queryTransactionStatus`). Handles OAuth token generation (`/oauth/v1/generate`) using Basic Auth (`consumerKey:consumerSecret`), timestamp formatting, password hashing (`shortcode + passkey + timestamp`), and Axios HTTP calls to Sandbox/Production base URLs.
   - `IPaymentGateway.ts`: Defines interfaces for STK push and transaction status queries.
   - `MpesaGatewayFactory.ts`: Instantiates the active gateway adapter based on environment configuration.
   - `MpesaMockAdapter.ts`: Mock implementation for testing without live Daraja connectivity.
2. **Credentials & Auth**:
   - Loaded via `process.env` (`MPESA_ENVIRONMENT`, `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, `MPESA_SHORTCODE`, `MPESA_CALLBACK_URL`).
   - Token acquisition is embedded inside `DarajaMpesaAdapter.ts` (no standalone shared auth utility).
3. **B2C Interface Contract**:
   - A new dedicated interface (`IB2CPayoutGateway`) or extension to `IPaymentGateway` should be introduced to support B2C payment disbursement (`initiateB2CPayout`).

---

## 3. Breakage Map: Consumers of `status = 'approved'`
- **`AdminComplianceService.approveWithdrawal`**: Currently sets status to `'approved'` and immediately debits wallet balance. With B2C integration, approval should transition status to `'dispatched'` (or trigger outbox dispatch), deferring wallet debit to the B2C success callback (`completed`).
- **`AdminRepository.listWithdrawals`**: Filters withdrawals by status. Must correctly display `'dispatched'`, `'completed'`, and `'failed'` rows in the finance UI filter tabs.

---

## 4. Schema + Ledger Findings
- **`payments.withdrawals.status`**: Already includes `('pending','approved','dispatched','completed','failed','rejected')` in its check constraint (`migrations/006_payments_schema_tables.sql`).
- **`gateway_reference`**: Already exists on `payments.withdrawals` and can store Daraja B2C ConversationID / OriginatorConversationID.
- **`wallet.ledger_entries`**: Immutable insert-only audit trail (`entry_type`, `amount`, `reference_type`, `reference_id`). `LedgerService.recordEntry` accepts structured DTOs matching deposit/withdrawal references.

---

## 5. Infra Findings (Outbox/Worker Feasibility)
- Existing background workers (`settlementWorker.ts`, `reconciliationWorker.ts`, `auditChainVerification.job.ts`) demonstrate a proven DB-backed polling worker pattern running on intervals.
- A lightweight B2C dispatch outbox table (`payments.b2c_outbox` or similar) paired with a background polling worker is highly feasible and avoids adding new infrastructure dependencies like Redis/BullMQ.

---

## 6. Config/Secrets + Daraja B2C Sandbox Requirements (G)
- **Additional Daraja B2C Environment Variables**:
  - `MPESA_B2C_SHORTCODE`, `MPESA_B2C_INITIATOR_NAME`, `MPESA_B2C_SECURITY_CREDENTIAL` (Encrypted/hashed credentials for B2C API authorization), `MPESA_B2C_RESULT_URL`, `MPESA_B2C_TIMEOUT_URL`.
- **Feature Flag**: `ENABLE_B2C_DISBURSEMENT=true/false` to gate live B2C calls in production vs sandbox/fallback mode.

---

## 7. UI/API Surface Findings (H)
- **`WithdrawalActionModal.tsx`**: Currently states `"Approving will dispatch M-Pesa B2C payout..."` in static copy. This will now align with actual backend behavior.
- **API Routes**: `PUT /api/v1/admin/withdrawals/:id/approve` initiates the dispatch workflow.

---

## 8. Security/Testing Findings (I)
- **Webhook Security**: Inbound M-Pesa C2B callbacks use query parameter token validation (`MPESA_CALLBACK_TOKEN`). B2C result and timeout callbacks will require an equivalent secure verification pattern.
- **Idempotency**: Daraja callback handlers must use transaction isolation and idempotency keys matching incoming Conversation IDs to prevent duplicate crediting/reversal.

---

## 9. Impact Map Table

| Slice | File Path | Description of Change | Risk Rating & Reason |
|---|---|---|---|
| **New** | `src/modules/payments/adapters/mpesa/IB2CPayoutGateway.ts` | Define B2C payout gateway interface | **LOW** — New interface contract |
| **New** | `src/modules/payments/adapters/mpesa/DarajaB2CAdapter.ts` | Implement Safaricom Daraja B2C API calls | **HIGH** — External API integration & credential security |
| **New** | `migrations/038_b2c_outbox_table.sql` | Create outbox table for reliable B2C job dispatch | **MED** — Schema addition |
| **Modified** | `src/modules/admin/services/AdminComplianceService.ts` | Refactor `approveWithdrawal` to transition status to `dispatched` & enqueue outbox job | **HIGH** — Core financial state transition change |
| **New** | `src/modules/payments/workers/b2cDispatchWorker.ts` | DB-backed background worker processing outbox dispatch | **MED** — Asynchronous execution & error handling |
| **New** | `src/modules/payments/controllers/b2cCallbackController.ts` | Handle inbound Daraja B2C Result and Timeout callbacks | **HIGH** — Webhook security, idempotency & wallet reversal |
| **Modified** | `frontend/src/components/admin/PendingWithdrawalsTable.tsx` | Display `dispatched`, `completed`, and `failed` status badges | **LOW** — UI badge rendering |

---

## 10. Risk Register Table

| Risk | Blast Radius | Likelihood / Severity | Mitigation Strategy |
|---|---|---|---|
| **Stuck `dispatched` state** (Daraja network timeout) | User payout delayed / platform audit discrepancy | Med / High | B2C reconciliation cron job polling transaction status or timing out after X hours with alerting |
| **Callback Replay / Double Reversal** | Wallet balance corruption / double crediting | Low / Critical | Strict idempotency checks on incoming Conversation IDs; database transactions with `FOR UPDATE` locks |
| **Credential Leakage** | Unauthorized B2C fund transfers on Safaricom shortcode | Low / Critical | Strict environment variable protection; encryption of B2C security credentials |

---

## 11. Recommended Build Slice Order
- **Slice 1**: B2C Adapter & DTOs (`DarajaB2CAdapter.ts`, unit tests).
- **Slice 2**: Outbox Table Migration & Dispatch Worker (`migrations/038`, `b2cDispatchWorker.ts`).
- **Slice 3**: Admin Approval Flow Refactor (`AdminComplianceService.ts` - transition to `dispatched`, remove immediate wallet debit).
- **Slice 4**: B2C Result/Timeout Callback Handler (`b2cCallbackController.ts` - success callback completes withdrawal & records ledger debit; failure callback executes auto-reversal/refund).
- **Slice 5**: Reconciliation Job & Admin UI Updates (`PendingWithdrawalsTable.tsx`, filter badges).

---

## 12. Open Questions / Decisions Needed from Project Owner
1. **Daraja B2C Sandbox Credentials**: Confirmation of active sandbox B2C shortcode and initiator credentials provisioned by Safaricom.
2. **Timeout Threshold**: What is the agreed window for a `dispatched` withdrawal to timeout and trigger auto-reversal (e.g., 2 hours vs 24 hours)?

---
**Read-Only Audit Completed**
