# B2C DISBURSEMENT MANUAL OPERATIONAL TASKS & CONFIGURATION GUIDE

This document tracks required manual actions, environment variable additions, and database migrations per B2C slice.

---

## Slice 1: Interface, Daraja Adapter, Factory, Config
- **Environment Variables (Render & Local `.env`)**:
  - `ENABLE_B2C_DISBURSEMENT=false` (Keep false until Slice 4 E2E verification)
  - `ENABLE_B2C_WORKER=false` (Keep false until Slice 4 E2E verification)
  - `MPESA_B2C_SHORTCODE=` 
    > **`MPESA_B2C_SHORTCODE` is NOT the same as `MPESA_SHORTCODE`.** `MPESA_SHORTCODE` (`174379`) is the STK Push sandbox shortcode for INBOUND deposits. `MPESA_B2C_SHORTCODE` is a separate value provisioned when you subscribe to the B2C product in the Daraja portal (typically `600980` or `600000` in sandbox). Using `174379` for B2C will fail with `Invalid Shortcode`.
  - `MPESA_B2C_INITIATOR_NAME=` (e.g. `testapi` in sandbox)
  - `MPESA_B2C_SECURITY_CREDENTIAL=` (RSA-encrypted initiator password string)
  - `MPESA_B2C_COMMAND_ID=BusinessPayment`
  - `MPESA_B2C_RESULT_URL=https://skiespro-api-njuw.onrender.com/api/v1/payments/mpesa/b2c/result?token=<MPESA_CALLBACK_TOKEN>`
  - `MPESA_B2C_TIMEOUT_URL=https://skiespro-api-njuw.onrender.com/api/v1/payments/mpesa/b2c/timeout?token=<MPESA_CALLBACK_TOKEN>`
    > **Callback URLs must always be the Render backend URL, not the Vercel frontend URL.** Daraja POSTs to your server; Vercel serves static React and cannot receive webhooks. The `?token=` query param MUST be appended — it's the only auth on the callback endpoint (validated against `process.env.MPESA_CALLBACK_TOKEN`).

---

## MPESA_CALLBACK_TOKEN (Shared Secret)
- **Purpose**: Static value generated once, used as the primary authentication token on inbound Safaricom callbacks (STK deposit callback, B2C result callback, B2C timeout callback).
- **Location**: Render environment variables + local `.env`.
- **Usage**: Appended as `?token=<value>` to every callback URL registered with Daraja.
- **Validation**: `PaymentController.handleMpesaCallback` validates `req.query.token === process.env.MPESA_CALLBACK_TOKEN`. Slice 4 adds the same validation to B2C callbacks.
- **Launch Hardening Note**: The same token value is reused across all three webhook types for simplicity. For post-launch hardening, split into separate tokens per webhook type so a leak of one doesn't compromise others.

---

## Render Operational Note (Slice 4 Testing)
- **Render Free Tier Sleep Warning**: Render free-tier web services spin down after 15 minutes of inactivity. If the backend is asleep when Safaricom POSTs a B2C callback, the callback fails silently and the withdrawal remains stuck in `dispatched` state (Slice 4 reconciliation job will eventually catch it, but it is slow and noisy).
- **Recommended Actions before Slice 4 E2E Testing**:
  - **Option A**: Upgrade to a paid Render tier (recommended for production).
  - **Option B**: Configure a keepalive ping every 10 minutes (e.g., UptimeRobot hitting `/health`).
  - **Option C**: Use `ngrok` against the local backend for testing (URLs change per session).

---

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

---

## Slice 4: Callback Handler (Result + Timeout) & Wallet Finalization
- **Live Callback URLs**: `MPESA_B2C_RESULT_URL` and `MPESA_B2C_TIMEOUT_URL` in Render must point to:
  - `https://skiespro-api-njuw.onrender.com/api/v1/payments/mpesa/b2c/result?token=<MPESA_CALLBACK_TOKEN>`
  - `https://skiespro-api-njuw.onrender.com/api/v1/payments/mpesa/b2c/timeout?token=<MPESA_CALLBACK_TOKEN>`
  - Confirm no `vercel.app` domain in either URL.
- **Post-Slice 4 Manual E2E Testing Protocol**:
  1. Ensure all `MPESA_B2C_*` env vars are populated in Render with active sandbox credentials from Daraja portal.
  2. Confirm Render backend is active (not sleeping).
  3. Set `ENABLE_B2C_WORKER=true` and `ENABLE_B2C_DISBURSEMENT=true` temporarily in Render.
  4. Initiate a withdrawal (e.g. 1500 KES) to a valid sandbox M-Pesa phone.
  5. Approve via Admin UI. Verify: withdrawal status $\rightarrow$ `dispatched`, outbox $\rightarrow$ `pending`.
  6. Worker claims outbox item $\rightarrow$ status $\rightarrow$ `sent`. Verify outbox `conversation_id` is set.
  7. Wait for Safaricom Daraja callback (5–30s). Verify: withdrawal status $\rightarrow$ `completed`, `gateway_reference` set, outbox `processed_at` populated.
  8. Verify user wallet: `balance` $-1500$, `locked_balance` $-1500$, debit ledger entry present.
  9. Immediately reset both flags back to `false` after testing until Slice 5 is ready.
