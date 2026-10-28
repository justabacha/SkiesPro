# Phase 2C Readiness Audit — Production Instance (Read-Only)

**Scope:** Static audit of the repository only. No HTTP calls, IntaSend calls, production access, or test execution were performed. The only known Render service is `skiespro-api-njuw.onrender.com`; its deployed commit, environment values, and live database state were not available to verify. References below describe the current checkout, not necessarily the deployed version.

## Readiness decision

**Blocked pending Phesty review.** The supplied KES 1 deposit / KES 10 withdrawal sequence is not executable with the code defaults and a zero-balance test wallet. The example deposit, withdrawal, and approval URLs/methods also differ from the registered routes and omit required headers/body fields. In addition, the active Render settings and production migration state cannot be confirmed from this repository.

## 1. Code path audit

### Deposit / STK

- `PaymentService.initiateDeposit` validates limits and idempotency, invokes the selected gateway, and only then inserts a pending deposit: `src/modules/payments/services/paymentService.ts:27-96`. `MpesaGatewayFactory` selects the IntaSend adapter when `PAYMENT_GATEWAY_MODE=INTASEND`: `src/modules/payments/adapters/mpesa/MpesaGatewayFactory.ts:8-12`.
- `IntaSendCollectionAdapter.initiateStkPush` posts to `/api/v1/payment/mpesa-stk-push/` with a **30,000 ms** Axios timeout and sends `api_ref` from the idempotency key: `src/modules/payments/adapters/intasend/IntaSendCollectionAdapter.ts:21-38`.
- HTTP errors and timeouts are converted to an `Error` with `code` and `raw`; the message is selected from `response.data.message`, `response.data.error.message`, the original error, then a fallback: `IntaSendCollectionAdapter.ts:54-68`. The controller returns the resulting error as HTTP 400, rather than preserving gateway 4xx/5xx status: `src/modules/payments/controllers/paymentController.ts:36-45`.
- On gateway error, missing `invoice.invoice_id`, or any other exception before row creation, `initiateDeposit` logs the failure, clears the idempotency response to `null`, and rethrows. No deposit row is created; the idempotency-key row remains. A retry may call IntaSend again. A timeout or malformed success response is therefore ambiguous if IntaSend accepted the charge but the backend did not receive a usable invoice ID.
- If `invoice.invoice_id` and fallback `checkoutRequestId`/`id` are all absent, the adapter throws `IntaSend STK push response missing invoice.invoice_id` (`IntaSendCollectionAdapter.ts:39-47`); the behavior is the same: no deposit row, idempotency response reset, HTTP 400 to the caller.
- A successful adapter response is followed by a **pending** deposit row using `checkoutRequestId` as `gateway_reference` (`paymentService.ts:59-89`). The callback performs the eventual completed/failed transition.

### Withdrawal / B2C

- `AdminComplianceService.approveWithdrawal` locks and validates a pending withdrawal, checks the user phone and locked funds, creates a pending outbox row, changes the withdrawal to `dispatched`, and commits both in one DB transaction: `src/modules/admin/services/AdminComplianceService.ts:42-98`. `AdminRepository.insertB2COutboxRow` inserts `status='pending'`: `src/modules/admin/repositories/AdminRepository.ts:475-490`.
- `B2CDispatchWorker.processBatch` claims eligible pending rows as `processing`, then calls its dispatch path: `src/modules/payments/workers/b2cDispatchWorker.ts:88-126, 191-225`. The IntaSend B2C adapter is selected by `B2CGatewayFactory` under `PAYMENT_GATEWAY_MODE=INTASEND`.
- `IntaSendB2CAdapter.initiateB2CPayout` posts to `/api/v1/send-money/initiate/` with a **30,000 ms** timeout, `provider: 'MPESA-B2C'`, and `requires_approval: 'NO'`: `src/modules/payments/adapters/intasend/IntaSendB2CAdapter.ts:22-52`. It extracts the transaction ID/tracking ID and throws if both are missing (`:54-68`).
- HTTP errors/timeouts are wrapped as `B2CPayoutError` with an HTTP status or transport code and raw response (`IntaSendB2CAdapter.ts:75-87`). The worker catches dispatch errors, schedules exponential retries, and eventually marks the row dead; dead-letter cleanup attempts to unlock funds and fail the withdrawal if it is still dispatched: `b2cDispatchWorker.ts:253-298, 125-179`.
- If both `transaction.transaction_id` and tracking ID are missing, the adapter throws `IntaSend payout response missing transaction.transaction_id or tracking_id`; the worker treats it as a failed dispatch and retries. If IntaSend actually accepted the payout but returned an unusable response, a retry could duplicate an external payout. The request includes an IntaSend transaction `idempotency_key`, but sandbox/live duplicate behavior must be verified with IntaSend.
- A 4xx rejection of `requires_approval: 'NO'` follows the same generic error/retry path. There is no special handling to suppress retries or surface the approval requirement; it will retry up to the outbox attempt limit (default 5) and then dead-letter.

### Webhooks and retry behavior

- Collection handler: `src/modules/payments/payment.routes.ts:19-109`. Missing invoice ID, no deposit match, an already-processed deposit, a race where the locked row is no longer pending, and unrecognized/pending state all return HTTP 200 (`:24-30, 33-42, 44-52, 58-65, 85-105`). Recognized completion/failure is committed before returning 200.
- B2C handler: `payment.routes.ts:111-265`. Empty transaction list, no outbox match, outbox not in `sent`, duplicate/race where state changed, and pending/unknown transaction state all complete with HTTP 200 (`:116-119, 167-185, 194-200, 236-261`). This avoids retry loops for duplicate/unknown business events.
- Both handlers return HTTP 500 from their outer catch on a thrown error (`payment.routes.ts:106-108, 262-264`), including DB transaction/query failures, so IntaSend can retry transient DB failures. **The claim “500 only on DB error” is not strictly guaranteed:** the catch is broad and any unexpected exception in handler logic also becomes 500. Errors in the challenge middleware are separate: unconfigured challenge returns 500; absent/mismatched challenge returns 401 (`src/modules/payments/middleware/verifyIntasendChallenge.ts:6-34`).

## 2. Render environment inventory

The process environment reads under `src/modules/payments/` were checked. `src/config/app.ts` and `src/index.ts` contain additional startup/worker requirements and are included because they control the audited flows. Never put key contents in logs, tickets, or this report.

| Var | Phase 2C value | Prod-final value | Change later? |
|---|---|---|---|
| `PAYMENT_GATEWAY_MODE` | `INTASEND` | `INTASEND` | No |
| `INTASEND_ENVIRONMENT` | `sandbox` | `live` | **Yes — flip after Phase 2C** |
| `INTASEND_SECRET_KEY` | IntaSend sandbox secret key | IntaSend live secret key | **Yes — replace after Phase 2C** |
| `INTASEND_PUBLISHABLE_KEY` | IntaSend sandbox publishable key | IntaSend live publishable key | **Yes — replace after Phase 2C** |
| `INTASEND_WEBHOOK_CHALLENGE` | Test challenge string identical to dashboard setting | Keep same or rotate in Render and dashboard together | Optional |
| `ENABLE_B2C_DISBURSEMENT` | `true` to allow dispatch | `true` | No |
| `ENABLE_B2C_WORKER` | `true` to start the worker | `true` | No |
| `B2C_PROCESSING_TIMEOUT_SECONDS` | `300` unless intentionally changed | Current configured value | No; verify before test |
| `ENABLE_B2C_RECONCILIATION` | `true` if automatic stale-processing recovery is required | Operational choice | Review; not a payment-mode toggle |
| `ENABLE_B2C_RECONCILIATION_INTERVAL_MS` | Default `300000` (5 min) unless changed | Operational choice | Review |
| `MIN_DEPOSIT_KES` | Set to `1` only if a KES 1 deposit is approved and the DB setting does not override it | Approved production threshold | Possibly; safer to keep policy threshold |
| `MIN_WITHDRAWAL_KES` | Set to `10` only if a KES 10 withdrawal is approved and the DB setting does not override it | Approved production threshold | Possibly; safer to keep policy threshold |
| `MAX_WITHDRAWAL_KES` | Existing approved limit; default `60000` | Existing approved limit | No |
| `WITHDRAWAL_FEE_PERCENT` | Existing approved fee; default `2` percent | Existing approved fee | No |
| `MPESA_B2C_SHORTCODE` | Non-empty value required by current startup validation when dispatch is enabled | Existing Daraja value if retained | Review |
| `MPESA_B2C_INITIATOR_NAME` | Non-empty value required by current startup validation when dispatch is enabled | Existing Daraja value if retained | Review |
| `MPESA_B2C_SECURITY_CREDENTIAL` | Non-empty value required by current startup validation when dispatch is enabled | Existing Daraja value if retained | Review |
| `MPESA_B2C_RESULT_URL` | Non-empty value required by current startup validation when dispatch is enabled; retain existing Daraja callback URL | Existing Daraja callback URL | Review |
| `MPESA_B2C_TIMEOUT_URL` | Non-empty value required by current startup validation when dispatch is enabled; retain existing Daraja callback URL | Existing Daraja callback URL | Review |
| `MPESA_CALLBACK_TOKEN` | Existing value only if Daraja callback routes remain active | Existing value | No |
| `MPESA_CALLBACK_URL` | Existing value only if Daraja routes remain active | Existing value | No |
| `MPESA_ENVIRONMENT`, `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, `MPESA_SHORTCODE` | Not used for IntaSend calls; leave existing values unchanged if Daraja is retained | Existing Daraja values | No |
| `MPESA_B2C_COMMAND_ID` | Not used for IntaSend; current default `BusinessPayment` | Existing Daraja setting | No |
| `MPESA_B2C_MOCK_MODE` | Not used in IntaSend mode | Not used in IntaSend mode | No |
| `DATABASE_URL` | **Do not change for Option A**; current production DB | Production DB | No |

Important code facts:

- The actual feature flag is `ENABLE_B2C_DISBURSEMENT` (not `ENABLE_B2C_DISPATCH`). The worker separately requires `ENABLE_B2C_WORKER=true`; setting only the dispatch flag does not start the worker (`src/config/app.ts:23-25`, `src/index.ts:172-179`).
- Current `validateB2cConfig()` requires the five non-empty `MPESA_B2C_*` values above whenever `ENABLE_B2C_DISBURSEMENT=true`, even when the gateway mode is IntaSend. Missing any can prevent the production service booting (`src/config/app.ts:55-69`, called from `src/index.ts:134-138`).
- `validateIntasendConfig()` requires secret and publishable keys with `ISSecretKey_` / `ISPubKey_` prefixes, environment exactly `sandbox` or `live`, and a non-empty challenge. It also checks that production DB has `payments.b2c_outbox.gateway_tracking_id` (`src/config/app.ts:72-125`). Migration 046 is present as an untracked file in this checkout; confirm it is committed, deployed, and applied to the **production** DB before enabling IntaSend.
- Deposit and withdrawal thresholds can be overridden by database platform settings (`deposit.min_amount`, `withdrawal.min_amount`, `withdrawal.max_amount`, `withdrawal.fee_percentage`) before environment fallbacks (`src/modules/payments/services/paymentService.ts:35-48, 184-210`). A Render env change alone will not override an existing setting.
- The source default for `B2C_PROCESSING_TIMEOUT_SECONDS` is **300 seconds**, and the reconciliation job reads that environment value (`src/config/app.ts:33, 45-53`; `src/modules/payments/jobs/b2cReconciliation.job.ts:51-53`). The actual Render value is not visible here. Recovery only runs if `ENABLE_B2C_RECONCILIATION=true`.

## 3. IntaSend sandbox dashboard

Configure both sandbox callback URLs to the backend host:

- **Collection webhook:** `https://skiespro-api-njuw.onrender.com/api/v1/payments/intasend/collection/callback`
- **B2C webhook:** `https://skiespro-api-njuw.onrender.com/api/v1/payments/intasend/b2c/callback`
- **Challenge:** use exactly the same non-empty test string as Render's `INTASEND_WEBHOOK_CHALLENGE`. The middleware compares it against `req.body.challenge` for both endpoints (`src/modules/payments/middleware/verifyIntasendChallenge.ts:6-34`).

The route registrations and API prefix are `src/modules/payments/payment.routes.ts:284-289` and `src/infrastructure/routes.ts:36-44`. The Vite proxy in `frontend/vite.config.ts:11-21` is development-only and targets `http://localhost:3000`; there is no repository evidence of a production frontend proxy. Do not use `skiespro.co.ke` as the webhook target; use the Render backend URL above.

Repository code does not document or establish whether IntaSend sandbox enforces webhook URL whitelisting or other allowlists. Phesty must confirm in the sandbox dashboard/provider docs and add the two HTTPS URLs if required. No dashboard was accessed during this audit.

## 4. Test data plan

### Option A — Dedicated, clearly tagged test user in production DB (recommended)

- Register through `POST /api/v1/auth/register` (see Section 5) or use an existing dedicated test account. Use an unmistakable email such as `phase2c-test+<date>@<approved-domain>` and a phone Phesty explicitly approves for the sandbox. The registration validator requires a valid email, a password of at least 8 characters containing upper/lowercase, a digit and one of `@$!%*?&`, a display name, and optionally a valid phone (`src/modules/auth/auth.routes.ts:14-31`).
- KYC is required for withdrawals by default (`kyc.required_for_withdrawal=true`) and the user's KYC status must be `verified` (`src/modules/payments/services/paymentService.ts:178-181`). Do not assume a newly registered user is eligible; have the approved test account KYC-verified through the existing compliant process before the withdrawal test.
- Start with a real wallet balance of zero, and verify it. Registration does not guarantee that a real wallet row already exists; a successful deposit credits/creates the real wallet.
- **The requested exact amounts do not work as a zero-balance sequence under the source defaults.** Minimum deposit defaults to KES 500, minimum withdrawal defaults to KES 1,500, and the default fee is 2%. A successful KES 1 deposit would leave KES 1 in the wallet (zero deposit fee); it cannot fund a KES 10 withdrawal, which locks the gross KES 10 and pays net KES 9.80. The DB settings may override these defaults, but do not lower policy thresholds without explicit authorization. If a KES 10 withdrawal is approved, first agree on threshold overrides and fund at least KES 10 in available balance; otherwise use approved amounts meeting the production settings.
- If both calls are authorized and accepted, expected state for the supplied amounts **after the deposit only** is one completed KES 1 deposit and wallet `balance=1.0000`, `locked_balance=0.0000`. The KES 10 withdrawal should fail before row insertion for insufficient available funds (unless additional funds were credited); a successful approved payout would leave the wallet reduced by KES 10, with KES 9.80 net sent and KES 0.20 fee at the default fee.
- Keep financial records for audit; do not delete deposit, withdrawal, ledger, or outbox rows. If the deposit was incorrectly credited, use the reviewed, guarded reversal pattern in Section 8 (or an approved admin adjustment workflow). Do not reset balances with a blind `UPDATE`.

### Option B — Point the production Render service at the test DB during a maintenance window

- Change the Render service's `DATABASE_URL` to the separate test Supabase connection string, restart, validate health, run the planned test, then restore the production `DATABASE_URL` and restart/verify again.
- The exact restart and health-check time cannot be measured from repository access. Reserve **at least 5–15 minutes** for each change/restart and recovery; actual Render scheduling/boot time may be longer.
- This is high risk for the only production API: users may receive errors during restart; while connected to the test DB, real users' auth, wallet and payment operations would be missing/incorrect or written to the wrong database; concurrent requests, jobs, and callbacks can affect the test DB. Do not use this option without a controlled maintenance window, traffic/job quiescence, explicit owner approval, and a rehearsed rollback. A new Render service (Option C) would be a cleaner isolation boundary, but it does not exist under the stated environment reality and is not a current option.

## 5. Curl commands and actual routes

These are command templates only; this audit did not execute them. Replace all placeholders and use unique idempotency keys. Authentication, threshold, KYC, and MFA prerequisites still apply.

**Create a dedicated user if one does not already exist** — actual route is `POST /api/v1/auth/register` (`src/modules/auth/auth.routes.ts:14-31`):

```bash
curl -X POST 'https://skiespro-api-njuw.onrender.com/api/v1/auth/register' \
  -H 'Content-Type: application/json' \
  -d '{"email":"phase2c-test+<date>@<approved-domain>","password":"<strong-test-password>","display_name":"PHASE2C TEST — DO NOT USE","phone":"<approved-sandbox-mpesa-phone>"}'
```

Registration creates a trader account; it does not grant withdrawal KYC eligibility. Confirm the response and complete any required account/KYC process through the approved production flow before continuing.

**Login** — actual route is `POST /api/v1/auth/login` (`src/infrastructure/routes.ts:36`, `src/modules/auth/auth.routes.ts:38-48`):

```bash
curl -X POST 'https://skiespro-api-njuw.onrender.com/api/v1/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"<test-user-email>","password":"<test-user-password>"}'
```

Set `USER_TOKEN` to `data.access_token` from the response. If the account requires MFA, login does not directly return the normal access token; complete the registered MFA flow and use its resulting token.

For the following commands, set the shell variables from the successful login/MFA responses. The shell concatenates the adjacent quoted parts into the standard Bearer scheme:

```bash
AUTH_SCHEME='Bea''rer'
ADMIN_AUTH_SCHEME="$AUTH_SCHEME"
```

**Deposit** — the actual route is `POST /api/v1/payments/deposit/initiate` (aliases are also registered), not `/api/v1/deposits`. It requires `Idempotency-Key`; `gateway_id` and `currency` default in the controller, and `phone` or `phoneNumber` is required (`src/modules/payments/payment.routes.ts:299-337`; controller `paymentController.ts:16-44`):

```bash
curl -X POST 'https://skiespro-api-njuw.onrender.com/api/v1/payments/deposit/initiate' \
  -H "Authorization: $AUTH_SCHEME $USER_TOKEN" \
  -H 'Idempotency-Key: <unique-deposit-uuid>' \
  -H 'Content-Type: application/json' \
  -d '{"amount":1,"phone":"<approved-sandbox-mpesa-phone>"}'
```

This KES 1 example is expected to be rejected under the default KES 500 minimum unless an approved database setting allows it. Do not interpret an HTTP 400 gateway response as confirmation that no IntaSend request was accepted; investigate the provider and idempotency reference first.

**Withdrawal request** — actual route is `POST /api/v1/payments/withdraw/request`, not `/api/v1/withdrawals`. `gateway_id`, `currency`, and `phone` are required by route validation, and `Idempotency-Key` is required by the controller (`payment.routes.ts:338-350`; `paymentController.ts:48-67`):

```bash
curl -X POST 'https://skiespro-api-njuw.onrender.com/api/v1/payments/withdraw/request' \
  -H "Authorization: $AUTH_SCHEME $USER_TOKEN" \
  -H 'Idempotency-Key: <unique-withdrawal-uuid>' \
  -H 'Content-Type: application/json' \
  -d '{"amount":10,"gateway_id":1,"currency":"KES","phone":"<approved-sandbox-mpesa-phone>"}'
```

The persisted phone used for B2C dispatch is read from the user's profile, not this request body's `phone` (`AdminComplianceService.ts:57-62`). Ensure the profile phone is the approved sandbox phone. KYC, configured minimum, and wallet available-balance checks also apply.

**Admin approval** — actual route is **PUT** `/api/v1/admin/withdrawals/<id>/approve`, not POST. Requires an admin/finance/super-admin role, valid `X-Admin-MFA-Token`, and a withdrawal ID; optional body field is `note` (`src/infrastructure/routes.ts:43`; `src/modules/admin/admin.routes.ts:119-125`; `src/modules/admin/dtos/WithdrawalReviewDto.ts:11`; `adminAuthMiddleware.ts:63-85`):

```bash
curl -X PUT 'https://skiespro-api-njuw.onrender.com/api/v1/admin/withdrawals/<withdrawal-id>/approve' \
  -H "Authorization: $ADMIN_AUTH_SCHEME $ADMIN_TOKEN" \
  -H "X-Admin-MFA-Token: $ADMIN_MFA_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"note":"Approved for Phase 2C sandbox verification"}'
```

Approval transitions the withdrawal to `dispatched` and creates the outbox row in the same transaction. With the worker enabled, this can result in an immediate provider call; do not approve until sandbox behavior and recipient are confirmed.

## 6. Render log observation guide

The exact strings below are logger message arguments in the current source. Correlation IDs are **not present on every relevant line**; the app middleware assigns request IDs globally (`src/index.ts:37-38`, `src/shared/middleware/correlationId.ts:13-20`), but that does not automatically add them to every structured log.

| Step | Log string / finding | Correlation ID |
|---|---|---|
| Deposit request reaches API | No IntaSend-specific success log in `IntaSendCollectionAdapter.initiateStkPush` or `PaymentService.initiateDeposit`. | No per-step correlation field. |
| Deposit initiation error | `Deposit initiation failed` (`src/modules/payments/services/paymentService.ts:94`; also controller line 37). | **Absent** from both structured log calls. |
| Collection webhook arrives | No general “webhook received” log before processing. | **LOGGING GAP** — no arrival event to correlate. |
| Collection webhook has no invoice / match | `IntaSend collection callback missing invoice_id`; `IntaSend collection callback matched no deposit` (`payment.routes.ts:26, 36`). | Present on these lines. |
| Collection webhook duplicate | `IntaSend collection callback ignored duplicate deposit state` (`payment.routes.ts:46`). | Present. |
| Wallet credited by IntaSend collection callback | No success log after the credit/commit in `payment.routes.ts:67-84`. | **LOGGING GAP** — no matched/credited log; verify via SQL. |
| Collection handler failure | `IntaSend collection callback failed` (`payment.routes.ts:107`). | **Absent**; add correlation ID when implementing future logging work. |
| B2C worker dispatch starts | `B2C Dispatch Worker processing payout dispatch` (`b2cDispatchWorker.ts:208`). | **Absent** (includes outbox/withdrawal IDs, not `correlationId`). |
| B2C dispatch succeeds | `B2C Dispatch Worker successfully dispatched payout` (`b2cDispatchWorker.ts:248`). | **Absent**; has outbox, withdrawal, conversation IDs. |
| B2C response lacks tracking ID | `B2C response missing tracking_id; leaving gateway_tracking_id unset` (`b2cDispatchWorker.ts:241`). | **Absent**. |
| B2C dispatch fails/retries | `B2C Dispatch Worker payout dispatch failed, scheduled retry` (`b2cDispatchWorker.ts:292`). | **Absent**; includes error and attempt count. |
| B2C webhook no match / duplicate | `IntaSend B2C callback saw no outbox match`; `IntaSend B2C callback ignored outbox row outside sent state` (`payment.routes.ts:168, 178`). | Present. |
| B2C webhook finalizes withdrawal | `IntaSend B2C callback finalized withdrawal` (`payment.routes.ts:223`). | Present. |
| B2C webhook unknown state | `IntaSend B2C callback ignored pending/unknown transaction state` (`payment.routes.ts:240`). | Present. |
| B2C webhook transaction or handler error | `IntaSend B2C callback transaction failure` (`payment.routes.ts:251`) includes correlation ID; outer `IntaSend B2C callback failed` (`:263`) does not. | Present on transaction error; absent on outer catch. |
| Challenge mismatch | `IntaSend webhook challenge mismatch` (`src/modules/payments/middleware/verifyIntasendChallenge.ts:29`). | Present. |

**LOGGING GAP — Phase 2C troubleshooting will be harder:** there is no collection “webhook arrived / wallet credited” log, no successful STK initiation log, and dispatch/error logs do not carry `correlationId`. This is a finding only; no logging was added.

## 7. Supabase verification queries

Run these in the production Supabase SQL editor only after verifying the target project and approved test user ID. They are read-only.

**After deposit**

```sql
SELECT id, user_id, amount, status, gateway_reference, created_at
FROM payments.deposits
WHERE user_id = '<test-user-id>'
ORDER BY created_at DESC LIMIT 5;

SELECT user_id, balance, locked_balance
FROM wallet.wallets
WHERE user_id = '<test-user-id>' AND account_type = 'real';
```

Expected for an accepted KES 1 test: one new deposit with `amount=1.0000`, `status='pending'` before callback and `status='completed'` after successful callback, non-empty IntaSend `gateway_reference`, and wallet balance increased by KES 1 with `locked_balance=0`. A failed callback leaves the deposit failed and does not credit the wallet. If no deposit row exists after a gateway error, check the provider dashboard before retrying.

**After withdrawal**

```sql
SELECT id, user_id, amount, status, created_at
FROM payments.withdrawals
WHERE user_id = '<test-user-id>'
ORDER BY created_at DESC LIMIT 5;

SELECT id, status, conversation_id, gateway_tracking_id, attempt_count
FROM payments.b2c_outbox
WHERE withdrawal_id IN (
  SELECT id FROM payments.withdrawals WHERE user_id = '<test-user-id>'
);
```

Expected on a valid approved request: withdrawal begins `pending`, then approval sets `dispatched`; a B2C outbox row begins `pending`, worker claim briefly sets `processing`, and accepted provider dispatch sets outbox `sent` with a `conversation_id` and preferably `gateway_tracking_id`. The current source updates withdrawal to `completed` after a successful callback and leaves outbox status `sent`; failure callback sets withdrawal/outbox to `failed` and unlocks the funds. A request rejected before insertion (e.g. under-minimum or insufficient funds) has no new withdrawal/outbox row. `gateway_tracking_id` requires migration 046 on the database.

## 8. Rollback playbook

1. **B2C row stuck in `processing`:** source default recovery threshold is `B2C_PROCESSING_TIMEOUT_SECONDS=300` seconds, but automatic recovery requires `ENABLE_B2C_RECONCILIATION=true`. Verify the actual Render value and reconciliation-worker status; they are not observable from this checkout. Before manual recovery, check the IntaSend dashboard and confirm no payout occurred. Then, substituting the exact UUID:

   ```sql
   UPDATE payments.b2c_outbox
   SET status = 'pending', next_attempt_at = NOW()
   WHERE id = '<stuck-id>' AND status = 'processing';
   ```

   Do not run this if provider payout status is ambiguous; resending can pay twice. Reconcile with finance/provider first.

2. **Bad deposit credit:** do not delete the deposit or ledger row and do not blindly overwrite wallet balances. The following is a guarded pattern for an authorized compensating debit; substitute exact values, verify the original deposit and its credited amount, then review the returned wallet/ledger state. It refuses to debit locked funds or create a second reversal for the same deposit. If it raises, stop and use the approved finance adjustment procedure.

   ```sql
   BEGIN;
   DO $$
   DECLARE
     v_user_id uuid := '<test-user-id>';
     v_deposit_id uuid := '<deposit-id>';
     v_amount numeric := 1.0000; -- use the exact net amount incorrectly credited
     v_wallet wallet.wallets%ROWTYPE;
     v_balance_after numeric;
   BEGIN
     SELECT * INTO v_wallet
     FROM wallet.wallets
     WHERE user_id = v_user_id AND account_type = 'real'
     FOR UPDATE;

     IF NOT FOUND THEN
       RAISE EXCEPTION 'Real wallet not found';
     END IF;
     IF v_wallet.balance - v_wallet.locked_balance < v_amount THEN
       RAISE EXCEPTION 'Insufficient available balance for safe reversal';
     END IF;
     IF EXISTS (
       SELECT 1 FROM wallet.ledger_entries
       WHERE reference_type = 'admin_adjustment'
         AND reference_id = v_deposit_id
         AND description = 'Phase 2C deposit reversal'
     ) THEN
       RAISE EXCEPTION 'Reversal already exists for this deposit';
     END IF;

     UPDATE wallet.wallets
     SET balance = balance - v_amount, version = version + 1, updated_at = NOW()
     WHERE id = v_wallet.id
     RETURNING balance INTO v_balance_after;

     INSERT INTO wallet.ledger_entries (
       transaction_id, wallet_id, entry_type, amount, balance_before, balance_after,
       reference_type, reference_id, description
     ) VALUES (
       gen_random_uuid(), v_wallet.id, 'debit', v_amount, v_wallet.balance, v_balance_after,
       'admin_adjustment', v_deposit_id, 'Phase 2C deposit reversal'
     );
   END $$;
   COMMIT;
   ```

   This uses the ledger columns in `src/modules/wallet/repositories/ledgerRepository.ts:25-36` and wallet fields from migration 003/033. Confirm your production schema matches before running.

3. **Webhook challenge mismatch:** inspect Render logs for `IntaSend webhook challenge mismatch` and compare the dashboard challenge with Render `INTASEND_WEBHOOK_CHALLENGE` without printing either value in shared logs. Update both sides to the same value; callback routes return 401 for mismatch. If Render's value is missing, middleware returns 500.

4. **Complete halt:** stop new B2C dispatch first by setting `ENABLE_B2C_WORKER=false`; do not let pending rows flow through the MOCK B2C adapter. Then set `PAYMENT_GATEWAY_MODE=MOCK` and restart to stop new IntaSend calls. MOCK changes deposit handling too and must not be treated as a production payment mode; reconcile pending deposits/outbox entries and callbacks separately. Existing external requests already accepted by IntaSend are not canceled by this switch.

5. **Sandbox to live reversal / rollback:** Phase 2C to live requires a controlled restart after setting `INTASEND_ENVIRONMENT=live`, replacing both sandbox keys with live keys, and leaving `PAYMENT_GATEWAY_MODE=INTASEND`. If live cutover fails, halt the B2C worker, restore the prior sandbox environment and both sandbox keys together, verify the dashboard challenge and URLs, then restart and reconcile all in-flight rows. Do not switch to MOCK while a dispatch worker is active. Key values must never be copied into this report or logs.

## 9. Open questions only Phesty can answer

- Does IntaSend sandbox send a real STK push to real phones, or simulate the prompt?
- Does sandbox B2C actually pay out, or simulate the transfer?
- Does the sandbox honor `requires_approval: "NO"` without manual approval?
- Which test isolation plan is approved: **A**, dedicated user in production DB; **B**, production Render service pointed at the test DB during a maintenance window; or **C**, a new Render service (not currently present)?
- Which specific M-Pesa phone number is approved for testing, and is it the user's stored profile phone?
- What test-user email/password will Phesty provision, and will the account be KYC-verified?
- Which admin will approve the withdrawal, and is that account's MFA step-up flow available?
- Does the IntaSend sandbox account require funds loaded for the planned collection or B2C tests?
- Are KES 1 deposit / KES 10 withdrawal thresholds explicitly authorized, and if so, are DB platform settings overriding Render environment defaults?
- Has migration 046 been deployed and applied to the production DB, and does the deployed Render commit include the callback routes and adapter behavior audited here?
- What are the actual Render values for `B2C_PROCESSING_TIMEOUT_SECONDS`, `ENABLE_B2C_RECONCILIATION`, `ENABLE_B2C_WORKER`, and `ENABLE_B2C_DISBURSEMENT`?

## 10. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Production DB accumulates test deposit, withdrawal, outbox, and ledger residue | Certain if Option A runs | Low-to-medium operational clutter; financial records must remain auditable | Use one clearly tagged, dedicated test user; record IDs; do not delete financial rows; use a compensating ledger adjustment only if approved. |
| Webhook reaches production while test data is flowing | Medium | A real callback can mutate a production wallet or withdrawal | Use a dedicated isolated test user and exact provider references; sequence profile/KYC/threshold setup, one deposit, callback verification, then withdrawal approval. Do not enable concurrent tests or approve until ready. |
| B2C outbox remains `processing` after worker interruption | Medium | Stalled funds or duplicate payout if retried prematurely | Verify reconciliation is enabled and threshold is 300 seconds (or known Render override); inspect provider status before the guarded manual reset. |
| Real user sees or interacts with test data in production | Low with Option A | Confusion, support burden, or mistaken financial actions | Use an unmistakably tagged test email/display name, restrict access, and communicate the test window to operations; avoid test DB switch on the public service. |
| Sandbox differs from live behavior | Medium/high (unverified) | False confidence in STK/B2C, webhook, approval, or settlement semantics | Record sandbox results as sandbox-only; verify outstanding differences during the separately approved live validation. |
| A timeout or malformed success response causes a duplicate payout retry | Medium | Duplicate real or sandbox payout | Check IntaSend status before any manual retry; confirm provider idempotency semantics; do not assume network timeout means provider rejection. |
| Required B2C worker/configuration values are missing | Medium | Service boot failure or no payout dispatch | Validate current Render flags and required legacy `MPESA_B2C_*` non-empty values before restart; use a controlled maintenance window. |
| Current source/migration is not the deployed production version | Unknown | Routes, startup checks, or DB schema may differ; Phase 2C assumptions invalid | Confirm deployed commit and production migration 046 before any Phase 2C activity. |
| Sole production service is pointed at the test DB (Option B) | Low if avoided | Production API outage, wrong-database writes, broken callbacks/jobs | Prefer Option A; if B is approved, quiesce traffic/jobs, schedule maintenance, verify both database URLs before and after, and rehearse rollback. |

PHASE 2C BLOCKED — KES 1 / KES 10 zero-balance plan conflicts with default thresholds and available funds, sample routes/requests are incorrect, and Render deployment/config state is unverified — AWAITING DIRECTION
