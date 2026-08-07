-- Migration 024: Fix kyc_status constraint to match DDS
-- Corrects enum mismatch between 'none/approved' and 'unverified/verified'

-- Drop old constraint FIRST so we can update the data
ALTER TABLE app_auth.users DROP CONSTRAINT IF EXISTS users_kyc_status_check;

-- Convert existing data
UPDATE app_auth.users SET kyc_status = 'unverified' WHERE kyc_status = 'none';
UPDATE app_auth.users SET kyc_status = 'verified' WHERE kyc_status = 'approved';

-- Add corrected constraint matching DDS
ALTER TABLE app_auth.users ADD CONSTRAINT users_kyc_status_check
CHECK (kyc_status IN ('unverified','pending','verified','rejected'));
