# FilterTabs Theme Audit

## 1. Root Cause
The `FilterTabs` shared component (`frontend/src/shared/components/FilterTabs.tsx`) uses hardcoded dark-mode classes (`bg-slate-900/60`, `border-slate-800`, `text-slate-400`, `bg-slate-800`) when `variant === 'pills'`. Because it does not utilize semantic design tokens (`bg-bg-*`, `text-text-*`, `border-border-*`), rendering `<FilterTabs variant="pills" />` on light-themed or theme-aware trader pages (such as `/history`) results in a dark gray splash box that fails to transition or adapt to light mode.

## 2. File & Line References
- **Shared Component**: `frontend/src/shared/components/FilterTabs.tsx` (Lines 25-54)
  ```tsx
  <div className={`flex border-b border-slate-800 bg-slate-900/60 rounded-xl p-1 gap-1 ${className}`}>
  ```
- **Usage**: `frontend/src/pages/history/HistoryPage.tsx` (Lines 307-313)
  ```tsx
  <FilterTabs
    tabs={STATUS_TABS}
    activeTab={statusFilter}
    onChange={(tab) => setStatusFilter(tab as StatusFilter)}
    variant="pills"
    className="flex-wrap"
  />
  ```

## 3. Recommended Fix (Advisory)
To make `FilterTabs` theme-aware without breaking admin pages:
1. Update `FilterTabs.tsx` to use semantic theme tokens for its pill container and button states:
   - Container: `border-border-light dark:border-border-dark bg-bg-light-secondary dark:bg-bg-dark-secondary`
   - Inactive button text: `text-text-light-secondary dark:text-text-dark-secondary hover:text-text-light-primary dark:hover:text-text-dark-primary`
   - Inactive badge: `bg-bg-light-tertiary dark:bg-bg-dark-tertiary text-text-light-secondary dark:text-text-dark-secondary`
2. Alternatively, allow custom background/border classes via props or ensure the shared component itself supports light/dark themes natively.

## 4. Constraints Honored
- READ-ONLY constraint honored: No code files were modified.
- Audit report successfully saved to `reports/TraderUI/06-filtertabs-theme-audit.md`.
