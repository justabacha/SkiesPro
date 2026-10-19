# B2C DISBURSEMENT MANUAL OPERATIONAL TASKS

This document tracks required manual actions, environment variable additions, and database migrations per B2C slice.

---

## Slice 1: Interface, Daraja Adapter, Factory, Config
- **Environment Variables (Render & Local `.env`)**:
  - `ENABLE_B2C_DISBURSEMENT=false` (Keep false until Slice 4 E2E verification)
  - `ENABLE_B2C_WORKER=false` (Keep false until Slice 4 E2E verification)
  - `MPESA_B2C_SHORTCODE=` (Safaricom B2C shortcode, e.g. `600980` in sandbox)
  - `MPESA_B2C_INITIATOR_NAME=` (e.g. `testapi` in sandbox)
  - `MPESA_B2C_SECURITY_CREDENTIAL=` (RSA-encrypted initiator password string)
  - `MPESA_B2C_COMMAND_ID=BusinessPayment`
  - `MPESA_B2C_RESULT_URL=https://<your-domain>/api/v1/payments/mpesa/b2c/result`
  - `MPESA_B2C_TIMEOUT_URL=https://<your-domain>/api/v1/payments/mpesa/b2c/timeout`

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
  - Keep `ENABLE_B2C_WORKER=false` in Render and local `.env` until Slice 4 callback handlers are ready to receive responses.
  - Keep `ENABLE_B2C_DISBURSEMENT=false` until Slice 4.
