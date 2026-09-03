# Settlement Module Workers

## Overview
The Settlement Module handles the automated evaluation and payout of expired binary options contracts. It operates as a background worker fleet consuming expiry jobs from RabbitMQ.

## Key Workers

### 1. SettlementWorker
The core processor for contract settlements.
- **Queue**: `trade.expiry`
- **Pattern**: Atomic CAS (Compare-And-Swap) for exactly-once processing.
- **Rules**: Implements the 60% payout ratio and Pip-Tolerance draw rule.
- **Security**: Hardened with a 10s Oracle Gap kill-switch and REPEATABLE READ isolation.

## Technical Details

### Transaction Isolation
Settlement operations use `REPEATABLE READ` isolation to ensure balance integrity and prevent phantom reads during the financial audit trail generation.

### Atomicity
Exactly-once settlement is guaranteed by a two-layer protection:
1. **Infrastructure Level**: RabbitMQ acknowledgments ensure messages are only removed after successful processing.
2. **Database Level**: Atomic CAS (`UPDATE ... WHERE status='active'`) prevents multiple workers from settling the same contract concurrently.

### Data Precision
All financial calculations use `Decimal.js`. Payouts are persisted as strings in the database to maintain bit-perfect precision.

## Configuration
- `ENABLE_SETTLEMENT_WORKER`: Boolean flag to activate the worker.
- `MAX_ORACLE_GAP_MS`: Threshold for stale price detection (default: 10000ms).

## Events
- `TradeSettled`: Emitted via the Transactional Outbox for every terminal state change (Won, Lost, Draw, Cancelled).
