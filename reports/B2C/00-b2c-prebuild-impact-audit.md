# PHASE 3 AUDIT REPORT — B2C PRE-BUILD IMPACT ANALYSIS (REVISION 1)

**Date**: May 2024  
**Scope**: Safaricom Daraja B2C Payout Integration Comprehensive Impact Analysis  
**Status**: Read-Only Audit Completed — Revision 1

---

## 1. Executive Summary
- **Biggest Risks**: Asynchronous callback loss or replay leading to double-crediting, double-reversal, or orphaned `dispatched` withdrawal states; secure generation and storage of Safaricom Daraja B2C RSA Security Credentials (`MPESA_B2C_SECURITY_CREDENTIAL`); database transaction isolation during high-concurrency B2C callback processing.
- **Biggest Unknowns**: Active Daraja B2C sandbox test credentials and B2C shortcodes provisioned by Safaricom; exact B2C JSON callback payload field mappings for error code resolution during failed disbursements.
- **Biggest Rework Areas**: Decoupling the immediate wallet balance debit from `AdminComplianceService.approveWithdrawal` (shifting approval to transition status to `'dispatched'` and enqueueing an outbox job, while delegating balance debit and ledger recording to the asynchronous Daraja B2C success callback).

---

## 2. Existing Daraja Integration Map (A–D Findings)

### A. Existing Daraja / Payments Integration
1. **`src/modules/payments/adapters/mpesa/` File Map**:
   - `[DarajaMpesaAdapter.ts](file:///C:/SkiesPro/src/modules/payments/adapters/mpesa/DarajaMpesaAdapter.ts#L1-L143)`: Implements `IPaymentGateway`. Manages OAuth token acquisition, password generation, STK Push initiation (`initiateStkPush`), and status queries (`queryTransactionStatus`) for inbound deposits.
   - `[IPaymentGateway.ts](file:///C:/SkiesPro/src/modules/payments/adapters/mpesa/IPaymentGateway.ts#L1-L27)`: Defines contract for `initiateStkPush` and `queryTransactionStatus`.
   - `[MpesaGatewayFactory.ts](file:///C:/SkiesPro/src/modules/payments/adapters/mpesa/MpesaGatewayFactory.ts#L1-L16)`: Factory instantiating `DarajaMpesaAdapter` or `MpesaMockAdapter`.
   - `[MpesaMockAdapter.ts](file:///C:/SkiesPro/src/modules/payments/adapters/mpesa/MpesaMockAdapter.ts#L1-L36)`: Mock implementation for test environments.
2. **`DarajaMpesaAdapter.ts` Implementation**:
   - **Credentials**: Loaded from `process.env` (`MPESA_ENVIRONMENT`, `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, `MPESA_SHORTCODE`, `MPESA_CALLBACK_URL`).
   - **OAuth Token**: Obtained via `getAccessToken()` (`DarajaMpesaAdapter.ts:29-45`) making a GET request to `/oauth/v1/generate?grant_type=client_credentials` with Basic Auth. Token is fetched per request (not cached in memory).
   - **Base URL**: Toggled via `MPESA_ENVIRONMENT === 'production'` (`https://api.safaricom.co.ke` vs `https://sandbox.safaricom.co.ke`).
3. **`IPaymentGateway.ts` Contract**:
   - **Contract**: Currently defines deposit methods (`initiateStkPush`, `queryTransactionStatus`).
   - **Recommendation**: Create a separate, dedicated `IB2CPayoutGateway` interface (`src/modules/payments/adapters/mpesa/IB2CPayoutGateway.ts`) to cleanly decouple outbound disbursement contracts from inbound collection contracts.
4. **Shared Utilities**:
   - OAuth token generation logic is currently embedded inside `DarajaMpesaAdapter.ts:29-45`. B2C integration should extract token generation into a shared utility or inherit from a base M-Pesa adapter class.

---

## 3. Section A — STK Callback Mapping (Mandatory Pattern Reference)
- **A1. Route Registration**:
  `[payment.routes.ts:8-15](file:///C:/SkiesPro/src/modules/payments/payment.routes.ts#L8-L15)` mounted under `[routes.ts:34](file:///C:/SkiesPro/src/infrastructure/routes.ts#L34)` at `/api/v1/payments/deposit/callback` and `/api/v1/payments/mpesa/callback`.
- **A2. Controller / Handler**:
  - Controller: `[PaymentController.ts:87-107](file:///C:/SkiesPro/src/modules/payments/controllers/paymentController.ts#L87-L107)` (`handleMpesaCallback`).
  - Service: `[PaymentService.ts:114-177](file:///C:/SkiesPro/src/modules/payments/services/paymentService.ts#L114-L177)` (`handleMpesaCallback`).
- **A3. Payload Shape**:
  ```typescript
  export interface StkCallbackPayload {
    Body: {
      stkCallback: {
        MerchantRequestID: string;
        CheckoutRequestID: string;
        ResultCode: number;
        ResultDesc: string;
        CallbackMetadata?: {
          Item: Array<{ Name: string; Value?: string | number }>;
        };
      };
    };
  }
  ```
- **A4. Validation Code**:
  `[PaymentController.ts:88-97](file:///C:/SkiesPro/src/modules/payments/controllers/paymentController.ts#L88-L97)`:
  ```typescript
  const token = req.query.token;
  if (token !== process.env.MPESA_CALLBACK_TOKEN) {
    logger.warn('Unauthorized M-Pesa callback attempt', { ip: req.ip, tokenProvided: !!token });
    res.status(401).send('Unauthorized');
    return;
  }
  ```
- **A5. Record Matching**:
  `[PaymentService.ts:121](file:///C:/SkiesPro/src/modules/payments/services/paymentService.ts#L121)` calls `PaymentRepository.findDepositByReferenceForUpdate(checkoutRequestId)` matching `CheckoutRequestID` to `payments.deposits.gateway_reference`.
- **A6. Replay Guard**:
  `[PaymentService.ts:133-137](file:///C:/SkiesPro/src/modules/payments/services/paymentService.ts#L133-L137)`:
  ```typescript
  if (deposit.status !== 'pending') {
    logger.info('Deposit already processed', { depositId: deposit.id, status: deposit.status });
    await client.query('ROLLBACK');
    return;
  }
  ```
- **A7. Transaction Boundaries**:
  `[PaymentService.ts:118-176](file:///C:/SkiesPro/src/modules/payments/services/paymentService.ts#L118-L176)`:
  ```typescript
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    ...
    await client.query('COMMIT');
  } catch (error: any) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  ```
- **A8. Partial Failure**:
  If wallet credit or database update fails inside the transaction, `ROLLBACK` is executed, logging the error (`PaymentService.ts:169`), and HTTP 500 is returned to Daraja. The deposit status remains `'pending'`.
- **A9. Routing Convention**:
  Mounted via `[routes.ts:34](file:///C:/SkiesPro/src/infrastructure/routes.ts#L34)` (`/api/v1/payments/mpesa/callback`).
- **A10. Callback URL Configuration**:
  `MPESA_CALLBACK_URL` is loaded from `.env` in `DarajaMpesaAdapter.ts:26` and passed in payload to Safaricom during STK Push request initiation.

---

## 4. Section B — Current Withdrawal Flow (Post-09 Fix)

### B1. Source Code (`AdminComplianceService.ts:34-147`)
```typescript
// [AdminComplianceService.ts:34-147]
async approveWithdrawal(id: string, reviewedBy: string, note: string) {
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');

    const adminRepoTx = new AdminRepository(client);
    const walletRepoTx = new WalletRepository(client);
    const ledgerServiceTx = new LedgerService(client);

    const withdrawal = await adminRepoTx.getWithdrawalById(id);
    if (!withdrawal) throw new Error('Withdrawal not found');
    if (withdrawal.status !== 'pending') throw new Error(`Cannot approve withdrawal with status '${withdrawal.status}'`);

    const amount = new Decimal(withdrawal.amount);
    const userId = withdrawal.user_id;

    const wallet = await walletRepoTx.findByUserIdForUpdate(userId, 'real');
    if (!wallet) throw new Error('Wallet not found for withdrawal user');

    const lockedBefore = new Decimal(wallet.locked_balance);
    if (lockedBefore.lessThan(amount)) throw new Error('Locked balance is less than withdrawal amount');

    const balanceBefore = new Decimal(wallet.balance);
    if (balanceBefore.lessThan(amount)) throw new Error('Total balance is less than withdrawal amount');

    const lockedAfter = lockedBefore.minus(amount);
    const balanceAfter = balanceBefore.minus(amount);
    const transactionId = uuidv4();

    await walletRepoTx.updateBalance(userId, 'real', wallet.id, balanceAfter, lockedAfter, wallet.version);

    await ledgerServiceTx.recordEntry({
      transactionId,
      walletId: wallet.id,
      entryType: 'debit',
      amount,
      balanceBefore,
      balanceAfter,
      referenceType: 'withdrawal',
      referenceId: id,
      description: `Withdrawal payout approved: KES ${amount.toString()}`,
    });

    const item = await adminRepoTx.updateWithdrawalStatus(id, 'approved', note, reviewedBy);

    await client.query('COMMIT');
    return { id, status: 'approved', reviewedBy, note, item };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

### B2. Lines MUST MOVE to B2C Success Callback
- Lines 64–98 of `AdminComplianceService.ts`:
  - `walletRepoTx.findByUserIdForUpdate` & balance checks (lines 64–77)
  - `walletRepoTx.updateBalance(...)` (lines 79–86)
  - `ledgerServiceTx.recordEntry(...)` (lines 88–98)
  - Status transition to `'completed'` (line 100)

### B3. Lines MUST STAY in `approveWithdrawal`
- DB transaction `BEGIN` / `COMMIT` / `ROLLBACK` (lines 35, 102–107)
- Fetching & checking `withdrawal.status !== 'pending'` (lines 43–50)
- Status update to `'dispatched'` and outbox record insertion.

### B4. `findByUserIdForUpdate` Lock Pattern
`[WalletRepository.ts:28-33](file:///C:/SkiesPro/src/modules/wallet/repositories/walletRepository.ts#L28-L33)`:
```typescript
async findByUserIdForUpdate(userId: string, accountType: AccountType): Promise<WalletRow | null> {
  const result = await this.query<WalletRow>(
    'SELECT * FROM wallet.wallets WHERE user_id = $1 AND account_type = $2 FOR UPDATE',
    [userId, accountType]
  );
  return result.rows[0] || null;
}
```

---

## 5. Section C — Breakage Map: Consumers of `status = 'approved'`

| Hit # | File Path & Line | Usage Context | Breakage Risk & Reason |
|---|---|---|---|
| C1.1 | `[PendingWithdrawalsTable.tsx:68](file:///C:/SkiesPro/frontend/src/components/admin/PendingWithdrawalsTable.tsx#L68)` | Checks `item.status.toLowerCase() === 'pending'` to render action buttons | **LOW** — Already checks `pending` specifically |
| C1.2 | `[FinanceOverviewPage.tsx:13](file:///C:/SkiesPro/frontend/src/pages/admin/FinanceOverviewPage.tsx#L13)` | Defines `WITHDRAWAL_TABS` array `{ id: 'approved', label: 'Approved' }` | **MED** — Needs tabs for `Dispatched`, `Completed`, `Failed` |
| C1.3 | `[adminApiClient.ts:94](file:///C:/SkiesPro/frontend/src/services/admin/adminApiClient.ts#L94)` | TypeScript interface `WithdrawalRequest.status` | **LOW** — Type union update needed |
| C2.1 | `[AdminRepository.ts:368](file:///C:/SkiesPro/src/modules/admin/repositories/AdminRepository.ts#L368)` | `listWithdrawals` filters `WHERE w.status = $1` | **MED** — Needs support for `dispatched`, `completed`, `failed` |
| C2.2 | `[admin.routes.ts:98](file:///C:/SkiesPro/src/modules/admin/admin.routes.ts#L98)` | Express validator for status query params | **LOW** — Already contains `dispatched`, `completed`, `failed` |
| C3.1 | `[FinanceOverviewPage.tsx:103](file:///C:/SkiesPro/frontend/src/pages/admin/FinanceOverviewPage.tsx#L103)` | Header count `withdrawals.length request(s) matching filter` | **LOW** — Reads array length directly |
| C4.1 | NOT FOUND — searched `[scripts/]` & `[src/modules/reports/]` | CSV export or analytics reporting job filtering `status = 'approved'` | **NONE** — No CSV export jobs currently filter withdrawal status |
| C5.1 | NOT FOUND — searched `[src/modules/]` for email/webhook on approval | Email notifications or external webhooks on approval | **NONE** — No user notification triggers on approval |
| C6.1 | `[seed-test-withdrawals.ts:57](file:///C:/SkiesPro/scripts/seed-test-withdrawals.ts#L57)` | Test seeding script statuses `['pending', 'approved', 'rejected']` | **LOW** — Test fixture script |

---

## 6. Section D — Schema Findings

### D1. FULL `payments.withdrawals` Schema (`migrations/006_payments_schema_tables.sql:44-67`)
```sql
CREATE TABLE IF NOT EXISTS payments.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  gateway_id SMALLINT NOT NULL,
  amount NUMERIC(16,4) NOT NULL CHECK (amount > 0),
  fee NUMERIC(16,4) NOT NULL DEFAULT 0.0000 CHECK (fee >= 0),
  net_amount NUMERIC(16,4) NOT NULL CHECK (net_amount = amount - fee),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','dispatched','completed','failed','rejected')),
  reviewed_by UUID,
  review_note TEXT,
  gateway_reference VARCHAR(255),
  idempotency_key VARCHAR(255) NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payments_withdrawals_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_auth.users(id) ON DELETE RESTRICT,
  CONSTRAINT payments_withdrawals_gateway_id_fkey FOREIGN KEY (gateway_id) REFERENCES payments.payment_gateways(id),
  CONSTRAINT payments_withdrawals_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES app_auth.users(id),
  CONSTRAINT payments_withdrawals_idempotency_key_fkey FOREIGN KEY (idempotency_key) REFERENCES payments.idempotency_keys(key)
);
```

### D2. Provider Reference Column
- `gateway_reference VARCHAR(255)` exists (`migrations/006_payments_schema_tables.sql:55`).

### D3. FULL `wallet.ledger_entries` Schema (`migrations/003_wallet_schema_tables.sql:18-35`)
```sql
CREATE TABLE IF NOT EXISTS wallet.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL,
  wallet_id UUID NOT NULL,
  entry_type VARCHAR(10) NOT NULL CHECK (entry_type IN ('debit', 'credit')),
  amount NUMERIC(16,4) NOT NULL CHECK (amount > 0),
  balance_before NUMERIC(16,4) NOT NULL DEFAULT 0.0000,
  balance_after NUMERIC(16,4) NOT NULL,
  reference_type VARCHAR(50) NOT NULL,
  reference_id VARCHAR(255),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT wallet_ledger_entries_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES wallet.wallets(id)
);
```

### D4. `LedgerService.recordEntry` Input Shape & Example Entries
- Signature: `[LedgerService.ts:16-27](file:///C:/SkiesPro/src/modules/wallet/services/ledgerService.ts#L16-L27)`
```typescript
export interface LedgerEntryInput {
  transactionId: string;
  walletId: string;
  entryType: 'debit' | 'credit';
  amount: Decimal;
  balanceBefore: Decimal;
  balanceAfter: Decimal;
  referenceType: LedgerReferenceType;
  referenceId?: string;
  description?: string;
}
```
- Example Real DB Debit Entry:
  `{ id: "675d294f...", wallet_id: "b3cdbc23...", entry_type: "debit", amount: "1500.0000", balance_before: "19860.0000", balance_after: "18360.0000", reference_type: "withdrawal", reference_id: "235d9ef4..." }`

### D5. Migration Tooling
- Tooling: Custom TypeScript runner (`[scripts/run-migrations.ts](file:///C:/SkiesPro/scripts/run-migrations.ts)`).
- Folder & Naming: `migrations/0XX_name.sql`. Run via `npm run migrate`.

### D6. RLS Policies / Triggers
- Triggers: `[migrations/026_add_available_balance_trigger.sql:38-60](file:///C:/SkiesPro/migrations/026_add_available_balance_trigger.sql#L38-L60)` updates `available_balance`.
- RLS Policies: NOT FOUND — searched `[migrations/]` for `CREATE POLICY`. RLS is managed at application level.

---

## 7. Section E — Wallet Service Surface

### E1. Public Methods (`src/modules/wallet/services/walletService.ts`)
- `createWallet(userId, accountType, currency)` (`L35-L47`): Creates or returns wallet row.
- `getBalance(userId, accountType)` (`L49-L53`): Returns wallet row.
- `getWalletBalance(userId)` (`L55-L85`): Returns balance DTO with available/locked values.
- `credit(userId, accountType, amount, referenceType, referenceId, description)` (`L104-L143`): Atomically credits total balance and logs ledger entry.
- `debit(userId, accountType, amount, referenceType, referenceId, description)` (`L145-L185`): Atomically debits total balance and logs ledger entry.
- `lockFunds(userId, accountType, amount, referenceType, referenceId, description)` (`L187-L214`): Atomically increases `locked_balance`.
- `unlockFunds(userId, accountType, amount)` (`L216-L238`): Atomically decreases `locked_balance`.

### E2 / E3. Single Atomic Method for B2C
- No single public method on `WalletService` currently performs "clear locked balance + debit total balance + record ledger entry" in one call. A dedicated `finalizeWithdrawalDebit` method should be added to `WalletService`.

---

## 8. Section F — Infrastructure & Worker Bootstrap
- **F1. File Paths**:
  - `[settlementWorker.ts](file:///C:/SkiesPro/src/modules/trading/workers/settlementWorker.ts)`
  - `[reconciliationWorker.ts](file:///C:/SkiesPro/src/modules/wallet/workers/reconciliationWorker.ts)`
  - `[auditChainVerification.job.ts](file:///C:/SkiesPro/src/modules/admin/jobs/auditChainVerification.job.ts)`
- **F2. Worker Bootstrap**:
  - `[src/index.ts:112-121](file:///C:/SkiesPro/src/index.ts#L112-L121)` imports and instantiates `SettlementWorker` when `config.enableSettlementWorker` is `true`.
- **F3. Failure Handling**:
  - `settlementWorker.ts:60-80`: `try/catch` block inside infinite loop logs error via `logger.error` and continues execution after interval delay.
- **F4. Worker Start Entry**: `src/index.ts:112-121`.
- **F5. Logging Pattern**: `import { logger } from '../../../shared/middleware/logger.js'` with structured JSON logs (`logger.info`, `logger.error`).
- **F6. Recommended Integration Point**: Add `enableB2cWorker: process.env.ENABLE_B2C_WORKER === 'true'` in `src/config/app.ts` and conditionally instantiate `B2CDispatchWorker` in `src/index.ts`.

---

## 9. Section G — Config / Env / Secrets

### G1 / G2. Env Vars Map
- `src/config/app.ts`: Loads port, CORS, worker flags.
- Complete set of M-Pesa env vars across codebase:
  1. `MPESA_ENVIRONMENT` (`DarajaMpesaAdapter.ts:20`)
  2. `MPESA_CONSUMER_KEY` (`DarajaMpesaAdapter.ts:22`)
  3. `MPESA_CONSUMER_SECRET` (`DarajaMpesaAdapter.ts:23`)
  4. `MPESA_PASSKEY` (`DarajaMpesaAdapter.ts:24`)
  5. `MPESA_SHORTCODE` (`DarajaMpesaAdapter.ts:25`)
  6. `MPESA_CALLBACK_URL` (`DarajaMpesaAdapter.ts:26`)
  7. `MPESA_CALLBACK_TOKEN` (`PaymentController.ts:89`)

### G3. B2C Sandbox Env Vars
- `MPESA_B2C_SHORTCODE` (e.g. `600980` or `600000`)
- `MPESA_B2C_INITIATOR_NAME` (e.g. `testapi`)
- `MPESA_B2C_SECURITY_CREDENTIAL` (RSA encrypted initiator password using Safaricom Sandbox cert)
- `MPESA_B2C_COMMAND_ID` (`BusinessPayment` / `SalaryPayment` / `PromotionPayment`)
- `MPESA_B2C_RESULT_URL`
- `MPESA_B2C_TIMEOUT_URL`

### G4. Base URL & Feature Flag
- Base URL: `DarajaMpesaAdapter.ts:20` (`https://sandbox.safaricom.co.ke`).
- Feature Flag: Add `ENABLE_B2C_DISBURSEMENT=true/false` in `.env` and `src/config/app.ts`.

---

## 10. Section H — UI / API Surface
- **H1. `FinanceOverviewPage.tsx`**: `[FinanceOverviewPage.tsx:1-151](file:///C:/SkiesPro/frontend/src/pages/admin/FinanceOverviewPage.tsx)`
- **H2. `useAdminFinance.ts`**: `[useAdminFinance.ts:1-142](file:///C:/SkiesPro/frontend/src/hooks/admin/useAdminFinance.ts)`
- **H3. Routes**: `PUT /api/v1/admin/withdrawals/:id/approve` (`[admin.routes.ts:105-115](file:///C:/SkiesPro/src/modules/admin/admin.routes.ts#L105-L115)`)
- **H4. Misleading UI Copy**: `[WithdrawalActionModal.tsx:107](file:///C:/SkiesPro/frontend/src/components/admin/WithdrawalActionModal.tsx#L107)` `"Approving will dispatch M-Pesa B2C payout of KES..."`.
- **H5. Status Badges**: `PendingWithdrawalsTable.tsx:75-79` renders status badge.
- **H6. Types**: `[adminApiClient.ts:93-104](file:///C:/SkiesPro/frontend/src/services/admin/adminApiClient.ts#L93-L104)`.

---

## 11. Section I — Security / Testing
- **I1. Test Suite**: Jest tests in `tests/payments/` (`withdrawal.test.ts`, `mpesaCallback.test.ts`). `MpesaMockAdapter.ts` simulates Daraja responses.
- **I2. Callback Validation**: `PaymentController.ts:89` validates `req.query.token === process.env.MPESA_CALLBACK_TOKEN`.
- **I3. Rate Limiting & Idempotency**: `rateLimit('authenticated')` in `payment.routes.ts`; `payments.idempotency_keys` table for POST requests.

---

## 12. Exhaustive Impact Map Table

| Slice | File Path | Description of Change | Risk Rating & Reason |
|---|---|---|---|
| **New** | `src/modules/payments/adapters/mpesa/IB2CPayoutGateway.ts` | Define B2C payout interface contract | **LOW** — New interface |
| **New** | `src/modules/payments/adapters/mpesa/DarajaB2CAdapter.ts` | Implement Safaricom B2C API client | **HIGH** — External API integration & credential security |
| **New** | `migrations/038_b2c_outbox_table.sql` | Create DB outbox table for reliable B2C job dispatch | **MED** — Schema addition |
| **Modified** | `src/modules/admin/services/AdminComplianceService.ts` | Refactor `approveWithdrawal` to set status `dispatched` & enqueue outbox job | **HIGH** — Core financial state transition change |
| **New** | `src/modules/payments/workers/b2cDispatchWorker.ts` | DB-backed background worker processing outbox dispatch | **MED** — Asynchronous execution |
| **New** | `src/modules/payments/controllers/b2cCallbackController.ts` | Handle inbound B2C Result and Timeout callbacks | **HIGH** — Webhook security, idempotency & wallet reversal |
| **Modified** | `src/modules/payments/payment.routes.ts` | Register B2C callback endpoints | **LOW** — Route registration |
| **Modified** | `src/modules/wallet/services/walletService.ts` | Add `finalizeWithdrawalDebit` method to clear locked balance & debit balance atomically | **HIGH** — Wallet balance mutation |
| **Modified** | `src/config/app.ts` | Add B2C worker and disbursement feature flags | **LOW** — Config addition |
| **Modified** | `src/index.ts` | Bootstrap `B2CDispatchWorker` when enabled | **LOW** — Worker bootstrap |
| **Modified** | `frontend/src/services/admin/adminApiClient.ts` | Update `WithdrawalRequest.status` type union | **LOW** — Type update |
| **Modified** | `frontend/src/components/admin/PendingWithdrawalsTable.tsx` | Render `dispatched`, `completed`, and `failed` status badges | **LOW** — UI badge rendering |
| **Modified** | `frontend/src/pages/admin/FinanceOverviewPage.tsx` | Add filter tabs for `Dispatched`, `Completed`, `Failed` | **LOW** — UI tab addition |
| **New** | `scripts/seed-b2c-test-withdrawals.ts` | Seed test withdrawals across all B2C states | **LOW** — Test fixture script |
| **New** | `tests/payments/b2cCallback.test.ts` | Unit tests for B2C result callback and auto-reversal | **MED** — Test suite addition |

---

## 13. Risk Register Table

| Risk | Blast Radius | Likelihood / Severity | Mitigation Strategy |
|---|---|---|---|
| **Status-transition breakage** | Admin finance dashboard, reporting queries | Low / Med | Update type unions, status filter tabs, and status badge renderers |
| **Callback Replay / Double Debit** | Wallet balances, financial ledger | Low / Critical | Strict idempotency checks on `ConversationID` with `FOR UPDATE` row locks |
| **Stuck `dispatched` state** (Daraja Timeout) | User payout status, audit compliance | Med / High | B2C reconciliation job polling status or timing out after threshold with auto-reversal |
| **Credential Exposure** (Initiator Password) | Daraja B2C shortcode security | Low / Critical | RSA encryption of Security Credential; strictly isolate in environment secrets |
| **Sandbox-vs-Prod Misconfiguration** | Payment routing, test funds | Low / High | Explicit `MPESA_ENVIRONMENT` check & feature flag `ENABLE_B2C_DISBURSEMENT` |
| **Ledger / Balance Drift** | Financial ledger integrity | Low / Critical | Execute balance debit and ledger entry in a single DB transaction |
| **Missing Idempotency in Dispatch Worker** | Duplicate M-Pesa B2C payout calls | Low / High | Outbox job status transition (`pending` → `processing` → `sent`) with optimistic version lock |

---

## 14. Recommended Build Slice Order

- **Slice 1: B2C Interface & Adapter (`IB2CPayoutGateway.ts`, `DarajaB2CAdapter.ts`, unit tests)**
  - Files: `IB2CPayoutGateway.ts`, `DarajaB2CAdapter.ts`, `tests/payments/b2cAdapter.test.ts`.
  - Eye test: Unit tests verify B2C OAuth token generation and B2C payload construction.
- **Slice 2: Outbox Table Migration & Dispatch Worker (`migrations/038`, `b2cDispatchWorker.ts`)**
  - Files: `migrations/038_b2c_outbox_table.sql`, `b2cDispatchWorker.ts`, `src/config/app.ts`, `src/index.ts`.
  - Eye test: Worker polls outbox table and executes Daraja B2C dispatch.
- **Slice 3: Admin Approval Flow Refactor (`AdminComplianceService.ts`)**
  - Files: `AdminComplianceService.ts`.
  - Eye test: Admin clicking "Approve" transitions status to `'dispatched'` and enqueues outbox record without immediately debiting wallet.
- **Slice 4: B2C Callback Controller & Wallet Finalization (`b2cCallbackController.ts`, `WalletService.ts`)**
  - Files: `b2cCallbackController.ts`, `payment.routes.ts`, `WalletService.ts`, `tests/payments/b2cCallback.test.ts`.
  - Eye test: Success callback transitions status to `'completed'`, clears locked balance, debits total balance, and writes ledger debit; failure callback transitions status to `'failed'`, unlocks balance, and writes ledger refund.
- **Slice 5: Reconciliation Job & UI Updates (`FinanceOverviewPage.tsx`, `PendingWithdrawalsTable.tsx`)**
  - Files: `FinanceOverviewPage.tsx`, `PendingWithdrawalsTable.tsx`, `adminApiClient.ts`.
  - Eye test: Admin dashboard renders `Dispatched`, `Completed`, and `Failed` tabs and badges correctly.

---

## 15. Open Questions / Decisions Needed from Project Owner
1. **Safaricom B2C Sandbox Credentials**: Confirmation of active sandbox B2C shortcode (`600980` or `600000`) and initiator credentials.
2. **Timeout Auto-Reversal Window**: Agreed timeframe before a stuck `dispatched` withdrawal is automatically timed out and refunded (e.g. 2 hours vs 24 hours).

---
**Read-Only Audit Completed — Revision 1**
