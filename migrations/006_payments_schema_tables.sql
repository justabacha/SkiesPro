-- Migration 006: Payments schema tables
-- FIXED: Create parent tables BEFORE child tables that reference them

-- 1. Create payment_gateways FIRST (no dependencies)
CREATE TABLE IF NOT EXISTS payments.payment_gateways (
  id SMALLSERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  provider_type VARCHAR(30) NOT NULL CHECK (provider_type IN ('mobile_money','card','crypto','bank_transfer')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create idempotency_keys (no dependencies)
CREATE TABLE IF NOT EXISTS payments.idempotency_keys (
  key VARCHAR(255) PRIMARY KEY,
  response JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create deposits (depends on payment_gateways and idempotency_keys)
CREATE TABLE IF NOT EXISTS payments.deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  gateway_id SMALLINT NOT NULL,
  gateway_reference VARCHAR(255) NOT NULL,
  amount NUMERIC(16,4) NOT NULL CHECK (amount > 0),
  fee NUMERIC(16,4) NOT NULL DEFAULT 0.0000 CHECK (fee >= 0),
  net_amount NUMERIC(16,4) NOT NULL CHECK (net_amount = amount - fee),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','refunded')),
  webhook_payload JSONB,
  idempotency_key VARCHAR(255) NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payments_deposits_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_auth.users(id) ON DELETE RESTRICT,
  CONSTRAINT payments_deposits_gateway_id_fkey FOREIGN KEY (gateway_id) REFERENCES payments.payment_gateways(id),
  CONSTRAINT payments_deposits_gateway_reference_unique UNIQUE (gateway_reference),
  CONSTRAINT payments_deposits_idempotency_key_fkey FOREIGN KEY (idempotency_key) REFERENCES payments.idempotency_keys(key)
);

-- 4. Create withdrawals (depends on payment_gateways and idempotency_keys)
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

-- 5. Create payment_webhook_logs (depends on payment_gateways)
CREATE TABLE IF NOT EXISTS payments.payment_webhook_logs (
  id BIGSERIAL PRIMARY KEY,
  gateway_id SMALLINT NOT NULL,
  headers JSONB NOT NULL,
  body JSONB NOT NULL,
  signature_valid BOOLEAN,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payments_payment_webhook_logs_gateway_id_fkey FOREIGN KEY (gateway_id) REFERENCES payments.payment_gateways(id)
);

-- Indexes for payments schema
CREATE INDEX IF NOT EXISTS deposits_user_id_idx ON payments.deposits(user_id);
CREATE INDEX IF NOT EXISTS deposits_gateway_reference_idx ON payments.deposits(gateway_reference);
CREATE INDEX IF NOT EXISTS deposits_status_idx ON payments.deposits(status);
CREATE INDEX IF NOT EXISTS withdrawals_user_id_idx ON payments.withdrawals(user_id);
CREATE INDEX IF NOT EXISTS withdrawals_status_idx ON payments.withdrawals(status);
CREATE INDEX IF NOT EXISTS withdrawals_reviewed_by_idx ON payments.withdrawals(reviewed_by) WHERE reviewed_by IS NOT NULL;