# WP-21 Revised Specification Note

**Date:** 2026-10-04
**Specification:** `work-packages/WP-21_DEMO_TRADE_SURFACE.md`
**Basis:** `reports/WP-21_INDEPENDENT_ARCHITECTURAL_REVIEW.md`
**Status:** Specification revised to address all 11 findings. This note records design requirements; it is not evidence that implementation or deployment is complete.

## Review Finding Resolution Map

| # | Review finding | Specification change |
|---|---|---|
| 1 | Wallet queries become nondeterministic after allowing two wallets per user. | §4.6 now requires account type on every wallet repository and service read/mutation, including create and lock paths; no mode-less overload/default is allowed. M-Pesa callback/credit, real trade, real settlement, real wallet reads, and withdrawals explicitly use `real`; demo paths explicitly use `demo`. |
| 2 | Ledger migration leaves the migration-026 CHECK active and omits supported reference values. | §4.2 identifies both historical constraint names (`wallet_ledger_entries_reference_type_check` and `ledger_entries_reference_type_check`), requires dropping both and leaving one authoritative CHECK containing all migration-003 and migration-026 real values plus `demo_funding`, `demo_reset`, `demo_trade_stake`, and `demo_trade_payout`. Full-chain/deployed-schema verification is mandatory. |
| 3 | Demo ticks can be selected for real settlement. | §4.5 requires explicit source for tick writes and reads, including `getLatest` and `getPriceAt`; §4.6 requires live settlement to pass `live` and demo settlement to pass `demo`, with interleaved-source integration tests. |
| 4 | Shared contracts contaminate exposure, user history, and real reports. | §4.2 requires recreating both real reporting materialized views with `account_type='real'`; §4.6 requires account-type filters for every contract query and exposure calculation and testing that demo data leaves real reports/exposure unchanged. |
| 5 | Contract account mode is not propagated end to end. | §4.6 requires a non-optional typed `BinaryContract.accountType`, persistence/mapping, account-scoped repository APIs and settlement dispatch. Missing/invalid persisted mode fails closed and cannot fall through to either wallet path. Outbox payloads require typed `accountType`. |
| 6 | Demo ledger references do not themselves prevent cross-mode credits/debits. | §4.2 and §4.6 require a database-level ledger-reference/account-mode guard as well as typed service APIs. Demo references against real wallets and real references against demo wallets must fail and roll back. |
| 7 | Route separation alone does not isolate shared price transport or all relevant import paths. | §4.1 and §4.5 define isolated demo cache, publisher, gateway/channel, and quote paths; prohibit demo publication to live channels; and extend import-boundary checks to `DemoTradingService` and shared settlement code. Adapter-instantiation and live-channel tests are required. |
| 8 | A caller-provided demo flag could bypass the live Tier-3 circuit breaker. | §4.6 and §4.7 define `TradingService` as real-only, remove request/user-supplied mode as authority, and require demo trading to use its own service/mock quote path. The real circuit breaker is unconditional for live trades. |
| 9 | Mode changes can leave stale requests, state, channels, or independent wallet copies. | §4.4 requires the provider above `RouterProvider` and the app shell, a shared wallet cache keyed by user and mode, invalidation/abort and stale-response rejection, complete old-mode state cleanup, pending-order confirmation behavior, and prior WS unsubscription before new-mode subscription. Wallet/payment screens remain real-only. UI race tests are required. |
| 10 | Reset behavior with open trades, ledger accounting, idempotency, and rate-limit failure is undefined. | §4.6.1 specifies reject-on-active-or-settling reset, zero locked balance, atomic balance delta ledgering, idempotent initial funding/reset, a durable per-user reset-event log, a maximum of five successful resets in any rolling 60-minute interval, and fail-closed `503` behavior. Concurrency and failure tests are required. |
| 11 | Owner decisions and retention behavior were still unresolved while configuration enabled demo by default. | §2.4 and §5 make owner ratification of initial balance, tick storage, and retention mandatory before implementation/migration. Demo is disabled by default; missing configuration does not seed a balance or enable routes. Tick retention is constrained by active settlement needs and retained settlement evidence; ledger/audit records are not pruned. |

## Execution Gate

The owner subsequently ratified the KES 100,000 initial demo balance, five successful resets per rolling hour/user, and shared `pricing.price_ticks` storage with `source='demo'`. The owner also set tick retention to 30 days on 2026-10-04, superseding the original 90-day proposal. Migration 033 and the follow-on configurable-retention migration 034 were applied to the confirmed disposable test database; production deployment remains subject to the normal migration and release process.
