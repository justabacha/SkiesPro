# WP-20 Phase 6 — Reports & Analytics Fixes

**Status: Executed & Verified**

## Pre-checks

### P1 — `AdminRepository.getReports()` SQL before the change

The repository exposes one `getReports(dateFrom, dateTo)` method containing four report queries (not four separate repository methods). The second query used the stale `stake_amount` column.

```sql
-- Daily revenue
SELECT COALESCE(SUM(amount), 0) AS revenue, DATE(created_at) AS day
FROM payments.deposits
WHERE created_at >= COALESCE($1::timestamptz, NOW() - INTERVAL '30 days')
  AND created_at <= COALESCE($2::timestamptz, NOW())
GROUP BY DATE(created_at)
ORDER BY day DESC
```

```sql
-- Trade volume (the schema drift was SUM(stake_amount))
SELECT COALESCE(SUM(stake_amount), 0) AS volume, DATE(created_at) AS day
FROM trading.binary_contracts
WHERE created_at >= COALESCE($1::timestamptz, NOW() - INTERVAL '30 days')
  AND created_at <= COALESCE($2::timestamptz, NOW())
GROUP BY DATE(created_at)
ORDER BY day DESC
```

```sql
-- User registrations
SELECT COUNT(*)::int AS users, DATE(created_at) AS day
FROM app_auth.users
WHERE created_at >= COALESCE($1::timestamptz, NOW() - INTERVAL '30 days')
  AND created_at <= COALESCE($2::timestamptz, NOW())
GROUP BY DATE(created_at)
ORDER BY day DESC
```

```sql
-- Settlement performance
SELECT COUNT(*)::int AS total_settlements, DATE(created_at) AS day
FROM trading.binary_contracts
WHERE status IN ('won', 'lost', 'draw')
  AND created_at >= COALESCE($1::timestamptz, NOW() - INTERVAL '30 days')
  AND created_at <= COALESCE($2::timestamptz, NOW())
GROUP BY DATE(created_at)
ORDER BY day DESC
```

### P2 — Controller methods before the change

The four report controller methods lacked `try/catch`:

```ts
async getDailyRevenue(req: Request, res: Response): Promise<void> {
  const result = await this.reports.getDailyRevenue(
    req.query.date_from as string,
    req.query.date_to as string
  );
  res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
}

async getTradeVolume(req: Request, res: Response): Promise<void> {
  const result = await this.reports.getTradeVolume(
    req.query.date_from as string,
    req.query.date_to as string
  );
  res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
}

async getUserRegistrations(req: Request, res: Response): Promise<void> {
  const result = await this.reports.getUserRegistrations(
    req.query.date_from as string,
    req.query.date_to as string
  );
  res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
}

async getSettlementPerformance(req: Request, res: Response): Promise<void> {
  const result = await this.reports.getSettlementPerformance(
    req.query.date_from as string,
    req.query.date_to as string
  );
  res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
}
```

The controller already imported the shared `logger`.

### P3 — Frontend before the change

`ReportsDashboardPage` rendered the active tab's rows directly. For Daily Revenue, the data/empty branch was:

```tsx
{dailyRevenue.length > 0 ? (
  <div className="space-y-3">
    {dailyRevenue.map((item, idx) => (
      <div key={idx}>
        <span>{item.date}</span>
        <span>KES {safeFormatNumber(item.revenue_kes)}</span>
        <span>${safeFormatNumber(item.revenue_usd)} USD</span>
      </div>
    ))}
  </div>
) : (
  <div className="p-8 text-center text-xs text-slate-500">No revenue data reported.</div>
)}
```

The other tabs used the same pattern with plain-text empty messages. There was no data-area loading branch. The refresh control only animated its icon. In `useAdminReports`, each Promise was individually caught and converted to `[]`, so an endpoint failure was silently presented as an empty report instead of setting the error state.

## Implementation

### SQL schema drift

```diff
- SELECT COALESCE(SUM(stake_amount), 0) AS volume, DATE(created_at) AS day
+ SELECT COALESCE(SUM(stake), 0) AS volume, DATE(created_at) AS day
```

There are no remaining `stake_amount` references in `AdminRepository.ts` reporting SQL.

### Controller error handling

Each of the four report endpoints now catches failures, logs the report-specific error and request ID through `logger.error`, and responds with the requested 500 payload:

```ts
catch (error) {
  logger.error('Trade volume report fetch failed', {
    error: error instanceof Error ? error.message : String(error),
    request_id: req.correlationId,
  });
  res.status(500).json({ error: 'Internal server error', code: 'REPORT_FETCH_FAILED' });
}
```

The same pattern is applied to daily revenue, user registrations, and settlement performance.

### Frontend loading, empty, and error states

The hook no longer turns individual request failures into empty arrays. Failed report requests now reach the hook's catch, which stores a visible error. The page displays an error banner with a Retry button. Each selected tab renders three pulsing chart-row placeholders while loading. Empty tabs use `TableEmpty` with “No Data Available” and “No metrics found for the selected period.” No CSV/download control existed, so export was not added.

```tsx
{isLoading ? (
  <div className="space-y-3" aria-label="Loading revenue metrics">
    {[1, 2, 3].map((item) => (
      <div key={item} className="h-16 rounded-lg bg-slate-950/60 animate-pulse" />
    ))}
  </div>
) : dailyRevenue.length > 0 ? (
  // Existing revenue rows
) : (
  <TableEmpty
    icon={BarChart3}
    title="No Data Available"
    description="No metrics found for the selected period."
  />
)}
```

## Integration test

Added `tests/admin/adminReports.integration.test.ts`. It creates a uniquely identified test user, asset, and contract with `stake = 1234.50` in the isolated test database, invokes `AdminRepository.getReports()` for the fixture time window, and verifies the aggregate result. Teardown removes only the test contract, its events, asset, and user:

```ts
it('returns trade-volume data using the current stake column', async () => {
  const repository = new AdminRepository();
  const from = new Date(reportTime.getTime() - 1000).toISOString();
  const to = new Date(reportTime.getTime() + 60 * 1000).toISOString();

  const reports = await repository.getReports(from, to);

  expect(reports.tradeVolume).toHaveLength(1);
  expect(Number(reports.tradeVolume[0].volume)).toBe(1234.5);
  expect(reports.tradeVolume[0].day).toBeDefined();
});
```

## Verification

- `npm run typecheck`: **0 errors**.
- `npx tsc --noEmit`: **0 errors**.
- Focused report integration test: **1/1 passed**.
- Full `npm test` run 1: **58 suites passed; 388 tests passed** (337.874 s, exit code 0).
- Full `npm test` run 2: **58 suites passed; 388 tests passed** (329.644 s, exit code 0).

The count is 388 because this change adds one integration test to the 387-test baseline. Both final runs include the new test.

Final tracked-change `git diff --stat`:

```text
 frontend/src/hooks/admin/useAdminReports.ts        | 10 +--
 frontend/src/pages/admin/ReportsDashboardPage.tsx | 74 +++++++++++++++++++----
 src/modules/admin/controllers/AdminController.ts  | 72 ++++++++++++++++------
 src/modules/admin/repositories/AdminRepository.ts |  2 +-
 4 files changed, 120 insertions(+), 38 deletions(-)
```

The new integration test is untracked until staging, so it is not included in Git's default `git diff --stat` output. `git diff --check` is clean.
