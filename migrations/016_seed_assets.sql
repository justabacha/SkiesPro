-- Migration 016: Seed assets
-- Seeds default trading assets as per ProjectAnswers.md

-- Insert assets
INSERT INTO trading.assets (symbol, name, asset_type, is_active) VALUES
('EUR/USD', 'Euro/US Dollar', 'forex', TRUE),
('GBP/USD', 'British Pound/US Dollar', 'forex', TRUE),
('USD/JPY', 'US Dollar/Japanese Yen', 'forex', TRUE),
('XAU/USD', 'Gold', 'commodity', TRUE),
('WTI/USD', 'Crude Oil', 'commodity', TRUE)
ON CONFLICT (symbol) DO NOTHING;

-- Insert asset configurations (values from ProjectAnswers.md)
INSERT INTO trading.asset_config (asset_symbol, min_stake, max_stake, min_duration_seconds, max_duration_seconds, payout_ratio, is_tradable)
VALUES
('EUR/USD', 500.00, 500000.00, 30, 3600, 0.85, TRUE),
('GBP/USD', 500.00, 500000.00, 30, 3600, 0.85, TRUE),
('USD/JPY', 500.00, 500000.00, 30, 3600, 0.85, TRUE),
('XAU/USD', 500.00, 500000.00, 30, 3600, 0.85, TRUE),
('WTI/USD', 500.00, 500000.00, 30, 3600, 0.85, TRUE)
ON CONFLICT (asset_symbol) DO NOTHING;

-- Insert market hours (assuming 24/7 for forex, specific hours for commodities)
INSERT INTO pricing.market_hours (asset_symbol, opens_at, closes_at, timezone, is_24_7)
VALUES
('EUR/USD', '00:00:00', '23:59:59', 'UTC', TRUE),
('GBP/USD', '00:00:00', '23:59:59', 'UTC', TRUE),
('USD/JPY', '00:00:00', '23:59:59', 'UTC', TRUE),
('XAU/USD', '01:00:00', '23:59:59', 'UTC', FALSE),
('WTI/USD', '01:00:00', '23:59:59', 'UTC', FALSE)
ON CONFLICT (asset_symbol) DO NOTHING;
