# WORK PACKAGE: WP-21_DEMO_TRADE_SURFACE

---

## §1 Work Package Identity

| Field | Value |
|-------|-------|
| **WP-ID** | WP-21 |
| **Name** | Demo Trade Surface (Practice Account) |
| **Phase** | Post-Phase 10 (follow-on to WP-18; unblocks Phase 11 launch readiness) |
| **Module** | Trading / Pricing / Wallet / Frontend |
| **Critical Path** | Yes (required by ProjectAnswers.md D4 = YES) |
| **Estimated Effort** | XL (Fibonacci: 13) |
| **Executor** | AI Agent / Backend Dev / Frontend Dev |
| **Owner Review Required** | Yes |

**Status of this document:** BLUEPRINT (no application code written). Implementation begins only after owner sign-off.

---

## §2 Before You Start

### §2.1 Prerequisites (Must Be Complete)

| WP-ID | Name | Status |
|-------|------|--------|
| WP-04 | Auth Module Backend | ✅ Complete |
| WP-06 | Wallet Module Backend | ✅ Complete |
| WP-07 | Payment Module Backend | ✅ Complete |
| WP-08 | Pricing Service | ✅ Complete |
| WP-09 | WebSocket Streaming | ✅ Complete |
| WP-10 | Trading Engine Backend | ✅ Complete |
| WP-11 | Settlement Worker | ✅ Complete |
| WP-16 | Frontend Design System | ✅ Complete |
| WP-17 | Frontend Auth Screens & App Shell | ✅ Complete |
| WP-18 | Frontend Trading Interface | ✅ Complete |
| WP-19 | Frontend Wallet & Payment UI | ✅ Complete |

**Cannot start until ALL prerequisites are COMPLETE.** All listed prerequisites are verified complete (see `reports/wp_audit_and_next_steps.md`).

### §2.2 Documents to Read

| Document | Sections | Why Needed |
|----------|----------|------------|
| docs/ProjectAnswers.md | §D (D1–D5), §C | Source of truth for stake limits, durations, D4 = Demo YES, KES base currency. |
| 11_IMPLEMENTATION_SPECIFICATION.md | §7.3, §7.4, §7.5, §7.6, §7.7 | Wallet, Payment, Pricing, Trading, Settlement module blueprints. |
| 06_DATABASE_DESIGN_SPECIFICATION.md | §5.9–5.11, §5.12–5.15, §5.16–5.18 | Wallet/ledger, trading, and pricing schema + constraints. |
| 07_API_DESIGN_SPECIFICATION.md | §9, §11, §12, §17 | Wallet/trading/pricing REST + WebSocket envelopes. |
| 08_UI_UX_DESIGN_SPECIFICATION.md | §7, §8, §11, §13 | Trading layout, components, notifications, tokens. |
| 09_SECURITY_ARCHITECTURE_AND_THREAT_MODEL.md | §4, §11, §17.1 | Auth, trade validation, wallet/payment boundaries. |
| 12_TESTING_STRATEGY_AND_QA_SPECIFICATION.md | §4.4, §4.11, §9, §12 | Trading/settlement/financial and frontend test catalogs. |
| 04_SOFTWARE_ARCHITECTURE.md | §7.1, §15 (ADR-007, 009, 010, 011, 012) | Ledger, locking, CAS, outbox, price authority. |
| 14_DEVELOPER_HANDBOOK_AND_CODING_STANDARDS.md | §3, §4, §5, §6, §10 | Naming, backend/frontend standards, security coding. |
| docs/15_MASTER_IMPLEMENTATION_CHECKLIST.md | Phase 10, Phase 11 | Task scope and launch readiness. |
| reports/trade_integrity.md | §4 | Mandate: demo trades continue during Tier-3 mock; real trades blocked. |

**Read these BEFORE writing code.**

### §2.3 Decisions Already Made

| Decision | Value | Source |
|----------|-------|--------|
| Demo/practice account supported | **YES** | ProjectAnswers.md D4 |
| Payout ratio | **60%** | ProjectAnswers.md #33 |
| Min / Max stake | **100 KES / 50,000 KES** | ProjectAnswers.md §D1/D2 |
| Trade durations | **60s (1m), 300s (5m), 900s (15m)** | ProjectAnswers.md §D3, WP-18 §2.3 |
| Base currency | **KES** | ProjectAnswers.md §C12 |
| Initial virtual balance (proposed; owner ratification required) | **KES 100,000 (≈ $1,000)** | §2.4 |
| Draw rule | **ABS(expiry − strike) < 0.00001** | DDS §5.14 |
| Price authority (real) | **PostgreSQL `pricing.price_ticks`** | ADR-012 |
| Mock generator | **`MockPriceAdapter` class, instantiated independently for demo** | WP-08/WP-09 |

### §2.4 Owner Decisions (Required Before Implementation)

| Item | Value | Why Needed | Blocker? |
|------|-------|------------|----------|
| Initial demo balance | Proposed **KES 100,000**; owner must explicitly ratify or provide a replacement | Virtual wallet seed + reset value | Yes |
| Demo balance reset rate limit | **5 successful resets / rolling hour / user** | Anti-abuse; enforced by durable shared storage, fail-closed | Yes |
| Demo tick storage strategy | Proposed shared table with mandatory `source='demo'`; owner must explicitly approve | Settlement authority isolation | Yes |
| Demo data retention | **30 days** for demo ticks, as directed by the owner on 2026-10-04; ledger and audit records are retained per accounting policy | Storage cost and retention compliance | Ratified |

The owner ratified KES 100,000 initial balance, five successful resets per rolling hour/user, and shared `pricing.price_ticks` storage with `source='demo'`. The owner set demo tick retention to 30 days on 2026-10-04. Cleanup must prune only old demo ticks, preserve ticks required by active/settling demo contracts, and never delete ledger or contract records. `VITE_DEMO_ENABLED` defaults to `false`; missing/invalid backend demo configuration disables demo routes rather than supplying a success-shaped default.

**Naming note:** requirement 1 references `useMockPrices`; the codebase implements the mock feed as `MockPriceAdapter` (`PriceFeedIngestionService.currentTier === 'tier3_mock'`). This WP introduces a **dedicated demo mock feed + `useDemoPrices` frontend hook** (see §4.1/§4.5).

### §2.5 Secret Handling Rule

**NEVER hardcode secrets.** Use `process.env.*`; reference `.env.example` for names only.
---

## §3 What You'll Build

### §3.1 Scope

- [ ] **Strict mock-feed isolation** — demo pricing served exclusively by the internal mock generator; zero upstream (Kraken/Coinbase) WebSocket/REST calls; 24/7/365 regardless of real market hours/weekends.
- [ ] **Virtual ledger & balance isolation** — separate demo wallet, demo ledger entries, and demo contracts that NEVER touch real balances or withdrawal flows.
- [ ] **Reset Demo Balance** — user-triggered refill only when no demo contracts are active or settling; enforce durable, fail-closed quota and idempotency.
- [ ] **Demo trading & settlement** — identical 60% payout, durations, and expiry mechanics executed without touching live funds.
- [ ] **Global account switcher** — `[Real | Demo]` toggle across Navbar + TradingPage with a prominent DEMO badge/banner and dynamic balance/hook switching.
- [ ] **Full responsive parity** — mobile, tablet, desktop.

### §3.2 Out of Scope

- [ ] Real-money circuit-breaker redesign (out of scope); removing request-supplied demo bypasses and making the existing real-only guard unconditional is in scope.
- [ ] Multiple simultaneous demo accounts per user (single demo wallet per user in V1).
- [ ] Demo withdrawal/transfer to real funds (permanently disallowed).
- [ ] Admin risk controls / Admin Dashboard (WP-14 / WP-20).
- [ ] Demo leaderboards, contests, or gamification (future).

### §3.3 Deliverables

| Deliverable | Format | Location |
|-------------|--------|----------|
| Demo isolation migration | SQL | `migrations/033_demo_account_isolation.sql` (wallet/contract/tick discriminators, reconciled ledger CHECK, mode-consistency enforcement, reset quota, real-only reporting views) |
| Demo price feed service | TypeScript | `src/modules/pricing/services/DemoPriceFeedService.ts` |
| Demo pricing routes | TypeScript | `src/modules/demo/demo.routes.ts` |
| Wallet mode support | TypeScript | `src/modules/wallet/services/walletService.ts`, `repositories/walletRepository.ts` (account type mandatory on every lookup and mutation) |
| Demo wallet service | TypeScript | `src/modules/wallet/services/demoWalletService.ts` |
| Demo REST namespace | TypeScript | `src/modules/demo/controllers/demoController.ts` |
| Demo trading service | TypeScript | `src/modules/trading/services/demoTradingService.ts` |
| Settlement mode support | TypeScript | `src/modules/trading/workers/settlementWorker.ts` |
| Account-mode context (FE) | TypeScript | `frontend/src/shared/context/AccountModeContext.tsx` |
| Account switcher (FE) | TypeScript | `frontend/src/shared/components/AccountSwitcher.tsx` |
| Demo banner (FE) | TypeScript | `frontend/src/modules/trading/components/DemoModeBanner.tsx` |
| Demo price hook (FE) | TypeScript | `frontend/src/modules/trading/hooks/useDemoPrices.ts` |
| Hook/component updates (FE) | TypeScript | `useWallet.ts`, `useTrading.ts`, `TradingPage.tsx`, `Navbar.tsx`, `OrderForm.tsx` |
| Tests | Jest / RTL | `tests/demo/**`, `frontend/src/modules/trading/__tests__/**` |
| Module README | Markdown | `src/modules/demo/README.md` |

### §3.4 Sub-Task Breakdown

| Sub-task | Description | Primary Owner |
|----------|-------------|---------------|
| **WP-21.1** | DB migration `033_demo_account_isolation.sql`: account discriminators, explicit source, remove both historical ledger reference constraints and install one complete authoritative CHECK, enforce ledger-reference/account-type consistency, durable reset-event/idempotency storage, indexes, composite uniqueness, and recreate real-only reporting views. | Backend |
| **WP-21.2** | `DemoPriceFeedService` — dedicated `MockPriceAdapter` instance, 24/7 loop, writes `source='demo'` ticks, publishes only to isolated `demo:{symbol}` cache and `demo.price.{symbol}` WS channel. | Backend |
| **WP-21.3** | `WalletService`/`WalletRepository`: required account type on all reads and mutations; real payment/trading/withdrawal callers explicitly pass `real`; `DemoWalletService` uses `demo` only and implements atomic reset rules. | Backend |
| **WP-21.4** | Demo REST namespace `/api/v1/demo/*` + controller/routes + rate limits + audit logging. | Backend |
| **WP-21.5** | `DemoTradingService` (place demo contract, active/history) reusing validation rules without calling live `TradingService`; every repository query scopes account type. | Backend |
| **WP-21.6** | `SettlementWorker`: require typed persisted contract account type, query matching tick source and wallet type, fail closed on invalid mode; preserve CAS + outbox + Oracle-gap + pip-tolerance. | Backend |
| **WP-21.7** | FE `AccountModeContext` + `AccountSwitcher` mounted above app layout/router content including Navbar; persist only validated preference. | Frontend |
| **WP-21.8** | `TradingPage` + `OrderForm` DEMO banner/badge + responsive layout. | Frontend |
| **WP-21.9** | `useWallet`/`useTrading`/`useDemoPrices`/`websocketService`: mode-keyed state, cancellation/invalidation of in-flight requests, full state cleanup and previous-channel unsubscribe on every mode switch. | Frontend |
| **WP-21.10** | Tests (unit/integration/UI/security), docs, and security review sign-off. | All |
---

## §4 Technical Specification

### §4.1 Architecture

- **Pattern:** Controller → Service → Repository (unchanged, DHCS §4).
- **Isolation strategy:** a first-class `account_type ∈ {'real','demo'}` discriminator on wallets and contracts, plus a required `source ∈ {'live','demo'}` discriminator on price ticks. Mode/source is explicit in every repository API; it is never inferred from request body, local storage, a nullable field, or a default branch.
- **Demo price feed:** **dedicated** `MockPriceAdapter` inside `DemoPriceFeedService` — it never reads or subscribes to the live `PriceFeedIngestionService`. It runs continuously (24/7) and is independent of `PriceFeedIngestionService.currentTier`.
- **Transport:** demo ticks are persisted with `source='demo'` and published only through an isolated `demo:{symbol}` cache namespace and `demo.price.{symbol}` WS channel. Live channels remain `price.{symbol}`. The existing shared live publisher/subscriber must not forward demo ticks.
- **Frontend mode:** `AccountModeContext` is the single source of truth and is mounted above `RouterProvider`/`AppLayout`, so it encloses both `Navbar` and routed pages. On a mode change, hooks abort or invalidate every old-mode request, clear old-mode data and pending orders, and immediately unsubscribe from the prior WS channel before fetching/subscribing in the new mode.

### §4.2 Database (Migration `033_demo_account_isolation.sql`)

```sql
-- 1. Wallet isolation ---------------------------------------------------------
ALTER TABLE wallet.wallets
  ADD COLUMN IF NOT EXISTS account_type VARCHAR(10) NOT NULL DEFAULT 'real'
  CHECK (account_type IN ('real','demo'));

-- Replace single-column uniqueness with (user_id, account_type)
ALTER TABLE wallet.wallets DROP CONSTRAINT IF EXISTS wallet_wallets_user_id_unique;
CREATE UNIQUE INDEX IF NOT EXISTS wallet_wallets_user_account_type_uidx
  ON wallet.wallets(user_id, account_type);

-- 2. Ledger reference types ---------------------------------------------------
-- Migration 003 and migration 026 leave differently named CHECK constraints.
-- Drop both names, then install exactly one authoritative constraint.
ALTER TABLE wallet.ledger_entries
  DROP CONSTRAINT IF EXISTS wallet_ledger_entries_reference_type_check;
ALTER TABLE wallet.ledger_entries
  DROP CONSTRAINT IF EXISTS ledger_entries_reference_type_check;
ALTER TABLE wallet.ledger_entries
  ADD CONSTRAINT ledger_entries_reference_type_check
  CHECK (reference_type IN (
    'deposit','withdrawal','trade_stake','trade_payout','referral_commission',
    'admin_adjustment','trade_win','trade_loss','trade_draw','fee',
    'referral_bonus','platform_revenue','demo_funding','demo_reset',
    'demo_trade_stake','demo_trade_payout'
  ));

-- 3. Contract isolation -------------------------------------------------------
ALTER TABLE trading.binary_contracts
  ADD COLUMN IF NOT EXISTS account_type VARCHAR(10) NOT NULL DEFAULT 'real'
  CHECK (account_type IN ('real','demo'));
CREATE INDEX IF NOT EXISTS trading_contracts_account_type_idx
  ON trading.binary_contracts(account_type, user_id);

-- 4. Price tick source --------------------------------------------------------
ALTER TABLE pricing.price_ticks
  ADD COLUMN IF NOT EXISTS source VARCHAR(10) NOT NULL DEFAULT 'live'
  CHECK (source IN ('live','demo'));
CREATE INDEX IF NOT EXISTS pricing_price_ticks_symbol_source_idx
  ON pricing.price_ticks(symbol, source, tick_time DESC);
```

The authoritative reference set preserves the migration-003 types (`deposit`, `withdrawal`, `trade_stake`, `trade_payout`, `referral_commission`, `admin_adjustment`) and migration-026 types (`trade_win`, `trade_loss`, `trade_draw`, `fee`, `referral_bonus`, `platform_revenue`) in addition to the demo types. Inspect `pg_constraint` in the target database before applying migration 033; drop any deployed legacy aliases discovered there and leave exactly one authoritative CHECK. Test the full migration chain and deployed-schema names, not only a clean schema.

Migration 033 also MUST:

1. Add a database-enforced ledger-reference/account-mode guard: demo references (`demo_funding`, `demo_reset`, `demo_trade_stake`, `demo_trade_payout`) may only be recorded against a wallet with `account_type='demo'`; all real payment/trade references may only use `account_type='real'`. Implement a trigger or equivalent constraint-safe mechanism that resolves `wallet_id` to its wallet mode and rejects mismatches. Service typing is additional protection, not a substitute.
2. Add durable `demo_wallet_reset_events` storage with user ID, idempotency key, timestamp, and the original response payload; enforce `UNIQUE(user_id, idempotency_key)`. Serialize reset attempts per user in a DB transaction, count successful events in the preceding 60 minutes, reject at five, and insert the event atomically with the successful reset. If this storage cannot be read or updated, reject the reset with a service-unavailable response; never fail open.
3. Recreate `reporting.daily_revenue_summary` and `reporting.daily_trade_summary` using their existing output contracts/indexes but include only `tr.account_type='real'` contracts in real-money aggregates. Preserve the existing view refresh function and unique indexes; do not allow demo contracts to alter real reports.
4. Keep existing wallet and contract rows as `real` and existing ticks as `live` using the migration defaults. Do not add an unqualified runtime query on the assumption that the default makes it safe.

The wallet primary-key `id` and foreign keys from ledger/version-log tables remain unchanged. Dropping the one-column user uniqueness does not itself rewrite or break those foreign keys, but every application operation must become mode-explicit before the second wallet row can be created.

> **Rollback note:** migration 033 is a coordinated schema/application change, not safely reversible by simply dropping columns after demo activity exists. Document a guarded rollback that first disables demo routes/workers, resolves demo contracts, and preserves or archives demo ledger/audit data; restore `UNIQUE(user_id)` only after all demo wallets are removed or migrated without deleting accounting records. Stage and rehearse the rollback before production apply.

### §4.3 API Endpoints (new `/api/v1/demo/*` namespace)

| Method | Endpoint | Purpose | Auth | Idempotency |
|--------|----------|---------|------|-------------|
| GET | `/api/v1/demo/wallet` | Demo balance (balance, locked, available, currency) | JWT | — |
| POST | `/api/v1/demo/wallet/reset` | Reset demo balance to initial virtual amount; returns `409 DEMO_TRADES_OPEN` if any demo contract is `active` or `settling` | JWT | Required `Idempotency-Key` |
| GET | `/api/v1/demo/wallet/ledger` | Demo ledger (cursor-paginated) | JWT | — |
| POST | `/api/v1/demo/trading/contracts` | Place demo contract (`higher`/`lower`) | JWT | `Idempotency-Key` |
| GET | `/api/v1/demo/trading/contracts/active` | Open demo contracts | JWT | — |
| GET | `/api/v1/demo/trading/contracts` | Demo trade history | JWT | — |
| GET | `/api/v1/demo/pricing/quote?symbol=` | Demo mock quote (bid/ask/mid) | JWT | — |

**WS:** `demo.price.{symbol}` (server→client), mirroring the WP-09 `price.{symbol}` envelope.
Demo subscriptions are separately authorized and routed; the live `price.{symbol}` channel must never carry demo data. `/api/v1/demo/pricing/quote` reads only a demo quote source/cache.

**Request body (demo contract):**
```json
{ "assetSymbol": "EUR/USD", "contractType": "higher", "stake": "500", "expirySeconds": 60, "strikePrice": 1.08490 }
```

### §4.4 UI Screens / UX Changes

| Screen / Component | Change |
|--------------------|--------|
| `AccountSwitcher.tsx` (new) | Segmented `[Real | Demo]` toggle. |
| `Navbar.tsx` | Embeds `AccountSwitcher`; balance chip switches Real KES ↔ Demo KES; shows `DEMO` pill in demo mode. |
| `TradingPage.tsx` | Renders `DemoModeBanner`; passes `accountMode` to hooks; header shows demo balance. |
| `DemoModeBanner.tsx` (new) | Amber banner: "DEMO MODE — Virtual funds only. No real money is at risk." Overlays/abuts chart + order panel. |
| `OrderForm.tsx` | Uses demo balance when in demo; "DEMO" label on Higher/Lower buttons; hides real-only actions. |
| `useWallet.ts` | `accountMode`-aware; demo → `/api/v1/demo/wallet`, real → `/api/v1/wallets/balance`. |
| `useTrading.ts` | `accountMode`-aware; demo → `/api/v1/demo/trading/*`. |
| `useDemoPrices.ts` (new) / `usePriceStream.ts` | Demo subscribes `demo.price.{symbol}`; real stays `price.{symbol}`. |

**Anti-confusion requirements:** (a) the string "DEMO" MUST be visible on both the chart and order panel whenever `accountMode === 'demo'`; (b) real↔demo switching MUST NOT carry over pending order state; (c) a confirmation is shown when switching modes with an open pending order.

**Provider and transition contract:** mount `AccountModeProvider` in `App.tsx` above `RouterProvider`; this encloses `AppLayout`, `Navbar`, and every routed page. Persist only the validated `real`/`demo` preference; never treat local storage as authorization. On each mode transition, synchronously increment a mode-generation token, abort any supported `AbortController` requests, invalidate the generation for APIs that cannot be aborted, clear wallet/ledger/trade/history/settlement-event/quote/chart state, clear the pending order and confirmation modal, and unsubscribe the previous WS `(mode, symbol)` channel before any new-mode request or subscription begins. Responses tagged with a stale generation must be discarded. When a pending order exists, first ask the user to confirm the switch; on confirmation discard it, then perform the transition; on cancellation remain in the original mode with its state intact.

The `useWallet`, `useTrading`, and `usePriceStream` hooks must all subscribe to the same context mode and implement this invalidation/cleanup behavior, including cleanup on unmount and user change. Wallet data displayed by `Navbar` and pages must come from one shared account-scoped cache/provider keyed by `(userId, accountMode)`; multiple hook consumers must not maintain independent balance copies. Do not keep parallel mode state. The wallet/deposit/withdrawal pages and M-Pesa actions are always real-only and must explicitly request the real wallet regardless of the trading account mode; Demo mode must not redirect or expose those operations.

### §4.5 Strict Mock Price Feed Isolation Rules

1. Demo pricing MUST be sourced **only** from `DemoPriceFeedService` → `MockPriceAdapter`.
2. `DemoPriceFeedService` MUST NOT import or instantiate `KrakenAdapter`, `CoinbaseAdapter`, or the live `PriceFeedIngestionService`.
3. Demo market simulation runs **24/7/365**; `MarketStatusService` MUST be bypassed for demo (`is_open = true` always for demo quotes/trades).
4. Demo ticks are persisted to `pricing.price_ticks` with `source='demo'`; demo settlement reads **only** `source='demo'` ticks.
5. The demo WS channel (`demo.price.{symbol}`) is served by the demo feed; demo clients MUST NOT subscribe to `price.{symbol}`.
6. `TickRepository.save`, `saveBatch`, `getLatest`, and `getPriceAt` MUST take an explicit source argument/field and persist/filter it; no method may silently default source. `getLatest(symbol, 'live'|'demo')` and `getPriceAt(symbol, time, 'live'|'demo')` must put the source predicate in SQL. Every live price consumer must pass `'live'`; every demo price consumer must pass `'demo'`.
7. Demo publishing uses a dedicated adapter/service and namespaces end-to-end: no demo tick may publish to `pricing/ticks:{symbol}`, `pricing/ticks:all`, `price.{symbol}`, or `price.all`. Add distinct gateway subscription handling, cache keys, authorization, and message validation for demo channels. The current live `PriceTickSubscriber`/`PriceDistributionService` must not be reused in a way that forwards demo ticks.
8. Apply the import-boundary/static-analysis rule to the actual demo routes, `DemoTradingService`, demo price service, and shared settlement branch—not only `src/modules/demo/**`. Integration tests must assert demo flows never instantiate upstream adapters and never publish to live channels.

### §4.6 Trading & Settlement Logic

- **`DemoTradingService.placeDemoTrade(userId, dto)`** reuses the WP-10 validation chain (status, self-exclusion (real-only), stake range, duration bounds, balance, exposure-per-demo-account, slippage, tick age) with these deltas:
  - Uses demo wallet balance (`account_type='demo'`).
  - Uses demo mock tick/quote (no real-feed dependency).
  - Skips real market-hours gate (24/7).
  - Debits the demo wallet with `reference_type='demo_trade_stake'`.
  - Persists contract with `account_type='demo'`.
  - Enqueues expiry to `trade.expiry` (same queue, contract carries `account_type`).
- **Repository contract:** `WalletRepository.findByUserId`, `findByUserIdForUpdate`, `create`, and every balance mutation MUST require `accountType: 'real' | 'demo'` (the SQL column is `account_type`) and constrain SQL by both `user_id` and `account_type`. There is no mode-less overload or implicit default. `WalletService` methods also require the account type and use a closed, account-specific ledger-reference union. M-Pesa success callbacks/credits, real trade debits/payouts, real wallet display, and real withdrawal locks explicitly pass `'real'`; all demo wallet operations explicitly pass `'demo'`. Payment flows may never accept client-selected account type.
- **Contract repository:** `BinaryContract.accountType` is a required typed field, persisted and mapped on create/read. `findByIdForSettlement(contractId)` may load by the contract's primary key solely for the trusted worker to read the persisted discriminator; it must return and validate that discriminator before any mode-sensitive action. User-facing contract lookup requires `(id, userId, accountType)`. CAS/status mutation requires the already validated account type in its SQL predicate; `create`, `listByUser`, and `getActiveByUser` are explicitly scoped. Exposure API takes an explicit discriminated scope: real exposure remains platform-wide and filters `account_type='real'`; demo exposure requires `userId` and filters both `account_type='demo'` and that user. User active/history APIs cannot return contracts from the other mode. Unknown/missing persisted account type is a hard error, never defaulted.
- **Ledger boundary:** `demo_funding`, `demo_reset`, `demo_trade_stake`, and `demo_trade_payout` are accepted only for demo wallets. Real references are accepted only for real wallets. Enforce this in the shared wallet/ledger service and in migration 033's DB-level guard; invalid cross-mode mutations fail and roll back. Do not expose generic untyped `credit()`/`debit()` calls to demo controllers.
- **Payout:** `PayoutService.calculatePayout` is reused **verbatim** → identical 60% ratio and `ABS(expiry−strike) < 0.00001` draw rule.
- **Settlement:** `SettlementWorker.settle()` requires `contract.accountType` from the DB, branches explicitly, and queries `getPriceAt(symbol, expiryTime, 'live')` for real contracts or `getPriceAt(symbol, expiryTime, 'demo')` for demo contracts. The real path credits only account type `real`; the demo path credits only `demo` with `demo_trade_payout` for wins, draws, and cancellation/refund payouts. `demo_reset` is reserved for wallet reset adjustments, not trade settlement. A null, invalid, or unavailable account type fails closed, alerts, and cannot fall through to either wallet path. Outbox payloads have required `accountType: 'real' | 'demo'`; consumers must honor it or ignore demo events without mutating real-money systems. CAS, Oracle-gap (10s), idempotency and pip-tolerance remain identical.
- **Real mode remains authoritative:** `TradingService.placeTrade()` is a real-only service and always enforces the live Tier-3 circuit breaker. Remove any request-body `is_demo`/`account_type` bypass. Demo endpoints call only `DemoTradingService`, which uses its own mock quote and demo wallet; neither a forged field nor a JWT claim can convert a live trade into a demo trade or bypass the real circuit breaker.
- **Durations:** exactly `60 / 300 / 900` seconds.

Real exposure and reports are explicitly real-only. The existing daily materialized views keep their public columns and indexes but filter `tr.account_type='real'`; demo contracts must not change real revenue, volume, user counts, or live exposure. Every report refresh definition is updated with the migration, not only the initial view.

For retention, demo price ticks may be pruned after the owner-approved retention interval only after no active/settling demo contract can use them. Persist the selected tick source, tick identity/time, and exact settlement price in the contract settlement audit event so retaining the ledger/audit trail does not depend on retaining raw demo ticks. Never purge ledger or financial audit entries as part of demo tick cleanup.

### §4.6.1 Demo Wallet Creation and Reset Invariants

- Create-on-first-use is atomic under the unique `(user_id, account_type)` index and creates exactly one demo wallet. Initial virtual funding is one ledgered `demo_funding` credit in the same transaction as wallet creation; concurrent creation cannot issue duplicate funding.
- Reset is an atomic transaction using a required idempotency key and a locked demo wallet row. Before changing any balance, reject with `409 DEMO_TRADES_OPEN` if that user's demo wallet has a contract in `active` or `settling` state. Contract placement and reset must use a consistent wallet-first lock order; settlement transition semantics must ensure a concurrently settling trade causes reset to reject rather than race the reset.
- With no open/settling contracts, `locked_balance` MUST be zero. Set `balance` to the owner-approved configured initial amount and `available_balance` to the same amount through the existing database trigger. Record the exact non-zero difference from prior balance as one `demo_reset` ledger entry (`credit` if increasing, `debit` if decreasing), with before/after balances. If the balance already equals the initial amount, record no zero-value ledger entry but still record the successful reset event for quota accounting; an idempotency replay returns the original response and does not add another event.
- Enforce at most five successful resets per user in any rolling 60-minute interval with durable reset-event rows. In one transaction, first return the saved response for a matching `(userId, Idempotency-Key)` replay; otherwise lock the demo wallet row, enforce the open-contract guard and quota, then atomically write the wallet/ledger change and event including the response payload. Rate-limit/idempotency storage failure returns `503` and performs no reset. Replays do not consume quota again. Failed resets do not consume quota.

### §4.7 Security Requirements (Boundaries)

| Requirement | Enforcement |
|-------------|-------------|
| Demo endpoints MUST NEVER alter real funds | Every wallet repository/service read or mutation requires `accountType: 'real' | 'demo'`; DB-level reference-type/account-mode guard rejects mismatches. Demo controllers use only demo-specific service APIs. Static analysis covers demo service files under both `src/modules/demo/**` and `src/modules/trading/services/`, plus shared settlement branches. |
| No withdrawals/transfers from demo | Demo wallet has no withdrawal/transfer endpoints. The frontend exposes no payment action in demo mode. Payment routes and M-Pesa callbacks are real-only and always resolve/mutate the real wallet; they accept no client-selected account type. If a request explicitly attempts to select a demo account, reject it with `403` rather than reinterpret it. |
| No privilege escalation | `userId` always derived from JWT; demo endpoints ignore client-supplied user ids. |
| Cross-user isolation | Every demo query filters by `(user_id, account_type='demo')`; unique index enforces one demo wallet per user. |
| Reset abuse | Durable atomic quota: five successful resets per rolling hour/user; fail closed on quota-store errors; idempotency replay does not consume quota; audit every accepted reset. |
| Real-trade protection preserved | `TradingService` is real-only and always blocks placement during `tier3_mock`; no user/request field bypass exists. Demo continues only through its separate mock-price path. |
| Auditability | All demo financial mutations write to `wallet.ledger_entries` and `trading.contract_events` with demo reference types. |

### §4.8 Responsive Architecture

| Viewport | Breakpoint | Behaviour |
|----------|-----------|-----------|
| Mobile | ≤ 640px | Switcher collapses to icon+label; banner is compact single-line; chart/order stack vertically. |
| Tablet | 641–1024px | Two-column trading grid; banner full-width above grid. |
| Desktop | ≥ 1025px | Chart (2-span) + order panel (1-span); banner pinned above grid. |

- Tap targets ≥ 44px (UDS §2.7); no horizontal overflow on the lowest supported width.
- Dark mode tokens honoured (`#0F1117`, emerald/rose directional buttons).

---

## §5 Manual Steps for Owner

### §5.1 Database
1. Obtain written owner approval for initial demo balance, tick storage/source strategy, and data retention before any migration or demo service is enabled.
2. Apply migrations 001–032 to a disposable database, then apply migration 033; inspect `pg_constraint` to verify exactly one ledger reference CHECK remains and it contains all real and demo values.
3. Verify account columns and constraints, the unique `(user_id, account_type)` index, ledger-mode guard, reset quota storage, and real-only reporting-view definitions against the full migration chain.
4. Run migration 033 on staging only after integration tests pass. Production apply requires a reviewed, rehearsed rollback plan; do not drop demo accounting/audit records to restore the old uniqueness constraint.

### §5.2 Environment Configuration
```bash
# .env
DEMO_INITIAL_BALANCE_KES=<owner-approved-value>
DEMO_MARKET_ALWAYS_OPEN=true
DEMO_RESET_RATE_LIMIT_PER_HOUR=5
```
```bash
# frontend/.env
VITE_DEMO_ENABLED=false
```
Enable `VITE_DEMO_ENABLED` and backend demo routes only after owner approval, migration verification, and staging sign-off. Missing or invalid initial-balance configuration must keep demo provisioning disabled; do not silently fall back to 100,000 KES.

### §5.3 Verification Steps
```bash
npm run typecheck && npm run lint && npm test
cd frontend && npm run lint && npx tsc --noEmit && npm run build
```
---

## §6 Testing Requirements

| Test Type | Coverage Target | Test IDs |
|-----------|-----------------|----------|
| Unit | >85% demo services | `DEMO-UNIT-001..010` |
| Integration | Full demo place→settle flow | `DEMO-INT-001..008` |
| UI | Switcher, banner, responsive | `UI-DEMO-001..010` |
| Security | Fund-isolation boundaries | `DEMO-SEC-001..005` |

**Unit (`DEMO-UNIT-001..010`):** account type is required in every wallet repository/service API; `real` and `demo` reads/locks/mutations select only their matching row; initial funding is exactly once under concurrent create; payout math matches real 60%; pip-tolerance draw identical; mock feed runs with market closed; demo feed never constructs/calls upstream adapters; every tick query requires and filters explicit source; 24/7 `is_open`; reset quota is atomic and fail-closed; idempotency replay consumes no extra quota.

**Integration (`DEMO-INT-001..008`):** demo place debits demo wallet only; real wallet unchanged; M-Pesa callback, real trade, settlement, and withdrawal explicitly mutate real wallet only when both wallets exist; demo settlement credits demo wallet and selects only demo ticks while live settlement selects only live ticks under interleaved same-symbol ticks; demo draw/oracle-gap refunds are demo-only; demo contracts do not affect real exposure, real user history, or real report aggregates; reset rejects active/settling contracts and restores the owner-approved amount atomically when none exist; cross-mode ledger reference attempts fail and roll back; all live report view definitions filter to real contracts.

**UI (`UI-DEMO-001..010`):** provider wraps Navbar and routes; shared wallet cache switches by `(userId, mode)`; DEMO badge visible on chart + order panel; chart consumes demo channel (not live); mode switch aborts/invalidates deferred old-mode responses, clears old-mode data/pending state, and unsubscribes old channel before new subscription; switch confirmation cancellation preserves current mode; preference persistence across reload; responsive at 375/768/1440; dark mode; accessibility (`axe-core` clean); wallet/payment pages remain real-only.

**Security (`DEMO-SEC-001..005`):** demo cannot debit/credit real wallet even when both wallets exist; demo reference on real wallet and real reference on demo wallet rejected by DB guard; payment routes/callbacks always target real wallet, expose no demo withdrawal path, and reject an explicit demo-account selection; spoofed user/account mode ignored; demo endpoints require JWT; cross-user demo access denied; reset quota storage failure returns 503 without changing balance; demo ticks cannot publish to live channels or affect real settlement; malformed contract account type cannot settle or credit either wallet.

---

## §7 Validation & Done Criteria

### §7.1 Code Quality Checklist
- [ ] DHCS naming conventions (§3) followed; snake_case DB columns, PascalCase classes.
- [ ] Controller thin; service single-responsibility; repository has no business logic.
- [ ] No `any` in demo financial paths.
- [ ] Every wallet API requires account type; every tick API requires source; every contract query scopes account type.
- [ ] All real M-Pesa, live trading, settlement, and withdrawal paths explicitly select `real`.
- [ ] Demo services import no live-feed or payment modules; boundary checks cover shared settlement and demo trading service locations.
- [ ] All real reporting views explicitly filter `account_type='real'`.
- [ ] `AccountModeProvider` encloses Navbar and routed pages; mode transition invalidation is tested.
- [ ] Reset rejects open/settling contracts and uses an atomic, durable, fail-closed per-user quota.
- [ ] Structured logging with `correlationId`; demo mutations audit-logged.
- [ ] No secrets in code (§2.5).

### §7.2 Functional Verification
- [ ] Demo trading works with real markets closed (weekend test).
- [ ] Demo trades never reach Kraken/Coinbase (verified with an integration test asserting upstream adapters are never instantiated for demo).
- [ ] Demo balance starts/resets only to the owner-approved amount; configuration is mandatory and has no success-shaped fallback.
- [ ] Real wallet balances are unchanged after demo activity (byte-for-byte assertion on ledger sums).
- [ ] Real reporting summaries and exposure are unchanged by demo activity.
- [ ] Source-separated settlement is proven for interleaved live/demo ticks.
- [ ] 60% payout and pip-tolerance draw match real behaviour exactly.
- [ ] Real-trade circuit breaker during `tier3_mock` still blocks real orders.
- [ ] UI shows explicit DEMO indicators and switches balances correctly.
- [ ] All `DEMO-*`/`UI-DEMO-*` tests pass; typecheck + lint clean.

### §7.3 Owner Sign-Off
| Check | Verified By | Date |
|-------|-------------|------|
| Initial demo balance, tick-storage strategy, and data-retention policy approved | [Owner name] | |
| Feature works as described | [Owner name] | |
| Manual steps completed | [Owner name] | |
| Deployed to staging | [Owner name] | |

---

## §8 Handoff

### §8.1 Next Work Package
| WP-ID | Name | Why This Next |
|-------|------|---------------|
| WP-14 / WP-20 | Admin Dashboard | Approve withdrawals; oversight; prerequisite for Phase 11 launch. |
| WP-12 | Notification System | Demo/settlement alerts via `TradeSettled` outbox. |

### §8.2 Handoff Notes
- Demo and real contract flows may share pure payout calculation and settlement orchestration, but every wallet operation, contract query, settlement tick query, exposure calculation, and report must explicitly scope by account type/source. Never infer or default mode.
- Keep the `/api/v1/demo/*` namespace physically separate to make the security boundary auditable.
- Resolve all owner decisions and feature-flag gates in §2.4 before implementation; §2.4 proposals are not authorization to deploy.

---

## §9 Risks & Blockers

| Risk | Probability | Impact | Mitigation | Owner |
|------|-------------|--------|-----------|-------|
| Demo/real fund leakage | High until all gates are implemented | Critical | Required mode argument at every repository/service boundary; DB ledger-mode guard; explicit real caller updates; dual-wallet regression tests | Executor |
| Mock feed coupled to live transport | High until isolated namespaces exist | High | Dedicated demo publisher/gateway/cache path; import-boundary rules cover all demo/shared code; no-live-channel integration tests | Executor |
| Demo ticks polluting real settlement | High until source predicates land | Critical | Mandatory source arguments for all tick persistence/read APIs; interleaved-tick settlement tests | Executor |
| Demo contracts polluting real exposure/reports | High until query/view updates land | High | Account-type filter in every repository and real-only view definitions | Executor |
| Mode switch leaks stale state or responses | Medium | High | Provider above app shell; shared mode-keyed wallet state; abort/generation invalidation and WS teardown tests | Frontend |
| Reset races or quota bypass | Medium | High | Active/settling rejection under transaction/row locks; durable atomic quota; fail closed | Backend |
| Owner decisions not approved | High until written sign-off | High | Keep demo disabled and migration unapplied until all §2.4 decisions are recorded | Owner |

---

## §10 Change Log

| Date | Change | By |
|------|--------|----|
| 2026-10-04 | Created WP-21 Blueprint (Demo Trade Surface) | AI Agent |
| 2026-10-04 | Revised wallet, ledger, tick-source, contract/reporting, frontend-state, reset, settlement, isolation, and owner-approval requirements after independent architectural review | AI Agent |

---

## §11 Final Checklist (Before Closing This WP)
- [ ] All prerequisites complete
- [ ] All §2.4 decisions are explicitly approved and recorded; feature flags remain disabled until then
- [ ] Migration 033 verified against the full migration chain and target constraint names
- [ ] All 11 findings in `reports/WP-21_INDEPENDENT_ARCHITECTURAL_REVIEW.md` closed by implementation and tests
- [ ] All deliverables produced at listed paths
- [ ] All tests (Unit/Integration/UI/Security) passing
- [ ] Manual steps documented & verified
- [ ] Owner sign-off obtained
- [ ] Next WP identified
- [ ] Handoff notes written

**END OF WORK PACKAGE WP-21**