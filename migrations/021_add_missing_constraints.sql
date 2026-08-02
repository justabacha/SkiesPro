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
ALTER TABLE app_auth.roles ADD CONSTRAINT app_auth_roles_name_check CHECK (name IN ('trader','support','finance','risk_manager','compliance','admin','super_admin'));

-- wallet.wallets.available_balance constraint (computed in app, but add CHECK for safety)
ALTER TABLE wallet.wallets ADD COLUMN IF NOT EXISTS available_balance NUMERIC(16,4) GENERATED ALWAYS AS (balance - locked_balance) STORED;
ALTER TABLE wallet.wallets ADD CONSTRAINT wallet_wallets_available_balance_check CHECK (available_balance >= 0);

-- trading.binary_contracts.contract_type constraint (column will be renamed in 022, add constraint for now)
-- Note: direction column exists, will be renamed to contract_type in migration 022
ALTER TABLE trading.binary_contracts ADD CONSTRAINT trading_binary_contracts_direction_check CHECK (direction IN ('higher','lower'));

-- trading.binary_contracts.payout_rate constraint (column is payout_ratio, will be renamed in 022)
ALTER TABLE trading.binary_contracts ADD CONSTRAINT trading_binary_contracts_payout_ratio_check CHECK (payout_ratio BETWEEN 0.65 AND 0.88);

-- trading.binary_contracts.status constraint (update to match DDS)
ALTER TABLE trading.binary_contracts DROP CONSTRAINT IF EXISTS trading_binary_contracts_status_check;
ALTER TABLE trading.binary_contracts ADD CONSTRAINT trading_binary_contracts_status_check CHECK (status IN ('draft','active','settling','won','lost','draw','cancelled','archived'));

-- trading.contract_events.event_type constraint (update to match DDS)
ALTER TABLE trading.contract_events DROP CONSTRAINT IF EXISTS trading_contract_events_event_type_check;
ALTER TABLE trading.contract_events ADD CONSTRAINT trading_contract_events_event_type_check CHECK (event_type IN ('created','stake_locked','expired','settling_acquired','settled','won','lost','draw','cancelled','archived'));

-- trading.assets.asset_type constraint (add 'synthetic' to enum)
ALTER TABLE trading.assets DROP CONSTRAINT IF EXISTS trading_assets_asset_type_check;
ALTER TABLE trading.assets ADD CONSTRAINT trading_assets_asset_type_check CHECK (asset_type IN ('forex','commodity','index','synthetic','crypto'));

-- trading.asset_config.payout_rate constraint (column is payout_ratio, will be renamed in 022)
ALTER TABLE trading.asset_config ADD CONSTRAINT trading_asset_config_payout_ratio_check CHECK (payout_ratio BETWEEN 0.65 AND 0.88);

-- trading.asset_config.volatility_multiplier constraint
ALTER TABLE trading.asset_config ADD CONSTRAINT trading_asset_config_volatility_multiplier_check CHECK (volatility_multiplier BETWEEN 0.50 AND 2.00);

-- pricing.candles.granularity_seconds constraint
ALTER TABLE pricing.candles ADD CONSTRAINT pricing_candles_granularity_seconds_check CHECK (granularity_seconds IN (60, 300, 900, 3600, 86400));

-- ============================================================================
-- UNIQUE Constraints
-- ============================================================================

-- app_auth.sessions.access_token_jti UNIQUE (column added in 019, constraint already there)
-- No action needed - UNIQUE constraint was added with column in migration 019

-- wallet.ledger_entries.transaction_id UNIQUE (composite with wallet_id)
-- Note: This is a composite unique constraint on (wallet_id, transaction_id)
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

-- trading_contracts_purchase_idx on purchase_time (column is entry_time, will be renamed in 022)
CREATE INDEX IF NOT EXISTS trading_contracts_entry_time_idx ON trading.binary_contracts(entry_time);

-- candles_time_idx on close_time
CREATE INDEX IF NOT EXISTS candles_time_idx ON pricing.candles(close_time);
