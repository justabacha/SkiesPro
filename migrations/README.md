# Database Migrations

This directory contains SQL migration files for the SkiesPro database schema.

## Migration Files

Migrations are numbered and named in the order they should be executed:

1. `001_create_schemas.sql` - Creates all 12 database schemas (note: auth is renamed to app_auth to avoid Supabase conflict)
2. `002_auth_schema_tables.sql` - Creates authentication and authorization tables in app_auth schema
3. `003_wallet_schema_tables.sql` - Creates wallet and ledger tables
4. `004_trading_schema_tables.sql` - Creates trading operation tables
5. `005_pricing_schema_tables.sql` - Creates price data tables
6. `006_payments_schema_tables.sql` - Creates payment processing tables
7. `007_compliance_schema_tables.sql` - Creates KYC and AML tables
8. `008_referral_schema_tables.sql` - Creates referral system tables
9. `009_admin_schema_tables.sql` - Creates admin operation tables
10. `010_config_schema_tables.sql` - Creates platform configuration tables
11. `011_notifications_schema_tables.sql` - Creates notification system tables
12. `012_events_schema_tables.sql` - Creates event outbox table
13. `013_reporting_views.sql` - Creates reporting materialized views
14. `014_create_indexes.sql` - Creates additional performance indexes
15. `015_seed_roles_permissions.sql` - Seeds roles and permissions
16. `016_seed_assets.sql` - Seeds trading assets
17. `017_seed_payment_gateways.sql` - Seeds payment gateways
18. `018_seed_platform_settings.sql` - Seeds platform settings

## Running Migrations

### Option 1: Supabase SQL Editor (Recommended for Production)

1. Open your Supabase Dashboard
2. Navigate to SQL Editor
3. Open each migration file in numerical order
4. Click "Run" to execute each migration
5. Verify completion in Table Editor

### Option 2: Local Migration Runner (Development)

```bash
# Install dependencies first
npm install

# Run all migrations
npm run migrate

# Run specific migration
npm run migrate:up 001
```

**Prerequisites for local runner:**
- Ensure `.env` is configured with `DATABASE_URL`
- Run `npm install` to install dependencies

## Verification

After running migrations, verify in Supabase SQL Editor:

```sql
-- Check all schemas exist
SELECT schema_name FROM information_schema.schemata 
WHERE schema_name IN ('auth', 'wallet', 'trading', 'pricing', 'payments', 
                      'compliance', 'referral', 'admin', 'config', 
                      'notifications', 'events', 'reporting');

-- Check seed data
SELECT * FROM auth.roles;
SELECT * FROM trading.assets;
SELECT * FROM config.platform_settings;
```

## Rollback

If migrations fail or need to be reverted, drop schemas and re-run:

```sql
DROP SCHEMA IF EXISTS reporting CASCADE;
DROP SCHEMA IF EXISTS events CASCADE;
DROP SCHEMA IF EXISTS notifications CASCADE;
DROP SCHEMA IF EXISTS config CASCADE;
DROP SCHEMA IF EXISTS admin CASCADE;
DROP SCHEMA IF EXISTS referral CASCADE;
DROP SCHEMA IF EXISTS compliance CASCADE;
DROP SCHEMA IF EXISTS payments CASCADE;
DROP SCHEMA IF EXISTS pricing CASCADE;
DROP SCHEMA IF EXISTS trading CASCADE;
DROP SCHEMA IF EXISTS wallet CASCADE;
DROP SCHEMA IF EXISTS app_auth CASCADE;
```

## Important Notes

- **Never skip migrations** - They must be run in numerical order
- **Seed data uses placeholder admin user ID** - Update `00000000-0000-0000-0000-000000000000` in migration 018 with actual admin user ID after creating first admin
- **Payment gateway config is empty** - Add actual M-Pesa credentials via Supabase Dashboard or admin panel after setup
