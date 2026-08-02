-- Migration 014: Additional indexes
-- Creates additional performance indexes as per DDS §7

-- Note: Most indexes are created inline with table migrations.
-- This migration adds any additional indexes that need to be created separately.

-- app_auth schema additional indexes
CREATE INDEX IF NOT EXISTS app_auth_users_kyc_status_idx ON app_auth.users(kyc_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS app_auth_users_is_active_idx ON app_auth.users(is_active) WHERE deleted_at IS NULL;

-- wallet schema additional indexes
CREATE INDEX IF NOT EXISTS ledger_entry_type_idx ON wallet.ledger_entries(entry_type);
CREATE INDEX IF NOT EXISTS ledger_reference_idx ON wallet.ledger_entries(reference_type, reference_id);

-- trading schema additional indexes
CREATE INDEX IF NOT EXISTS trading_contracts_user_asset_idx ON trading.binary_contracts(user_id, asset_symbol);

-- pricing schema additional indexes
CREATE INDEX IF NOT EXISTS price_ticks_time_idx ON pricing.price_ticks(tick_time DESC);

-- payments schema additional indexes
CREATE INDEX IF NOT EXISTS deposits_created_at_idx ON payments.deposits(created_at);
CREATE INDEX IF NOT EXISTS withdrawals_created_at_idx ON payments.withdrawals(created_at);

-- compliance schema additional indexes
CREATE INDEX IF NOT EXISTS aml_flags_resolved_idx ON compliance.aml_flags(resolved);
CREATE INDEX IF NOT EXISTS aml_flags_severity_idx ON compliance.aml_flags(severity);

-- referral schema additional indexes
CREATE INDEX IF NOT EXISTS referrals_status_idx ON referral.referrals(status);
CREATE INDEX IF NOT EXISTS referral_commissions_status_idx ON referral.referral_commissions(status);

-- admin schema additional indexes
CREATE INDEX IF NOT EXISTS admin_actions_target_user_idx ON admin.admin_actions(target_user_id);
CREATE INDEX IF NOT EXISTS support_tickets_assigned_idx ON admin.support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS system_jobs_created_at_idx ON admin.system_jobs(created_at);

-- config schema additional indexes
CREATE INDEX IF NOT EXISTS platform_settings_updated_at_idx ON config.platform_settings(updated_at);

-- notifications schema additional indexes
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications.notifications(created_at);
CREATE INDEX IF NOT EXISTS notification_queue_locked_idx ON notifications.notification_queue(locked_until);

-- events schema additional indexes
CREATE INDEX IF NOT EXISTS event_outbox_published_idx ON events.event_outbox(published);
CREATE INDEX IF NOT EXISTS event_outbox_event_type_idx ON events.event_outbox(event_type);
