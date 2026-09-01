-- Migration 009: Admin schema tables
-- Creates tables for admin operations as per DDS §5.30-5.34

-- Create helper function for immutable table protection
CREATE OR REPLACE FUNCTION admin.prevent_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Cannot % % on immutable table %', TG_OP, TG_WHEN, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- admin.audit_logs
CREATE TABLE IF NOT EXISTS admin.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  entry_hash VARCHAR(64) NOT NULL,
  previous_entry_hash VARCHAR(64) NOT NULL,
  actor_id UUID,
  action VARCHAR(100) NOT NULL,
  affected_entity VARCHAR(50) NOT NULL,
  entity_id UUID,
  details JSONB NOT NULL DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES app_auth.users(id)
);

-- Prevent UPDATE and DELETE on audit_logs (immutable)
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

-- admin.admin_actions
CREATE TABLE IF NOT EXISTS admin.admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  target_user_id UUID,
  details JSONB NOT NULL,
  requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_admin_actions_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES app_auth.users(id),
  CONSTRAINT admin_admin_actions_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES app_auth.users(id),
  CONSTRAINT admin_admin_actions_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES app_auth.users(id)
);

-- admin.support_tickets
CREATE TABLE IF NOT EXISTS admin.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subject VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  priority VARCHAR(10) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','critical')),
  assigned_to UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  CONSTRAINT admin_support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_auth.users(id),
  CONSTRAINT admin_support_tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES app_auth.users(id)
);

-- admin.system_jobs
CREATE TABLE IF NOT EXISTS admin.system_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','cancelled')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- admin.job_history
CREATE TABLE IF NOT EXISTS admin.job_history (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_job_history_job_id_fkey FOREIGN KEY (job_id) REFERENCES admin.system_jobs(id)
);

-- Indexes for admin schema
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON admin.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON admin.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON admin.audit_logs(affected_entity, entity_id);
CREATE INDEX IF NOT EXISTS audit_logs_hash_idx ON admin.audit_logs(entry_hash);
CREATE INDEX IF NOT EXISTS admin_actions_admin_id_idx ON admin.admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS support_tickets_user_id_idx ON admin.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON admin.support_tickets(status);
CREATE INDEX IF NOT EXISTS system_jobs_status_idx ON admin.system_jobs(status);