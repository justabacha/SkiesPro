# Wave 1 — History Page Implementation

## Pre-code verification

1. **Trade detail endpoint / H8:** Real mode has `GET /contracts/:id` in `src/modules/trading/trading.routes.ts:32`, handled by `ContractController.getById` at `src/modules/trading/controllers/contractController.ts:149`. The demo router lists history and active routes at `src/modules/demo/demo.routes.ts:28-29`, but has no contract-by-ID route or demo detail handler. Per the locked condition requiring both modes, H8 is out of scope.
2. **History paging:** `src/modules/trading/repositories/contractRepository.ts:128-134` applies `purchase_time < $n` with the provided `cursor` string and orders newest first. The limit defaults to 20 (`filters.limit || 20`); there is no maximum cap in this history query. The demo history controller also accepts `cursor` as a string (`src/modules/demo/controllers/demoController.ts:149-160`).
3. **`settled_at`:** `TradeResponse` declares `settled_at?: string` at `src/modules/trading/dto/trading.dto.ts:16-29`, so the CSV includes this column. The real controller's `mapToResponse` currently omits the optional property, so the exported field can be blank for responses produced by that mapper.
4. **`useTrading`:** Before this change, the hook returned `tradeHistory`, `isLoadingHistory`, and `fetchTradeHistory`, but did not expose `getContracts`. The hook now exposes a mode-aware `getContracts(params, signal)` at `frontend/src/modules/trading/hooks/useTrading.ts:49-57,136-145`. Existing settlement refresh is polling-based: active-contract disappearance triggers a history fetch at lines 271-287, and polling runs every three seconds at lines 410-413. There is no settlement WebSocket in this hook.
5. **Reusable component APIs:**
   - `TradeHistoryProps` (`frontend/src/modules/trading/components/TradeHistory.tsx:12-15`): `{ contracts: BinaryContract[]; isLoading?: boolean }`.
   - `FilterTabs` (`frontend/src/shared/components/FilterTabs.tsx:3-18`):
     ```ts
     export interface TabOption<T extends string = string> {
       id: T;
       label: string;
       icon?: React.ElementType;
       badge?: string | number;
     }

     export interface FilterTabsProps<T extends string = string> {
       tabs: readonly TabOption<T>[] | TabOption<T>[];
       activeTab: T;
       onChange: (tabId: T) => void;
       variant?: 'underline' | 'pills';
       className?: string;
     }
     ```

## Implementation

- Added a mode-aware `/history` page using `useTrading`, `TradeHistory`, `FilterTabs`, `TableLoading`, and `TableEmpty`.
- Added status and asset filters, cursor pagination, retryable errors, mode-change reset, live updates merged from `useTrading.tradeHistory`, and a below-top new-trades badge.
- Added full-history CSV export: fetches up to 20 pages of 20 rows (400 total), probes one additional row to detect truncation, and shows the required warning if more rows remain.
- Added the optional `settled_at` CSV column as prescribed by the DTO.
- H8 deferred (endpoint absent).

## Files created

- `frontend/src/pages/history/HistoryPage.tsx`
- `frontend/src/shared/utils/csvExporter.ts`
- `frontend/src/tests/history/HistoryPage.test.tsx`
- `frontend/vitest.config.ts`

## Files modified

- `frontend/src/router/index.tsx` — only the `history` route now renders `HistoryPage`.
- `frontend/src/modules/trading/hooks/useTrading.ts` — added a mode-aware, abortable `getContracts` read method; no Trade or Wallet page changes.
- `frontend/package.json` — added Vitest/jsdom/Testing Library and the `test:ui` script; retained the existing `test` script behavior.
- `frontend/package-lock.json` — updated lockfile for the test dependencies.

## Verification

- History UI scenarios: `npm.cmd run test:ui --prefix frontend` — **9/9 tests passed**.
- Frontend typecheck: `npm.cmd run typecheck --prefix frontend` — passed. Repository-wide `npm.cmd run lint --prefix frontend` reports 44 existing warnings in untouched files and exits nonzero; targeted ESLint on all changed frontend source and test files passed with `--max-warnings 0`.
- Frontend production build: `npm.cmd run build --prefix frontend` — passed. Vite reports a bundle-size advisory (>500 kB).
- Backend/shared typecheck: `npm.cmd run typecheck` — passed.
- Full backend test suite, run consecutively against `TEST_DATABASE_URL`:
  - Run 1: `npm.cmd test -- --runInBand --forceExit` — **61 suites passed; 395 tests passed** (438.705 s).
  - Run 2: `npm.cmd test -- --runInBand --forceExit` — **61 suites passed; 395 tests passed** (432.356 s).
- `git diff --check` — passed.
- Frozen-path verification — no changed files under `src/modules/admin`, `src/modules/trading`, `src/modules/wallet`, `src/modules/auth`, `src/modules/settlement`, `migrations`, or the listed non-History trader pages.

## Deviations and rationale

- Settlement updates are sourced from the existing hook's three-second polling/history-refresh behavior, not WebSocket events; no such WebSocket exists in `useTrading`.
- No detail modal was implemented because the required demo contract detail endpoint is absent.
- The backend has no history limit maximum; export uses 20 rows per request and caps the export at 400 rows, with a one-row probe to determine whether the truncation warning is needed.
- `settled_at` is in the CSV because it is in the DTO, though the real response mapper currently leaves it unset.
- Repository-wide frontend lint remains blocked by the 44 pre-existing warnings. No unrelated lint fixes were made.

## Scope confirmations

- Admin implementation untouched.
- Daraja/payment implementation untouched.
- Trade and Wallet pages untouched.
- Dashboard, KYC, Referrals, Support, and Settings pages untouched.
- No backend or migration changes.

## Final `git status --short`

```text
 M docs/15_MASTER_IMPLEMENTATION_CHECKLIST.md
 M frontend/package-lock.json
 M frontend/package.json
 M frontend/src/modules/trading/hooks/useTrading.ts
 M frontend/src/router/index.tsx
?? frontend/src/pages/history/
?? frontend/src/shared/utils/csvExporter.ts
?? frontend/src/tests/history/
?? frontend/vitest.config.ts
?? reports/TraderUI/
```

`docs/15_MASTER_IMPLEMENTATION_CHECKLIST.md` and the untracked `reports/TraderUI/` directory were already present in the worktree before this task; the existing audit files were preserved.
