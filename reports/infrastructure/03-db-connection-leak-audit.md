# READ-ONLY FORENSIC AUDIT — Database Connection Pool Exhaustion

**Date:** October 30, 2026  
**Scope:** Tick ingestion, OHLC persistence, tick retention, PostgreSQL pool configuration, and login error handling  
**Status:** Read-only audit; report added, no source changes made

## Executive Summary

The inspected tick ingestion and retention paths use `pgPool.query` (directly or through repositories), not manually checked-out clients. The inspected `OHLCService` methods also delegate to a repository query and contain no `pool.connect()` call. No un-released checked-out client was found in the requested pricing paths.

There are two operational risks relevant to the reported symptoms:

1. The retention job deletes every expired tick in a single unbounded `DELETE`; it has no `LIMIT` or batching.
2. The login controller maps every exception from `authService.login` to HTTP 401, including database connection errors. This can make a database outage appear as an authentication failure.

The configured pool maximum defaults to 15 connections **per application process**. That is within the example 10–15 range, but is not a guarantee of safety for the Supabase project as a whole: replicas and other services/processes can multiply the total. This source audit does not establish whether the production pool is currently exhausted or prove that a leak elsewhere is absent.

## 1. Connection-Leak Review

### Tick ingestion

`src/modules/pricing/services/PriceFeedIngestionService.ts:197-214`:

```ts
private async flushTicks() {
  if (this.tickBuffer.length === 0) return;

  const ticksToSave = [...this.tickBuffer];

  try {
    await this.tickRepo.saveBatch(ticksToSave);
    this.tickBuffer = this.tickBuffer.filter((t) => !ticksToSave.includes(t));
  } catch (error: any) {
    // logs the failed batch and retains it for retry
  }
}
```

`flushTicks()` itself does not call `pgPool.connect()`. It delegates to `TickRepository.saveBatch()` at line 203. In `src/modules/pricing/repositories/tickRepository.ts:18-23,44-66`, the repository defaults to `pgPool`, and `saveBatch()` issues `this.client.query(...)`. The production wiring in `src/modules/pricing/bootstrap.ts:14-21` constructs the repositories without an injected client, so this path uses the pool-managed query path; there is no manually acquired client to release in this flow.

### OHLC persistence

`src/modules/pricing/services/OHLCService.ts:21-65` (`processTick`) updates the in-memory candle and calls `saveCandle()` when a candle rolls over. `saveCandle()` at lines 67-92 delegates to `this.candleRepo.upsert(...)` at line 80; it does not call `pool.connect()`.

In `src/modules/pricing/repositories/candleRepository.ts:19-27`, the repository defaults to `pgPool`, and `upsert()` executes `this.client.query(...)`. The default construction is visible in `src/modules/pricing/bootstrap.ts:16-17`. No unreleased connection is evident in the requested `processTick()` / `saveCandle()` path.

### Tick retention query

`src/modules/pricing/jobs/TickRetentionJob.ts:35-53` uses `pgPool.query(...)` for both tick and candle cleanup (lines 48-49). It does not check out a client with `pgPool.connect()` and does not contain an explicit `LOCK TABLE`.

## 2. Massive Delete Risk

**MASSIVE DELETE RISK — Table lock likely**

`src/modules/pricing/jobs/TickRetentionJob.ts:39-42`:

```sql
DELETE FROM pricing.price_ticks
WHERE tick_time < NOW() - ($1 || ' hours')::INTERVAL
```

There is **no `LIMIT` clause or batching**. A large backlog can therefore be deleted in one statement, potentially causing high I/O, long-running work, row-lock contention, and substantial dead-tuple/vacuum pressure.

PostgreSQL locking nuance: a `DELETE` takes a `ROW EXCLUSIVE` table-level lock and row-level locks for deleted rows. The table-level lock is not an `ACCESS EXCLUSIVE` lock and does not, by itself, block ordinary reads and writes. The risk is the size and duration of this unbounded operation, rather than a guaranteed full-table exclusive lock.

## 3. Database Pool Configuration

`src/config/database.ts:39-45`:

```ts
export const pgPool = new Pool({
  connectionString: databaseConfig.url,
  max: Number.parseInt(process.env.DB_POOL_MAX || '15', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});
```

The default maximum is **15**; `DB_POOL_MAX` can override it. Fifteen is at the upper end of the example 10–15 range in the audit request, but the effective project-wide connection count depends on process/replica count and other database clients. The 10-second `connectionTimeoutMillis` is consistent with requests eventually reporting a connection-acquisition timeout; it does not by itself identify why connections are unavailable.

## 4. Login 401 Fallback

`src/modules/auth/controllers/authController.ts:30-77` catches errors from the full `authService.login(...)` call. Its catch block is:

```ts
} catch (error) {
  logger.warn('Login failed', { email: req.body.email, error: (error as Error).message });
  res.status(401).json({ error: (error as Error).message });
}
```

This catch does not distinguish invalid credentials from infrastructure failures. Since `AuthService.login()` performs database-backed repository operations (including user lookup, login-attempt updates, and last-login/session work), a database timeout propagated from those calls can be returned as **401 Unauthorized** instead of **500 Internal Server Error**. Thus, the observed 401s are compatible with DB errors being masked at this handler, though this source inspection alone cannot confirm the cause of the production requests.

## Conclusion

No connection leak was identified in the requested price-feed flush, OHLC save/process, or tick-retention paths. The most direct findings are the unbounded retention delete and the login catch-all mapping errors to 401. Investigating any leak elsewhere or confirming current production pool saturation would require broader code/runtime evidence, which was outside this read-only scope.

CONNECTION LEAK AUDIT COMPLETE — NO SOURCE CHANGES MADE
