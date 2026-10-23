# WP-20 Execution Report: Asset Config 404, Seed Restoration, & User Profile UI Fixes

## Status
Executed & Verified

---

## Pre-Check Findings (P1-P3)

- **P1. Asset Config API Call (`adminApiClient.ts`)**:
  ```ts
  async updateAssetConfig(symbol: string, payload: Partial<AssetConfig> & { totp_code?: string }) {
    const res = await apiClient.put<ApiResponse<AssetConfig>>(`/api/v1/admin/risk/asset-config/${symbol}`, payload, { headers });
  ```
  *Finding*: Parameter `symbol` (e.g. `'EUR/USD'`) was passed raw without URL encoding, causing Express route `/risk/asset-config/:symbol` to see two path segments (`EUR` and `USD`) and return `404 Not Found`.

- **P2. Test Teardown Mutation (`tests/admin/riskDashboard.test.ts`)**:
  ```ts
  await pgPool.query(
    'UPDATE trading.asset_config SET is_active = true, payout_rate = 0.85, min_stake = 10, max_stake_per_trade = 1000 WHERE asset_symbol = $1',
    ['EUR/USD']
  );
  ```
  *Finding*: Test teardown explicitly mutated `EUR/USD` in `trading.asset_config`, changing `payout_rate` to `0.85` and `min_stake` to `10.0000`.

- **P3. User Profile Drawer Mapping (`UserDetailDrawer.tsx`)**:
  *Finding*: Verified that drawer handles `win_rate_pct`, `total_trades`, and `recent_trades` properties with fallback mappings and direction/mode badges.

---

## Task 1 — `adminApiClient.ts` URL Encoding Diff

```diff
  async updateAssetConfig(symbol: string, payload: Partial<AssetConfig> & { totp_code?: string }) {
    const headers: Record<string, string> = {};
    if (payload.totp_code) headers['X-Admin-MFA-Token'] = payload.totp_code;
+   const encodedSymbol = encodeURIComponent(symbol);
    const res = await apiClient.put<ApiResponse<AssetConfig>>(
-     `/api/v1/admin/risk/asset-config/${symbol}`,
+     `/api/v1/admin/risk/asset-config/${encodedSymbol}`,
      payload,
      { headers }
    );
    return res.data;
  }
```

---

## Task 2 — Seed Restoration & Test Teardown Fix

### 2A. Restored `EUR/USD` Production Seed in DB
```sql
UPDATE trading.asset_config 
SET payout_rate = 0.60, min_stake = 100.0000, max_stake_per_trade = 50000.0000 
WHERE asset_symbol = 'EUR/USD';
```

### 2B. Test Teardown Fix (`tests/admin/riskDashboard.test.ts`)
```diff
+ const TEST_SYMBOL = 'TEST/CFG';
  beforeAll(async () => {
    // ...
+   await pgPool.query(
+     "INSERT INTO trading.assets (symbol, name, asset_type, is_active) VALUES ($1, 'Test Config Asset', 'forex', true) ON CONFLICT (symbol) DO NOTHING",
+     [TEST_SYMBOL]
+   );
+   await pgPool.query(
+     "INSERT INTO trading.asset_config (asset_symbol, payout_rate, min_stake, max_stake_per_trade, min_duration_seconds, max_duration_seconds, is_active) VALUES ($1, 0.60, 100, 5000, 60, 3600, true) ON CONFLICT (asset_symbol) DO NOTHING",
+     [TEST_SYMBOL]
+   );
  });

  afterAll(async () => {
    // ...
+   await pgPool.query('DELETE FROM trading.asset_config WHERE asset_symbol = $1', [TEST_SYMBOL]);
+   await pgPool.query('DELETE FROM trading.assets WHERE symbol = $1', [TEST_SYMBOL]);
  });
```

---

## Task 3 — User Profile Drawer Component Enhancements (`UserDetailDrawer.tsx`)

```diff
  const tradeDirectionLabel = (direction?: string) => {
+   if (!direction) return 'CALL';
    const normalized = direction.toLowerCase();
-   if (normalized === 'higher') return 'HIGH';
-   if (normalized === 'lower') return 'LOW';
+   if (normalized === 'higher' || normalized === 'call') return 'HIGH';
+   if (normalized === 'lower' || normalized === 'put') return 'LOW';
    return direction.toUpperCase();
  };
```
And added `account_type` badge (`[REAL]` / `[DEMO]`) to recent trade items so admins can distinguish real vs demo contracts in trade activity.

---

## Task 4 — Raw Database Output (`EUR/USD` Restored)

Executed directly against PostgreSQL database:
```json
{
  "asset_symbol": "EUR/USD",
  "payout_rate": "0.60",
  "min_stake": "100.0000",
  "max_stake_per_trade": "50000.0000",
  "is_active": true
}
```

---

## Consecutive Full-Suite Test Verification

### Run 1 Summary
```text
Test Suites: 57 passed, 57 total
Tests:       385 passed, 385 total
Snapshots:   0 total
Time:        432.305 s
```

### Run 2 Summary
```text
Test Suites: 57 passed, 57 total
Tests:       385 passed, 385 total
Snapshots:   0 total
Time:        402.139 s
```

---

## Typechecks
- **Backend Typecheck (`npm run typecheck`)**: 0 errors
- **Frontend Typecheck (`cd frontend && npx tsc --noEmit`)**: 0 errors
