-- Migration 002: Auth schema tables
-- Creates tables for authentication and authorization as per DDS §5.1-5.8
-- Note: Schema renamed to 'app_auth' to avoid Supabase conflict

-- app_auth.users
CREATE TABLE IF NOT EXISTS app_auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100),
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  kyc_status VARCHAR(20) NOT NULL DEFAULT 'none' CHECK (kyc_status IN ('none','pending','approved','rejected')),
  self_exclusion_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- app_auth.sessions
CREATE TABLE IF NOT EXISTS app_auth.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT app_auth_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_auth.users(id) ON DELETE CASCADE
);

-- app_auth.mfa_tokens
CREATE TABLE IF NOT EXISTS app_auth.mfa_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  secret VARCHAR(255) NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  backup_codes TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT app_auth_mfa_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_auth.users(id) ON DELETE CASCADE,
  CONSTRAINT app_auth_mfa_tokens_user_id_unique UNIQUE (user_id)
);

-- app_auth.password_reset_tokens
CREATE TABLE IF NOT EXISTS app_auth.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT app_auth_password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_auth.users(id) ON DELETE CASCADE
);

-- app_auth.roles
CREATE TABLE IF NOT EXISTS app_auth.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- app_auth.permissions
CREATE TABLE IF NOT EXISTS app_auth.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- app_auth.user_roles
CREATE TABLE IF NOT EXISTS app_auth.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role_id UUID NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT app_auth_user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_auth.users(id) ON DELETE CASCADE,
  CONSTRAINT app_auth_user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES app_auth.roles(id) ON DELETE CASCADE,
  CONSTRAINT app_auth_user_roles_user_role_unique UNIQUE (user_id, role_id)
);

-- app_auth.role_permissions
CREATE TABLE IF NOT EXISTS app_auth.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL,
  permission_id UUID NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT app_auth_role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES app_auth.roles(id) ON DELETE CASCADE,
  CONSTRAINT app_auth_role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES app_auth.permissions(id) ON DELETE CASCADE,
  CONSTRAINT app_auth_role_permissions_role_permission_unique UNIQUE (role_id, permission_id)
);

-- Indexes for app_auth schema
CREATE UNIQUE INDEX IF NOT EXISTS app_auth_users_email_idx ON app_auth.users(email) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS app_auth_users_phone_idx ON app_auth.users(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS app_auth_sessions_user_id_idx ON app_auth.sessions(user_id);
CREATE INDEX IF NOT EXISTS app_auth_sessions_token_hash_idx ON app_auth.sessions(token_hash);
CREATE INDEX IF NOT EXISTS app_auth_password_reset_tokens_user_id_idx ON app_auth.password_reset_tokens(user_id);
