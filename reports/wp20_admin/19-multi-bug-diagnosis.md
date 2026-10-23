# WP-20 Read-Only Diagnosis: Config 404, Payout Unit Mismatch, and Seed Poisoning

## Status
Read-Only Diagnosis Complete

---

## Task 1 — Trace the Asset Config 404

### 1. Frontend API Call (`frontend/src/services/admin/adminApiClient.ts`)
```ts
async updateAssetConfig(symbol: string, payload: Partial<AssetConfig> & { totp_code?: string }) {
  const headers: Record<string, string> = {};
  if (payload.totp_code) headers['X-Admin-MFA-Token'] = payload.totp_code;
  const res = await apiClient.put<ApiResponse<AssetConfig>>(
    `/api/v1/admin/risk/asset-config/${symbol}`,
    payload,
    { headers }
  );
  return res.data;
}
```
**Finding**: The `symbol` parameter (e.g. `'EUR/USD'`) is passed raw into the URL string without wrapping in `encodeURIComponent(symbol)`.

### 2. Backend Route Definition (`src/modules/admin/admin.routes.ts`)
```ts
router.put(
  '/risk/asset-config/:symbol',
  requireAdminRole(['risk_manager', 'admin', 'super_admin']),
  requireAdminMFA,
  validateAssetConfig,
  validate,
  (req: Request, res: Response) => controller.updateAssetConfig(req, res)
);
```

### 3. Route Match Behavior
Express matches `:symbol` up to the first `/` character.
- Calling `/api/v1/admin/risk/asset-config/EUR/USD` results in Express interpreting `EUR` as `:symbol` and `USD` as an unexpected additional path segment, triggering `404 Not Found`.
- Calling `/api/v1/admin/risk/asset-config/EUR%2FUSD` matches `:symbol = 'EUR/USD'` and returns `200 OK`.

---

## Task 2 — Payout Rate Unit Audit

### 1. Database Value (`trading.asset_config`)
```text
asset_symbol | payout_rate | min_stake | max_stake_per_trade | is_active
-------------+-------------+-----------+---------------------+----------
EUR/USD      | 0.85        | 10.0000   | 1000.0000           | true
BTC/USD      | 0.60        | 100.0000  | 50000.0000          | true
```
**Raw DB Format**: `payout_rate` is stored as a decimal string (`'0.85'` for 85%, `'0.60'` for 60%).

### 2. Frontend Display (Trader View)
In `OrderForm.tsx` & `AssetSelector.tsx`:
```ts
const payoutRate = asset?.payoutRate || 0.6; // Reads decimal 0.60 / 0.85
// Displays percentage:
+{(payoutRate * 100).toFixed(0)}%
```
For `EUR/USD` (`0.85`), the trader UI displays `+85%`. For `BTC/USD` (`0.60`), the trader UI displays `+60%`.

### 3. Settlement Engine (`tradingService.ts` & `payoutService.ts`)
In `tradingService.ts`:
```ts
const payoutRate = new Decimal(config.payoutRate); // Decimal('0.85')
const potentialPayout = stakeAmount.times(payoutRate.plus(1)); // 100 * (0.85 + 1) = 185.00 KES
```
On a winning trade with `stake = 100` and `payout_rate = 0.85`, settlement pays `185 KES` (`stake + 85 KES profit`). On a 60% rate (`0.60`), settlement pays `160 KES`.

### 4. Risk Dashboard API (`AdminRepository.ts`)
```sql
CASE WHEN ac.payout_rate <= 1 THEN ac.payout_rate * 100 ELSE ac.payout_rate END::float AS payout_rate
```
Converts decimal `'0.85'` to `85.0` (85%) for admin dashboard display.

### 5. Conclusion
- Database format is decimal (`0.85` / `0.60`).
- Settlement formula is `stake * (1 + payout_rate)` (returning total payout: stake + profit).
- Units are consistent across layers; the apparent discrepancy stems from `EUR/USD` having been poisoned in the database to `0.85` while other assets remain at `0.60`.

---

## Task 3 — Stake Validation Mismatch

### 1. Frontend Stake Validation (`OrderForm.tsx`)
```ts
const minStake = asset?.minStake || 100;
if (numericStake < minStake) return `Minimum stake is KES ${minStake}`;
```

### 2. Backend Stake Validation (`stakeValidator.ts`)
```ts
const minStake = new Decimal(config.minStake);
if (stake.lt(minStake)) {
  return { valid: false, error: `Stake amount below minimum for asset (${minStake.toString()})` };
}
```

### 3. Analysis
Both frontend and backend read `min_stake` from `trading.asset_config`. Because `EUR/USD` in `trading.asset_config` was poisoned to `min_stake = 10`, both layers accept a 10 stake for `EUR/USD` while enforcing `100` for `BTC/USD`/`ETH/USD` and `500` for `GBP/USD`/`USD/JPY`.

---

## Task 4 — Seed Poisoning Audit

### Database `trading.asset_config` Table State
```text
┌─────────┬──────────────┬─────────────┬───────────┬─────────────────────┬───────────┐
│ (index) │ asset_symbol │ payout_rate │ min_stake │ max_stake_per_trade │ is_active │
├─────────┼──────────────┼─────────────┼───────────┼─────────────────────┼───────────┤
│ 0       │ 'BTC/USD'    │ '0.60'      │ '100.0000'│ '50000.0000'        │ true      │
│ 1       │ 'ETH/USD'    │ '0.60'      │ '100.0000'│ '50000.0000'        │ true      │
│ 2       │ 'EUR/USD'    │ '0.85'      │ '10.0000' │ '1000.0000'         │ true      │  <-- POISONED
│ 3       │ 'GBP/USD'    │ '0.60'      │ '500.0000'│ '500000.0000'       │ true      │
│ 4       │ 'USD/JPY'    │ '0.60'      │ '500.0000'│ '500000.0000'       │ true      │
│ 5       │ 'WTI/USD'    │ '0.60'      │ '500.0000'│ '500000.0000'       │ true      │
│ 6       │ 'XAU/USD'    │ '0.60'      │ '500.0000'│ '500000.0000'       │ true      │
└─────────┴──────────────┴─────────────┴───────────┴─────────────────────┴───────────┘
```

### Source of Poisoning
In `tests/admin/riskDashboard.test.ts` line 195:
```ts
await pgPool.query(
  'UPDATE trading.asset_config SET is_active = true, payout_rate = 0.85, min_stake = 10, max_stake_per_trade = 1000 WHERE asset_symbol = $1',
  ['EUR/USD']
);
```
The test teardown in `riskDashboard.test.ts` hardcoded an UPDATE that set `EUR/USD` `payout_rate = 0.85` and `min_stake = 10` in the shared database.

---

## Root Cause Hypotheses

1. **Asset Config 404 Bug**:
   `adminApiClient.ts` constructs the `PUT` URL by concatenating the raw `symbol` parameter (`EUR/USD`) into the path. Express matches route parameters up to the `/` character, treating `USD` as a non-matching subpath and returning `404 Not Found`.

2. **Payout Unit Mismatch & Perception**:
   The database stores `payout_rate` as a decimal (`0.85` vs `0.60`). Settlement calculates total return as `stake * (1 + payout_rate)` (returning 185 KES on 100 stake for 85%, and 160 KES for 60%). The perception of a mismatch was caused by `EUR/USD` being poisoned to `0.85` while other assets remained at `0.60`.

3. **Stake Validation & Seed Poisoning Bug**:
   Line 195 of `tests/admin/riskDashboard.test.ts` ran an `UPDATE` on test completion that permanently mutated `EUR/USD` in `trading.asset_config` to `payout_rate = 0.85`, `min_stake = 10`, and `max_stake_per_trade = 1000`. This poisoned the database state across trader and admin environments.
