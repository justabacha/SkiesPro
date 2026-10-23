# WP-20 Phase 7 Follow-up: Audit Trail UI and Filters

**Status: Executed & Verified**

## Scope and production-chain safety

The frontend mappings, EAT timestamp formatting, action labels, audit filters, and controller error handling were implemented. The requested production reseal script was deliberately not created or run. Recomputing hashes and replacing `previous_entry_hash` on the remaining production rows would rewrite immutable forensic evidence and could conceal the history of the deleted records. No production database was modified, and the production chain was not verified through the UI; therefore a green chain status is not claimed.

The referenced `37-phase7_fixes.md` did not exist before this follow-up; the preceding audit report is `36-phase7_audit_audit.md`.

## Pre-checks

**P1 — `AuditLogsTable.tsx`:** The table previously read `log.hash` and `log.previous_hash`, formatted `created_at` via `safeFormatDate(..., { utc: true })`, and rendered `log.action` directly. The API interface and database rows provide `entry_hash` and `previous_entry_hash`.

**P2 — `AuditLogsPage.tsx` and `useAdminAudit.ts`:** Both filter values were already controlled React state and `handleApplyFilter` passed `actor_id` and `action` into `fetchAuditLogs`; the API client serialized those parameters. The repository used exact equality for both fields, so action text did not work as a partial/case-insensitive search. The actor input advertised email filtering even though the repository only filters by actor ID. The old `limit` parameter also did not match the backend's `per_page` parameter.

**P3 — `AdminController.ts`:** `getAuditLogs` and `verifyAuditChain` awaited the audit service and returned success responses without `try/catch` or logged error responses.

## Changes

- **Hashes and dates:** The table now reads `entry_hash` and `previous_entry_hash`, uses `formatDateEAT`, and labels the timestamp column EAT.
- **Action labels:** An inline formatter replaces underscores with spaces and title-cases each word (for example, `WALLET_ADJUSTMENT_PENDING_APPROVAL` becomes `Wallet Adjustment Pending Approval`).
- **Filters:** Actor ID remains an exact match. Action search now uses `action ILIKE $n` with a `%...%` parameter. Pagination is sent with `page`/`per_page`; the actor placeholder now accurately says Actor ID.
- **Controller handling:** Both audit endpoints log exceptions and return `500 { error: 'Internal server error', code: 'AUDIT_ACTION_FAILED' }`.
- **Regression test:** `adminRepository.test.ts` asserts the actor ID predicate, case-insensitive action substring predicate, bound values, and result.

The production-chain rewrite code is intentionally omitted. Safe recovery should preserve the original rows and hashes, document the deletion as an integrity incident, and use an authorized, append-only corrective record or other compliance-approved recovery process. Re-sealing the existing rows must not be used to make verification pass.

## Validation

- `npm.cmd run typecheck` — passed.
- `npx.cmd tsc --noEmit -p frontend\tsconfig.json` — passed.
- Focused repository tests — 1 suite passed, 8 tests passed.
- Full `npm.cmd test` run 1 — 58 suites passed, 389 tests passed; exit code 0.
- Full `npm.cmd test` run 2 — 58 suites passed, 389 tests passed; exit code 0.
- `git diff --check` — passed.

The production audit chain and UI verification were not changed or represented as verified.
