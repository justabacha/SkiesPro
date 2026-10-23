# Trading Config Join and Frontend Fallback Removal

**Status: Executed & Verified**

## Pre-checks

**P1 — `AssetRepository` SQL before the change.** There is no `getBySymbol()` method in this repository; the corresponding method is `findBySymbol()`.

```sql
-- findBySymbol(symbol)
SELECT *, pip_decimal_places AS "pipDecimalPlaces"
FROM trading.assets
WHERE symbol = $1 AND is_active = TRUE
```

```sql
-- getAllActive()
SELECT *, asset_type AS "assetType", is_active AS "isActive",
       pip_decimal_places AS "pipDecimalPlaces"
FROM trading.assets
WHERE is_active = TRUE
```

**P2 — `OrderForm.tsx` before the change.**

```tsx
const payoutRate = asset?.payoutRate || 0.6;
const minStake = asset?.minStake || 100;
```

**P3 — `tradingService.ts` before the change.** Both the list and detail normalizers substituted 60%/100 when config values were missing:

```ts
// getAssets()
payoutRate: Number(asset.payoutRate) || 0.6,
minStake: Number(asset.minStake) || 100,

// getAssetDetail()
payoutRate: Number(assetData.payoutRate) || 0.6,
minStake: Number(assetData.minStake) || 100,
```

The list/detail service also had hardcoded `DEFAULT_ASSETS` fallback data when the request failed or returned no assets. That masking fallback was removed as well.

**P4 — `trading.asset_config` columns.** Verified read-only against the isolated test database. The relevant current columns are `asset_symbol`, `payout_rate` (`numeric`), `min_stake` (`numeric`), `max_stake_per_trade` (`numeric`), and `is_active` (`boolean`). The table also has `min_duration_seconds`, `max_duration_seconds`, and `max_exposure`.

## Backend SQL change

Both `findBySymbol()` (the existing symbol lookup) and `getAllActive()` now use the same `LEFT JOIN`, returning payout and stake values flat under the frontend's camel-case keys while retaining assets without configuration:

```diff
- SELECT *, asset_type AS "assetType", is_active AS "isActive",
-        pip_decimal_places AS "pipDecimalPlaces"
- FROM trading.assets
- WHERE is_active = TRUE
+ SELECT a.*, a.asset_type AS "assetType", a.is_active AS "isActive",
+        a.pip_decimal_places AS "pipDecimalPlaces",
+        ac.payout_rate AS "payoutRate", ac.min_stake AS "minStake",
+        ac.max_stake_per_trade AS "maxStake"
+ FROM trading.assets a
+ LEFT JOIN trading.asset_config ac ON a.symbol = ac.asset_symbol
+ WHERE a.is_active = TRUE
```

The symbol lookup uses that same `SELECT`/`LEFT JOIN` with `WHERE a.symbol = $1 AND a.is_active = TRUE`. `AssetService.getAssetDetail()` now returns this joined flat asset, matching the detail response the frontend normalizer expects.

## Frontend behavior

`OrderForm` now reads the values without defaults. If either payout or minimum stake is absent, non-finite, or invalid, it disables trading and shows the requested message:

```tsx
const payoutRate = asset?.payoutRate;
const minStake = asset?.minStake;
const hasTradingConfig =
  typeof payoutRate === 'number' &&
  Number.isFinite(payoutRate) &&
  payoutRate >= 0 &&
  typeof minStake === 'number' &&
  Number.isFinite(minStake) &&
  minStake > 0;
```

```text
Trading configuration unavailable for this asset. Please contact support.
```

The list/detail service passes joined values through numerically, preserving missing values as `undefined` rather than substituting 0.6/100. Its hardcoded asset-list fallback was removed. The asset selector displays “Unavailable” rather than a fabricated payout, and the confirmation path rejects missing config instead of creating a pending order with a 60% default.

```diff
- payoutRate: Number(asset.payoutRate) || 0.6,
- minStake: Number(asset.minStake) || 100,
+ payoutRate: asset.payoutRate == null ? undefined : Number(asset.payoutRate),
+ minStake: asset.minStake == null ? undefined : Number(asset.minStake),
```

## Integration test

The trading integration suite creates a unique asset and config with payout `0.75` and minimum stake `250`, then verifies both list and symbol lookups:

```ts
test('asset list joins payout and stake configuration', async () => {
  const repository = new AssetRepository();
  const assets = await repository.getAllActive();
  const asset = assets.find((item) => item.symbol === configJoinTestSymbol);
  const detail = await repository.findBySymbol(configJoinTestSymbol);

  expect(asset).toBeDefined();
  expect(Number(asset?.payoutRate)).toBe(0.75);
  expect(Number(asset?.minStake)).toBe(250);
  expect(Number(detail?.payoutRate)).toBe(0.75);
  expect(Number(detail?.minStake)).toBe(250);
});
```

The fixture is removed by symbol in `afterAll`.

## Verification

- Backend `npm run typecheck`: **0 errors**.
- Frontend `npx tsc --noEmit --project frontend/tsconfig.json`: **0 errors**.
- Focused trading integration suite: **4/4 tests passed**, including the list and detail join assertions.
- Full `npm test` run 1: **57 suites passed; 386 tests passed** (342.979 s; exit code 0).
- Full `npm test` run 2: **57 suites passed; 386 tests passed** (321.485 s; exit code 0).

The full test total is 386 rather than the former 385 because this change adds one integration test. Both runs include that test.

Scoped `git diff --stat` for the requested source and test paths:

```text
 .../modules/trading/components/AssetSelector.tsx   |  9 ++-
 .../src/modules/trading/components/OrderForm.tsx   | 46 +++++++++--
 frontend/src/modules/trading/hooks/useTrading.ts   | 13 +++-
 .../src/modules/trading/services/tradingService.ts | 89 +++-------------------
 .../src/modules/trading/types/trading.types.ts     |  4 +-
 .../trading/repositories/assetRepository.ts        | 26 ++++---
 src/modules/trading/services/assetService.ts       |  5 +-
 .../trading/integration/tradingIntegration.test.ts | 28 +++++++
 8 files changed, 116 insertions(+), 104 deletions(-)
```

`git diff --check` is clean. The existing `package.json` change was already present before this task and is excluded from the scoped stat above.
