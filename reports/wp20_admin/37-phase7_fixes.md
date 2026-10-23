# WP-20 Phase 7 Follow-up: Audit Trail UI and Filters

**Status: Executed & Verified — Phase 7 closed**

## Scope and production-chain safety

The frontend mappings, EAT timestamp formatting, action labels, audit filters, and controller error handling were implemented. No production reseal script was created or run. The owner subsequently reported manually clearing the test logs in Supabase and confirming that the Verify button now shows a green, valid chain. This is recorded as owner-confirmed; it was not independently verified by this session.

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

## Follow-up: Proposed Production Log Truncation

**Status: Owner-confirmed complete; not independently verified by this session.**

The owner reports manually clearing the test logs in Supabase and confirming that the Verify button is green. The reset was performed by the owner, not by this session. No SQL command, affected-row count, or database query result was provided for independent confirmation, so the report does not claim a verified post-reset row count.

The Audit Logs page’s Apply Filters control is wired as a form `onSubmit` handler. `handleApplyFilter` prevents the browser’s default submit and calls `fetchAuditLogs` with the current `actor_id`, `action`, `page: 1`, and `per_page: 50` values. The hook forwards them to `adminApiClient.getAuditLogs`, which serializes them into the `/api/v1/admin/audit-logs` query string. The repository applies exact actor ID matching and case-insensitive partial action matching with `ILIKE`. A repository regression test and the full test suite passed in the prior validation above; this confirms the code path, not a live browser request.

The Verify button is wired to `verifyChain()`. The owner confirms using it after the manual Supabase reset and seeing a green, valid result. This owner confirmation closes Phase 7; it is not an independent database or UI verification performed by this session.
