# WP-20 Phase 7 Audit Report: Audit Trail & Chain (`/admin/audit-logs`)

## 1. Executive Summary

- **Top Gap #1 (The Missing Hash — `N/A` Issue)**: The database table `admin.audit_logs` stores SHA-256 hashes in columns named `entry_hash` and `previous_entry_hash`. The SQL query (`SELECT * FROM admin.audit_logs`) returns these exact column names. However, [AuditLogsTable.tsx](file:///C:/SkiesPro/frontend/src/components/admin/AuditLogsTable.tsx#L52) checks `log.hash` and `log.previous_hash` (which are `undefined`), evaluating as falsy and causing the UI to render `'N/A'` and `'GENESIS'` on every single row.
- **Top Gap #2 (Missing Controller Error Handling)**: Neither `getAuditLogs` nor `verifyAuditChain` in [AdminController.ts](file:///C:/SkiesPro/src/modules/admin/controllers/AdminController.ts#L282) contains a `try/catch` block. Any database failure or query exception results in unhandled promise rejections and hung HTTP sockets instead of formatted JSON error responses.
- **Top Gap #3 (Date Formatting & Raw Strings)**: Timestamps in [AuditLogsTable.tsx](file:///C:/SkiesPro/frontend/src/components/admin/AuditLogsTable.tsx#L62) use `safeFormatDate(log.created_at, { utc: true })`, rendering raw UTC strings instead of local EAT time via `formatDateEAT`. Additionally, raw DB action codes (e.g. `USER_STATUS_CHANGE`, `WALLET_ADJUSTMENT`) are rendered directly without human-readable title casing.

---

## 2. Page & Route Map (A)

1. **Frontend Route**: Defined in [adminRoutes.tsx](file:///C:/SkiesPro/frontend/src/routes/adminRoutes.tsx#L66):
   - Path: `/admin/audit` (redirects/loads `AuditLogsPage`)
   - Access Control: Protected via `AdminProtectedRoute` for roles `['compliance', 'admin', 'super_admin']`.
2. **Page Component Path**: [AuditLogsPage.tsx](file:///C:/SkiesPro/frontend/src/pages/admin/AuditLogsPage.tsx)
3. **Available Page Actions**:
   - Filter by Actor ID / Email (`actor_id` text input).
   - Filter by Action Type (`action` text input).
   - "Apply Filters" form submit button.
   - "Verify Audit Chain Integrity" button (triggers cryptographic SHA-256 chain verification via `verifyChain()` in `AuditChainStatusBanner`).

---

## 3. Data Wiring & Hash Chain Findings (B)

4. **Live API Fetch**: `useAdminAudit` hook invokes `adminApiClient.getAuditLogs()` $\rightarrow$ `GET /api/v1/admin/audit-logs`.
5. **Exact SQL Query** from [AdminRepository.ts](file:///C:/SkiesPro/src/modules/admin/repositories/AdminRepository.ts#L713):
   ```sql
   SELECT COUNT(*)::int AS count FROM admin.audit_logs WHERE ...;

   SELECT * FROM admin.audit_logs WHERE ... ORDER BY created_at DESC LIMIT $limit OFFSET $offset;
   ```
6. **Selected Hash Columns**: `SELECT *` retrieves all table columns: `id`, `entry_hash`, `previous_entry_hash`, `actor_id`, `action`, `affected_entity`, `entity_id`, `details`, `ip_address`, `user_agent`, `created_at`.
7. **Property Mapping Mismatch (`N/A` Cause)**:
   - Backend returned JSON object key: `entry_hash` and `previous_entry_hash`.
   - Frontend [AuditLogsTable.tsx](file:///C:/SkiesPro/frontend/src/components/admin/AuditLogsTable.tsx#L52):
     ```tsx
     {log.hash ? `${log.hash.substring(0, 8)}...${log.hash.substring(log.hash.length - 8)}` : 'N/A'}
     Prev: {log.previous_hash ? `${log.previous_hash.substring(0, 6)}...` : 'GENESIS'}
     ```
   - Because `log.hash` is `undefined`, it falls back to `'N/A'` for every entry. `log.previous_hash` is also `undefined`, falling back to `'GENESIS'` for every entry.
   - **Fix**: Update property access to `log.entry_hash || log.hash` and `log.previous_entry_hash || log.previous_hash`.
8. **Audit Chain Verification Endpoint**:
   - "Verify Audit Chain Integrity" button calls `adminApiClient.verifyAuditChain()` $\rightarrow$ `GET /api/v1/admin/audit-chain/verify`.
   - Handled by `AdminController.verifyAuditChain` $\rightarrow$ `AdminAuditService.verifyChain`.
   - Backend logic recalculates SHA-256 for all log entries sequentially using `computeEntryHash`, compares `previous_entry_hash` with prior `entry_hash`, and returns `{ valid, checked, mismatches }`.

---

## 4. UI/UX Findings (C)

9. **Shared Component Usage**:
   - Uses `TableLoading` and `TableEmpty` inside [AuditLogsTable.tsx](file:///C:/SkiesPro/frontend/src/components/admin/AuditLogsTable.tsx).
   - Does NOT use `FilterTabs` (uses standard text inputs for filtering actor ID and action type).
10. **Date / Timestamp Formatting**:
    - Currently uses `safeFormatDate(log.created_at, { utc: true })` producing `10/23/2026, 12:00:00 AM`.
    - Needs to be updated to `formatDateEAT(log.created_at)` to render formatted local EAT time e.g. `Fri, 23 Oct 2026 03:00:00`.
11. **Raw Database Strings**:
    - `log.action` displays raw snake_case/uppercase strings like `USER_STATUS_CHANGE` or `WALLET_ADJUSTMENT`.
    - `log.target_entity` displays raw table names like `users` or `wallets`.

---

## 5. Controller Error Handling (D)

12. **Controller File**: [AdminController.ts](file:///C:/SkiesPro/src/modules/admin/controllers/AdminController.ts)
13. **Missing `try/catch` Blocks**:
    ```typescript
    async getAuditLogs(req: Request, res: Response): Promise<void> {
      const result = await this.audit.listAuditLogs({...});
      res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
    }

    async verifyAuditChain(req: Request, res: Response): Promise<void> {
      const result = await this.audit.verifyChain();
      res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
    }
    ```
    - Neither method handles potential database exceptions or service errors. Database downtime or query timeouts will cause unhandled rejections and socket hangs.

---

## 6. Edge Cases (E)

14. **Empty Audit Log Ledger**: Handled correctly. `AuditLogsTable.tsx` displays `TableEmpty` with icon `ShieldCheck`, title `"No Audit Trail Records"`, and description `"No administrative events recorded matching current filter parameters."`.
15. **Broken Hash Chain / Tampering Detection**:
    - Handled correctly in UI when `verifyChain()` returns `valid: false`.
    - `AuditChainStatusBanner.tsx` displays a red `ShieldAlert` icon, badge `'TAMPER ALERT: CHAIN BROKEN'`, and warning message: `Hash mismatch detected at audit record ID: ${result.broken_at_id}. Immediate compliance audit required.`.

---

## 7. Impact Map

| Component / File | Changes Needed |
| :--- | :--- |
| `frontend/src/components/admin/AuditLogsTable.tsx` | Map `log.entry_hash` and `log.previous_entry_hash`; apply `formatDateEAT(log.created_at)`; format action string |
| `src/modules/admin/controllers/AdminController.ts` | Wrap `getAuditLogs` and `verifyAuditChain` in `try/catch` blocks with correlationId logging |

---

## 8. Recommended Fix Scope

1. **Frontend Table Hash Property Fix**: Update [AuditLogsTable.tsx](file:///C:/SkiesPro/frontend/src/components/admin/AuditLogsTable.tsx) to read `log.entry_hash || log.hash` and `log.previous_entry_hash || log.previous_hash`.
2. **Frontend Date Formatting Fix**: Replace `safeFormatDate(..., { utc: true })` with `formatDateEAT(...)` in [AuditLogsTable.tsx](file:///C:/SkiesPro/frontend/src/components/admin/AuditLogsTable.tsx).
3. **Backend Controller Robustness**: Add `try/catch` error handling to `getAuditLogs` and `verifyAuditChain` in [AdminController.ts](file:///C:/SkiesPro/src/modules/admin/controllers/AdminController.ts).

Read-Only Audit Completed
