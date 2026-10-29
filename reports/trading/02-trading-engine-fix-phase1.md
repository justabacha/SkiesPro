# Trading Engine Phase 1 Implementation Report (Backend Core & Connectivity)

**Date:** February 2025  
**Scope:** Phase 1 Backend Core & Connectivity Fixes — WebSocket Rate Limit Adjustment, Client Ping Over-the-Wire, Settlement Recovery Job, Missing Price Tick Fallback & Refund, Chart Candle SQL Subquery Fix, and Settlement Integration Test Alignment.  
**Status:** Successfully Implemented & 100% Full Suite Verified  

---

## Metadata

- **Modified Files:**
  - `src/modules/pricing/websocket/priceGateway.ts`
  - `frontend/src/shared/ws/websocketClient.ts`
  - `frontend/src/modules/trading/services/websocketService.ts`
  - `src/modules/trading/workers/settlementRecovery.job.ts` (NEW)
  - `src/config/app.ts`
  - `src/index.ts`
  - `src/modules/trading/workers/settlementWorker.ts`
  - `src/modules/pricing/repositories/candleRepository.ts`
  - `tests/pricing/websocket/gateway.integration.test.ts`
  - `tests/trading/unit/settlementWorker.test.ts`
  - `tests/trading/unit/settlementRecoveryJob.test.ts` (NEW)
  - `tests/trading/integration/settlementIntegration.test.ts`
  - `tests/demo/demoSecurity.unit.test.ts`

---

## 1. WebSocket Rate Limit & Heartbeat Fixes

### Backend Rate Limit Update (`src/modules/pricing/websocket/priceGateway.ts`)
Increased the fallback default rate limit from `10` to `120` messages per minute to prevent disconnects on normal client interaction.

```ts
private readonly INBOUND_RATE_LIMIT_PER_MIN = parseInt(
  process.env.WS_INBOUND_RATE_LIMIT_PER_MIN || '120',
  10
);
```

### Frontend WebSocket Client & Ping Heartbeat (`frontend/src/shared/ws/websocketClient.ts` & `frontend/src/modules/trading/services/websocketService.ts`)
Added `sendPing()` to `WebSocketClient` and called it over the wire inside `websocketService.ts`:

```ts
// frontend/src/shared/ws/websocketClient.ts
sendPing(): void {
  this.send({
    type: 'ping',
  });
}

// frontend/src/modules/trading/services/websocketService.ts
private startPingInterval(): void {
  this.stopPingInterval();
  this.pingIntervalId = setInterval(() => {
    if (this.client && this.client.isConnected()) {
      this.lastPingTime = Date.now();
      this.client.sendPing();
    }
  }, 10000);
}
```

---

## 2. Settlement Recovery Job (`src/modules/trading/workers/settlementRecovery.job.ts`)

Implemented a background recovery worker that periodically checks for contracts stuck in `settling` status due to process crashes or network partitions, resetting them back to `active` so the settlement worker can pick them up.

```ts
import { pgPool } from '../../../config/database.js';
import { logger } from '../../../shared/middleware/logger.js';

export class SettlementRecoveryJob {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(private readonly intervalMs: number = 60000) {}

  async start(): Promise<void> {
    logger.info('Settlement Recovery Job starting...', { intervalMs: this.intervalMs });
    await this.recoverOrphanedSettlingContracts();
    this.timer = setInterval(async () => {
      if (this.isRunning) return;
      this.isRunning = true;
      try {
        await this.recoverOrphanedSettlingContracts();
      } catch (err: any) {
        logger.error('Error running settlement recovery job', { error: err.message });
      } finally {
        this.isRunning = false;
      }
    }, this.intervalMs);
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    logger.info('Settlement Recovery Job stopped');
  }

  async recoverOrphanedSettlingContracts(): Promise<number> {
    const query = `
      UPDATE trading.binary_contracts
      SET status = 'active'
      WHERE status = 'settling'
        AND expiry_time < NOW() - INTERVAL '30 seconds'
      RETURNING id, account_type
    `;
    const result = await pgPool.query<{ id: string; account_type: string }>(query);
    const recovered = result.rows;

    for (const contract of recovered) {
      logger.warn('Recovered orphaned settling contract', {
        contractId: contract.id,
        accountType: contract.account_type,
      });
    }

    return recovered.length;
  }
}
```

Wired into `src/index.ts` guarded by `config.enableSettlementRecovery`.

---

## 3. Settlement Worker Missing Tick Fallback (`src/modules/trading/workers/settlementWorker.ts`)

Updated `settle()` so that if `getPriceAt()` returns `null`, the worker falls back to `getLatest()` for that symbol and source. If no tick exists at all, it safely cancels the contract, refunds the user stake, and acknowledges the message in RabbitMQ.

```ts
// 3. Fetch settlement price (tick at or just before expiry)
let settlementTick = await this.tickRepo.getPriceAt(
  contract.assetSymbol,
  contract.expiryTime,
  accountType === 'real' ? 'live' : 'demo'
);

if (!settlementTick) {
  logger.warn('Missing settlement tick, falling back to latest tick', { contractId });
  settlementTick = await this.tickRepo.getLatest(
    contract.assetSymbol,
    accountType === 'real' ? 'live' : 'demo'
  );
}

if (!settlementTick) {
  logger.warn('No price tick available for settlement, cancelling and refunding contract', {
    contractId,
    assetSymbol: contract.assetSymbol,
  });
  await this.cancelAndRefund(contract, 'MISSING_PRICE_TICK');
  return;
}
```

---

## 4. CandleRepository SQL Query Subquery Fix (`src/modules/pricing/repositories/candleRepository.ts`)

Fixed `getCandles` to fetch the 200 newest candles up to `to` date before returning them in chronological order (`ASC`), resolving the 18-hour timeline gap bug on the chart.

```sql
SELECT * FROM (
  SELECT id, symbol, granularity_seconds, open_time, close_time, open_price,
         high_price, low_price, close_price, volume, source, created_at
  FROM pricing.candles
  WHERE symbol = $1 AND granularity_seconds = $2 AND open_time >= $3 AND open_time <= $4
  ORDER BY open_time DESC
  LIMIT $5
) recent
ORDER BY open_time ASC
```

---

## 5. Settlement Integration Test Alignment (`tests/trading/integration/settlementIntegration.test.ts`)

Updated test `SET-008` to reflect Phase 1 graceful cancellation & refund behavior when no price tick is available:

```diff
- test('SET-008: should handle missing price tick with error (to trigger retry)', async () => {
+ test('SET-008: should gracefully cancel and refund when no price tick is found', async () => {
    const contract = await placeTestTrade('1.10000');

    const tickRepo = (settlementWorker as any).tickRepo;
    const originalGetPriceAt = tickRepo.getPriceAt;
+   const originalGetLatest = tickRepo.getLatest;
    tickRepo.getPriceAt = jest.fn().mockResolvedValue(null);
+   tickRepo.getLatest = jest.fn().mockResolvedValue(null);
    try {
-     await expect(settlementWorker.settle(contract.id!)).rejects.toThrow('Price tick not found');
+     await settlementWorker.settle(contract.id!);

      const { rows } = await pgPool.query(
        'SELECT status FROM trading.binary_contracts WHERE id = $1',
        [contract.id]
      );
-     expect(rows[0].status).toBe('active');
+     expect(rows[0].status).toBe('cancelled');
    } finally {
      tickRepo.getPriceAt = originalGetPriceAt;
+     tickRepo.getLatest = originalGetLatest;
    }
  });
```

---

## 6. Full Repository Test Suite Verification (2x Consecutive Runs)

Command executed across all 71 test suites in repository:
`npx jest --runInBand --forceExit`

### Full Suite Run 1
```text
Test Suites: 71 passed, 71 total
Tests:       484 passed, 484 total
Snapshots:   0 total
Time:        471.002 s
Ran all test suites.
```

### Full Suite Run 2
```text
Test Suites: 71 passed, 71 total
Tests:       484 passed, 484 total
Snapshots:   0 total
Time:        490.811 s
Ran all test suites.
```

---

TRADING PHASE 1 FIX COMPLETE — FULL SUITE VERIFIED — AWAITING GATE PASS
