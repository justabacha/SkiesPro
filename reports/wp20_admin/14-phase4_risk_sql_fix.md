# WP-20 Phase 4 Risk Dashboard: SQL Fix, Error Handling & Real DB Integration Test Report

## Status
Executed & Verified

---

## Pre-Check Findings (P1-P4)

### P1. `trading.assets` Schema Verification
From `004_trading_schema_tables.sql`:
```sql
CREATE TABLE IF NOT EXISTS trading.assets (
  symbol VARCHAR(20) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  asset_type VARCHAR(20) NOT NULL CHECK (asset_type IN ('forex','commodity','crypto','index')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
**Finding**: The correct column name on `trading.assets` is `name`, NOT `display_name`.

---

### P2. `AdminController` Exception Handling Audit
```ts
async getRiskDashboard(req: Request, res: Response): Promise<void> {
  const result = await this.risk.getDashboard();
  res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
}

async getRiskExposure(req: Request, res: Response): Promise<void> {
  const result = await this.risk.getExposure();
  res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
}
```
**Finding**: Confirmed that neither method was wrapped in a `try/catch` block. When SQL errors occurred, the unhandled promise rejection caused Express sockets to hang indefinitely.

---

### P3. `useAdminRisk.ts` Swallow Wrappers
```ts
const [m, exp] = await Promise.all([
  adminApiClient.getRiskDashboard(totp_code).catch(() => null),
  adminApiClient.getRiskExposure(totp_code).catch(() => []),
]);
```
**Finding**: Confirmed `.catch(() => null)` and `.catch(() => [])` swallowed backend HTTP errors, preventing error propagation to `setError(...)`.

---

### P4. Verification of Previous Tests
**Finding**: Previous test suites mocked repository responses or setup data in isolation, allowing the invalid column reference `a.display_name` to bypass unit tests.

---

## Task 1 — `getRiskExposure` SQL Fix (`AdminRepository.ts`)

```sql
SELECT 
  ac.asset_symbol AS symbol,
  COALESCE(a.name, ac.asset_symbol) AS display_name,
  CASE WHEN ac.payout_rate <= 1 THEN ac.payout_rate * 100 ELSE ac.payout_rate END::float AS payout_rate,
  ac.min_stake::float AS min_stake,
  ac.max_stake_per_trade::float AS max_stake,
  ac.is_active,
  COALESCE(SUM(CASE WHEN c.contract_type = 'higher' AND c.status = 'active' THEN c.stake ELSE 0 END), 0)::float AS open_call_volume,
  COALESCE(SUM(CASE WHEN c.contract_type = 'lower' AND c.status = 'active' THEN c.stake ELSE 0 END), 0)::float AS open_put_volume,
  COALESCE(SUM(CASE WHEN c.status = 'active' THEN c.stake ELSE 0 END), 0)::float AS net_exposure,
  COALESCE(SUM(CASE WHEN c.status = 'active' THEN c.stake ELSE 0 END), 0)::float AS exposure
FROM trading.asset_config ac
LEFT JOIN trading.assets a ON ac.asset_symbol = a.symbol
LEFT JOIN trading.binary_contracts c ON ac.asset_symbol = c.asset_symbol AND c.status = 'active'
GROUP BY ac.asset_symbol, a.name, ac.payout_rate, ac.min_stake, ac.max_stake_per_trade, ac.is_active
ORDER BY exposure DESC, ac.asset_symbol ASC;
```

---

## Task 2 — Controller Error Handling (`AdminController.ts`)

```ts
async getRiskDashboard(req: Request, res: Response): Promise<void> {
  try {
    const result = await this.risk.getDashboard();
    res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
  } catch (error: any) {
    logger.error('Risk dashboard fetch failed', { error: error.message, code: error.code });
    res.status(500).json({ error: 'Internal server error', code: 'RISK_FETCH_FAILED' });
  }
}

async getRiskExposure(req: Request, res: Response): Promise<void> {
  try {
    const result = await this.risk.getExposure();
    res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
  } catch (error: any) {
    logger.error('Risk exposure fetch failed', { error: error.message, code: error.code });
    res.status(500).json({ error: 'Internal server error', code: 'RISK_FETCH_FAILED' });
  }
}
```

---

## Task 3 — Client Cleanups (`adminApiClient.ts` & `useAdminRisk.ts`)

### `adminApiClient.ts` Win-Ratio Normalization
```ts
platform_win_loss_ratio: Number(d.platform_win_loss_ratio ?? 0)
```

### `useAdminRisk.ts` Error Propagation
```ts
const [m, exp] = await Promise.all([
  adminApiClient.getRiskDashboard(totp_code),
  adminApiClient.getRiskExposure(totp_code),
]);
```

---

## Task 4 — Real DB Integration Test (`tests/admin/riskExposure.integration.test.ts`)

```ts
import { pgPool } from '../../src/config/database.js';
import { AdminRepository } from '../../src/modules/admin/repositories/AdminRepository.js';

describe('Risk Exposure & Dashboard Real DB Integration Tests', () => {
  let adminRepo: AdminRepository;

  it('Real DB Query Test: getRiskExposure executes without SQL errors and returns valid shape', async () => {
    const exposures = await adminRepo.getRiskExposure();
    expect(Array.isArray(exposures)).toBe(true);
    expect(exposures.length).toBeGreaterThan(0);
    // Asserts symbol, display_name, payout_rate, min_stake, max_stake, etc.
  });

  it('Real DB Query Test: getRiskDashboard executes without SQL errors and calculates all metrics', async () => {
    const dashboard = await adminRepo.getRiskDashboard();
    expect(dashboard).toBeDefined();
    expect(typeof dashboard.platform_win_loss_ratio).toBe('number');
  });
});
```

---

## Task 5 — Raw DB SQL Execution Proof

Executed directly against PostgreSQL:
```text
--- Executing getRiskExposure SQL ---
Returned 7 rows.
Sample rows: [
  {
    "symbol": "BTC/USD",
    "display_name": "Bitcoin/US Dollar",
    "payout_rate": 60,
    "min_stake": 100,
    "max_stake": 50000,
    "is_active": true,
    "open_call_volume": 0,
    "open_put_volume": 0,
    "net_exposure": 0,
    "exposure": 0
  },
  {
    "symbol": "ETH/USD",
    "display_name": "Ethereum/US Dollar",
    "payout_rate": 60,
    "min_stake": 100,
    "max_stake": 50000,
    "is_active": true,
    "open_call_volume": 0,
    "open_put_volume": 0,
    "net_exposure": 0,
    "exposure": 0
  },
  {
    "symbol": "EUR/USD",
    "display_name": "Euro/US Dollar",
    "payout_rate": 85,
    "min_stake": 10,
    "max_stake": 1000,
    "is_active": true,
    "open_call_volume": 0,
    "open_put_volume": 0,
    "net_exposure": 0,
    "exposure": 0
  }
]
```

---

## Task 6 — `AdminController.ts` Exception Handling Audit (Tech Debt)

- **Methods WITH `try/catch` (6)**:
  - `retryWithdrawal`
  - `forceCompleteWithdrawal`
  - `forceRefundWithdrawal`
  - `getRiskDashboard` (Added)
  - `getRiskExposure` (Added)
  - `rejectAction`

- **Methods MISSING `try/catch` (28)**:
  - `listUsers`, `getUserById`, `updateUserStatus`, `getUserLedger`
  - `listPendingKyc`, `getKycById`, `reviewKyc`
  - `listWithdrawals`, `listPendingWithdrawals`, `getWithdrawalById`, `approveWithdrawal`, `rejectWithdrawal`
  - `updateAssetConfig`, `listSettings`, `getSettingByKey`, `updateSettings`
  - `getDailyRevenue`, `getTradeVolume`, `getUserRegistrations`, `getSettlementPerformance`
  - `getAuditLogs`, `listTickets`, `getTicketById`, `updateTicket`
  - `adjustWallet`, `approveAction`, `listPendingActions`, `verifyAuditChain`

---

## Verification & Typechecks
- **Backend Typecheck (`npm run typecheck`)**: 0 errors
- **Frontend Typecheck (`cd frontend && npx tsc --noEmit`)**: 0 errors
- **Admin Test Suites (`tests/admin/*`)**: 7/7 test suites passed (33/33 tests green)
- **Git Diff Stat**:
  ```text
   frontend/src/hooks/admin/useAdminRisk.ts           | 10 +--
   frontend/src/pages/admin/RiskDashboardPage.tsx      |  2 +-
   frontend/src/services/admin/adminApiClient.ts     |  3 +-
   src/modules/admin/controllers/AdminController.ts   | 15 +++--
   src/modules/admin/repositories/AdminRepository.ts |  4 +-
   tests/admin/riskExposure.integration.test.ts       | 97 ++++++++++++++++++++++
   6 files changed, 114 insertions(+), 17 deletions(-)
  ```
