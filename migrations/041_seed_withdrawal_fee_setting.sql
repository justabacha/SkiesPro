-- Add the public withdrawal fee setting while preserving the existing JSONB settings schema.
INSERT INTO config.platform_settings (key, value, description, updated_by)
SELECT
  'withdrawal.fee_percentage',
  '0.02'::jsonb,
  'Withdrawal processing fee percentage',
  u.id
FROM app_auth.users u
ORDER BY u.created_at ASC
LIMIT 1
ON CONFLICT (key) DO NOTHING;
