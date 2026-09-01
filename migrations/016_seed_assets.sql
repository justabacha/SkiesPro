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
DO $$
DECLARE
    payout_col TEXT;
    max_stake_col TEXT;
    active_col TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='trading' AND table_name='asset_config' AND column_name='payout_rate') THEN
        payout_col := 'payout_rate';
    ELSE
        payout_col := 'payout_ratio';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='trading' AND table_name='asset_config' AND column_name='max_stake_per_trade') THEN
        max_stake_col := 'max_stake_per_trade';
    ELSE
        max_stake_col := 'max_stake';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='trading' AND table_name='asset_config' AND column_name='is_active') THEN
        active_col := 'is_active';
    ELSE
        active_col := 'is_tradable';
    END IF;

    EXECUTE format('
    INSERT INTO trading.asset_config (asset_symbol, min_stake, %I, min_duration_seconds, max_duration_seconds, %I, %I)
    VALUES
    (''EUR/USD'', 500.00, 500000.00, 30, 3600, 0.60, TRUE),
    (''GBP/USD'', 500.00, 500000.00, 30, 3600, 0.60, TRUE),
    (''USD/JPY'', 500.00, 500000.00, 30, 3600, 0.60, TRUE),
    (''XAU/USD'', 500.00, 500000.00, 30, 3600, 0.60, TRUE),
    (''WTI/USD'', 500.00, 500000.00, 30, 3600, 0.60, TRUE)
    ON CONFLICT (asset_symbol) DO NOTHING', max_stake_col, payout_col, active_col);
END $$;

-- Insert market hours (assuming 24/7 for forex, specific hours for commodities)
INSERT INTO pricing.market_hours (asset_symbol, opens_at, closes_at, timezone, is_24_7)
VALUES
('EUR/USD', '00:00:00', '23:59:59', 'UTC', TRUE),
('GBP/USD', '00:00:00', '23:59:59', 'UTC', TRUE),
('USD/JPY', '00:00:00', '23:59:59', 'UTC', TRUE),
('XAU/USD', '01:00:00', '23:59:59', 'UTC', FALSE),
('WTI/USD', '01:00:00', '23:59:59', 'UTC', FALSE)
ON CONFLICT (asset_symbol) DO NOTHING;
