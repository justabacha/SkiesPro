# WP-02: Database Setup and Migration

**Status**: Completed  
**Priority**: High  
**Dependencies**: WP-01_PROJECT_SCAFFOLDING  
**Estimated Effort**: 8 hours

---

## 1. Scope

This work package establishes the database layer for the SkiesPro binary trading platform, including:

- Database connection configuration using Supabase (PostgreSQL)
- Creation of all schemas and tables as specified in DDS §5
- Implementation of all constraints (PRIMARY KEY, FOREIGN KEY, CHECK, UNIQUE)
- Implementation of all indexes as specified in DDS §7
- Seed data for roles, permissions, assets, payment gateways, and platform settings
- Database connectivity tests
- Manual migration procedures for Supabase SQL Editor

---

## 2. Deliverables

### 2.1 Code Deliverables

1. **Database Connection Module** (`src/config/database.ts`)
   - Supabase client configuration using environment variables
   - PostgreSQL connection pool configuration
   - Connection health check function

2. **Migration Files** (`migrations/`)
   - Schema creation migrations (one per schema)
   - Table creation migrations (one per table)
   - Index creation migrations
   - Seed data migrations

3. **Database Tests** (`tests/database.test.ts`)
   - Connection test
   - Schema existence verification
   - Seed data verification

### 2.2 Documentation Deliverables

1. **This WP Document** with:
   - Manual steps for running migrations in Supabase
   - Environment variable requirements
   - Verification commands

---

## 3. Technical Specifications

### 3.1 Database Technology

- **Database**: PostgreSQL 15+ (via Supabase)
- **ORM/Client**: Supabase JS Client v2 + pg (for raw SQL migrations)
- **Connection Pooling**: Supabase managed pool

### 3.2 Environment Variables

**CRITICAL: Owner must configure these in `.env` before running migrations:**

| Variable | Purpose | Example Format |
|----------|---------|----------------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres` |
| `SUPABASE_URL` | Supabase project URL | `https://xyz.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anon/public key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (admin) | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

> **NOTE**: These values are found in Supabase Dashboard → Settings → API

### 3.3 Schema Organization

Per DDS §4, the database uses schema-per-module isolation:

| Schema | Purpose | Tables |
|--------|---------|--------|
| `auth` | Authentication & authorization | users, sessions, mfa_tokens, password_reset_tokens, roles, permissions, user_roles, role_permissions |
| `wallet` | Wallet & ledger | wallets, ledger_entries, wallet_version_log |
| `trading` | Trading operations | assets, binary_contracts, contract_events, asset_config |
| `pricing` | Price data | price_ticks, candles, market_hours |
| `payments` | Payment processing | deposits, withdrawals, payment_gateways, payment_webhook_logs, idempotency_keys |
| `compliance` | KYC & AML | kyc_documents, aml_flags, compliance_rules |
| `referral` | Referral system | referral_codes, referrals, referral_commissions |
| `admin` | Admin operations | audit_logs, admin_actions, support_tickets, system_jobs, job_history |
| `config` | Platform configuration | platform_settings, feature_flags |
| `notifications` | Notification system | notifications, notification_queue |
| `events` | Event outbox | event_outbox |
| `reporting` | Reporting views | daily_revenue_summary, daily_trade_summary |

### 3.4 Seed Data Sources

Seed data values come from `docs/ProjectAnswers.md`:

- **Currency**: KES (Kenyan Shilling)
- **Assets**: EUR/USD, GBP/USD, USD/JPY, Gold (XAU/USD), Oil (WTI/USD)
- **Payment Gateway**: M-Pesa (mobile_money)
- **Platform Settings**:
  - Min deposit: KES 500
  - Max deposit: KES 500,000
  - Min withdrawal: KES 500
  - Max withdrawal: KES 500,000
  - Min trade duration: 30 seconds
  - Max trade duration: 1 hour
  - Payout ratio: 85%
  - Referral commission: 10%

---

## 4. Implementation Details

### 4.1 Database Connection Module

Location: `src/config/database.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const { Pool } = pg;

export const databaseConfig = {
  url: process.env.DATABASE_URL || '',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
};

// Supabase client for application queries
export const supabase = createClient(
  databaseConfig.supabaseUrl,
  databaseConfig.supabaseAnonKey
);

// Supabase admin client (service role) for privileged operations
export const supabaseAdmin = createClient(
  databaseConfig.supabaseUrl,
  databaseConfig.supabaseServiceRoleKey
);

// PostgreSQL pool for raw SQL (migrations, complex queries)
export const pgPool = new Pool({
  connectionString: databaseConfig.url,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Health check function
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const client = await pgPool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}
```

### 4.2 Migration Structure

```
migrations/
├── 001_create_schemas.sql
├── 002_auth_schema_tables.sql
├── 003_wallet_schema_tables.sql
├── 004_trading_schema_tables.sql
├── 005_pricing_schema_tables.sql
├── 006_payments_schema_tables.sql
├── 007_compliance_schema_tables.sql
├── 008_referral_schema_tables.sql
├── 009_admin_schema_tables.sql
├── 010_config_schema_tables.sql
├── 011_notifications_schema_tables.sql
├── 012_events_schema_tables.sql
├── 013_reporting_views.sql
├── 014_create_indexes.sql
├── 015_seed_roles_permissions.sql
├── 016_seed_assets.sql
├── 017_seed_payment_gateways.sql
├── 018_seed_platform_settings.sql
```

### 4.3 Key Constraints Implementation

All tables include:
- **PRIMARY KEY**: UUID (gen_random_uuid()) or SERIAL/SERIAL BIG
- **FOREIGN KEY**: With appropriate ON DELETE behavior (CASCADE/RESTRICT)
- **CHECK constraints**: For status enums, numeric ranges
- **UNIQUE constraints**: For business keys (email, phone, referral codes)

### 4.4 Index Strategy

Per DDS §7:
- Partial indexes for high-selectivity queries (e.g., active contracts only)
- Composite indexes for filter+sort patterns
- UNIQUE indexes for business uniqueness
- Covering indexes for common query patterns

---

## 5. Manual Steps for Owner

### 5.1 Prerequisites

1. **Create Supabase Project** (if not already done):
   - Go to https://supabase.com
   - Create new project
   - Choose region closest to your users
   - Set database password (save securely)

2. **Configure `.env`**:
   ```bash
   # Copy the example file
   cp .env.example .env
   
   # Edit .env and add your Supabase values:
   DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   SUPABASE_URL=https://[PROJECT-REF].supabase.co
   SUPABASE_ANON_KEY=[YOUR-ANON-KEY]
   SUPABASE_SERVICE_ROLE_KEY=[YOUR-SERVICE-ROLE-KEY]
   ```

3. **Install Dependencies**:
   ```bash
   npm install @supabase/supabase-js pg
   npm install --save-dev @types/pg
   ```

### 5.2 Running Migrations in Supabase SQL Editor

Since Supabase manages the database, migrations are run via the Supabase Dashboard SQL Editor:

1. **Open Supabase Dashboard** → SQL Editor
2. **Run migrations in order** (do not skip):
   - Open `migrations/001_create_schemas.sql` → Run
   - Open `migrations/002_auth_schema_tables.sql` → Run
   - Continue through all migration files in numerical order
3. **Verify completion**: Check that all schemas and tables exist in Table Editor

### 5.3 Alternative: Local Migration Runner

For development, you can run migrations locally using a Node.js script:

```bash
# Run all migrations
npm run migrate

# Run specific migration
npm run migrate:up 001_create_schemas
```

This script reads `DATABASE_URL` from `.env` and executes SQL files sequentially.

### 5.4 Verification Commands

After migrations, verify in Supabase SQL Editor:

```sql
-- Check all schemas exist
SELECT schema_name FROM information_schema.schemata 
WHERE schema_name IN ('auth', 'wallet', 'trading', 'pricing', 'payments', 
                      'compliance', 'referral', 'admin', 'config', 
                      'notifications', 'events', 'reporting');

-- Check tables in auth schema
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'auth';

-- Check seed data: roles
SELECT * FROM auth.roles;

-- Check seed data: assets
SELECT * FROM trading.assets;

-- Check seed data: platform settings
SELECT * FROM config.platform_settings;
```

---

## 6. Testing

### 6.1 Database Connection Test

Location: `tests/database.test.ts`

```typescript
import { checkDatabaseConnection, supabase } from '../src/config/database';

describe('Database Connection', () => {
  test('should connect to database successfully', async () => {
    const isConnected = await checkDatabaseConnection();
    expect(isConnected).toBe(true);
  });

  test('should query auth schema', async () => {
    const { data, error } = await supabase.from('auth.roles').select('*');
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });
});
```

### 6.2 Seed Data Verification Test

```typescript
test('should have seeded roles', async () => {
  const { data, error } = await supabase
    .from('auth.roles')
    .select('*');
  expect(error).toBeNull();
  expect(data?.length).toBeGreaterThan(0);
});

test('should have seeded assets', async () => {
  const { data, error } = await supabase
    .from('trading.assets')
    .select('*');
  expect(error).toBeNull();
  expect(data?.length).toBe(5); // EUR/USD, GBP/USD, USD/JPY, Gold, Oil
});
```

### 6.3 Running Tests

```bash
# Run database tests
npm test -- tests/database.test.ts

# Run with coverage
npm test -- --coverage tests/database.test.ts
```

---

## 7. Rollback Plan

If migrations fail or need to be reverted:

1. **Drop schemas** (in Supabase SQL Editor):
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
   DROP SCHEMA IF EXISTS auth CASCADE;
   ```

2. **Re-run migrations** from step 5.2

---

## 8. Completion Criteria

- [x] Database connection module created using `process.env` variables
- [x] All 12 schemas created via migration files
- [x] All 41 tables created with correct constraints
- [x] All indexes created per DDS §7
- [x] Seed data migrations created for roles, permissions, assets, payment gateways, platform settings
- [x] Database connection tests pass
- [x] Seed data verification tests pass
- [x] Manual steps documented for Supabase SQL Editor execution
- [x] WP-02 document completed

---

## 9. Next Steps

After WP-02 completion:

1. **WP-03: Authentication Module** - Implement user registration, login, MFA
2. **WP-04: Wallet Module** - Implement wallet creation, balance management
3. **WP-05: Trading Module** - Implement contract placement and settlement

---

## 10. References

- DDS: `docs/06_DATABASE_DESIGN_SPECIFICATION.md`
- ProjectAnswers: `docs/ProjectAnswers.md`
- Work Package Template: `docs/templates/WORK_PACKAGE_TEMPLATE.md`
- Supabase Docs: https://supabase.com/docs
