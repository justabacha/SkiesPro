# Read-Only Diagnosis Report: Settlement "Contract Not Found" & Price Deviation Spam

## Executive Summary

Render production logs highlighted two recurring non-fatal system issues:
1. **Settlement "Contract Not Found" Loop**: The settlement worker continuously retries processing an orphaned contract ID (`42b41de6-18b5-4000-be57-496fb2baf5c6`) that does not exist in `trading.binary_contracts`. Because the worker calls `nack(true)` (requeue) on "not found" errors, the message loops infinitely.
2. **Price Deviation Spam**: `PriceValidationService` maintains a single global `lastPrices` map per symbol without distinguishing between `source = 'live'` and `source = 'demo'`. Interleaving demo ticks (~1.26) and live ticks (~1.33) for `'GBP/USD'` cross-contaminates the baseline, triggering false-positive `>5%` deviation errors and spamming error logs.

---

## TASK 1 — Settlement "Contract Not Found" Diagnosis

### 1. Database Query Result (`trading.binary_contracts`)
- Query: `SELECT * FROM trading.binary_contracts WHERE id = '42b41de6-18b5-4000-be57-496fb2baf5c6';`
- Result: `[]` (0 rows). The contract does not exist in the database.

### 2. Message Queue / Outbox State (`events.event_outbox`)
- Query: `SELECT * FROM events.event_outbox WHERE aggregate_id = '42b41de6-18b5-4000-be57-496fb2baf5c6' OR payload::text LIKE '%42b41de6%';`
- Result: `[]` (0 rows). The stale retry message originates from message broker redelivery (RabbitMQ/InMemory queue broker backlog).

### 3. Settlement Worker Error-Handling Behavior (`SettlementWorker.ts`)
- In [SettlementWorker.ts:60](file:///C:/SkiesPro/src/modules/trading/workers/settlementWorker.ts#L60):
  ```typescript
  catch (error: any) {
    logger.error('Failed to process settlement message', {
      error: error.message,
      contractId,
    });
    if (contractId) {
      await this.idempotencyService.clearKey(`settle:${contractId}`);
    }
    // Nack with requeue so it can be retried
    nack(true);
  }
  ```
- **Root Cause Hypothesis**: When `contractRepo.findByIdForSettlement(contractId)` returns `null`, `settle()` throws `new Error('Contract ... not found')`. The catch block treats missing contracts as retryable failures and calls `nack(true)`, causing an infinite retry loop for deleted or stale queue messages.

---

## TASK 2 — Price Deviation Spam Diagnosis

### 1. Recent Price Ticks (`pricing.price_ticks` for `GBP/USD`)
- Query: `SELECT mid_price, source, tick_time FROM pricing.price_ticks WHERE symbol = 'GBP/USD' ORDER BY tick_time DESC LIMIT 10;`
- Result snippet:
  - `mid_price`: `"1.261735"`, `source`: `"demo"`
  - `mid_price`: `"1.336705"`, `source`: `"live"`
- **Finding**: Both `demo` and `live` ticks are ingested into the same `pricing.price_ticks` table and validated through the same `PriceValidationService` instance.

### 2. Price Validation Service Configuration (`PriceValidationService.ts`)
- Threshold: `this.thresholdPct = parseFloat(process.env.PRICE_VALIDATION_THRESHOLD_PCT || '0.05');` (5%). Configurable via process.env, not `config.platform_settings`.
- **Source Isolation Flaw**: `PriceValidationService` maintains a single shared `lastPrices` Map keyed solely by `symbol`. It does **not** distinguish between `source = 'live'` and `source = 'demo'`.
- When a `demo` tick (`1.26`) arrives immediately after a `live` tick (`1.33`), `PriceValidationService` compares the new demo price against the last live price, computes a `>5%` deviation (`~5.35%`), logs an abnormal deviation error, and drops the tick.

---

## Recommended Fix Scope (Advisory Only)

1. **Settlement Poison Message Handling**: In `SettlementWorker.ts`, catch missing contract errors (`error.message.includes('not found')`), log a warning, and call `ack()` (acknowledge/discard) instead of `nack(true)` (requeue) so orphaned/stale queue messages are purged automatically.
2. **Price Validator Source Isolation**: Update `PriceValidationService` to namespace `lastPrices` by source (e.g., `symbol:source` key or separate validation instances for live vs. demo feeds) so demo price streams do not cross-contaminate live price validation baselines.

Read-Only Diagnosis Complete
