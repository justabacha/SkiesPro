-- Migration 029: Add missing crypto assets
-- Adds BTC/USD and ETH/USD to trading.assets to match price feed mapping

INSERT INTO trading.assets (symbol, name, asset_type, is_active) VALUES
('BTC/USD', 'Bitcoin/US Dollar', 'crypto', TRUE),
('ETH/USD', 'Ethereum/US Dollar', 'crypto', TRUE)
ON CONFLICT (symbol) DO NOTHING;

INSERT INTO trading.asset_config (asset_symbol, min_stake, max_stake_per_trade, min_duration_seconds, max_duration_seconds, payout_rate, is_active)
VALUES
('BTC/USD', 500.00, 500000.00, 30, 3600, 0.60, TRUE),
('ETH/USD', 500.00, 500000.00, 30, 3600, 0.60, TRUE)
ON CONFLICT (asset_symbol) DO NOTHING;

INSERT INTO pricing.market_hours (asset_symbol, opens_at, closes_at, timezone, is_24_7)
VALUES
('BTC/USD', '00:00:00', '23:59:59', 'UTC', TRUE),
('ETH/USD', '00:00:00', '23:59:59', 'UTC', TRUE)
ON CONFLICT (asset_symbol) DO NOTHING;
