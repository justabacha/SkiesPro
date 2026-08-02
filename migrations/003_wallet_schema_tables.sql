-- Migration 003: Wallet schema tables
-- Creates tables for wallet and ledger as per DDS §5.9-5.11

-- wallet.wallets
CREATE TABLE IF NOT EXISTS wallet.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  balance NUMERIC(16,4) NOT NULL DEFAULT 0.0000 CHECK (balance >= 0),
  locked_balance NUMERIC(16,4) NOT NULL DEFAULT 0.0000 CHECK (locked_balance >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'KES',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT wallet_wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_auth.users(id) ON DELETE RESTRICT,
  CONSTRAINT wallet_wallets_user_id_unique UNIQUE (user_id)
);

-- wallet.ledger_entries
CREATE TABLE IF NOT EXISTS wallet.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL,
  wallet_id UUID NOT NULL,
  entry_type VARCHAR(20) NOT NULL CHECK (entry_type IN ('credit','debit')),
  amount NUMERIC(16,4) NOT NULL CHECK (amount > 0),
  balance_after NUMERIC(16,4) NOT NULL,
  reference_type VARCHAR(50) NOT NULL CHECK (reference_type IN ('deposit','withdrawal','trade_stake','trade_payout','referral_commission','admin_adjustment')),
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT wallet_ledger_entries_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES wallet.wallets(id) ON DELETE RESTRICT
);

-- wallet.wallet_version_log
CREATE TABLE IF NOT EXISTS wallet.wallet_version_log (
  id BIGSERIAL PRIMARY KEY,
  wallet_id UUID NOT NULL,
  old_balance NUMERIC(16,4) NOT NULL,
  new_balance NUMERIC(16,4) NOT NULL,
  old_locked_balance NUMERIC(16,4) NOT NULL,
  new_locked_balance NUMERIC(16,4) NOT NULL,
  version INTEGER NOT NULL,
  change_reason VARCHAR(50) NOT NULL,
  changed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT wallet_wallet_version_log_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES wallet.wallets(id) ON DELETE CASCADE
);

-- Indexes for wallet schema
CREATE INDEX IF NOT EXISTS ledger_wallet_id_created_idx ON wallet.ledger_entries(wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ledger_transaction_id_idx ON wallet.ledger_entries(transaction_id);
CREATE INDEX IF NOT EXISTS wallet_version_log_wallet_id_idx ON wallet.wallet_version_log(wallet_id);
