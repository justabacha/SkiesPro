-- Migration 041: Add settings columns and support deactivated status
-- 1. Add last_seen_at to app_auth.sessions
ALTER TABLE app_auth.sessions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Add deactivated_at and update status constraint on app_auth.users
ALTER TABLE app_auth.users DROP CONSTRAINT IF EXISTS app_auth_users_status_check;
ALTER TABLE app_auth.users ADD CONSTRAINT app_auth_users_status_check CHECK (status IN ('active','suspended','closed','deactivated'));
ALTER TABLE app_auth.users ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
