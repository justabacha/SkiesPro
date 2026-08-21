-- Migration 001: Create all schemas
-- This migration creates all database schemas as per DDS §4
-- Note: 'auth' is renamed to 'app_auth' to avoid conflict with Supabase's built-in auth schema

CREATE SCHEMA IF NOT EXISTS app_auth;
CREATE SCHEMA IF NOT EXISTS wallet;
CREATE SCHEMA IF NOT EXISTS trading;
CREATE SCHEMA IF NOT EXISTS pricing;
CREATE SCHEMA IF NOT EXISTS payments;
CREATE SCHEMA IF NOT EXISTS compliance;
CREATE SCHEMA IF NOT EXISTS referral;
CREATE SCHEMA IF NOT EXISTS admin;
CREATE SCHEMA IF NOT EXISTS config;
CREATE SCHEMA IF NOT EXISTS notifications;
CREATE SCHEMA IF NOT EXISTS events;
CREATE SCHEMA IF NOT EXISTS reporting;

-- Grant usage on schemas to appropriate roles (adjust based on Supabase setup)
-- Supabase typically handles this via the dashboard, but we ensure schemas exist
