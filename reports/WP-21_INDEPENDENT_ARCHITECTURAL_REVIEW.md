# WP-21 Independent Architectural Review

**Review date:** 2026-10-04  
**Scope:** `work-packages/WP-21_DEMO_TRADE_SURFACE.md` reviewed against the current `src/`, `frontend/src/`, `migrations/`, and `reports/` implementation.  
**Verdict:** **REJECTED / NEEDS REVISION**  
**Execution readiness:** **38/100**

## Executive Summary

WP-21 identifies the right isolation dimensions—wallet account type, contract account type, tick source, separate demo routes, and explicit DEMO UX—but its proposed migration and service integration do not yet preserve the existing system's real-money invariants. Most importantly, after a second wallet is allowed per user, current wallet lookups and payment callbacks still select by `user_id` only; demo ticks can be selected by the live settlement query; the proposed ledger constraint does not replace the currently active constraint; and existing reporting and exposure queries include all contracts. These are concrete data-integrity and financial-isolation blockers, not merely implementation details.

The scope is a blueprint rather than a change set: there is no `033_demo_account_isolation.sql` or implemented `src/modules/demo/` to execute or validate. The review therefore assesses whether the specified plan is safe to implement against current behavior. It is not ready for implementation or production migration until the blockers below are incorporated into the design.

## Architectural Strengths

- The plan correctly chooses explicit `real`/`demo` wallet and contract discriminators and `live`/`demo` tick provenance instead of treating a UI toggle as the security boundary (§4.1–§4.2).
- A dedicated `MockPriceAdapter`, separate demo price channels/cache namespace, and no need for upstream feeds are appropriate isolation goals (§4.1, §4.5).
- JWT-derived user identity, user-scoped demo reads, idempotency, a reset limit, a distinct endpoint namespace, and a visible DEMO state are sound requirements (§4.3, §4.4, §4.7).
- Reusing the pure `PayoutService` calculation can avoid outcome-rule drift. Keeping CAS settlement, oracle-gap handling, and transactional outbox behavior is also a reasonable target (§4.6).
- The listed integration/UI/security cases include useful core invariants, notably checking that demo activity leaves real wallet balances unchanged and that demo clients do not consume live price channels (§6).

## Flagged Risks & Suggestions

### 1. HIGH — Existing wallet operations become nondeterministic after relaxing uniqueness

**WP reference:** §4.2, lines 160–166; §4.7, lines 253–256.  
**Existing implementation:** `wallet.wallets` has `UNIQUE(user_id)` in `migrations/003_wallet_schema_tables.sql:14`; `WalletRepository.findByUserId()` and `findByUserIdForUpdate()` filter only on `user_id` (`src/modules/wallet/repositories/walletRepository.ts:22–34`). `WalletService` uses those lookups for creation, reads, credits, debits, and fund locks (`src/modules/wallet/services/walletService.ts`). M-Pesa callback and withdrawal flows call those unqualified mutations (`src/modules/payments/services/paymentService.ts`).

Replacing `UNIQUE(user_id)` with `UNIQUE(user_id, account_type)` allows two rows to match existing `WHERE user_id = $1` lookups. PostgreSQL does not promise which matching row is returned by `rows[0]`; `FOR UPDATE` can lock both rows but still returns an arbitrary first row. This affects existing real paths, including payment credits and withdrawals, as well as balance display and trading debit. Depending on query plan/row order, a real deposit can be recorded against a demo wallet, or a live trade/withdrawal can mutate the demo wallet. The wallet primary key and ledger `wallet_id` foreign key remain valid, but the application-level association to the real account is no longer safe.

**Required revision:** Make account type mandatory in repository/service method signatures and in every wallet read/mutation predicate. Existing payment, real trading, and settlement paths must explicitly use `real`; demo paths must explicitly use `demo`. Make wallet creation explicit and race-safe per `(user_id, account_type)`. Fail closed if callers omit the mode. Add regression tests for M-Pesa credit, withdrawal locking, live trade debit/payout, and demo activity with both wallet rows present.

### 2. HIGH — Ledger CHECK migration leaves an incompatible active constraint

**WP reference:** §4.2, lines 168–176.  
**Existing schema:** `migrations/003_wallet_schema_tables.sql:25` defines `wallet_ledger_entries_reference_type_check` with the original values. `migrations/026_add_available_balance_trigger.sql:42–53` drops a differently named constraint (`ledger_entries_reference_type_check`) and recreates that constraint with the current set: `trade_win`, `trade_loss`, `trade_draw`, `fee`, `referral_bonus`, and `platform_revenue`, among others.

The WP migration drops/recreates only `wallet_ledger_entries_reference_type_check`. It leaves the `ledger_entries_reference_type_check` from migration 026 active. PostgreSQL applies both CHECK constraints, so demo types such as `demo_trade_stake` and `demo_trade_payout` remain rejected by the surviving constraint. In addition, the proposed replacement list omits current ledger values such as `trade_win`, `trade_draw`, `fee`, `referral_bonus`, and `platform_revenue`; those entries would be rejected by the new constraint even if the old constraint were removed.

**Required revision:** Inspect and reconcile all actual constraint names and values in the deployed schema. Replace the active constraint(s) with one authoritative CHECK containing the complete currently supported set plus the demo types. Add a migration test against a database built by applying the full migration chain, asserting both existing real reference types and all proposed demo reference types insert successfully.

### 3. HIGH — Demo ticks can settle real contracts

**WP reference:** §4.2, lines 184–189; §4.5 item 4; §4.6 settlement paragraph; §9 risk table.  
**Existing implementation:** `TickRepository.getPriceAt()` selects by `symbol` and `tick_time` only (`src/modules/pricing/repositories/tickRepository.ts:70–81`); `SettlementWorker.settle()` uses it for every contract (`src/modules/trading/workers/settlementWorker.ts:104–107`). The existing `getLatest()` query is similarly unqualified.

Adding `source` to `pricing.price_ticks` does not change these queries. Writing demo ticks into the shared table creates a straightforward price-provenance leak: the latest eligible demo tick for a symbol can be used to calculate a real contract's payout. The index includes `source`, but an index is not an isolation predicate.

**Required revision:** Require explicit source parameters in all tick repository methods and make real settlement, real latest-price lookups, and any other live consumers explicitly select `source='live'`; demo consumers must explicitly select `source='demo'`. Do not use an implicit/default source in settlement. Test interleaved live/demo ticks at the same symbol and expiry and prove each settlement chooses only its own source.

### 4. HIGH — Shared contracts pollute real reporting and exposure limits

**WP reference:** §4.2, lines 178–182; §4.6; §6 integration case `DEMO-INT-001..008`.  
**Existing implementation:** `ContractRepository.getActiveExposure()` sums all active contracts for a symbol (`src/modules/trading/repositories/contractRepository.ts:66–71`). `listByUser()` and `getActiveByUser()` filter by user/status, not account type (`:80–110`). Reporting materialized views aggregate all rows in `trading.binary_contracts` (`migrations/013_reporting_views.sql:19–62`, also recreated in `migrations/019_add_critical_columns.sql:118–136`).

Once demo contracts share this table, they will count toward live platform exposure, appear in the same user's live history/active positions, and enter daily trade volume/revenue/user reporting. The WP's test expectation that demo contracts do not affect real exposure is not backed by a query or schema rule. There is no account-type filter in the existing report definitions, and adding the column does not alter materialized views.

**Required revision:** Parameterize contract repository APIs with account type and filter every list, active, and exposure query. Define whether exposure is isolated per account mode, per demo user, or platform-wide, then implement that exact rule. Recreate/update reporting views to explicitly include only `account_type='real'` for real-money reports (and create separate demo reporting if wanted). Add tests showing demo trades do not change real exposure, real UI results, or real reporting aggregates.

### 5. HIGH — Contract type is not yet propagated through the actual repository and settlement model

**WP reference:** §3.4 WP-21.5–21.6; §4.6; §8.2.  
**Existing implementation:** `BinaryContract` has no `accountType`, `ContractRepository.create()` does not write it, and `mapToCamelCase()` does not read it (`src/modules/trading/repositories/contractRepository.ts`). Its queries do not consistently scope by account type. `SettlementWorker` relies on that repository mapping and credits through `WalletService` without a wallet mode.

The spec says that the worker branches on `contract.account_type`, but no end-to-end contract type is defined for the TypeScript model, persistence mapping, worker payload, payout credit, or outbox consumer contract. An omitted/null/unknown value must not silently follow the real branch or a default-real wallet path.

**Required revision:** Make account type a typed, non-optional property in the persisted contract model, repository inputs/outputs, settlement dispatch, and settlement wallet calls. Treat missing or invalid account type as a hard settlement failure and alert; never default a legacy/malformed contract to real or demo based on request data. Define the `TradeSettled` outbox schema and ensure every consumer either handles or safely ignores `accountType='demo'`.

### 6. HIGH — The proposed ledger references alone do not enforce wallet isolation

**WP reference:** §4.2 lines 168–176; §4.6; §4.7 lines 253–259.  
The WP adds demo transaction reference strings but does not bind a reference type to the wallet's `account_type`. The current `WalletService.credit()` accepts a free-form `referenceType: string`, and `LedgerService.recordEntry()` records it without checking wallet mode. A code-path mistake in reset, payout, or funding can therefore record `demo_reset` or `demo_trade_payout` against a real wallet, or real payment references against a demo wallet; the CHECK constraint only validates spelling.

**Required revision:** Use account-type-specific mutation APIs with typed reference unions and database/service-level enforcement that demo references can only mutate demo wallets and real payment/trade references can only mutate real wallets. Demo funding/reset should not share an unrestricted generic credit API with live payments. Add negative tests that deliberately attempt each cross-mode mutation and assert transaction rollback.

### 7. MEDIUM — “Physically separate routes/imports” do not by themselves isolate feeds, and the existing WS path is live-only

**WP reference:** §4.1, §4.3, §4.5, §4.7, §7.1.  
**Existing implementation:** No `src/modules/demo/` module or demo route is present. `src/infrastructure/routes.ts:33–38` mounts only existing modules. `PriceDistributionService` publishes both `ticks:{symbol}` and `ticks:all` in the shared `pricing` cluster (`src/modules/pricing/services/priceDistributionService.ts:24–30`); `PriceTickSubscriber` forwards those messages to `price.{symbol}` and `price.all` (`src/modules/pricing/websocket/priceTickSubscriber.ts`). `PriceGateway` and the frontend `websocketService` currently implement those live channels only.

The plan names a static-analysis gate for `src/modules/demo/**`, but the demo trading service is located under `src/modules/trading/services/`, and settlement changes are in the shared worker. A directory import rule alone cannot protect those paths. Reusing the current tick distribution or subscriber would also publish demo prices into live channels; simply adding `source` to the database does not prevent it. In the frontend, the existing price hook also requests the live pricing REST endpoint.

**Required revision:** Specify and implement separate demo publish/subscribe/cache namespaces end to end, including gateway authorization/channel validation, quote REST routes, cache keys, and frontend teardown on mode changes. Apply import-boundary rules to the actual demo service and shared settlement boundary, and add tests/spies proving demo operations instantiate no Kraken/Coinbase clients and never publish to live channels. Keep the bypass of upstream adapters enforced at construction and deployment wiring, not only by code review convention.

### 8. MEDIUM — Existing circuit-breaker bypass is too permissive to reuse for demo routing

**Existing implementation:** `TradingService.placeTrade()` treats `user.is_demo`, `request.is_demo`, or `user.account_type === 'demo'` as authority to bypass the Tier-3 block (`src/modules/trading/services/tradingService.ts:62–76`), including a value taken from the request object. The current HTTP controller does not forward an `is_demo` field, but the service-level condition creates a dangerous pattern for future callers.

The WP says the circuit breaker remains for real trades and demo trades may continue (§4.6–§4.7), but does not explicitly forbid demo endpoints from calling the real `TradingService` with a caller-controlled flag. Route namespace and JWT authentication do not establish wallet/account mode.

**Required revision:** Remove request-supplied demo state as authority. Derive mode from the server-side route/service boundary and persisted wallet/contract mode; real trade entry points must always enforce the real feed-tier guard. Demo services should use a dedicated mock-price and demo-wallet path and should not invoke live trade placement with a `is_demo` flag.

### 9. MEDIUM — Mode switching needs explicit stale-response and state-reset handling

**WP reference:** §4.4 anti-confusion requirements; §4.7; §6 UI cases.  
**Existing implementation:** `App.tsx` currently wraps only `RouterProvider`; `AppLayout` renders `Navbar` outside the route outlet. `useWallet()` keeps its own component-local state and polls independently. `useTrading()` keeps pending orders, active contracts, history, and settlement events in local hook state. `usePriceStream()` fetches a live REST quote and shares a singleton websocket service. `OrderForm` stores stake/expiry in shared local-storage keys.

The spec declares `AccountModeContext` the source of truth and requires clearing a pending order, but does not define provider placement/lifetime or the state-transition contract. Updating endpoints alone leaves active/history data and pending orders in the existing hook state. Concurrent requests from the old mode can complete after a toggle and overwrite the new balance/contract state; multiple `useWallet` instances can also display different stale values until their independent polls finish. The request to confirm a switch with an open pending order is not reconciled with clearing that order.

**Required revision:** Put the mode provider above both `Navbar` and routed content; key or clear wallet/trading/price state by `(userId, accountMode)`; cancel/invalidate in-flight requests and unsubscribe the previous channel on mode changes; reset pending confirmation state under a single documented confirmation flow. Keep deposits, withdrawals, and wallet pages explicitly real-only even when the global trading mode is demo. Add deferred-response race tests and verify no live quote remains visible during/after a switch.

### 10. MEDIUM — Reset semantics, active contracts, idempotency, and rate limits are underspecified

**WP reference:** §2.4, §4.3, §4.7, §5.2, §6.  
The reset endpoint promises a refill “at any time,” but does not define behavior when demo contracts are active or how `balance`, `locked_balance`, and `available_balance` change atomically. The current database trigger enforces `available_balance = balance - locked_balance` and rejects negative available balance (`migrations/026_add_available_balance_trigger.sql:15–26`). A reset that overwrites the balance below the locked amount can fail or violate user-visible accounting expectations. The migration adds `demo_funding` and `demo_reset`, but the initial funding/reset ledger transaction semantics, amount, and treatment of repeated resets are not specified as a precise ledger invariant.

The “5/hour/user” reset limit and idempotency requirement name desired behavior but not storage, atomicity, replay response, concurrency handling, or what happens when the limiter is unavailable. Existing trading rate limiting is 10 requests/second and explicitly fails open when cache operations fail (`src/modules/trading/middleware/tradingMiddleware.ts`); it is not a substitute for an account-scoped reset quota.

**Required revision:** Decide whether reset is rejected while trades are active or atomically cancels/refunds them; define the exact wallet/ledger balance equation and transaction boundary. Use durable/distributed per-user rate limiting and idempotency for financial mutations, with a defined fail-closed policy if rate-limit storage is unavailable. Add concurrent reset/place/settle tests and an explicit partial-failure/retry case.

### 11. MEDIUM — Owner decisions are still marked blockers

**WP reference:** §2.4 and §5.1–§5.2.  
The initial balance and tick storage strategy are explicitly marked “Blocker? Yes,” and values are proposals pending owner confirmation. The later environment example hardcodes the proposed 100,000 KES value and enables the frontend demo flag, but configuration examples do not constitute approval. The retention period is stated as a default without any retention/deletion implementation or effect on shared ticks/contracts/ledger rows.

**Required revision:** Record owner decisions before implementation, keep demo disabled by default until deployed and verified, and define retention behavior for demo ticks, contracts, and ledger/audit records without deleting data needed for accounting or settlement.

## Execution Readiness Score

**38/100.** The design direction and UX/testing intent are good, but the current blueprint has multiple blockers involving real wallet selection, real settlement price provenance, ledger constraints, and shared reporting/exposure queries. These defects can cause cross-account mutations, invalid ledger writes, incorrect live payouts, and corrupted real-money analytics if the plan is implemented as written.

## Final Sign-Off Recommendation

**Do not approve execution or run migration 033 yet.** Revise WP-21 to include the required account-type predicates throughout wallet/contract repositories and live service calls; reconcile deployed ledger constraints and values; separate live/demo tick selection and transport; exclude demo records from real exposure/reporting; specify reset accounting and fail-closed rate limiting; and define frontend state invalidation on mode changes. Then obtain the pending owner decisions and require database-backed tests against the complete existing migration chain before staging deployment.
