-- Migration 031: Payout ratio reconciliation
-- Relaxes payout_rate constraints and updates seeded values to 60% per ProjectAnswers #33

-- ============================================================================
-- 1. Relax CHECK constraints in trading schema to allow 0.60 (60%)
-- ============================================================================

-- trading.binary_contracts
ALTER TABLE trading.binary_contracts DROP CONSTRAINT IF EXISTS trading_binary_contracts_payout_rate_check;
ALTER TABLE trading.binary_contracts ADD CONSTRAINT trading_binary_contracts_payout_rate_check
  CHECK (payout_rate >= 0.60 AND payout_rate <= 0.88);

-- trading.asset_config
ALTER TABLE trading.asset_config DROP CONSTRAINT IF EXISTS trading_asset_config_payout_rate_check;
ALTER TABLE trading.asset_config ADD CONSTRAINT trading_asset_config_payout_rate_check
  CHECK (payout_rate >= 0.60 AND payout_rate <= 0.88);

-- ============================================================================
-- 2. Update default payout ratio in platform settings
-- ============================================================================
-- Update trade.default_payout_ratio from 0.80 to 0.60 (60%)
UPDATE config.platform_settings
SET value = '0.60'::jsonb
WHERE key = 'trade.default_payout_ratio';

-- ============================================================================
-- 3. Update payout rates for all existing assets in asset_config
-- ============================================================================
-- Update all existing asset configurations to the new default 60%
UPDATE trading.asset_config
SET payout_rate = 0.60;
