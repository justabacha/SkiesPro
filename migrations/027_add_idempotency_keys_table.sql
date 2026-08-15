-- Migration 027: Ensure idempotency_keys table exists with nullable response
-- This fixes the missing relation error and supports two-phase idempotency locking

-- 1. Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS payments.idempotency_keys (
  key VARCHAR(255) PRIMARY KEY,
  response JSONB, -- Nullable to support request phase locking
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Ensure response is nullable (in case it was created with NOT NULL in migration 006)
ALTER TABLE payments.idempotency_keys ALTER COLUMN response DROP NOT NULL;
