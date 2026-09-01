-- Migration 022: Rename misnamed columns to match DDS
-- Renames columns as per WP_02_INTEGRITY_REVIEW.md
-- This migration aligns column names with DDS specifications

-- ============================================================================
-- app_auth.users
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='app_auth' AND table_name='users' AND column_name='full_name') THEN
        ALTER TABLE app_auth.users RENAME COLUMN full_name TO display_name;
    END IF;
END $$;

-- ============================================================================
-- app_auth.permissions
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='app_auth' AND table_name='permissions' AND column_name='name') THEN
        ALTER TABLE app_auth.permissions RENAME COLUMN name TO code;
    END IF;
END $$;

-- ============================================================================
-- app_auth.user_roles
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='app_auth' AND table_name='user_roles' AND column_name='assigned_at') THEN
        ALTER TABLE app_auth.user_roles RENAME COLUMN assigned_at TO granted_at;
    END IF;
END $$;

-- ============================================================================
-- app_auth.mfa_tokens
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='app_auth' AND table_name='mfa_tokens' AND column_name='secret') THEN
        ALTER TABLE app_auth.mfa_tokens RENAME COLUMN secret TO secret_encrypted;
    END IF;
END $$;

-- ============================================================================
-- trading.binary_contracts
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='trading' AND table_name='binary_contracts' AND column_name='direction') THEN
        ALTER TABLE trading.binary_contracts RENAME COLUMN direction TO contract_type;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='trading' AND table_name='binary_contracts' AND column_name='stake_amount') THEN
        ALTER TABLE trading.binary_contracts RENAME COLUMN stake_amount TO stake;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='trading' AND table_name='binary_contracts' AND column_name='payout_ratio') THEN
        ALTER TABLE trading.binary_contracts RENAME COLUMN payout_ratio TO payout_rate;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='trading' AND table_name='binary_contracts' AND column_name='entry_time') THEN
        ALTER TABLE trading.binary_contracts RENAME COLUMN entry_time TO purchase_time;
    END IF;
END $$;

-- Update CHECK constraint to use new column name
DO $$
BEGIN
    ALTER TABLE trading.binary_contracts DROP CONSTRAINT IF EXISTS trading_binary_contracts_direction_check;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='trading' AND table_name='binary_contracts' AND column_name='contract_type') THEN
        ALTER TABLE trading.binary_contracts DROP CONSTRAINT IF EXISTS trading_binary_contracts_contract_type_check;
        ALTER TABLE trading.binary_contracts ADD CONSTRAINT trading_binary_contracts_contract_type_check CHECK (contract_type IN ('higher','lower'));
    END IF;

    ALTER TABLE trading.binary_contracts DROP CONSTRAINT IF EXISTS trading_binary_contracts_payout_ratio_check;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='trading' AND table_name='binary_contracts' AND column_name='payout_rate') THEN
        ALTER TABLE trading.binary_contracts DROP CONSTRAINT IF EXISTS trading_binary_contracts_payout_rate_check;
        ALTER TABLE trading.binary_contracts ADD CONSTRAINT trading_binary_contracts_payout_rate_check CHECK (payout_rate BETWEEN 0.60 AND 0.88);
    END IF;
END $$;

-- ============================================================================
-- trading.contract_events
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='trading' AND table_name='contract_events' AND column_name='event_data') THEN
        ALTER TABLE trading.contract_events RENAME COLUMN event_data TO details;
    END IF;
END $$;

-- ============================================================================
-- trading.asset_config
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='trading' AND table_name='asset_config' AND column_name='payout_ratio') THEN
        ALTER TABLE trading.asset_config RENAME COLUMN payout_ratio TO payout_rate;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='trading' AND table_name='asset_config' AND column_name='max_stake') THEN
        ALTER TABLE trading.asset_config RENAME COLUMN max_stake TO max_stake_per_trade;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='trading' AND table_name='asset_config' AND column_name='is_tradable') THEN
        ALTER TABLE trading.asset_config RENAME COLUMN is_tradable TO is_active;
    END IF;
END $$;

-- Update CHECK constraint to use new column name
DO $$
BEGIN
    ALTER TABLE trading.asset_config DROP CONSTRAINT IF EXISTS trading_asset_config_payout_ratio_check;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='trading' AND table_name='asset_config' AND column_name='payout_rate') THEN
        ALTER TABLE trading.asset_config DROP CONSTRAINT IF EXISTS trading_asset_config_payout_rate_check;
        ALTER TABLE trading.asset_config ADD CONSTRAINT trading_asset_config_payout_rate_check CHECK (payout_rate BETWEEN 0.60 AND 0.88);
    END IF;
END $$;

-- ============================================================================
-- pricing.price_ticks
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='pricing' AND table_name='price_ticks' AND column_name='bid_price') THEN
        ALTER TABLE pricing.price_ticks RENAME COLUMN bid_price TO bid;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='pricing' AND table_name='price_ticks' AND column_name='ask_price') THEN
        ALTER TABLE pricing.price_ticks RENAME COLUMN ask_price TO ask;
    END IF;
END $$;

-- ============================================================================
-- wallet.wallet_version_log - SPECIAL CASE
-- ============================================================================
ALTER TABLE wallet.wallet_version_log DROP COLUMN IF EXISTS old_balance;
ALTER TABLE wallet.wallet_version_log DROP COLUMN IF EXISTS new_balance;
ALTER TABLE wallet.wallet_version_log DROP COLUMN IF EXISTS old_locked_balance;
ALTER TABLE wallet.wallet_version_log DROP COLUMN IF EXISTS new_locked_balance;

-- ============================================================================
-- Update index names to reflect column renames
-- ============================================================================
DROP INDEX IF EXISTS trading.trading_contracts_entry_time_idx;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='trading' AND table_name='binary_contracts' AND column_name='purchase_time') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'trading_contracts_purchase_time_idx' AND n.nspname = 'trading') THEN
            CREATE INDEX trading_contracts_purchase_time_idx ON trading.binary_contracts(purchase_time);
        END IF;
    END IF;
END $$;
