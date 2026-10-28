-- Migration 047: Add 'needs_review' status for ambiguous payout outcomes
-- When a B2C dispatch may have reached IntaSend but the response was lost,
-- the row is marked 'needs_review' to prevent auto-retry (which could double-pay).
-- 'needs_review' is terminal until an admin manually resolves via:
--   - status = 'sent'   (payout confirmed, finalize debit)
--   - status = 'failed' (payout confirmed failed, unlock funds)
--   - status = 'pending' (confirmed not sent, safe to retry)
-- Reconciliation and worker do NOT auto-process 'needs_review' rows.

ALTER TABLE payments.b2c_outbox
  DROP CONSTRAINT IF EXISTS b2c_outbox_status_check;

ALTER TABLE payments.b2c_outbox
  ADD CONSTRAINT b2c_outbox_status_check
  CHECK (status IN ('pending','processing','sent','failed','dead','needs_review'));
