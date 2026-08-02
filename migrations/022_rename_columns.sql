-- Migration 022: Rename misnamed columns to match DDS
-- Renames columns as per WP_02_INTEGRITY_REVIEW.md
-- This migration aligns column names with DDS specifications

-- ============================================================================
-- app_auth.users
-- ============================================================================
-- Rename full_name to display_name
ALTER TABLE app_auth.users RENAME COLUMN full_name TO display_name;

-- ============================================================================
-- app_auth.permissions
-- ============================================================================
-- Rename name to code
ALTER TABLE app_auth.permissions RENAME COLUMN name TO code;

-- ============================================================================
-- app_auth.user_roles
-- ============================================================================
-- Rename assigned_at to granted_at
ALTER TABLE app_auth.user_roles RENAME COLUMN assigned_at TO granted_at;

-- ============================================================================
-- app_auth.mfa_tokens
-- ============================================================================
-- Rename secret to secret_encrypted
ALTER TABLE app_auth.mfa_tokens RENAME COLUMN secret TO secret_encrypted;

-- ============================================================================
-- trading.binary_contracts
-- ============================================================================
-- Rename direction to contract_type
ALTER TABLE trading.binary_contracts RENAME COLUMN direction TO contract_type;

-- Rename stake_amount to stake
ALTER TABLE trading.binary_contracts RENAME COLUMN stake_amount TO stake;

-- Rename payout_ratio to payout_rate
ALTER TABLE trading.binary_contracts RENAME COLUMN payout_ratio TO payout_rate;

-- Rename entry_time to purchase_time
ALTER TABLE trading.binary_contracts RENAME COLUMN entry_time TO purchase_time;

-- Update CHECK constraint to use new column name
ALTER TABLE trading.binary_contracts DROP CONSTRAINT IF EXISTS trading_binary_contracts_direction_check;
ALTER TABLE trading.binary_contracts ADD CONSTRAINT trading_binary_contracts_contract_type_check CHECK (contract_type IN ('higher','lower'));

-- Update CHECK constraint to use new column name
ALTER TABLE trading.binary_contracts DROP CONSTRAINT IF EXISTS trading_binary_contracts_payout_ratio_check;
ALTER TABLE trading.binary_contracts ADD CONSTRAINT trading_binary_contracts_payout_rate_check CHECK (payout_rate BETWEEN 0.65 AND 0.88);

-- ============================================================================
-- trading.contract_events
-- ============================================================================
-- Rename event_data to details
ALTER TABLE trading.contract_events RENAME COLUMN event_data TO details;

-- ============================================================================
-- trading.asset_config
-- ============================================================================
-- Rename payout_ratio to payout_rate
ALTER TABLE trading.asset_config RENAME COLUMN payout_ratio TO payout_rate;

-- Update CHECK constraint to use new column name
ALTER TABLE trading.asset_config DROP CONSTRAINT IF EXISTS trading_asset_config_payout_ratio_check;
ALTER TABLE trading.asset_config ADD CONSTRAINT trading_asset_config_payout_rate_check CHECK (payout_rate BETWEEN 0.65 AND 0.88);

-- Rename max_stake to max_stake_per_trade
ALTER TABLE trading.asset_config RENAME COLUMN max_stake TO max_stake_per_trade;

-- Rename is_tradable to is_active
ALTER TABLE trading.asset_config RENAME COLUMN is_tradable TO is_active;

-- ============================================================================
-- pricing.price_ticks
-- ============================================================================
-- Rename bid_price to bid
ALTER TABLE pricing.price_ticks RENAME COLUMN bid_price TO bid;

-- Rename ask_price to ask
ALTER TABLE pricing.price_ticks RENAME COLUMN ask_price TO ask;

-- ============================================================================
-- wallet.wallet_version_log - SPECIAL CASE
-- ============================================================================
-- RISKY SECTION: The original columns (old_balance, new_balance, old_locked_balance, new_locked_balance)
-- are semantically incorrect - they store balance data, not version data.
-- 
-- Correct columns (version_before, version_after, changed_by) were added in migration 019.
-- 
-- Since the old columns contain balance data (NUMERIC) and the new columns expect version data (INTEGER),
-- we cannot migrate the data. The old columns are fundamentally wrong and should be dropped.
-- 
-- If the table is empty (no data), it's safe to drop the old columns.
-- If the table has data, the owner should verify if the old columns actually contain version integers
-- before proceeding. For MVP with no production data, we proceed with dropping.

-- Drop the semantically incorrect columns
ALTER TABLE wallet.wallet_version_log DROP COLUMN IF EXISTS old_balance;
ALTER TABLE wallet.wallet_version_log DROP COLUMN IF EXISTS new_balance;
ALTER TABLE wallet.wallet_version_log DROP COLUMN IF EXISTS old_locked_balance;
ALTER TABLE wallet.wallet_version_log DROP COLUMN IF EXISTS new_locked_balance;

-- ============================================================================
-- Update index names to reflect column renames
-- ============================================================================

-- trading_contracts_entry_time_idx → trading_contracts_purchase_time_idx
DROP INDEX IF EXISTS trading_contracts_entry_time_idx;
CREATE INDEX IF NOT EXISTS trading_contracts_purchase_time_idx ON trading.binary_contracts(purchase_time);
