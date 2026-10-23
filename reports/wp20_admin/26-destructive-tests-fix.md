# Destructive Test Teardown Remediation

**Status: Executed & Verified**

The suite now targets the dedicated Supabase test database through `TEST_DATABASE_URL`; production `DATABASE_URL` was not changed. `tests/setup.ts` now fails closed if Jest starts without the test URL and forces the test URL only when `NODE_ENV=test`.

## Diffs

### `tests/admin/riskDashboard.test.ts`

```diff
-  const TEST_SYMBOL = 'TEST/CFG';
+  const TEST_SYMBOL = `T${uuidv4().replace(/-/g, '').slice(0, 12)}/CFG`;
...
-    await pgPool.query('DELETE FROM trading.contract_events');
-    await pgPool.query('DELETE FROM trading.binary_contracts');
+    dashboardTestUserId = await createTestUser();
...
-    const uId = await createTestUser();
+    const uId = dashboardTestUserId;
```

The zero-division test now runs before the win-ratio fixture so its unchanged global-dashboard assertion observes the empty test database. Created contracts are tracked by ID and deleted in `afterAll`; the dashboard user is tracked by `testUserIds`.

### `tests/payments/b2cDispatchWorker.test.ts`

```diff
-    await pgPool.query("DELETE FROM payments.b2c_outbox WHERE status = 'pending' AND id <> $1", [fixture.outboxId]);
+    await pgPool.query(
+      `DELETE FROM payments.b2c_outbox AS outbox
+       USING payments.withdrawals AS withdrawal
+       WHERE outbox.withdrawal_id = withdrawal.id
+         AND withdrawal.user_id = $1
+         AND outbox.status = 'pending'
+         AND outbox.id <> $2`,
+      [testUserId, fixture.outboxId]
+    );
```

Applied at both call sites. The outbox table has no `user_id`, so filtering through its related withdrawal limits cleanup to this suite's user.

### `tests/demo/demoWallet.integration.test.ts`

```diff
   const originalInitialBalance = process.env.DEMO_INITIAL_BALANCE_KES;
+  let originalEurUsdMinStake: string | undefined;

   beforeAll(async () => {
     process.env.DEMO_INITIAL_BALANCE_KES = '100000';
+    const assetConfig = await pgPool.query<{ min_stake: string }>(
+      'SELECT min_stake FROM trading.asset_config WHERE asset_symbol = $1',
+      ['EUR/USD']
+    );
+    if (!assetConfig.rows[0]) {
+      throw new Error('Missing EUR/USD asset configuration for demo wallet integration test');
+    }
+    originalEurUsdMinStake = assetConfig.rows[0].min_stake;
+    await pgPool.query('UPDATE trading.asset_config SET min_stake = 100 WHERE asset_symbol = $1', [
+      'EUR/USD',
+    ]);

-  beforeEach(async () => {
-    await pgPool.query("DELETE FROM pricing.price_ticks WHERE source = 'demo'");
-  });

   afterAll(async () => {
     ...
     await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [userId]);
+    if (originalEurUsdMinStake !== undefined) {
+      await pgPool.query('UPDATE trading.asset_config SET min_stake = $1 WHERE asset_symbol = $2', [
+        originalEurUsdMinStake,
+        'EUR/USD',
+      ]);
+    }
   });
```

The tests already delete their own inserted tick IDs. To preserve the unchanged 100-unit trade fixture against the seeded 500-unit minimum, `beforeAll` saves the EUR/USD minimum and sets it to 100; `afterAll` restores the saved value. The `...` line indicates unchanged source omitted from this excerpt.

### `tests/trading/integration/settlementIntegration.test.ts`

```diff
-  const testSymbol = 'EUR/USD';
+  const testSymbol = `T${uuidv4().replace(/-/g, '').slice(0, 10).toUpperCase()}/USD`;
...
     // Ensure asset config exists
+    await pgPool.query(
+      `INSERT INTO trading.assets (symbol, name, asset_type, is_active)
+       VALUES ($1, 'Settlement Integration Test Asset', 'forex', TRUE)
+       ON CONFLICT (symbol) DO NOTHING`,
+      [testSymbol]
+    );
     await pgPool.query(
  `INSERT INTO trading.asset_config (asset_symbol, min_stake, max_stake_per_trade, min_duration_seconds, max_duration_seconds, payout_rate, is_active, max_exposure)
   VALUES ($1, '100', '50000', 60, 3600, '0.60', TRUE, '1000000')
-       ON CONFLICT (asset_symbol) DO UPDATE SET is_active = TRUE, payout_rate = '0.60'`,
+       ON CONFLICT (asset_symbol) DO NOTHING`,
       [testSymbol]
     );
...
+    await pgPool.query('DELETE FROM pricing.price_ticks WHERE symbol = $1', [testSymbol]);
+    await pgPool.query('DELETE FROM trading.asset_config WHERE asset_symbol = $1', [testSymbol]);
+    await pgPool.query('DELETE FROM trading.assets WHERE symbol = $1', [testSymbol]);
...
-    // Ensure no ticks exist in the database for any symbol
-    await pgPool.query('DELETE FROM pricing.price_ticks');
```

The unique uppercase symbol matches the normalizer; cleanup is restricted to that symbol and the suite's user. The `...` lines indicate unchanged source omitted from this excerpt. The previous test-user pre-cleanup block was removed entirely; the test creates its own fresh user and cleans up that user's records in `afterAll`.

### `tests/trading/integration/tradingIntegration.test.ts`

```diff
-  const testSymbol = 'EUR/USD';
+  const testSymbol = `T${uuidv4().replace(/-/g, '').slice(0, 10).toUpperCase()}/USD`;
...
+    await pgPool.query(
+      `INSERT INTO trading.assets (symbol, name, asset_type, is_active)
+       VALUES ($1, 'Trading Integration Test Asset', 'forex', TRUE)
+       ON CONFLICT (symbol) DO NOTHING`,
+      [testSymbol]
+    );
   await pgPool.query(
     `INSERT INTO trading.asset_config (asset_symbol, min_stake, max_stake_per_trade, min_duration_seconds, max_duration_seconds, payout_rate, is_active, max_exposure)
      VALUES ($1, 100, 50000, 60, 3600, 0.60, TRUE, 1000000)
      ON CONFLICT (asset_symbol) DO UPDATE SET
       is_active = TRUE,
       max_exposure = 1000000,
       payout_rate = 0.60,
       min_stake = 100,
       max_stake_per_trade = 50000`,
     [testSymbol]
   );
...
+    await pgPool.query('DELETE FROM trading.asset_config WHERE asset_symbol = $1', [testSymbol]);
+    await pgPool.query('DELETE FROM trading.assets WHERE symbol = $1', [testSymbol]);
```

The config upsert now targets a per-run asset instead of mutating the shared EUR/USD seed. The `...` lines above indicate unchanged source omitted from these excerpts.

### `tests/setup.ts`

```diff
 if (process.env.NODE_ENV === 'test') {
+  if (!process.env.TEST_DATABASE_URL) {
+    throw new Error('TEST_DATABASE_URL is required when NODE_ENV=test');
+  }
   process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
 }
...
 process.env.ENABLE_PRICE_FEED = 'false';
+process.env.DEMO_ENABLED = 'false';
```

Disabling the demo feed prevented application import from starting a background writer that had inserted 355 demo ticks during the initial run.

### `migrations/035_admin_schema_and_views.sql`

```diff
-  (SELECT COALESCE(SUM(stake_amount), 0) FROM trading.binary_contracts WHERE status = 'active') AS open_exposure,
+  (SELECT COALESCE(SUM(stake), 0) FROM trading.binary_contracts WHERE status = 'active') AS open_exposure,
```

The migration referenced the pre-022 column name and failed on a fresh database.

No test assertions were changed.

## Migration and validation notes

The first `npm run migrate` applied migrations 001–017, then stopped at 018 because its documented placeholder user was absent. The required migration-only user was inserted into the dedicated test database, and migrations 018–034 were applied. Migration 035 then exposed the stale `stake_amount` reference above; after correction, migrations 035–036 succeeded. Migration 037 required its documented KYC fixture user, which was inserted only into the test database; migrations 037–040 then succeeded.

The initial full-suite attempt reported 374/385 passing and created 355 demo ticks. Those exact rows were removed by their IDs after confirming the test database had started with zero ticks; the test database's EUR/USD config was restored to its migration-seeded values. After the isolation fixes, the changed DB suites passed 37/37.

The repository-wide `rg -n "DELETE FROM" tests/` search found 141 matches in 17 files; the remaining statements are scoped to test-owned IDs, user IDs, related records, or unique fixture symbols. The unscoped/broad-delete scan returned:

```text
$ rg -n "DELETE\s+FROM\s+[\w.]+\s*;|DELETE\s+FROM[^\n]*(status\s*=|WHERE\s+status\s*=)|DELETE\s+FROM\s+trading\.(binary_contracts|contract_events)\s*;|DELETE\s+FROM\s+pricing\.price_ticks\s*;" tests/
No matches found.
```

## Data integrity and full suite

| Check | Before final full runs | After pass 1 | After pass 2 |
|---|---:|---:|---:|
| `SELECT COUNT(*) FROM trading.binary_contracts;` | 0 | 0 | 0 |
| `SELECT COUNT(*) FROM pricing.price_ticks;` | 0 | 0 | 0 |
| Full Jest suite | — | 385/385 | 385/385 |

Pass 1 completed all 57 suites and 385 tests, but Jest remained alive after its summary due to open handles; it was stopped after completion. Pass 2 used `npm test -- --forceExit`, exited successfully, and also passed 57/57 suites and 385/385 tests. `npm run typecheck` passed.
