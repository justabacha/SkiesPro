-- Migration 035: Admin schema and views
-- Ensures the admin module tables and role seeds exist for WP-15.

CREATE SCHEMA IF NOT EXISTS admin;
CREATE SCHEMA IF NOT EXISTS config;

CREATE TABLE IF NOT EXISTS admin.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  entry_hash VARCHAR(64) NOT NULL,
  previous_entry_hash VARCHAR(64) NOT NULL,
  actor_id UUID REFERENCES app_auth.users(id),
  action VARCHAR(100) NOT NULL,
  affected_entity VARCHAR(50) NOT NULL,
  entity_id UUID,
  details JSONB NOT NULL DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin.admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES app_auth.users(id),
  action_type VARCHAR(50) NOT NULL,
  target_user_id UUID REFERENCES app_auth.users(id),
  details JSONB NOT NULL DEFAULT '{}',
  requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
  approved_by UUID REFERENCES app_auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_auth.users(id),
  subject VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority VARCHAR(10) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  assigned_to UUID REFERENCES app_auth.users(id),
  response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS admin.system_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin.job_history (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES admin.system_jobs(id),
  status VARCHAR(20) NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS config.platform_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by UUID REFERENCES app_auth.users(id),
  reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION admin.prevent_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Cannot % % on immutable table %', TG_OP, TG_WHEN, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_prevent_update ON admin.audit_logs;
CREATE TRIGGER audit_logs_prevent_update
BEFORE UPDATE ON admin.audit_logs
FOR EACH STATEMENT
EXECUTE FUNCTION admin.prevent_mutation();

DROP TRIGGER IF EXISTS audit_logs_prevent_delete ON admin.audit_logs;
CREATE TRIGGER audit_logs_prevent_delete
BEFORE DELETE ON admin.audit_logs
FOR EACH STATEMENT
EXECUTE FUNCTION admin.prevent_mutation();

INSERT INTO app_auth.roles (name, description) VALUES
('support', 'Customer support agent'),
('finance', 'Finance operations agent'),
('risk_manager', 'Risk and exposure oversight'),
('compliance', 'KYC and AML review'),
('admin', 'Platform administrator'),
('super_admin', 'System owner with elevated permissions')
ON CONFLICT (name) DO NOTHING;

CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON admin.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON admin.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON admin.audit_logs(affected_entity, entity_id);
CREATE INDEX IF NOT EXISTS audit_logs_hash_idx ON admin.audit_logs(entry_hash);
CREATE INDEX IF NOT EXISTS admin_actions_admin_id_idx ON admin.admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS support_tickets_user_id_idx ON admin.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON admin.support_tickets(status);
CREATE INDEX IF NOT EXISTS system_jobs_status_idx ON admin.system_jobs(status);

CREATE OR REPLACE VIEW admin.user_overview AS
SELECT
  u.id,
  u.email,
  u.display_name,
  u.status,
  u.kyc_status,
  u.mfa_enabled,
  json_agg(DISTINCT r.name) AS roles,
  u.created_at,
  u.updated_at
FROM app_auth.users u
LEFT JOIN app_auth.user_roles ur ON ur.user_id = u.id
LEFT JOIN app_auth.roles r ON r.id = ur.role_id
GROUP BY u.id, u.email, u.display_name, u.status, u.kyc_status, u.mfa_enabled, u.created_at, u.updated_at;

CREATE OR REPLACE VIEW admin.platform_overview AS
SELECT
  (SELECT COUNT(*) FROM app_auth.users WHERE deleted_at IS NULL) AS total_users,
  (SELECT COUNT(*) FROM app_auth.users WHERE status = 'active' AND deleted_at IS NULL) AS active_users,
  (SELECT COUNT(*) FROM trading.binary_contracts WHERE status = 'active') AS open_trades,
  (SELECT COALESCE(SUM(stake_amount), 0) FROM trading.binary_contracts WHERE status = 'active') AS open_exposure,
  (SELECT COALESCE(SUM(amount), 0) FROM payments.withdrawals WHERE status = 'pending') AS pending_withdrawals;
