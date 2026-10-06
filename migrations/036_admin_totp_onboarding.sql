-- Reconcile staff MFA flags with verified TOTP enrollments.
-- Staff without an enabled TOTP secret are forced through enrollment at login.
UPDATE app_auth.users AS users
SET
  mfa_enabled = COALESCE(mfa_tokens.is_enabled, FALSE),
  mfa_type = CASE WHEN COALESCE(mfa_tokens.is_enabled, FALSE) THEN 'totp' ELSE NULL END,
  updated_at = NOW()
FROM (
  SELECT user_roles.user_id
  FROM app_auth.user_roles AS user_roles
  JOIN app_auth.roles AS roles ON roles.id = user_roles.role_id
  WHERE LOWER(roles.name) IN (
    'super_admin', 'admin', 'compliance', 'risk', 'risk_manager', 'finance', 'support'
  )
    AND user_roles.revoked_at IS NULL
) AS staff
LEFT JOIN app_auth.mfa_tokens AS mfa_tokens
  ON mfa_tokens.user_id = staff.user_id
WHERE users.id = staff.user_id;
