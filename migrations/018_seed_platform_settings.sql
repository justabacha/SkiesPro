-- Migration 018: Seed platform settings
-- Seeds default platform settings as per ProjectAnswers.md
-- Note: updated_by references a system admin user that should be created separately

-- Insert platform settings (using a placeholder admin user ID)
-- The owner should replace '00000000-0000-0000-0000-000000000000' with actual admin user ID after creating first admin
INSERT INTO config.platform_settings (key, value, description, updated_by)
VALUES
-- Currency settings
('platform.currency', '"KES"', 'Base currency for the platform', '00000000-0000-0000-0000-000000000000'),

-- Deposit limits
('deposit.min_amount', '500', 'Minimum deposit amount in KES', '00000000-0000-0000-0000-000000000000'),
('deposit.max_amount', '500000', 'Maximum deposit amount in KES', '00000000-0000-0000-0000-000000000000'),

-- Withdrawal limits
('withdrawal.min_amount', '500', 'Minimum withdrawal amount in KES', '00000000-0000-0000-0000-000000000000'),
('withdrawal.max_amount', '500000', 'Maximum withdrawal amount in KES', '00000000-0000-0000-0000-000000000000'),

-- Trade settings
('trade.min_duration_seconds', '30', 'Minimum trade duration in seconds', '00000000-0000-0000-0000-000000000000'),
('trade.max_duration_seconds', '3600', 'Maximum trade duration in seconds', '00000000-0000-0000-0000-000000000000'),
('trade.default_payout_ratio', '0.85', 'Default payout ratio (85%)', '00000000-0000-0000-0000-000000000000'),

-- Referral settings
('referral.commission_percentage', '0.10', 'Referral commission percentage (10%)', '00000000-0000-0000-0000-000000000000'),

-- KYC settings
('kyc.required_for_trading', 'false', 'Whether KYC is required before trading', '00000000-0000-0000-0000-000000000000'),
('kyc.required_for_withdrawal', 'true', 'Whether KYC is required before withdrawal', '00000000-0000-0000-0000-000000000000')
ON CONFLICT (key) DO NOTHING;

-- Insert feature flags
INSERT INTO config.feature_flags (flag_name, is_enabled, description, updated_by)
VALUES
('registration_enabled', true, 'Allow new user registrations', '00000000-0000-0000-0000-000000000000'),
('trading_enabled', true, 'Allow trading operations', '00000000-0000-0000-0000-000000000000'),
('deposits_enabled', true, 'Allow deposit operations', '00000000-0000-0000-0000-000000000000'),
('withdrawals_enabled', true, 'Allow withdrawal operations', '00000000-0000-0000-0000-000000000000'),
('referrals_enabled', true, 'Enable referral system', '00000000-0000-0000-0000-000000000000')
ON CONFLICT (flag_name) DO NOTHING;
