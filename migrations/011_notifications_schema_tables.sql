-- Migration 011: Notifications schema tables
-- Creates tables for notification system as per DDS §5.37-5.38

-- notifications.notifications
CREATE TABLE IF NOT EXISTS notifications.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  notification_type VARCHAR(30) NOT NULL CHECK (notification_type IN ('deposit_confirmed','withdrawal_confirmed','trade_result','kyc_status','referral_bonus','security_alert','password_changed')),
  channel VARCHAR(10) NOT NULL CHECK (channel IN ('email','sms','push')),
  recipient_address VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  body_text TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','suppressed')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notifications_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_auth.users(id)
);

-- notifications.notification_queue
CREATE TABLE IF NOT EXISTS notifications.notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL,
  retry_count SMALLINT NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  max_retries SMALLINT NOT NULL DEFAULT 3,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notifications_notification_queue_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES notifications.notifications(id),
  CONSTRAINT notifications_notification_queue_notification_id_unique UNIQUE (notification_id)
);

-- Indexes for notifications schema
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications.notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_status_idx ON notifications.notifications(status);
CREATE INDEX IF NOT EXISTS notification_queue_next_attempt_idx ON notifications.notification_queue(next_attempt_at) WHERE locked_until IS NULL;
