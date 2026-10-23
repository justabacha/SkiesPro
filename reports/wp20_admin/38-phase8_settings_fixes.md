# WP-20 Phase 8: Platform Settings Wiring, UI Polish & Audit Logs

**Status: Executed & Verified**

## Pre-check findings

**P1 — Settings schema:** `migrations/010_config_schema_tables.sql` defines:

```sql
CREATE TABLE IF NOT EXISTS config.platform_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT config_platform_settings_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES app_auth.users(id)
);
```

Migration 035 also contains a `CREATE TABLE IF NOT EXISTS` variant with `value TEXT`, `updated_by UUID REFERENCES ...`, and `reason TEXT`, but no `description`. Since migration 010 creates the table first in the normal ordered migration chain, the original JSONB definition remains in effect unless a database was provisioned differently. The settings repository no longer assumes the later-only `reason` column; the reason is retained in the audit log.

**P2 — Frontend:** `PlatformSettingsPage.tsx` originally rendered all settings as `type="text"` in a flat list, displayed any setting description directly, and sent every current value on save. Existing labels came from the setting descriptions, including the seed description `Default payout ratio (60%)`. Save failures were not caught by the page.

**P3 — Business logic:** Before these changes:

- `TradingService` already validated stake against `trading.asset_config` and used its `payoutRate`, but did not use platform duration settings or the platform KYC trading requirement.
- `DemoTradingService` also used the asset payout directly and had no global payout fallback.
- `PaymentService.initiateDeposit` used `MIN_DEPOSIT_KES` (default 100); withdrawal limits used `MIN_WITHDRAWAL_KES` (1500) and `MAX_WITHDRAWAL_KES` (60000), and KYC was always required for withdrawals. None of these paths read `config.platform_settings`.
- There is no standalone KYC service in the current source tree; trading and payment enforce KYC in their respective services.

## Implemented changes

### Settings access and engine wiring

Added `src/shared/services/settingsService.ts`. It reads values from `config.platform_settings`, parses JSON text when needed, caches each key for five seconds, and exposes targeted cache invalidation after administrative updates:

```typescript
import { pgPool } from '../../config/database.js';

const CACHE_TTL_MS = 5000;
const cache = new Map<string, { value: unknown; expiresAt: number }>();

export function parseSettingValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export class SettingsService {
  async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value as T;

    const result = await pgPool.query<{ value: unknown }>(
      'SELECT value FROM config.platform_settings WHERE key = $1',
      [key]
    );
    const value =
      result.rows.length > 0 ? (parseSettingValue(result.rows[0].value) as T) : defaultValue;
    cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  }

  static invalidate(key?: string): void {
    if (key) cache.delete(key);
    else cache.clear();
  }
}
```

The owner-confirmed trading policy is applied: `trading.asset_config.payout_rate` is authoritative for configured assets. `trade.default_payout_ratio` is consulted only if the asset config has a null payout rate; it does not override the Risk Dashboard’s per-asset value. `TradingService` and `DemoTradingService` also apply global minimum/maximum duration bounds in conjunction with asset-specific duration bounds, and real-money trading now enforces `kyc.required_for_trading`.

`PaymentService` now enforces the configured deposit minimum and maximum, withdrawal minimum and maximum, and `kyc.required_for_withdrawal`; environment values remain fallback defaults if a setting is absent.

### Settings UI and API

- Grouped settings under General, Trading, Fees & Referrals, KYC, Deposits, and Withdrawals tabs.
- Boolean `kyc.required*` settings render as checkbox switches; numeric settings render as number inputs with visible current values.
- Added client-side validation for positive numeric limits, payout/referral ratios bounded by 1, and minimum/maximum amount consistency.
- Removed percentage claims from the payout/referral seed descriptions and normalized those descriptions in the API response to avoid stale labels on already-seeded databases.
- Save submits one array payload in one `PUT /api/v1/admin/settings` request. The page catches failures, shows the message, and rethrows to the MFA modal so it can stop its submitting state and display the error.

### Audit logging, validation, and controller handling

`AdminRiskService.updateSettingsBatch` applies changes in one database transaction. For each changed value it reads the previous value, writes the new value, and adds an `admin.audit_logs` event with action `PLATFORM_SETTING_UPDATED`, actor ID, setting key, old/new values, and reason. Unchanged values are not logged as changes. The transaction rolls back as a unit on failure; setting cache entries are invalidated after commit.

The settings PUT route validates each entry, requiring booleans for KYC flags, positive numeric amount/duration values, and bounded payout/referral ratios. `listSettings`, `getSettingByKey`, and `updateSettings` now log caught failures and return `500` with code `SETTINGS_ACTION_FAILED`.

### Reported compilation fixes

- Made `AssetConfig.payoutRate` nullable in its type and added the approved `trade.default_payout_ratio` fallback in both trading engines before constructing `Decimal`.
- Changed the mocked pool connection in `tradingService.test.ts` to `client as unknown as PoolClient`, rather than passing the mock through `any`.
- Searched the remaining source usages of nullable payout/minimum values; no other `new Decimal(config.payoutRate)` or nullable `minStake` conversion remains without appropriate handling. Asset stake limits remain required by the schema and type.

## Tests and verification

- Backend: `npm.cmd run typecheck` — passed with 0 errors.
- Frontend: `npx.cmd tsc --noEmit -p frontend\tsconfig.json` — passed with 0 errors.
- Focused admin, trading, and payment tests — 3 suites passed, 26 tests passed.
- Database-backed integration coverage confirms that a settings update persists and creates the corresponding audit log event.
- Trading unit coverage confirms the platform payout value is used only when the asset payout is absent, and verifies the resulting payout calculation.
- `git diff --check` — passed.

Full-suite run 1:

```text
Test Suites: 58 passed, 58 total
Tests:       391 passed, 391 total
Snapshots:   0 total
Time:        318.925 s, estimated 334 s
Ran all test suites.
```

Full-suite run 2:

```text
Test Suites: 58 passed, 58 total
Tests:       391 passed, 391 total
Snapshots:   0 total
Time:        338.322 s
Ran all test suites.
```
