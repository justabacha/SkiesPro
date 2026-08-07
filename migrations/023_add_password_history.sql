-- Migration 023: Add password history table
-- Required for password history enforcement as per SATM §4.3 and WP-04 §5

CREATE TABLE IF NOT EXISTS app_auth.password_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS app_auth_password_history_user_id_idx ON app_auth.password_history(user_id);
