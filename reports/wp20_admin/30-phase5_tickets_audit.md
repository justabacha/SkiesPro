# WP-20 Phase 5 Audit: Customer Support Tickets (`/admin/tickets`)

## Status
Read-Only Audit Completed

---

## 1. Executive Summary
The Customer Support Ticket Management page (`/admin/tickets`) provides support staff with inbox controls to review customer inquiries, filter by status and priority, and inspect message threads. However, several critical wiring, architectural, and UI consistency gaps prevent it from being production-ready.

### Top 3 Gaps:
1. **Missing Shared UI Components**: The tickets table does not utilize `FilterTabs`, `TableLoading`, or `TableEmpty` components, relying instead on native HTML `<select>` elements and standard table loops without stateful loading or empty placeholders.
2. **Missing Pagination Controls**: While the backend `listSupportTickets` repository query supports `page` and `perPage` query parameters, the frontend `SupportTicketsPage` and `useAdminSupport` hook do not implement pagination controls or page navigation.
3. **Missing User Joins**: The backend `admin.support_tickets` table query selects directly from the table without joining `app_auth.users`, meaning user data relies entirely on whatever is pre-populated in `user_email` columns rather than dynamic relational resolution.

---

## 2. Page & Route Map (A)
1. **Frontend Route**: Defined in `frontend/src/routes/adminRoutes.tsx` at path `support` under `AdminProtectedRoute` with allowed roles `['support', 'admin', 'super_admin']`.
2. **Backend Routes**: Registered in `src/modules/admin/admin.routes.ts`:
   - `GET /api/v1/admin/support/tickets`
   - `GET /api/v1/admin/support/tickets/:id`
   - `PUT /api/v1/admin/support/tickets/:id`
3. **Main Page Component**: `SupportTicketsPage.tsx` (`frontend/src/pages/admin/SupportTicketsPage.tsx`).
4. **Sub-components**: `TicketDetailDrawer.tsx`, Lucide icons (`Headphones`, `RefreshCw`, `MessageSquare`, `AlertCircle`, `Send`, `X`).

---

## 3. Data Wiring Findings (B)
- **Live Endpoints**: Fully wired to backend support endpoints (`/api/v1/admin/support/tickets/...`).
- **Mock Data**: No mock arrays or hardcoded ticket lists in the frontend component (fetches live data via `useAdminSupport`).
- **Backend Query Join Gaps**: `AdminRepository.listSupportTickets` and `getSupportTicketById` query `admin.support_tickets` directly without joining `app_auth.users`.
- **Pagination**: Backend supports pagination (`page`, `perPage`), but frontend lacks pagination UI controls.

---

## 4. UI/UX Findings (C)
- **Shared Components**: Lacks usage of `FilterTabs`, `TableLoading`, and `TableEmpty`. Uses native `<select>` dropdowns for status and priority filters.
- **Empty State**: If `tickets.length === 0`, renders an empty table body rather than a dedicated `TableEmpty` component.
- **Loading State**: Refresh button spins during fetch (`isLoading`), but no skeleton loader or `TableLoading` component is rendered inside the table area.
- **Status Badges**: Color-coded badges are implemented for status (`open`, `in_progress`, `resolved`, `closed`) and priority (`urgent`, `high`, etc.).

---

## 5. Logic & Actions Findings (D)
- **Admin Actions**: Support officers can view tickets, open `TicketDetailDrawer`, update ticket status and priority, and submit responses.
- **MFA Step-Up**: Ticket replies and status updates trigger `MfaStepUpModal` for secure TOTP verification.
- **Validation**: Reply form checks that response message is non-empty or status has been modified before opening MFA modal.

---

## 6. Edge Cases & Error Handling (E)
- **Non-existent Tickets**: Handled gracefully by optional chaining and null checks.
- **Date Formatting**: Uses `safeFormatDate` for timestamps.
- **Controller Try/Catch**: `AdminController.listTickets`, `getTicketById`, and `updateTicket` currently lack explicit `try/catch` blocks (risking socket hangs on DB errors, similar to the Risk Dashboard bug).

---

## 7. Impact Map
- `src/modules/admin/controllers/AdminController.ts` (Add `try/catch` error handling to ticket controller actions).
- `src/modules/admin/repositories/AdminRepository.ts` (Join `app_auth.users` for robust user email/name resolution).
- `frontend/src/pages/admin/SupportTicketsPage.tsx` (Adopt `FilterTabs`, `TableLoading`, `TableEmpty`, and pagination controls).

---

## 8. Recommended Fix Scope
1. Wrap ticket controller methods in `AdminController.ts` with `try/catch` blocks.
2. Refactor `SupportTicketsPage.tsx` to reuse `FilterTabs`, `TableLoading`, and `TableEmpty`.
3. Add pagination controls to the support tickets inbox.
