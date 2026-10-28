-- Migration 046: Track IntaSend batch IDs for B2C webhook correlation and reconciliation
ALTER TABLE payments.b2c_outbox
  ADD COLUMN IF NOT EXISTS gateway_tracking_id VARCHAR(255) NULL;

CREATE INDEX IF NOT EXISTS idx_b2c_outbox_gateway_tracking_id
  ON payments.b2c_outbox (gateway_tracking_id);
