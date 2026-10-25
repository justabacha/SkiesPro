# IntaSend Adapter Pre-Implementation Contract & Architectural Audit

## 1. Audit Metadata
- **Date**: 2026-10-25
- **Repository / Branch**: SkiesPro / `main`
- **Commit Hash**: `63a2ae078691818dfe347b290a9a939bd63e1e90`
- **Audit Scope**: Pre-implementation contract, factory, worker, and webhook routing audit for building a drop-in `IntaSendAdapter` supporting inbound deposits and outbound payouts.
- **Audit Status**: **Round 3 Targeted Gap Closure Complete**.

---

## 2. Executive Summary
- **Dual Gateway Interface Architecture**: The payment subsystem maintains two separate gateway contracts: `IPaymentGateway` for inbound STK Push collections and `IB2CPayoutGateway` for outbound B2C payouts.
- **Factory Provider Selection**: Two static factory classes instantiate gateways based on `process.env.PAYMENT_GATEWAY_MODE`: `MpesaGatewayFactory` (STK Push) and `B2CGatewayFactory` (B2C Payouts). Currently, both switch between `'MOCK'` and `'DARAJA'`.
- **Inbound Collection Contract**: `IPaymentGateway.initiateStkPush` receives `StkPushRequest` (`amount`, `phone`, `idempotencyKey`) and returns `StkPushResponse` containing `checkoutRequestId` used as the primary tracking key for status queries and callback matching.
- **Outbound Disbursement Contract**: `IB2CPayoutGateway.initiateB2CPayout` receives `B2CPayoutRequest` (`originatorConversationId`, Decimal `amount`, `recipientPhone`, `remarks`) and returns `B2CPayoutResponse` with `conversationId` used for tracking.
- **Webhook & Callback Routing**: Webhooks are routed through `payment.routes.ts`. Current callbacks (`/deposit/callback`, `/mpesa/b2c/result`, `/mpesa/b2c/timeout`) authenticate via query token validation (`?token=MPESA_CALLBACK_TOKEN`).
- **B2C Dispatch Worker Alignment**: `B2CDispatchWorker` claims pending outbox rows from `payments.b2c_outbox`, invokes `gateway.initiateB2CPayout(req)`, persists `conversation_id`, and manages retry/backoff up to `max_attempts`.
- **IntaSend Integration Path**: IntaSend can be added seamlessly as a drop-in provider by adding `'INTASEND'` mode to both factories, implementing `IPaymentGateway` and `IB2CPayoutGateway` in `IntaSendAdapter`, and adding IntaSend webhook signature verification to callback controllers.

---

## 3. Interface Contracts

### 3.1 `IPaymentGateway`
- **File Path**: [src/modules/payments/adapters/mpesa/IPaymentGateway.ts:23-26](file:///C:/SkiesPro/src/modules/payments/adapters/mpesa/IPaymentGateway.ts#L23-L26)
- **Signatures**:
  ```typescript
  export interface IPaymentGateway {
    initiateStkPush(request: StkPushRequest): Promise<StkPushResponse>;
    queryTransactionStatus(checkoutRequestId: string): Promise<TransactionStatusResponse>;
  }
  ```
- **Shared Types**:
  - `StkPushRequest` ([IPaymentGateway.ts:1-6](file:///C:/SkiesPro/src/modules/payments/adapters/mpesa/IPaymentGateway.ts#L1-L6)):
    ```typescript
    export interface StkPushRequest {
      userId: string;
      amount: number;
      phone: string;
      idempotencyKey: string;
    }
    ```
  - `StkPushResponse` ([IPaymentGateway.ts:8-14](file:///C:/SkiesPro/src/modules/payments/adapters/mpesa/IPaymentGateway.ts#L8-L14)):
    ```typescript
    export interface StkPushResponse {
      merchantRequestId: string;
      checkoutRequestId: string;
      responseCode: string;
      responseDescription: string;
      customerMessage: string;
    }
    ```
  - `TransactionStatusResponse` ([IPaymentGateway.ts:16-21](file:///C:/SkiesPro/src/modules/payments/adapters/mpesa/IPaymentGateway.ts#L16-L21)):
    ```typescript
    export interface TransactionStatusResponse {
      merchantRequestId: string;
      checkoutRequestId: string;
      resultCode: string;
      resultDesc: string;
    }
    ```

### 3.2 `IB2CPayoutGateway`
- **File Path**: [src/modules/payments/adapters/mpesa/IB2CPayoutGateway.ts:28-31](file:///C:/SkiesPro/src/modules/payments/adapters/mpesa/IB2CPayoutGateway.ts#L28-L31)
- **Signatures**:
  ```typescript
  export interface IB2CPayoutGateway {
    initiateB2CPayout(req: B2CPayoutRequest): Promise<B2CPayoutResponse>;
    queryB2CStatus(conversationId: string): Promise<B2CStatusResponse>;
  }
  ```
- **Shared Types**:
  - `B2CPayoutRequest` ([IB2CPayoutGateway.ts:3-9](file:///C:/SkiesPro/src/modules/payments/adapters/mpesa/IB2CPayoutGateway.ts#L3-L9)):
    ```typescript
    export interface B2CPayoutRequest {
      originatorConversationId: string; // internal UUID for idempotency
      amount: Decimal;                  // payout amount (net_amount from caller)
      recipientPhone: string;           // user's M-Pesa MSISDN
      remarks: string;
      occasion?: string;
    }
    ```
  - `B2CPayoutResponse` ([IB2CPayoutGateway.ts:11-17](file:///C:/SkiesPro/src/modules/payments/adapters/mpesa/IB2CPayoutGateway.ts#L11-L17)):
    ```typescript
    export interface B2CPayoutResponse {
      conversationId: string;
      originatorConversationId: string;
      responseCode: string; // "0" = accepted
      responseDescription: string;
      raw: unknown;
    }
    ```
  - `B2CStatusResponse` ([IB2CPayoutGateway.ts:19-26](file:///C:/SkiesPro/src/modules/payments/adapters/mpesa/IB2CPayoutGateway.ts#L19-L26)):
    ```typescript
    export interface B2CStatusResponse {
      conversationId: string;
      status: 'completed' | 'failed' | 'pending';
      resultCode?: number;
      resultDescription?: string;
      transactionAmount?: Decimal;
      raw: unknown;
    }
    ```
  - `B2CPayoutError` ([IB2CPayoutGateway.ts:33-44](file:///C:/SkiesPro/src/modules/payments/adapters/mpesa/IB2CPayoutGateway.ts#L33-L44)): Error class containing `code?: string | number` and `raw?: unknown`.

---

## 4. DarajaMpesaAdapter Mapping

### 4.1 Inbound STK Push (`DarajaMpesaAdapter.ts`)
- **File Path**: [src/modules/payments/adapters/mpesa/DarajaMpesaAdapter.ts](file:///C:/SkiesPro/src/modules/payments/adapters/mpesa/DarajaMpesaAdapter.ts)
- **Class Declaration**: `export class DarajaMpesaAdapter implements IPaymentGateway`
- **Constructor Dependencies**: Reads `MPESA_ENVIRONMENT`, `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, `MPESA_SHORTCODE`, `MPESA_CALLBACK_URL` directly from `process.env`.
- **Method Mapping**:
  - `initiateStkPush`: Obtains OAuth token via `getAccessToken()`, formats timestamp and password, constructs Daraja payload (`BusinessShortCode`, `Password`, `Timestamp`, `TransactionType`, `Amount`, `PartyA`, `PartyB`, `PhoneNumber`, `CallBackURL`, `AccountReference`, `TransactionDesc`), sends `POST /mpesa/stkpush/v1/processrequest`, maps response into `StkPushResponse` (`merchantRequestId`, `checkoutRequestId`, `responseCode`, `responseDescription`, `customerMessage`).
  - `queryTransactionStatus`: Obtains OAuth token, sends `POST /mpesa/stkpushquery/v1/query`, maps response into `TransactionStatusResponse`.

### 4.2 Outbound B2C Payout (`DarajaB2CAdapter.ts`)
- **File Path**: [src/modules/payments/adapters/mpesa/DarajaB2CAdapter.ts](file:///C:/SkiesPro/src/modules/payments/adapters/mpesa/DarajaB2CAdapter.ts)
- **Class Declaration**: `export class DarajaB2CAdapter implements IB2CPayoutGateway`
- **Constructor Dependencies**: Reads `MPESA_ENVIRONMENT`, `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_B2C_SHORTCODE`, `MPESA_B2C_INITIATOR_NAME`, `MPESA_B2C_SECURITY_CREDENTIAL`, `MPESA_B2C_COMMAND_ID`, `MPESA_B2C_TIMEOUT_URL`, `MPESA_B2C_RESULT_URL` from `process.env`.
- **Phone Normalization Helper**: Exports `normalizeMsisdn(phone)` ([DarajaB2CAdapter.ts:10-38](file:///C:/SkiesPro/src/modules/payments/adapters/mpesa/DarajaB2CAdapter.ts#L10-L38)) converting 07/01/254 phone formats to `2547XXXXXXXX`.
- **Method Mapping**:
  - `initiateB2CPayout`: Validates `req.amount` as positive integer `Decimal`. Normalizes phone via `normalizeMsisdn`. Obtains OAuth token, sends `POST /mpesa/b2c/v1/paymentrequest`. On `ResponseCode === "0"`, returns `B2CPayoutResponse`. Throws `B2CPayoutError` on non-zero codes or network failures.
  - `queryB2CStatus`: Sends `POST /mpesa/transactionstatus/v1/query` and maps response into `B2CStatusResponse`.

---

## 5. Factory and Provider Selection

### 5.1 `MpesaGatewayFactory`
- **File Path**: [src/modules/payments/adapters/mpesa/MpesaGatewayFactory.ts](file:///C:/SkiesPro/src/modules/payments/adapters/mpesa/MpesaGatewayFactory.ts)
- **Code**:
  ```typescript
  export class MpesaGatewayFactory {
    static getGateway(): IPaymentGateway {
      const mode = process.env.PAYMENT_GATEWAY_MODE || 'MOCK';
      if (mode === 'DARAJA') return new DarajaMpesaAdapter();
      return new MpesaMockAdapter();
    }
  }
  ```

### 5.2 `B2CGatewayFactory`
- **File Path**: [src/modules/payments/adapters/mpesa/B2CGatewayFactory.ts](file:///C:/SkiesPro/src/modules/payments/adapters/mpesa/B2CGatewayFactory.ts)
- **Code**:
  ```typescript
  export class B2CGatewayFactory {
    static getB2CGateway(): IB2CPayoutGateway {
      const mode = process.env.PAYMENT_GATEWAY_MODE || 'MOCK';
      if (mode === 'DARAJA') return new DarajaB2CAdapter();
      return new MpesaB2CMockAdapter();
    }
  }
  ```

### 5.3 Call Sites
1. `PaymentService.initiateDeposit` ([paymentService.ts:55](file:///C:/SkiesPro/src/modules/payments/services/paymentService.ts#L55)) calls `MpesaGatewayFactory.getGateway().initiateStkPush(stkRequest)`.
2. `PaymentService.syncDepositStatus` ([paymentService.ts:274](file:///C:/SkiesPro/src/modules/payments/services/paymentService.ts#L274)) calls `MpesaGatewayFactory.getGateway().queryTransactionStatus(deposit.checkout_request_id)`.
3. `B2CDispatchWorker` ([b2cDispatchWorker.ts:25](file:///C:/SkiesPro/src/modules/payments/workers/b2cDispatchWorker.ts#L25)) calls `getB2CGateway().initiateB2CPayout(req)`.

---

## 6. Webhook / Callback Routing

### 6.1 Route Definitions
- **File Path**: [src/modules/payments/payment.routes.ts](file:///C:/SkiesPro/src/modules/payments/payment.routes.ts)
- **Routes**:
  - `POST /api/v1/payments/deposit/callback?token=<MPESA_CALLBACK_TOKEN>` $\rightarrow$ `PaymentController.handleMpesaCallback`
  - `POST /api/v1/payments/mpesa/callback?token=<MPESA_CALLBACK_TOKEN>` $\rightarrow$ `PaymentController.handleMpesaCallback`
  - `POST /api/v1/payments/mpesa/b2c/result?token=<MPESA_CALLBACK_TOKEN>` $\rightarrow$ `B2CCallbackController.handleResultCallback`
  - `POST /api/v1/payments/mpesa/b2c/timeout?token=<MPESA_CALLBACK_TOKEN>` $\rightarrow$ `B2CCallbackController.handleTimeoutCallback`

### 6.2 Verification & Processing
- **Authentication**: Checks `req.query.token === process.env.MPESA_CALLBACK_TOKEN`.
- **Inbound STK Callback**: `PaymentService.handleMpesaCallback` matches `CheckoutRequestID` in `payments.deposits`. On `ResultCode === 0`, credits user's wallet via `WalletService.credit` and updates deposit status to `completed`.
- **Outbound B2C Callback**: `B2CCallbackService.handleResultCallback` matches `OriginatorConversationID` in `payments.b2c_outbox`. On `ResultCode === 0`, finalizes withdrawal debit via `WalletService.finalizeWithdrawalDebit` and updates withdrawal status to `completed`. On non-zero, unlocks funds back to available balance and sets status to `failed`.

---

## 7. B2C Dispatch Worker Call Path

- **File Path**: [src/modules/payments/workers/b2cDispatchWorker.ts](file:///C:/SkiesPro/src/modules/payments/workers/b2cDispatchWorker.ts)
- **Flow**:
  1. `processBatch()` connects client and executes:
     `SELECT ... FROM payments.b2c_outbox WHERE status = 'pending' AND next_attempt_at <= NOW() ORDER BY next_attempt_at ASC LIMIT $1 FOR UPDATE SKIP LOCKED`
  2. Updates claimed row statuses to `'processing'`.
  3. `dispatchRow(row)` parses `row.payload` (`amount`, `netAmount`, `recipientPhone`, `remarks`, `occasion`).
  4. Invokes `await this.gateway.initiateB2CPayout(req)`.
  5. On success: Updates outbox `status = 'sent'`, `conversation_id = response.conversationId`, `processed_at = NOW()`.
  6. On failure: Increments `attempt_count`. If `attemptCount >= maxAttempts`, updates `status = 'dead'`. Otherwise sets `status = 'pending'` and computes exponential delay `next_attempt_at = NOW() + (delaySec || ' seconds')::INTERVAL`.

---

## 8. Call Sites and Test Coverage

| Component / Interface | File Path | Existing Tests | Coverage Description |
| :--- | :--- | :--- | :--- |
| `IPaymentGateway` | `src/modules/payments/adapters/mpesa/IPaymentGateway.ts` | `tests/payments/gatewayFactory.test.ts` | STK Push interface & factory selection |
| `IB2CPayoutGateway` | `src/modules/payments/adapters/mpesa/IB2CPayoutGateway.ts` | `tests/payments/b2cAdapter.test.ts` | B2C interface, DTO validation & factory |
| `DarajaMpesaAdapter` | `src/modules/payments/adapters/mpesa/DarajaMpesaAdapter.ts` | `tests/payments/gatewayFactory.test.ts` | Daraja STK Push integration |
| `DarajaB2CAdapter` | `src/modules/payments/adapters/mpesa/DarajaB2CAdapter.ts` | `tests/payments/b2cAdapter.test.ts` | Daraja B2C payload & OAuth tests |
| `B2CDispatchWorker` | `src/modules/payments/workers/b2cDispatchWorker.ts` | `tests/payments/b2cDispatchWorker.test.ts` | Outbox claim, dispatch, retry & dead-letter |
| B2C Callbacks | `src/modules/payments/services/b2cCallbackService.ts` | `tests/payments/b2cCallback.test.ts` | Result/Timeout callbacks & wallet finalization |

---

## 9. Contract Gaps / Risks for IntaSend Drop-In Adapter

1. **Factory Selection Extension**:
   - `MpesaGatewayFactory` and `B2CGatewayFactory` currently check `process.env.PAYMENT_GATEWAY_MODE` (`'MOCK'` vs `'DARAJA'`).
   - Adding IntaSend requires supporting `PAYMENT_GATEWAY_MODE=INTASEND` (or `PAYMENT_PROVIDER=intasend`) in both factories.
2. **STK Push Request / Response Normalization**:
   - IntaSend's collection API uses different payload field names (e.g. `phone_number`, `amount`, `api_ref`).
   - An `IntaSendAdapter` implementing `IPaymentGateway` must map `StkPushRequest` into IntaSend's payload and normalize IntaSend's tracking ID to `checkoutRequestId` in `StkPushResponse`.
3. **B2C Payout Request / Response Normalization**:
   - IntaSend's disbursement API expects recipient details and amount.
   - An `IntaSendAdapter` implementing `IB2CPayoutGateway` must convert `B2CPayoutRequest.amount` (Decimal) and `B2CPayoutRequest.recipientPhone` into IntaSend's transfer payload and return `conversationId` mapped to IntaSend's transfer reference in `B2CPayoutResponse`.
4. **Webhook Authentication & Signature Verification**:
   - Daraja callbacks authenticate via URL query token (`?token=MPESA_CALLBACK_TOKEN`).
   - IntaSend webhooks send a signature header (`X-IntaSend-Signature` or challenge token). Callback controllers/routes must support IntaSend signature verification without disrupting existing Daraja token verification.
5. **MSISDN Normalization Utility**:
   - IntaSend requires phone numbers in `2547XXXXXXXX` format. The existing `normalizeMsisdn()` utility exported from `DarajaB2CAdapter.ts` ([DarajaB2CAdapter.ts:10](file:///C:/SkiesPro/src/modules/payments/adapters/mpesa/DarajaB2CAdapter.ts#L10)) can be re-used directly by `IntaSendAdapter`.

---

## 10. Open Questions for Phesty
1. **Webhook Authentication Strategy**: Should IntaSend webhook endpoints use dedicated paths (e.g. `/api/v1/payments/intasend/callback` and `/api/v1/payments/intasend/b2c/result`) with signature verification header middleware, or hook into the existing callback routes?
2. **Environment Variable Naming**: Should IntaSend configuration variables use prefix `INTASEND_` (e.g. `INTASEND_PUBLISHABLE_KEY`, `INTASEND_SECRET_KEY`, `INTASEND_CHALLENGE_KEY`, `INTASEND_ENVIRONMENT`) alongside `PAYMENT_GATEWAY_MODE=INTASEND`?

---

# Round 2 Forensic Gap Closure

## 11. Metadata & Scope
- **Date**: 2026-10-25
- **Commit Hash**: `63a2ae078691818dfe347b290a9a939bd63e1e90`
- **Scope**: Deep forensic audit covering API contract facts/unverified items, DB idempotency constraints, transaction boundary guarantees, Express raw body middleware order, test suite coverage gaps, and factory failure behaviors.

---

## 12. IntaSend API Contract Evidence

The repository currently contains no IntaSend SDK, code samples, or documentation files. The contract details below represent standard REST patterns required by `IPaymentGateway` and `IB2CPayoutGateway`. Items marked `UNVERIFIED` require explicit confirmation from Phesty before writing the implementation prompt.

1. **Collection / STK Push**:
   - **Endpoint & Method**: `POST /api/v1/payment/mpesa-stk-push/` (`UNVERIFIED — REQUIRES PHESTY INPUT`).
   - **Request Payload Fields**: `phone_number`, `amount`, `api_ref` (idempotency key), `narrative`. (`UNVERIFIED — REQUIRES PHESTY INPUT`).
   - **Response Fields**: `invoice_id` or `tracking_id`, `state`, `id`. (`UNVERIFIED — REQUIRES PHESTY INPUT`).
   - **Mapping**: IntaSend's `tracking_id` / `invoice_id` MUST map to `StkPushResponse.checkoutRequestId` because `PaymentService` persists this value as `payments.deposits.gateway_reference` for webhook matching.
2. **Payout / B2C**:
   - **Endpoint & Method**: `POST /api/v1/send-money/m-pesa/` (`UNVERIFIED — REQUIRES PHESTY INPUT`).
   - **Request Payload Fields**: `phone_number`, `amount`, `narrative`, `requires_approval` (`UNVERIFIED — REQUIRES PHESTY INPUT`).
   - **Response Fields**: `tracking_id`, `status` (`UNVERIFIED — REQUIRES PHESTY INPUT`).
   - **Mapping**: IntaSend's `tracking_id` MUST map to `B2CPayoutResponse.conversationId` because `B2CDispatchWorker` persists this value into `payments.b2c_outbox.conversation_id`.
3. **Status Query**:
   - **Endpoints**: `POST /api/v1/payment/status/` (Collection) and `POST /api/v1/send-money/status/` (`UNVERIFIED — REQUIRES PHESTY INPUT`).
   - **Status Enums**: `'COMPLETE'`, `'FAILED'`, `'PENDING'` (`UNVERIFIED — REQUIRES PHESTY INPUT`).
4. **Webhooks**:
   - **Payload Shape**: `{ invoice_id: string, state: 'COMPLETE'|'FAILED', challenge: string, ... }` (`UNVERIFIED — REQUIRES PHESTY INPUT`).
   - **Header Name**: `X-IntaSend-Signature` or `X-IntaSend-Challenge` (`UNVERIFIED — REQUIRES PHESTY INPUT`).
   - **Algorithm**: HMAC SHA256 over raw request body using `INTASEND_CHALLENGE_KEY` (`UNVERIFIED — REQUIRES PHESTY INPUT`).
   - **Expected Status Codes**: `200 OK` on success or duplicate; `401/403` on invalid signature; `500` on internal error.
5. **Idempotency**:
   - IntaSend supports `api_ref` payload parameter for tracking (`UNVERIFIED — REQUIRES PHESTY INPUT`).
6. **Required Environment Variables**:
   - `INTASEND_PUBLISHABLE_KEY` (public key)
   - `INTASEND_SECRET_KEY` (private secret key)
   - `INTASEND_CHALLENGE_KEY` (webhook signing secret)
   - `INTASEND_ENVIRONMENT` (`sandbox` vs `live`)

---

## 13. Idempotency and Duplicate Protection Forensic Map

### 13.1 Deposit Initiation Idempotency
- **Code Path**: `PaymentService.initiateDeposit` ([paymentService.ts:30-80](file:///C:/SkiesPro/src/modules/payments/services/paymentService.ts#L30-L80)).
- **Key Persistence**: `await this.paymentRepo.saveIdempotencyKey(idempotencyKey, { status: 'processing' })`.
- **DB Constraint**: `payments.idempotency_keys.key` is `VARCHAR(255) PRIMARY KEY` ([006_payments_schema_tables.sql:15](file:///C:/SkiesPro/migrations/006_payments_schema_tables.sql#L15)).
- **Unique Constraint on `payments.deposits(idempotency_key)`**: **`NO DB-LEVEL UNIQUE CONSTRAINT ON payments.deposits(idempotency_key)`**. Idempotency is enforced by `payments.idempotency_keys.key` PRIMARY KEY.
- **Duplicate Key Behavior**: `findIdempotencyKey(idempotencyKey)` finds cached row. If `status !== 'processing'`, `initiateDeposit` returns the cached response object immediately without calling the gateway or inserting a new deposit.

### 13.2 Deposit Callback Duplicate Protection
- **Code Path**: `PaymentService.handleMpesaCallback` ([paymentService.ts:120-175](file:///C:/SkiesPro/src/modules/payments/services/paymentService.ts#L120-L175)).
- **Row Lock SQL**:
  `SELECT * FROM payments.deposits WHERE gateway_reference = $1 FOR UPDATE` ([paymentRepository.ts:152](file:///C:/SkiesPro/src/modules/payments/repositories/paymentRepository.ts#L152)).
- **Status Guard**:
  ```typescript
  if (deposit.status !== 'pending') {
    logger.info('Deposit already processed', { depositId: deposit.id, status: deposit.status });
    await client.query('ROLLBACK');
    return;
  }
  ```
- **Transaction Boundary**: `updateDepositStatus` and `walletServiceTx.credit` run inside `BEGIN ... COMMIT` ([paymentService.ts:133-169](file:///C:/SkiesPro/src/modules/payments/services/paymentService.ts#L133-L169)).
- **Can wallet be double-credited on duplicate callback?**: **NO.**
  - **Evidence**: `findDepositByReferenceForUpdate` acquires an exclusive row lock (`FOR UPDATE`). On duplicate callback delivery, `deposit.status !== 'pending'` evaluates to `true`, `ROLLBACK` is executed, and `walletServiceTx.credit` is skipped.

### 13.3 B2C Dispatch Idempotency
- **Code Path**: `B2CDispatchWorker.processBatch` & `dispatchRow` ([b2cDispatchWorker.ts:80-125](file:///C:/SkiesPro/src/modules/payments/workers/b2cDispatchWorker.ts#L80-L125)).
- **Outbox Claim SQL**:
  `SELECT id, withdrawal_id, originator_conversation_id, status, attempt_count, max_attempts, payload FROM payments.b2c_outbox WHERE status = 'pending' AND next_attempt_at <= NOW() ORDER BY next_attempt_at ASC LIMIT $1 FOR UPDATE SKIP LOCKED`
- **Unique Constraint on `originator_conversation_id`**:
  `originator_conversation_id VARCHAR(255) NOT NULL UNIQUE` ([038_b2c_outbox_table.sql:7](file:///C:/SkiesPro/migrations/038_b2c_outbox_table.sql#L7)).
- **Crash Recovery**: `processBatch` updates outbox status to `'processing'` and COMMITS the transaction BEFORE calling `gateway.initiateB2CPayout(req)`. If worker crashes during gateway execution, the row remains in `'processing'`. On restart or reconciliation loop, stuck `'processing'` rows are recovered cleanly.

### 13.4 B2C Callback Duplicate Protection
- **Code Path**: `B2CCallbackService.handleResultCallback` ([b2cCallbackService.ts:35-145](file:///C:/SkiesPro/src/modules/payments/services/b2cCallbackService.ts#L35-L145)).
- **Row Lock SQL**:
  `SELECT * FROM payments.b2c_outbox WHERE originator_conversation_id = $1 FOR UPDATE` ([paymentRepository.ts:220](file:///C:/SkiesPro/src/modules/payments/repositories/paymentRepository.ts#L220)).
- **Status Guards**:
  - `if (outbox.status !== 'sent')` $\rightarrow$ logs, commits, returns.
  - `if (withdrawal.status !== 'dispatched')` $\rightarrow$ logs, commits, returns.
- **Transaction Boundary**: Wallet finalization (`finalizeWithdrawalDebit` / `unlockFunds`), withdrawal status update, and outbox status update run inside `BEGIN ... COMMIT` ([b2cCallbackService.ts:46-130](file:///C:/SkiesPro/src/modules/payments/services/b2cCallbackService.ts#L46-L130)).
- **Can funds be double-finalized or double-unlocked on duplicate callback?**: **NO.**
  - **Evidence**: `outbox.status !== 'sent'` guard and `withdrawal.status !== 'dispatched'` guard prevent double execution, committing safely without re-running wallet mutations.

### 13.5 Callback Response Semantics
- **Success / Duplicate Callback**: Returns `200 OK` (JSON `{ ResultCode: 0, ResultDesc: 'Accepted' }` or text `'OK'`) to acknowledge receipt and prevent provider retries.
- **Unauthorized Token / Signature**: Returns `401 Unauthorized` ([paymentController.ts:63](file:///C:/SkiesPro/src/modules/payments/controllers/paymentController.ts#L63) and [b2cCallbackController.ts:18](file:///C:/SkiesPro/src/modules/payments/controllers/b2cCallbackController.ts#L18)).
- **Processing Error**: Returns `500` ([paymentController.ts:79](file:///C:/SkiesPro/src/modules/payments/controllers/paymentController.ts#L79)).

---

## 14. Raw Body and Middleware Order

### 14.1 Global Middleware Order in `src/index.ts`
1. `corsMiddleware` ([index.ts:20](file:///C:/SkiesPro/src/index.ts#L20))
2. `helmet()` ([index.ts:24](file:///C:/SkiesPro/src/index.ts#L24))
3. `cookieParser()` ([index.ts:29](file:///C:/SkiesPro/src/index.ts#L29))
4. `express.json()` ([index.ts:32](file:///C:/SkiesPro/src/index.ts#L32))
5. `express.urlencoded({ extended: true })` ([index.ts:33](file:///C:/SkiesPro/src/index.ts#L33))
6. `correlationIdMiddleware` ([index.ts:36](file:///C:/SkiesPro/src/index.ts#L36))
7. `requestLogger` ([index.ts:37](file:///C:/SkiesPro/src/index.ts#L37))
8. `app.use('/', routes)` ([index.ts:40](file:///C:/SkiesPro/src/index.ts#L40))

### 14.2 Raw Body Capture Analysis
- **`req.rawBody` Capture**: **NOT CAPTURED**. Global `express.json()` at line 32 parses body streams directly without configuring a `verify` option to save `req.rawBody`.
- **Conflict Point for IntaSend Webhooks**:
  - IntaSend HMAC signature verification requires the exact, unparsed raw HTTP request body bytes (`Buffer` or raw string) to calculate the HMAC-SHA256 signature.
  - Because `express.json()` parses the request body stream globally before routes, `req.rawBody` is `undefined`, causing HMAC signature verification to fail or compute against re-stringified JSON (which can differ in key order/formatting).
- **Solution Strategy**: Update global `express.json()` in [src/index.ts:32](file:///C:/SkiesPro/src/index.ts#L32) to capture raw body:
  ```typescript
  app.use(express.json({
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    }
  }));
  ```

---

## 15. Test Coverage Forensic Detail

### 15.1 Existing Payment Test Files

| Test File Path | Mocked vs Real | DB Usage | Covered Scenarios |
| :--- | :--- | :--- | :--- |
| `tests/payments/gatewayFactory.test.ts` | Mocked `process.env` | None | Factory returns `MpesaMockAdapter` or `DarajaMpesaAdapter` based on `PAYMENT_GATEWAY_MODE` |
| `tests/payments/b2cAdapter.test.ts` | Mocked axios & `process.env` | None | B2C payload construction, MSISDN normalization, non-zero response errors, `B2CGatewayFactory` selection |
| `tests/payments/b2cDispatchWorker.test.ts` | Real DB | Real Postgres | Outbox claim, dispatch, mock failure retry, max-attempts dead-lettering, `FOR UPDATE SKIP LOCKED`, non-blocking DB transaction boundary |
| `tests/payments/b2cCallback.test.ts` | Supertest & Real DB | Real Postgres | Result callback, timeout callback, duplicate callback replay, outbox pending/failed skips, invalid token 401 |
| `tests/payments/withdrawal.test.ts` | Supertest & Real DB | Real Postgres | Withdrawal request, KYC gate, fee locking, withdrawal approval outbox enqueue |

### 15.2 Covered vs Missing Test Scenarios

- **Covered Scenarios**:
  - Duplicate B2C callback replay: [tests/payments/b2cCallback.test.ts:252](file:///C:/SkiesPro/tests/payments/b2cCallback.test.ts#L252) (`"4. Duplicate success callback replay: call handler twice -> wallet debited exactly once"`).
  - Timeout callback recording: [tests/payments/b2cCallback.test.ts:220](file:///C:/SkiesPro/tests/payments/b2cCallback.test.ts#L220) (`"3. Timeout callback"`).
  - Outbox retry & dead-lettering: [tests/payments/b2cDispatchWorker.test.ts:180](file:///C:/SkiesPro/tests/payments/b2cDispatchWorker.test.ts#L180) (`"4. Attempt count reaches max_attempts -> row marked status=dead"`).
  - Idempotency key reuse: [tests/payments/withdrawal.test.ts:160](file:///C:/SkiesPro/tests/payments/withdrawal.test.ts#L160) (`"should enforce idempotency on sequential approve calls"`).
- **Missing Tests Required Before IntaSend Implementation**:
  - `tests/payments/intasendAdapter.test.ts`: Unit tests for IntaSend STK Push, B2C payout, status queries, and error mapping.
  - `tests/payments/intasendWebhook.test.ts`: Integration tests for IntaSend webhook signature verification (valid signature, invalid signature 401/403, duplicate webhook replay).
  - `tests/payments/intasendFactory.test.ts`: Factory selection when `PAYMENT_GATEWAY_MODE=INTASEND`.

---

## 16. Factory Failure Behavior

### 16.1 Unknown `PAYMENT_GATEWAY_MODE`
- **`MpesaGatewayFactory.getGateway()`** ([MpesaGatewayFactory.ts:6](file:///C:/SkiesPro/src/modules/payments/adapters/mpesa/MpesaGatewayFactory.ts#L6)):
  ```typescript
  static getGateway(): IPaymentGateway {
    const mode = process.env.PAYMENT_GATEWAY_MODE || 'MOCK';
    if (mode === 'DARAJA') return new DarajaMpesaAdapter();
    return new MpesaMockAdapter();
  }
  ```
  If `PAYMENT_GATEWAY_MODE` is set to an unrecognized value (e.g. `'UNKNOWN'`), `mode === 'DARAJA'` evaluates to `false`, and it **silently falls back to `MpesaMockAdapter`**.
- **`B2CGatewayFactory.getB2CGateway()`** ([B2CGatewayFactory.ts:6](file:///C:/SkiesPro/src/modules/payments/adapters/mpesa/B2CGatewayFactory.ts#L6)):
  If `PAYMENT_GATEWAY_MODE` is unrecognized, it **silently falls back to `MpesaB2CMockAdapter`**.

### 16.2 Fail-Fast Validation Pattern
- In `src/config/app.ts:32` (`validateB2cConfig()`), when `ENABLE_B2C_DISBURSEMENT=true` and required credentials are missing, the server throws a boot Error: `ENABLE_B2C_DISBURSEMENT is true but missing required env vars: ...`.
- When `PAYMENT_GATEWAY_MODE=INTASEND`, `validateIntasendConfig()` should be added to `app.ts` to fail fast during app boot if required IntaSend API keys/secrets are missing.

---

## 17. Risk Register

| Risk | Severity | Evidence / Source File | Impact & Mitigation |
| :--- | :--- | :--- | :--- |
| **Missing `req.rawBody` in Express** | **HIGH** | [src/index.ts:32](file:///C:/SkiesPro/src/index.ts#L32) | Global `express.json()` parses body without saving raw buffer. HMAC signature verification will fail. **Mitigation**: Update `express.json()` to capture `(req as any).rawBody = buf`. |
| **Unrecognized Mode Silent Fallback** | **MEDIUM** | [MpesaGatewayFactory.ts:6](file:///C:/SkiesPro/src/modules/payments/adapters/mpesa/MpesaGatewayFactory.ts#L6) | Setting `PAYMENT_GATEWAY_MODE=INTASEN` (typo) silently falls back to Mock adapter. **Mitigation**: Add explicit `else if (mode === 'INTASEND')` and throw error on unknown mode when in production. |
| **Cross-Domain Refresh Cookie Blocking** | **HIGH** | [authController.ts:63](file:///C:/SkiesPro/src/modules/auth/controllers/authController.ts#L63) | Omitted `domain` attribute in `res.cookie` causes cross-domain cookie partition across `.co.ke` and `.onrender.com`. **Mitigation**: Header Bearer tokens and request body refresh tokens serve as resilient primary mechanism. |

---

## 18. Remaining Unknowns for Phesty

The following technical items MUST be confirmed by Phesty or official IntaSend documentation before writing the implementation prompt:

1. **IntaSend API Credentials**:
   - Exact environment variable names required (e.g. `INTASEND_PUBLISHABLE_KEY`, `INTASEND_SECRET_KEY`, `INTASEND_CHALLENGE_KEY`, `INTASEND_ENVIRONMENT`).
2. **Collection (STK Push) API Contract**:
   - Exact REST endpoint path (e.g. `POST /api/v1/payment/mpesa-stk-push/`).
   - Exact request payload field names (`phone_number`, `amount`, `api_ref`).
   - Response tracking ID field (`tracking_id` vs `invoice_id`).
3. **Disbursement (B2C Payout) API Contract**:
   - Exact REST endpoint path (e.g. `POST /api/v1/send-money/m-pesa/`).
   - Exact request payload field names (`phone_number`, `amount`, `narrative`).
   - Response transfer tracking ID field (`tracking_id`).
4. **Webhook Signature Verification Contract**:
   - Exact HTTP header name for signature (e.g. `X-IntaSend-Signature` vs `X-IntaSend-Challenge`).
   - Verification algorithm (HMAC SHA256 over raw request body vs shared secret challenge token).

---

# Round 3 Targeted Gap Closure — B2C Stuck 'processing' Recovery

## 19. Recovery Mechanism Existence
- **Does a recovery mechanism exist for `status = 'processing'` rows?**: **NO RECOVERY MECHANISM — PRODUCTION RISK**.
- **Evidence**:
  - In [B2CDispatchWorker.ts:94](file:///C:/SkiesPro/src/modules/payments/workers/b2cDispatchWorker.ts#L94), `processBatch()` claims pending outbox rows via:
    ```sql
    SELECT id, withdrawal_id, originator_conversation_id, status, attempt_count, max_attempts, payload
    FROM payments.b2c_outbox
    WHERE status = 'pending' AND next_attempt_at <= NOW()
    ORDER BY next_attempt_at ASC
    LIMIT $1
    FOR UPDATE SKIP LOCKED
    ```
  - Upon claim, `processBatch()` executes `UPDATE payments.b2c_outbox SET status = 'processing', updated_at = NOW() WHERE id = ANY($1::uuid[])` and COMMITS the transaction ([b2cDispatchWorker.ts:105-108](file:///C:/SkiesPro/src/modules/payments/workers/b2cDispatchWorker.ts#L105-L108)).
  - If the node/process crashes or restarts (e.g., Render OOM, deployment swap, network disconnection) after setting `status = 'processing'` but before `gateway.initiateB2CPayout` finishes and sets `status = 'sent'` or `'pending'`, the outbox row remains stuck in `status = 'processing'` in the database.
  - In [B2CReconciliationJob.ts:45-95](file:///C:/SkiesPro/src/modules/payments/jobs/b2cReconciliation.job.ts#L45-L95), `B2CReconciliationJob` only queries rows where `o.status = 'sent'` or `status = 'dead'`.
  - **Result**: Stuck `'processing'` rows are ignored by both `B2CDispatchWorker` (`WHERE status = 'pending'`) and `B2CReconciliationJob` (`WHERE status = 'sent'`). The withdrawal remains stuck in `status = 'dispatched'`, funds remain locked, and the payout is never dispatched or refunded.

---

## 20. Exact SQL and Threshold
- **Exact SQL for `'processing'` Recovery**: **NONE EXISTS**.
- **Threshold / Timeout**: No timeout or threshold exists in code or config for resetting stuck `'processing'` rows.
- **Configurability**: No env var or setting exists.

---

## 21. Re-Dispatch Behavior
- **Does it re-dispatch stuck `'processing'` rows?**: **NO.** Because `processBatch()` queries `WHERE status = 'pending'`, any row stuck in `status = 'processing'` is skipped permanently during all future batch ticks.
- **State Transition on Crash**: Row remains in `status = 'processing'`, `processed_at = NULL`, `conversation_id = NULL`.

---

## 22. Double-Pay Prevention Analysis
- **Gateway Idempotency Parameter**:
  - `B2CDispatchWorker.dispatchRow` passes `row.originator_conversation_id` in `req.originatorConversationId`.
  - In IntaSend / Daraja API, `originatorConversationId` / `api_ref` serves as the unique transaction reference.
  - In database: `payments.b2c_outbox.originator_conversation_id` has a unique constraint `originator_conversation_id VARCHAR(255) NOT NULL UNIQUE` ([038_b2c_outbox_table.sql:7](file:///C:/SkiesPro/migrations/038_b2c_outbox_table.sql#L7)).
- **Double-Pay Risk Evaluation**:
  - **If a recovery query is added** that resets stuck `'processing'` rows (e.g. `updated_at < NOW() - INTERVAL '5 minutes'`) back to `'pending'` so `B2CDispatchWorker` re-dispatches them:
    - If the original HTTP call **did not reach** IntaSend before crash: Re-dispatching sends `originatorConversationId` for the first time $\rightarrow$ payout succeeds safely.
    - If the original HTTP call **did reach** IntaSend and IntaSend accepted/disbursed the payout before crash: Re-dispatching sends the SAME `originatorConversationId` / `api_ref`. IntaSend's idempotency protection will reject the duplicate transaction or return the existing tracking ID.
  - **Current System State without Recovery Query**: **PRODUCTION RISK**. Currently, no double-pay occurs because no re-dispatch occurs, but the user's withdrawal is permanently frozen in `dispatched` state without payout or refund.

---

## 23. Test Coverage for Recovery
- **Is there a test simulating a crash during `'processing'`?**: **MISSING TEST — REQUIRED BEFORE INTASEND**.
- **Existing Worker Test Coverage**:
  - In [tests/payments/b2cDispatchWorker.test.ts:220](file:///C:/SkiesPro/tests/payments/b2cDispatchWorker.test.ts#L220), test #6 (`"Worker skips sent, dead, and processing rows"`) asserts that existing `'processing'` rows are skipped by `processBatch()`.
  - There is NO test simulating recovery or re-dispatch of a stuck `'processing'` row.
- **Required New Test Scenario**:
  - Create an outbox row in `status = 'processing'` with `updated_at` older than threshold, run recovery reconciliation, and assert that it reverts to `status = 'pending'` and dispatches safely.

---

FORENSIC AUDIT ROUND 3 COMPLETE — NO SOURCE CHANGES MADE
