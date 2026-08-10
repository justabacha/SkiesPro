-- Migration 025: Add avatar_url to users table
-- Required for User Profile MVP as per WP-05

ALTER TABLE app_auth.users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);
