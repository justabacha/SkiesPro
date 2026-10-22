-- Migration 039: B2C Outbox Ops Recovery and Reconciliation Columns
ALTER TABLE payments.b2c_outbox
  ADD COLUMN IF NOT EXISTS needs_manual_review BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_review_reason TEXT,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS b2c_outbox_review_idx
  ON payments.b2c_outbox (updated_at)
  WHERE needs_manual_review = true;
