-- Migration 020: Correct seed data values
-- Updates platform settings to match ProjectAnswers.md as per WP_02_INTEGRITY_REVIEW.md
-- This migration corrects 5 wrong seed values in config.platform_settings

-- ============================================================================
-- Update deposit.max_amount from 500,000 to 100,000 KES
-- ============================================================================
UPDATE config.platform_settings 
SET value = '100000'::jsonb
WHERE key = 'deposit.max_amount';

-- ============================================================================
-- Update withdrawal.max_amount from 100,000 to 60,000 KES
-- ============================================================================
UPDATE config.platform_settings 
SET value = '60000'::jsonb
WHERE key = 'withdrawal.max_amount';

-- ============================================================================
-- Update trade.default_payout_ratio from 0.85 to 0.60 (60%)
-- ============================================================================
UPDATE config.platform_settings 
SET value = '0.60'::jsonb
WHERE key = 'trade.default_payout_ratio';

-- ============================================================================
-- Update referral.commission_percentage from 0.10 to 0.05 (5%)
-- ============================================================================
UPDATE config.platform_settings 
SET value = '0.05'::jsonb
WHERE key = 'referral.commission_percentage';

-- ============================================================================
-- Update trade.min_duration_seconds from 30 to 60 (1 minute)
-- ============================================================================
UPDATE config.platform_settings 
SET value = '60'::jsonb
WHERE key = 'trade.min_duration_seconds';
