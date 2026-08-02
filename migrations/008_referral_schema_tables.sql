-- Migration 008: Referral schema tables
-- Creates tables for referral system as per DDS §5.27-5.29

-- referral.referral_codes
CREATE TABLE IF NOT EXISTS referral.referral_codes (
  code VARCHAR(20) PRIMARY KEY,
  owner_id UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  max_uses INTEGER,
  use_count INTEGER NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT referral_referral_codes_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES app_auth.users(id) ON DELETE RESTRICT,
  CONSTRAINT referral_referral_codes_owner_id_unique UNIQUE (owner_id)
);

-- referral.referrals
CREATE TABLE IF NOT EXISTS referral.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referred_user_id UUID NOT NULL,
  referrer_id UUID NOT NULL,
  referral_code VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
  commission_percentage NUMERIC(4,2) NOT NULL DEFAULT 10.00,
  total_commission_earned NUMERIC(16,4) NOT NULL DEFAULT 0.0000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT referral_referrals_referred_user_id_fkey FOREIGN KEY (referred_user_id) REFERENCES app_auth.users(id) ON DELETE RESTRICT,
  CONSTRAINT referral_referrals_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES app_auth.users(id) ON DELETE RESTRICT,
  CONSTRAINT referral_referrals_referral_code_fkey FOREIGN KEY (referral_code) REFERENCES referral.referral_codes(code),
  CONSTRAINT referral_referrals_referred_user_id_unique UNIQUE (referred_user_id)
);

-- referral.referral_commissions
CREATE TABLE IF NOT EXISTS referral.referral_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL,
  source_contract_id UUID NOT NULL,
  commission_amount NUMERIC(16,4) NOT NULL CHECK (commission_amount > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')),
  paid_at TIMESTAMPTZ,
  payout_tx_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT referral_referral_commissions_referral_id_fkey FOREIGN KEY (referral_id) REFERENCES referral.referrals(id) ON DELETE RESTRICT,
  CONSTRAINT referral_referral_commissions_source_contract_id_fkey FOREIGN KEY (source_contract_id) REFERENCES trading.binary_contracts(id),
  CONSTRAINT referral_referral_commissions_payout_tx_id_fkey FOREIGN KEY (payout_tx_id) REFERENCES wallet.ledger_entries(id)
);

-- Indexes for referral schema
CREATE INDEX IF NOT EXISTS referrals_referrer_id_idx ON referral.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS referral_commissions_referral_id_idx ON referral.referral_commissions(referral_id);
