-- Migration 017: Seed payment gateways
-- Seeds default payment gateway (M-Pesa) as per ProjectAnswers.md

-- Insert M-Pesa payment gateway
-- Note: config field is encrypted at application level, contains sensitive keys
INSERT INTO payments.payment_gateways (name, provider_type, is_active, config)
VALUES
('M-Pesa', 'mobile_money', TRUE, '{"shortcode": "", "passkey": "", "consumer_key": "", "consumer_secret": ""}')
ON CONFLICT (name) DO NOTHING;
