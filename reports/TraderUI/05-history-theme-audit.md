# History Page: Theme & Flags Audit — 2026-10-24

## 1. Theme Root Cause Analysis

### Theme Context Mechanism
The application's theme system ([ThemeContext.tsx:25](file:///C:/SkiesPro/frontend/src/shared/context/ThemeContext.tsx#L25)) applies either the `'light'` or `'dark'` class to `document.documentElement` (`window.document.documentElement.classList.add(theme)`). In Tailwind CSS, default class rules apply in Light mode, while `dark:` prefixed classes apply when the `'dark'` class is present on the HTML root element.

### The "Right" Way (`TradingPage.tsx` & `WalletPage.tsx`)
Reference pages like [TradingPage.tsx:100](file:///C:/SkiesPro/frontend/src/pages/trading/TradingPage.tsx#L100) and `WalletPage.tsx` use semantic design system tokens that dynamically adapt to theme changes:
- Outer Container: `bg-bg-light-primary dark:bg-bg-dark-primary text-text-light-primary dark:text-text-dark-primary`
- Card Sections: `bg-bg-light-secondary dark:bg-bg-dark-secondary border-border-light dark:border-border-dark`
- Subtitle Text: `text-text-light-secondary dark:text-text-dark-secondary`
- Input / Dropdowns: `bg-bg-light-primary dark:bg-bg-dark-primary text-text-light-primary dark:text-text-dark-primary border-border-light dark:border-border-dark`

### The "Broken" Way (`HistoryPage.tsx`)
[HistoryPage.tsx](file:///C:/SkiesPro/frontend/src/pages/history/HistoryPage.tsx) uses hardcoded dark Tailwind palette classes (`slate-900`, `slate-950`, `slate-800`, `slate-700`, `slate-100`, `slate-300`, `slate-400`) without `dark:` prefixes or light mode fallbacks. When the theme switches to Light mode, the outer navbar/sidebar turn light, but `HistoryPage.tsx` remains a dark/black box.

#### Exact Broken Class Mapping in `HistoryPage.tsx`

| DOM Element | Broken Class in `HistoryPage.tsx` | Line | Correct Design Token in `TradingPage.tsx` |
| :--- | :--- | :--- | :--- |
| Main Page Wrapper | `text-slate-100` | 230 | `text-text-light-primary dark:text-text-dark-primary` |
| Subtitle Text | `text-slate-400` | 242 | `text-text-light-secondary dark:text-text-dark-secondary` |
| Export CSV Button | `border-slate-700 hover:bg-slate-800` | 249 | `border-border-light dark:border-border-dark bg-bg-light-secondary dark:bg-bg-dark-secondary text-text-light-primary dark:text-text-dark-primary hover:bg-bg-light-tertiary dark:hover:bg-bg-dark-tertiary` |
| Filter Section Box | `border-slate-800 bg-slate-900/60` | 256 | `border-border-light dark:border-border-dark bg-bg-light-secondary dark:bg-bg-dark-secondary` |
| Filter Label Text | `text-slate-300` | 263 | `text-text-light-secondary dark:text-text-dark-secondary` |
| Asset Dropdown | `border-slate-700 bg-slate-950 text-slate-100` | 269 | `border-border-light dark:border-border-dark bg-bg-light-primary dark:bg-bg-dark-primary text-text-light-primary dark:text-text-dark-primary` |
| Load More Button | `border-slate-700 hover:bg-slate-800` | 310 | `border-border-light dark:border-border-dark bg-bg-light-secondary dark:bg-bg-dark-secondary text-text-light-primary dark:text-text-dark-primary hover:bg-bg-light-tertiary dark:hover:bg-bg-dark-tertiary` |

---

## 2. The 5 Flags Verification

### Flag F1: Theme Transition Breakage
- **Status**: **CONFIRMED ROOT CAUSE IDENTIFIED**.
- `HistoryPage.tsx` wraps its inner `<TradeHistory />` component in hardcoded dark elements (`bg-slate-900/60`, `bg-slate-950`, `text-slate-100`). While `<TradeHistory />` itself supports light mode, the parent container in `HistoryPage.tsx` forces a dark background in Light mode.

### Flag F2: `settled_at` CSV Export Field
- **Status**: **CONFIRMED BACKEND PAYLOAD GAP**.
- In [HistoryPage.tsx:49](file:///C:/SkiesPro/frontend/src/pages/history/HistoryPage.tsx#L49), `CSV_COLUMNS` includes `{ key: 'settled_at', header: 'settled_at' }`.
- In [contractController.ts:13](file:///C:/SkiesPro/src/modules/trading/controllers/contractController.ts#L13), `mapToResponse` converts `BinaryContract` to `TradeResponse`:
  ```typescript
  private mapToResponse = (contract: BinaryContract): TradeResponse => ({
    id: contract.id!,
    user_id: contract.userId,
    asset_symbol: contract.assetSymbol,
    stake: contract.stake,
    contract_type: contract.contractType,
    strike_price: contract.strikePrice,
    expiry_price: contract.expiryPrice,
    payout_rate: contract.payoutRate,
    potential_payout: contract.potentialPayout,
    purchase_time: contract.purchaseTime.toISOString(),
    expiry_time: contract.expiryTime.toISOString(),
    status: contract.status,
  });
  ```
- **Finding**: `contractController.ts` does NOT populate `settled_at` in the API response. As a result, the exported CSV produces a blank/empty value for the `settled_at` column on real trades.

### Flag F3: `useTrading` Hook Modification Safety
- **Status**: **SAFE**.
- Git diff check on `frontend/src/modules/trading/hooks/useTrading.ts` (commit `3c82ce6`):
  ```diff
  + getContracts: (
  + params?: {
  + status?: string;
  + asset_symbol?: string;
  + limit?: number;
  + cursor?: string;
  + },
  + signal?: AbortSignal
  + ) => Promise<BinaryContract[]>;
  ```
- **Finding**: The change is purely additive (exposing `getContracts` callback on `UseTradingReturn`). It does not alter existing state, return signatures, or polling behavior for `TradingPage.tsx` or `WalletPage.tsx`.

### Flag F4: Frontend Test Suite Commands
- **Status**: **VERIFIED**.
- In [frontend/package.json](file:///C:/SkiesPro/frontend/package.json#L11):
  - Unit/Component Tests: `npm run test:ui` (executes `vitest run`).
  - Typecheck: `npm run typecheck` (executes `tsc --noEmit`).
- Command to run frontend tests 2x consecutively:
  ```bash
  npm run test:ui && npm run test:ui
  ```

### Flag F5: Live Updates & Polling Logic
- **Status**: **VERIFIED (PAGINATION PRESERVED)**.
- In [HistoryPage.tsx:180-210](file:///C:/SkiesPro/frontend/src/pages/history/HistoryPage.tsx#L180-L210), live updates from `tradeHistory` are handled via:
  ```typescript
  const newContracts = matchingLive.filter((contract) => {
    const previous = previousContracts.get(contract.id);
    return !previous || (previous.status === 'active' && contract.status !== 'active');
  });
  setContracts((current) => {
    const updated = current
      .map((contract) => liveById.get(contract.id) || contract)
      .filter((contract) => {
        const liveContract = liveById.get(contract.id);
        return !liveContract || matchesFilters(liveContract, status, assetSymbol);
      });
    const currentIds = new Set(updated.map((contract) => contract.id));
    const additions = newContracts.filter((contract) => !currentIds.has(contract.id));
    updated.unshift(...additions);
    return updated.sort((left, right) =>
      new Date(right.purchase_time).getTime() - new Date(left.purchase_time).getTime()
    );
  });
  ```
- **Finding**: Existing paginated contracts in state (`current`) are preserved. In-place status updates are applied to existing items, and new settlements are prepended via `updated.unshift(...additions)`. Pagination is not reset.

---

## 3. Recommended Fix Strategy (Advisory Only)

1. **Theme Tokens in `HistoryPage.tsx`**: Replace all hardcoded `slate-900`, `slate-950`, `slate-800`, `slate-700`, `slate-100`, `slate-300`, `slate-400` classes in `HistoryPage.tsx` with design system tokens (`bg-bg-light-secondary dark:bg-bg-dark-secondary`, `border-border-light dark:border-border-dark`, `text-text-light-primary dark:text-text-dark-primary`, `text-text-light-secondary dark:text-text-dark-secondary`).
2. **Backend `settled_at` Payload Mapping**: Map `settled_at: contract.settledAt?.toISOString()` in `contractController.ts` `mapToResponse` so CSV exports populate the `settled_at` column for settled trades.

---

## 4. Constraints Honored

- **Read-Only**: No application code, CSS, tests, or config modified.
- **Working Tree Clean**: `git status` verified clean.
- **Admin Isolation**: Admin modules and frozen backend engines remained untouched.
- **Report Location**: Saved to [reports/TraderUI/05-history-theme-audit.md](file:///C:/SkiesPro/reports/TraderUI/05-history-theme-audit.md).

Read-Only Audit Completed
