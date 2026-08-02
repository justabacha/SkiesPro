-- Migration 007: Compliance schema tables
-- Creates tables for KYC and AML as per DDS §5.24-5.26

-- compliance.kyc_documents
CREATE TABLE IF NOT EXISTS compliance.kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  document_type VARCHAR(30) NOT NULL CHECK (document_type IN ('passport','national_id','drivers_license','proof_of_address','selfie')),
  file_storage_path VARCHAR(500) NOT NULL,
  file_hash VARCHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired')),
  reviewed_by UUID,
  review_note TEXT,
  reviewed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT compliance_kyc_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_auth.users(id) ON DELETE RESTRICT,
  CONSTRAINT compliance_kyc_documents_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES app_auth.users(id)
);

-- compliance.aml_flags
CREATE TABLE IF NOT EXISTS compliance.aml_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  flag_type VARCHAR(50) NOT NULL CHECK (flag_type IN ('pep_match','sanctions_match','suspicious_activity','volume_threshold','rapid_deposit_withdrawal')),
  severity VARCHAR(10) NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  details JSONB NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT compliance_aml_flags_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_auth.users(id) ON DELETE RESTRICT,
  CONSTRAINT compliance_aml_flags_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES app_auth.users(id)
);

-- compliance.compliance_rules
CREATE TABLE IF NOT EXISTS compliance.compliance_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name VARCHAR(100) NOT NULL UNIQUE,
  rule_type VARCHAR(30) NOT NULL CHECK (rule_type IN ('deposit_limit','withdrawal_hold','trade_limit','withdrawal_freeze')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  config JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for compliance schema
CREATE INDEX IF NOT EXISTS kyc_documents_user_id_idx ON compliance.kyc_documents(user_id);
CREATE INDEX IF NOT EXISTS kyc_documents_status_idx ON compliance.kyc_documents(status);
CREATE INDEX IF NOT EXISTS aml_flags_user_id_idx ON compliance.aml_flags(user_id);
