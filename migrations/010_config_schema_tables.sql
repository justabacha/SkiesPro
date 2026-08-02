-- Migration 010: Config schema tables
-- Creates tables for platform configuration as per DDS §5.35-5.36

-- config.platform_settings
CREATE TABLE IF NOT EXISTS config.platform_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT config_platform_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES app_auth.users(id)
);

-- config.feature_flags
CREATE TABLE IF NOT EXISTS config.feature_flags (
  flag_name VARCHAR(100) PRIMARY KEY,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  updated_by UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT config_feature_flags_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES app_auth.users(id)
);
