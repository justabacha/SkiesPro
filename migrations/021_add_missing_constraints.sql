-- Migration 021: Add missing CHECK constraints, UNIQUE constraints, and indexes
-- Adds constraints and indexes as per WP_02_INTEGRITY_REVIEW.md
-- This migration completes the constraint and index requirements from DDS

-- ============================================================================
-- CHECK Constraints
-- ============================================================================

-- app_auth.users.mfa_type constraint (already has column, add CHECK)
ALTER TABLE app_auth.users DROP CONSTRAINT IF EXISTS app_auth_users_mfa_type_check;
ALTER TABLE app_auth.users ADD CONSTRAINT app_auth_users_mfa_type_check CHECK (mfa_type IN ('totp','sms') OR NULL);

-- app_auth.roles.name constraint
ALTER TABLE app_auth.roles DROP CONSTRAINT IF EXISTS app_auth_roles_name_check;
ALTER TABLE app_auth.roles ADD CONSTRAINT app_auth_roles_name_check CHECK (name IN ('trader','support','finance','risk_manager','compliance','admin','super_admin'));

-- wallet.wallets.available_balance constraint (computed in app, but add CHECK for safety)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='wallet' AND table_name='wallets' AND column_name='available_balance') THEN
        ALTER TABLE wallet.wallets ADD COLUMN available_balance NUMERIC(16,4) GENERATED ALWAYS AS (balance - locked_balance) STORED;
    END IF;
END $$;

ALTER TABLE wallet.wallets DROP CONSTRAINT IF EXISTS wallet_wallets_available_balance_check;
ALTER TABLE wallet.wallets ADD CONSTRAINT wallet_wallets_available_balance_check CHECK (available_balance >= 0);

-- trading.binary_contracts.contract_type constraint
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='trading' AND table_name='binary_contracts' AND column_name='contract_type') THEN
        ALTER TABLE trading.binary_contracts DROP CONSTRAINT IF EXISTS trading_binary_contracts_contract_type_check;
        ALTER TABLE trading.binary_contracts ADD CONSTRAINT trading_binary_contracts_contract_type_check CHECK (contract_type IN ('higher','lower'));
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='trading' AND table_name='binary_contracts' AND column_name='direction') THEN
        ALTER TABLE trading.binary_contracts DROP CONSTRAINT IF EXISTS trading_binary_contracts_direction_check;
        ALTER TABLE trading.binary_contracts ADD CONSTRAINT trading_binary_contracts_direction_check CHECK (direction IN ('higher','lower'));
    END IF;
END $$;

-- trading.binary_contracts.payout_rate constraint
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='trading' AND table_name='binary_contracts' AND column_name='payout_rate') THEN
        ALTER TABLE trading.binary_contracts DROP CONSTRAINT IF EXISTS trading_binary_contracts_payout_rate_check;
        ALTER TABLE trading.binary_contracts ADD CONSTRAINT trading_binary_contracts_payout_rate_check CHECK (payout_rate BETWEEN 0.60 AND 0.88);
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='trading' AND table_name='binary_contracts' AND column_name='payout_ratio') THEN
        ALTER TABLE trading.binary_contracts DROP CONSTRAINT IF EXISTS trading_binary_contracts_payout_ratio_check;
        ALTER TABLE trading.binary_contracts ADD CONSTRAINT trading_binary_contracts_payout_ratio_check CHECK (payout_ratio BETWEEN 0.60 AND 0.88);
    END IF;
END $$;

-- trading.binary_contracts.status constraint (update to match DDS)
ALTER TABLE trading.binary_contracts DROP CONSTRAINT IF EXISTS trading_binary_contracts_status_check;
ALTER TABLE trading.binary_contracts ADD CONSTRAINT trading_binary_contracts_status_check CHECK (status IN ('draft','active','settling','won','lost','draw','cancelled','archived'));

-- trading.contract_events.event_type constraint (update to match DDS)
ALTER TABLE trading.contract_events DROP CONSTRAINT IF EXISTS trading_contract_events_event_type_check;
ALTER TABLE trading.contract_events ADD CONSTRAINT trading_contract_events_event_type_check CHECK (event_type IN ('created','stake_locked','expired','settling_acquired','settled','won','lost','draw','cancelled','archived'));

-- trading.assets.asset_type constraint (add 'synthetic' to enum)
ALTER TABLE trading.assets DROP CONSTRAINT IF EXISTS trading_assets_asset_type_check;
ALTER TABLE trading.assets ADD CONSTRAINT trading_assets_asset_type_check CHECK (asset_type IN ('forex','commodity','index','synthetic','crypto'));

-- trading.asset_config.payout_rate constraint
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='trading' AND table_name='asset_config' AND column_name='payout_rate') THEN
        ALTER TABLE trading.asset_config DROP CONSTRAINT IF EXISTS trading_asset_config_payout_rate_check;
        ALTER TABLE trading.asset_config ADD CONSTRAINT trading_asset_config_payout_rate_check CHECK (payout_rate BETWEEN 0.60 AND 0.88);
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='trading' AND table_name='asset_config' AND column_name='payout_ratio') THEN
        ALTER TABLE trading.asset_config DROP CONSTRAINT IF EXISTS trading_asset_config_payout_ratio_check;
        ALTER TABLE trading.asset_config ADD CONSTRAINT trading_asset_config_payout_ratio_check CHECK (payout_ratio BETWEEN 0.60 AND 0.88);
    END IF;
END $$;

-- trading.asset_config.volatility_multiplier constraint
ALTER TABLE trading.asset_config DROP CONSTRAINT IF EXISTS trading_asset_config_volatility_multiplier_check;
ALTER TABLE trading.asset_config ADD CONSTRAINT trading_asset_config_volatility_multiplier_check CHECK (volatility_multiplier BETWEEN 0.50 AND 2.00);

-- pricing.candles.granularity_seconds constraint
ALTER TABLE pricing.candles DROP CONSTRAINT IF EXISTS pricing_candles_granularity_seconds_check;
ALTER TABLE pricing.candles ADD CONSTRAINT pricing_candles_granularity_seconds_check CHECK (granularity_seconds IN (60, 300, 900, 3600, 86400));

-- ============================================================================
-- UNIQUE Constraints
-- ============================================================================

-- app_auth.sessions.access_token_jti UNIQUE (column added in 019, constraint already there)
-- No action needed - UNIQUE constraint was added with column in migration 019

-- wallet.ledger_entries.transaction_id UNIQUE (composite with wallet_id)
-- Note: This is a composite unique constraint on (wallet_id, transaction_id)
ALTER TABLE wallet.ledger_entries DROP CONSTRAINT IF EXISTS wallet_ledger_entries_wallet_transaction_unique;
ALTER TABLE wallet.ledger_entries ADD CONSTRAINT wallet_ledger_entries_wallet_transaction_unique UNIQUE (wallet_id, transaction_id);

-- ============================================================================
-- Indexes
-- ============================================================================

-- app_auth_users_status_idx on status
CREATE INDEX IF NOT EXISTS app_auth_users_status_idx ON app_auth.users(status);

-- app_auth_sessions_access_token_jti_idx UNIQUE on access_token_jti
-- Already created as UNIQUE constraint in migration 019, no separate index needed

-- app_auth_sessions_expires_idx on refresh_token_expires_at
CREATE INDEX IF NOT EXISTS app_auth_sessions_expires_idx ON app_auth.sessions(refresh_token_expires_at);

-- ledger_transaction_id_idx UNIQUE on transaction_id
-- Note: We have composite unique on (wallet_id, transaction_id), add single index for queries
CREATE INDEX IF NOT EXISTS ledger_transaction_id_idx ON wallet.ledger_entries(transaction_id);

-- trading_contracts_asset_expiry_idx on (asset_symbol, expiry_time)
CREATE INDEX IF NOT EXISTS trading_contracts_asset_expiry_idx ON trading.binary_contracts(asset_symbol, expiry_time);

-- trading_contracts_purchase_idx on purchase_time
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='trading' AND table_name='binary_contracts' AND column_name='purchase_time') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'trading_contracts_purchase_time_idx' AND n.nspname = 'trading') THEN
            CREATE INDEX trading_contracts_purchase_time_idx ON trading.binary_contracts(purchase_time);
        END IF;
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='trading' AND table_name='binary_contracts' AND column_name='entry_time') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'trading_contracts_entry_time_idx' AND n.nspname = 'trading') THEN
            CREATE INDEX trading_contracts_entry_time_idx ON trading.binary_contracts(entry_time);
        END IF;
    END IF;
END $$;

-- candles_time_idx on close_time
CREATE INDEX IF NOT EXISTS candles_time_idx ON pricing.candles(close_time);
