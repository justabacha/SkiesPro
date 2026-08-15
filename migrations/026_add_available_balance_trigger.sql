-- Migration 026: Add available_balance trigger and fix ledger schema
-- As per WP-06 §1 and DDS §5.9-5.10

-- 1. Update wallet.wallets
ALTER TABLE wallet.wallets ADD COLUMN IF NOT EXISTS available_balance NUMERIC(16,4) NOT NULL DEFAULT 0.0000;
ALTER TABLE wallet.wallets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Function to maintain available_balance = balance - locked_balance
CREATE OR REPLACE FUNCTION wallet.sync_available_balance()
RETURNS TRIGGER AS $$
BEGIN
  NEW.available_balance := NEW.balance - NEW.locked_balance;

  -- Critical invariant: available balance must never be negative
  IF NEW.available_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient available balance: balance (%) - locked (%) = %', NEW.balance, NEW.locked_balance, NEW.available_balance;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to execute before every insert or update on wallets
DROP TRIGGER IF EXISTS wallet_sync_available_balance_trg ON wallet.wallets;
CREATE TRIGGER wallet_sync_available_balance_trg
BEFORE INSERT OR UPDATE ON wallet.wallets
FOR EACH ROW
EXECUTE FUNCTION wallet.sync_available_balance();

-- Backfill existing rows to ensure they satisfy the constraint
UPDATE wallet.wallets SET updated_at = NOW();

-- Add physical CHECK constraint for defense-in-depth
ALTER TABLE wallet.wallets DROP CONSTRAINT IF EXISTS wallet_available_balance_non_negative;
ALTER TABLE wallet.wallets ADD CONSTRAINT wallet_available_balance_non_negative CHECK (available_balance >= 0);

-- 2. Update wallet.ledger_entries to match DDS §5.10
ALTER TABLE wallet.ledger_entries ADD COLUMN IF NOT EXISTS balance_before NUMERIC(16,4) NOT NULL DEFAULT 0.0000;

-- Expand reference_type ENUM values
ALTER TABLE wallet.ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_reference_type_check;
ALTER TABLE wallet.ledger_entries ADD CONSTRAINT ledger_entries_reference_type_check
CHECK (reference_type IN (
  'deposit',
  'withdrawal',
  'trade_stake',
  'trade_win',
  'trade_loss',
  'trade_draw',
  'fee',
  'referral_bonus',
  'admin_adjustment',
  'platform_revenue'
));

-- 3. Grant permissions to app_wallet role (if it exists, otherwise owner handles it)
-- Note: Permissions usually handled in deployment scripts, but documenting here
-- GRANT SELECT, INSERT ON wallet.ledger_entries TO app_wallet;
-- REVOKE UPDATE, DELETE ON wallet.ledger_entries FROM app_wallet;
