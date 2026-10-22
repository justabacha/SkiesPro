# WP-20 Phase 4 Diagnosis: Risk Dashboard Infinite Loading Bug

## Status
Read-Only Diagnosis Complete

---

## Task 1 — Frontend Fetch Logic & `isLoading` Analysis

### Code Snippet (`frontend/src/hooks/admin/useAdminRisk.ts`)
```ts
const fetchRiskData = useCallback(async (totp_code?: string) => {
  setIsLoading(true);
  setError(null);
  try {
    const [m, exp] = await Promise.all([
      adminApiClient.getRiskDashboard(totp_code).catch(() => null),
      adminApiClient.getRiskExposure(totp_code).catch(() => []),
    ]);
    setMetrics(m);
    setExposures(exp);
  } catch (err) {
    setError((err as Error).message);
  } finally {
    setIsLoading(false);
  }
}, []);
```

### Analysis:
- `setIsLoading(false)` is correctly placed inside the `finally` block of `fetchRiskData`.
- `Promise.all` wraps both API calls with `.catch(() => ...)` handlers.
- **Why it hangs**: `setIsLoading(false)` only executes when the promises in `Promise.all` settle (resolve or reject). If an HTTP request hangs indefinitely on the server without closing the connection or returning an HTTP response, `axios` awaits response headers indefinitely. Consequently, `Promise.all` never settles, and `setIsLoading(false)` in the `finally` block is never reached.

---

## Task 2 — Backend SQL Verification & Execution Results

### 1. `getRiskDashboard` Query (SUCCESS)
```sql
SELECT
  COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0)::int AS total_open_positions,
  COALESCE(SUM(CASE WHEN status = 'active' THEN potential_payout ELSE 0 END), 0)::float AS total_payout_exposure_kes,
  COALESCE((COUNT(CASE WHEN status = 'won' THEN 1 END)::float / NULLIF(COUNT(CASE WHEN status IN ('won', 'lost') THEN 1 END), 0)) * 100, 0)::float AS platform_win_loss_ratio,
  COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN stake ELSE 0 END), 0)::float AS daily_volume_kes,
  COALESCE(COUNT(DISTINCT CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN user_id END), 0)::int AS active_traders_24h,
  0::int AS high_risk_flagged_users,
  COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0)::int AS open_contracts,
  COALESCE(SUM(CASE WHEN status IN ('won', 'lost', 'draw') THEN 1 ELSE 0 END), 0)::int AS settled_contracts,
  COALESCE(SUM(CASE WHEN status = 'active' THEN stake ELSE 0 END), 0)::float AS total_exposure
FROM trading.binary_contracts;
```
**Raw DB Result**:
```json
{
  "total_open_positions": 0,
  "total_payout_exposure_kes": 0,
  "platform_win_loss_ratio": 0,
  "daily_volume_kes": 0,
  "active_traders_24h": 0,
  "high_risk_flagged_users": 0,
  "open_contracts": 0,
  "settled_contracts": 0,
  "total_exposure": 0
}
```

---

### 2. `getRiskExposure` Query (FAILED)
```sql
SELECT 
  ac.asset_symbol AS symbol,
  COALESCE(a.display_name, ac.asset_symbol) AS display_name,
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
GROUP BY ac.asset_symbol, a.display_name, ac.payout_rate, ac.min_stake, ac.max_stake_per_trade, ac.is_active
ORDER BY exposure DESC, ac.asset_symbol ASC;
```

**Raw DB Execution Error**:
```text
error: column a.display_name does not exist
    at PostgreSQL Parser (parse_relation.c:3716)
    code: '42703'
```

---

## Task 3 — Backend Controller & Error Propagation

### Controller Code (`src/modules/admin/controllers/AdminController.ts`)
```ts
async getRiskExposure(req: Request, res: Response): Promise<void> {
  const result = await this.risk.getExposure();
  res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
}
```

### Unhandled Error Propagation Analysis:
1. `AdminController.getRiskExposure` lacks a `try/catch` block.
2. When `this.risk.getExposure()` invokes `AdminRepository.getRiskExposure()` and PostgreSQL throws `column a.display_name does not exist`, the promise returned by the async controller method REJECTS.
3. In Express 4, unhandled promise rejections inside route handlers cause the HTTP request socket to hang indefinitely without returning an HTTP 500 error response to the client.

---

## Root Cause Hypothesis

1. **Primary Cause**: `AdminRepository.getRiskExposure()` references column `a.display_name` on `trading.assets`. In the schema (`004_trading_schema_tables.sql`), the column name is `a.name` (`name VARCHAR(100)`), NOT `display_name`.
2. **Secondary Trigger**: `AdminController.getRiskExposure` does not wrap the service call in a `try/catch` block to return HTTP 500. This causes Express 4 to leave the connection socket open/hanging.
3. **Frontend Symptom**: Because the HTTP socket never responds, `adminApiClient.getRiskExposure` awaits indefinitely, `Promise.all` in `useAdminRisk.ts` never settles, and `setIsLoading(false)` in the `finally` block is never reached—leaving the UI stuck in infinite loading state.
