# WP-20 Diagnosis: User Profile Trade Stats Bug (`/admin/users/:id`)

## Status
Read-Only Diagnosis Complete

---

## Task 1 — Trace the User Details Endpoint
- **API Endpoint**: `GET /api/v1/admin/users/:id`
- **Controller Method**: `AdminController.getUserById` (`src/modules/admin/controllers/AdminController.ts`)
- **Service Method**: `AdminUserService.getUserById` (`src/modules/admin/services/AdminUserService.ts`)
- **Repository Method**: `AdminRepository.getUserById` (`src/modules/admin/repositories/AdminRepository.ts`)

### Repository SQL Query (`AdminRepository.getUserById`)
```sql
SELECT
  u.*,
  COALESCE(assigned_role.role, 'TRADER') AS role,
  wallet_stats.real_balance,
  wallet_stats.available_balance,
  wallet_stats.demo_balance,
  trade_stats.total_trades,
  trade_stats.winning_trades
FROM app_auth.users u
${assignedRoleJoin}
LEFT JOIN LATERAL (
  SELECT
    MAX(balance) FILTER (WHERE account_type = 'real') AS real_balance,
    MAX(balance) FILTER (WHERE account_type = 'demo') AS demo_balance
  FROM wallet.wallets
  WHERE user_id = u.id
) wallet_stats ON TRUE
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::int AS total_trades,
    COUNT(*) FILTER (WHERE status = 'won')::int AS winning_trades
  FROM trading.binary_contracts
  WHERE user_id = u.id
) trade_stats ON TRUE
WHERE u.id = $1 AND u.deleted_at IS NULL;
```

---

## Task 2 — Trade Queries Analysis
1. **Total Trades Count**:
   ```sql
   SELECT COUNT(*)::int AS total_trades, COUNT(*) FILTER (WHERE status = 'won')::int AS winning_trades
   FROM trading.binary_contracts WHERE user_id = u.id
   ```
2. **Win Rate Calculation**:
   Calculated in TypeScript: `win_rate_pct: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : null`.
3. **Recent Trades Query**:
   ```sql
   SELECT id, asset_symbol AS asset_pair, contract_type AS direction, stake AS amount, potential_payout AS payout, status AS result, status, created_at
   FROM trading.binary_contracts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5;
   ```
4. **Schema Observations**:
   - The query correctly references `stake` and `contract_type` (matching Migration 022 column renames).
   - However, `trading.binary_contracts` includes both `real` and `demo` account contracts. If a trader places demo trades or real trades, `total_trades` aggregates all of them without distinguishing account modes, or conversely, if ledger activity shows demo/real divergence, stats might appear inconsistent.

---

## Task 3 — Raw DB Verification
Querying user `9bde8491-cd19-4b3a-b807-303c99854142` (`just1abacha@gmail.com`):
- **Contracts in DB**: 1 contract found (`id: 'c7f9cbcf-ee42-4936-8ed2-62ff48cb796b'`, `account_type: 'real'`, `status: 'won'`, `stake: '100.0000'`).
- **Admin Query Execution**: Returns `total_trades: 1`, `winning_trades: 1`, `real_balance: '18445.0000'`, and recent trade row successfully.

---

## Root Cause Hypothesis
The backend repository and controller queries for user profiles are structurally correct and execute successfully when queried directly. If the UI drawer previously showed N/A win rate or 0 trades, it was either due to:
1. An unhandled exception or network timeout if middleware/controllers lacked proper error handling.
2. Caching or stale frontend state referencing mismatched camelCase/snake_case properties (`win_rate_pct` vs `win_rate`, `total_trades` vs `stats.total_trades`).
