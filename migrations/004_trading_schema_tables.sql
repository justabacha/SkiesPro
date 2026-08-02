-- Migration 004: Trading schema tables
-- Creates tables for trading operations as per DDS §5.12-5.15

-- trading.assets
CREATE TABLE IF NOT EXISTS trading.assets (
  symbol VARCHAR(20) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  asset_type VARCHAR(20) NOT NULL CHECK (asset_type IN ('forex','commodity','crypto','index')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- trading.binary_contracts
CREATE TABLE IF NOT EXISTS trading.binary_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  asset_symbol VARCHAR(20) NOT NULL,
  stake_amount NUMERIC(16,4) NOT NULL CHECK (stake_amount > 0),
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('call','put')),
  entry_price NUMERIC(12,6) NOT NULL CHECK (entry_price > 0),
  expiry_price NUMERIC(12,6),
  strike_price NUMERIC(12,6) NOT NULL CHECK (strike_price > 0),
  payout_ratio NUMERIC(4,2) NOT NULL CHECK (payout_ratio > 0),
  potential_payout NUMERIC(16,4) NOT NULL CHECK (potential_payout > 0),
  entry_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expiry_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','settling','won','lost','draw','cancelled')),
  settlement_reason VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT trading_binary_contracts_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_auth.users(id) ON DELETE RESTRICT,
  CONSTRAINT trading_binary_contracts_asset_symbol_fkey FOREIGN KEY (asset_symbol) REFERENCES trading.assets(symbol)
);

-- trading.contract_events
CREATE TABLE IF NOT EXISTS trading.contract_events (
  id BIGSERIAL PRIMARY KEY,
  contract_id UUID NOT NULL,
  event_type VARCHAR(30) NOT NULL CHECK (event_type IN ('created','price_update','extended','settled','cancelled')),
  event_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT trading_contract_events_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES trading.binary_contracts(id) ON DELETE CASCADE
);

-- trading.asset_config
CREATE TABLE IF NOT EXISTS trading.asset_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_symbol VARCHAR(20) NOT NULL,
  min_stake NUMERIC(16,4) NOT NULL CHECK (min_stake > 0),
  max_stake NUMERIC(16,4) NOT NULL CHECK (max_stake > 0),
  min_duration_seconds INTEGER NOT NULL CHECK (min_duration_seconds > 0),
  max_duration_seconds INTEGER NOT NULL CHECK (max_duration_seconds > 0),
  payout_ratio NUMERIC(4,2) NOT NULL CHECK (payout_ratio > 0),
  is_tradable BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT trading_asset_config_asset_symbol_fkey FOREIGN KEY (asset_symbol) REFERENCES trading.assets(symbol) ON DELETE CASCADE,
  CONSTRAINT trading_asset_config_asset_symbol_unique UNIQUE (asset_symbol)
);

-- Indexes for trading schema
CREATE INDEX IF NOT EXISTS trading_contracts_user_id_idx ON trading.binary_contracts(user_id);
CREATE INDEX IF NOT EXISTS trading_contracts_asset_symbol_idx ON trading.binary_contracts(asset_symbol);
CREATE INDEX IF NOT EXISTS trading_contracts_expiry_idx ON trading.binary_contracts(expiry_time) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS trading_contracts_status_idx ON trading.binary_contracts(status);
CREATE INDEX IF NOT EXISTS trading_contracts_entry_time_idx ON trading.binary_contracts(entry_time);
CREATE INDEX IF NOT EXISTS trading_contract_events_contract_id_idx ON trading.contract_events(contract_id);
