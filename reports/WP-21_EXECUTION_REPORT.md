# Work Package Execution Report: WP-21 Demo Trade Surface

**Date:** 2026-10-05
**Branch:** main @ `1ce9648`
**Status:** 🟢 SUBSTANTIALLY IMPLEMENTED — PENDING CLOSE-OUT (owner sign-off + UI demo tests + demo candle history)

---

## 1. Work Package Identity

| Field | Value |
|-------|-------|
| **WP-ID** | WP-21 |
| **Name** | Demo Trade Surface (Practice Account) |
| **Blueprint** | `work-packages/WP-21_DEMO_TRADE_SURFACE.md` |
| **Prerequisites** | WP-04, WP-06, WP-07, WP-08, WP-09, WP-10, WP-11, WP-16, WP-17, WP-18, WP-19 — all ✅ Complete |
| **Owner decisions** | Ratified 2026-10-04: KES 100,000 initial balance; 5 resets/hour/user; shared `pricing.price_ticks` with `source='demo'`; 30-day demo tick retention |

---

## 2. Deliverable Status

| # | Deliverable | Path | Status | Verification |
|---|-------------|------|--------|--------------|
| 1 | Demo isolation migration | `migrations/033_demo_account_isolation.sql`, `migrations/034_demo_tick_retention_config.sql` | ✅ Applied | DB tests pass; real-only reporting views; `UNIQUE(user_id, account_type)`; ledger-mode CHECK; reset-event/quota table |
| 2 | Demo price feed service | `src/modules/pricing/services/DemoPriceFeedService.ts` | ✅ Implemented | `demoPriceFeedService.test.ts` 5/5 PASS |
| 3 | Demo pricing routes | `src/modules/demo/demo.routes.ts` | ✅ Implemented | Mounted at `/api/v1/demo`; gated on `DEMO_ENABLED` + positive `DEMO_INITIAL_BALANCE_KES` |
| 4 | Wallet mode support | `src/modules/wallet/services/walletService.ts`, `repositories/walletRepository.ts` | ✅ Implemented | `AccountType = 'real' \| 'demo'`; every lookup/mutation scoped; payments/withdrawals explicitly `'real'` |
| 5 | Demo wallet service | `src/modules/wallet/services/demoWalletService.ts` | ✅ Implemented | Reset idempotent, atomic, 5/hr durable quota, rejects open/settling contracts |
| 6 | Demo REST namespace | `src/modules/demo/controllers/demoController.ts` | ✅ Implemented | JWT protected; wallet/ledger/reset/trade/quote endpoints |
| 7 | Demo trading service | `src/modules/trading/services/demoTradingService.ts` | ✅ Implemented | `demoTradingService.test.ts` 8/8 PASS; expiry → `trade.expiry`; idempotency |
| 8 | Settlement mode support | `src/modules/trading/workers/settlementWorker.ts` | ✅ Implemented | Account-type branch; `getPriceAt(symbol, time, 'live'\|'demo')`; CAS + Oracle-gap + outbox preserved |
| 9 | Account-mode context (FE) | `frontend/src/shared/context/AccountModeContext.tsx` | ✅ Implemented | Mounted above `RouterProvider` in `App.tsx`; generation-based stale-response invalidation; shared `(userId, mode)` wallet cache |
| 10 | Account switcher (FE) | `frontend/src/shared/components/AccountSwitcher.tsx` | ✅ Implemented | Real/Demo segmented control; disabled when `VITE_DEMO_ENABLED=false` |
| 11 | Demo banner (FE) | `frontend/src/modules/trading/components/DemoModeBanner.tsx` | ✅ Implemented | Rendered on `TradingPage` + `OrderForm` |
| 12 | Demo price hook (FE) | `frontend/src/modules/trading/hooks/useDemoPrices.ts` | ⚠️ **NOT CREATED** | **Deviation:** behaviour delivered via mode-aware `usePriceStream.ts` + `websocketService` (`demo.price.{symbol}` channel, `msg.source` guard); documented in WP-21 §3.3 |
| 13 | Hook/component updates (FE) | `useWallet.ts`, `useTrading.ts`, `TradingPage.tsx`, `Navbar.tsx`, `OrderForm.tsx` | ✅ Implemented | Demo endpoints for wallet/trades; real-only wallet/payment pages preserved |
| 14 | Tests | `tests/demo/**` + `frontend/src/modules/trading/__tests__/**` | 🔄 Partial | Backend `tests/demo/**` PASS (see §4); **`UI-DEMO-001..010` DO NOT EXIST** (frontend has no test runner) |
| 15 | Module README | `src/modules/demo/README.md` | ✅ Written | Isolation rules and rollout gate documented |

---

## 3. Implementation Notes (Key Mechanisms)

- **Isolation:** `account_type` on `wallet.wallets` and `trading.binary_contracts`; `source` on `pricing.price_ticks`; a DB-level ledger-reference/account-mode guard rejects cross-mode references; both real reporting materialized views filter `account_type='real'`.
- **Feed isolation:** `DemoPriceFeedService` instantiates its own `MockPriceAdapter`; publishes to `demo:price:{symbol}` cache + `demo:ticks:{symbol}`/`demo:ticks:all` channels only; no upstream adapters are used.
- **WS isolation:** `SubscriptionManager.VALID_CHANNELS` includes `demo.price`; `demo.price` subscriptions rejected while `DEMO_ENABLED !== 'true'`; `DemoPriceTickSubscriber` forwards only `source='demo'` ticks to `demo.price.{symbol}`.
- **Settlement:** live contracts query `getPriceAt(..., 'live')`; demo contracts query `getPriceAt(..., 'demo')`; invalid/absent persisted account type fails closed before any wallet mutation.
- **Frontend:** mode switch increments a generation counter, aborts in-flight requests, runs registered cleanup (WS unsubscribes + state clears), and confirms when a pending order exists.

---

## 4. Test Evidence (run 2026-10-05)

| Test file | Result |
|-----------|--------|
| `tests/demo/demoSecurity.unit.test.ts` (DEMO-SEC-003/004/005) | ✅ 3/3 PASS |
| `tests/demo/demoSecurity.integration.test.ts` (DEMO-SEC-001/002, real DB) | ✅ 2/2 PASS |
| `tests/demo/demoTradingService.test.ts` | ✅ 8/8 PASS |
| `tests/demo/tickIsolation.test.ts` | ✅ 4/4 PASS |
| `tests/demo/demoPriceFeedService.test.ts` | ✅ 5/5 PASS |
| `tests/demo/demoPriceSubscriber.test.ts` | ✅ 2/2 PASS |
| `tests/demo/demoWallet.integration.test.ts` | ⚠️ Needs a non-time-boxed run (>30 s) |
| `tests/trading/unit/*` (settlement, payout, service, repository, frontend trading) | ✅ 32/32 PASS |
| `tests/database.test.ts` (migrations + seed + schema) | ✅ 14/14 PASS |

---

## 5. Open Items (Blocking Close-Out)

1. **Demo candle/chart history** — `TradingChart.tsx:406–409` returns `Promise.resolve([])` in demo mode; `OHLCService` runs only in the live ingestion path and `pricing.candles` has **no `source` column**, so demo candle isolation is not implemented.
2. **`UI-DEMO-001..010`** — No frontend UI test suite exists; `frontend/package.json` `"test"` = `typecheck && lint` only. `UI-DEMO-*` coverage is required by WP-21 §6 before owner sign-off.
3. **Env vars from WP-21 §5.2** — `DEMO_MARKET_ALWAYS_OPEN` and `DEMO_RESET_RATE_LIMIT_PER_HOUR` are specified but not implemented (quota hardcoded to 5 in `demoWalletService.ts`; demo "always open" is implicit).
4. **`useDemoPrices.ts` deviation** — deliverable not created; function covered by `usePriceStream`. Needs owner awareness/approval or creation.
5. **Owner sign-off (§7.3)** — pending.

---

## 6. Handoff

**Next Work Package:** WP-14 / WP-20 Admin Dashboard — top launch blocker (manual withdrawal approval deferred by WP-07 §3.2 and WP-19 §3.2). Prerequisites satisfied. Secondary: WP-12 Notification System.

**END OF WP-21 EXECUTION REPORT**