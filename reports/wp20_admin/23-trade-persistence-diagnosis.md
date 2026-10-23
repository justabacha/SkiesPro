# WP-20 Read-Only Diagnosis: Missing Trade History & Destructive Test Teardown Bug

## Status
Read-Only Diagnosis Complete

---

## Task 1 — The Write Path (Trade Placement)

- **API Endpoint**: `POST /api/v1/trading/place`
- **Service Method**: `TradingService.placeTrade` (`src/modules/trading/services/tradingService.ts`)
- **Repository Method**: `ContractRepository.create` (`src/modules/trading/repositories/contractRepository.ts`)

### SQL `INSERT` Statement (`ContractRepository.create`)
```sql
INSERT INTO trading.binary_contracts (
  user_id, asset_symbol, stake, contract_type, strike_price,
  payout_rate, potential_payout, purchase_time, expiry_time, status, lock_tx_id,
  account_type
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
RETURNING *;
```

### Transactionality & Error Check:
- Trade placement occurs inside an explicit database transaction (`BEGIN ... COMMIT`) wrapping wallet debit and contract creation.
- The write path operates correctly and commits the transaction without throwing database errors.

---

## Task 2 — The Read Path (Trade History)

- **API Endpoint**: `GET /api/v1/trading/history`
- **Service Method**: `TradingService.getUserContracts`
- **Repository Method**: `ContractRepository.listByUser` (`src/modules/trading/repositories/contractRepository.ts`)

### SQL `SELECT` Query (`ContractRepository.listByUser`)
```sql
SELECT * 
FROM trading.binary_contracts 
WHERE user_id = $1 AND account_type = $2 
ORDER BY purchase_time DESC 
LIMIT $3;
```

### Filtering Analysis:
- Filters strictly by `user_id` and `account_type` (`'real'` or `'demo'`).
- Does NOT filter out `status = 'cancelled'`, `status = 'won'`, or `status = 'lost'`. All valid trades matching `account_type` are queried.

---

## Task 3 — Test Teardown Audit (Catastrophic Global TRUNCATE)

In `tests/admin/riskDashboard.test.ts`:
- **Line 31** (`beforeAll`): `await pgPool.query('DELETE FROM trading.binary_contracts');`
- **Line 104** (`Win Ratio Math` test): `await pgPool.query('DELETE FROM trading.binary_contracts');`
- **Line 140** (`Zero Division` test): `await pgPool.query('DELETE FROM trading.binary_contracts');`

**Destructive Impact**:
`tests/admin/riskDashboard.test.ts` executes un-scoped `DELETE FROM trading.binary_contracts;` statements without a `WHERE user_id = $1` filter. Every time `npm test` or `riskDashboard.test.ts` runs against the database, **it wipes all trades for every user across the entire platform**.

---

## Task 4 — Raw Database Verification Output

1. **Total Trades Count in Database**:
   ```sql
   SELECT COUNT(*) FROM trading.binary_contracts;
   -- Output: 1
   ```

2. **Trades for `just1abacha@gmail.com` (`9bde8491-cd19-4b3a-b807-303c99854142`)**:
   ```sql
   SELECT id, user_id, asset_symbol, status, account_type, created_at 
   FROM trading.binary_contracts 
   WHERE user_id = '9bde8491-cd19-4b3a-b807-303c99854142' 
   ORDER BY created_at DESC LIMIT 5;
   ```
   **Output**:
   ```json
   [
     {
       "id": "e45250b6-f2ff-46a6-8c65-d6e1294c86a5",
       "user_id": "9bde8491-cd19-4b3a-b807-303c99854142",
       "asset_symbol": "EUR/USD",
       "status": "cancelled",
       "account_type": "real",
       "created_at": "2026-10-23T01:19:06.251Z"
     }
   ]
   ```

3. **Total Trades Across All Users in Last 24 Hours**:
   ```sql
   SELECT id, user_id, status, created_at 
   FROM trading.binary_contracts 
   WHERE created_at > NOW() - INTERVAL '24 hours'
   ORDER BY created_at DESC;
   ```
   **Output**:
   ```json
   [
     {
       "id": "e45250b6-f2ff-46a6-8c65-d6e1294c86a5",
       "user_id": "9bde8491-cd19-4b3a-b807-303c99854142",
       "status": "cancelled",
       "created_at": "2026-10-23T01:19:06.251Z"
     }
   ]
   ```

---

## Root Cause Hypothesis

The trade placement write path (`POST /api/v1/trading/place`) and trade history read path (`GET /api/v1/trading/history`) are functioning correctly. However, `tests/admin/riskDashboard.test.ts` contains global, un-scoped `DELETE FROM trading.binary_contracts;` statements in lines 31, 104, and 140. When tests run against the shared database, this test file executes a full table wipe that permanently deletes all trade history for every user on the platform.
