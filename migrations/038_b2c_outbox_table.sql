-- Migration 038: M-Pesa B2C Payout Outbox Table
-- Description: Creates the payments.b2c_outbox table and indexes for reliable async disbursement processing.

CREATE TABLE IF NOT EXISTS payments.b2c_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_id UUID NOT NULL REFERENCES payments.withdrawals(id) ON DELETE RESTRICT,
  originator_conversation_id VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','sent','failed','dead')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  conversation_id VARCHAR(255),
  payload JSONB NOT NULL,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS b2c_outbox_claim_idx
  ON payments.b2c_outbox (next_attempt_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS b2c_outbox_processing_idx
  ON payments.b2c_outbox (updated_at)
  WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS b2c_outbox_withdrawal_idx
  ON payments.b2c_outbox (withdrawal_id);
