-- Migration 040: Add reject/cancel columns and status constraint to admin.admin_actions

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'admin.admin_actions'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE admin.admin_actions DROP CONSTRAINT ' || constraint_name;
  END IF;
END $$;

-- Add new columns to admin.admin_actions
ALTER TABLE admin.admin_actions
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES app_auth.users(id),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

-- Backfill status for existing approved actions
UPDATE admin.admin_actions
  SET status = 'approved'
  WHERE approved_at IS NOT NULL AND status = 'pending';

-- Add CHECK constraint
ALTER TABLE admin.admin_actions
  ADD CONSTRAINT admin_actions_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));
