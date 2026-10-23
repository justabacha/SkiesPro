# WP-20 Phase 5 — Support Tickets Fixes

**Status: Executed & Verified**

## Pre-checks

### P1 — Repository SQL before the change

`AdminRepository` has `getSupportTicketById()` (not `getTicketById()`); the service wraps this method.

```sql
-- listSupportTickets(): count
SELECT COUNT(*)::int AS count FROM admin.support_tickets ${whereClause}
```

```sql
-- listSupportTickets(): rows
SELECT * FROM admin.support_tickets ${whereClause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}
```

```sql
-- getSupportTicketById(id)
SELECT * FROM admin.support_tickets WHERE id = $1
```

The ticket table does not have a `user_email` column in the repository migrations, so the new query selects the joined user email directly without `COALESCE`.

### P2 — Controller methods before the change

All three methods lacked `try/catch` and therefore had no local error response or error logging:

```ts
async listTickets(req: Request, res: Response): Promise<void> {
  const result = await this.support.listTickets({
    status: typeof req.query.status === 'string' ? req.query.status : undefined,
    priority: typeof req.query.priority === 'string' ? req.query.priority : undefined,
    page: Number(req.query.page || 1),
    perPage: Number(req.query.per_page || 20),
  });
  res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
}

async getTicketById(req: Request, res: Response): Promise<void> {
  const result = await this.support.getTicketById(req.params.id);
  res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
}

async updateTicket(req: Request, res: Response): Promise<void> {
  const user = req as AdminAuthenticatedRequest;
  const result = await this.support.updateTicket(req.params.id, req.body, user.user.sub);
  res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
}
```

`AdminController` already imported the shared `logger`.

### P3 — Support page before the change

The original status and priority filters were native selects:

```tsx
<div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-xl p-4 flex items-center gap-4">
  <select
    value={statusFilter}
    onChange={(e) => setStatusFilter(e.target.value)}
    className="px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500/80"
  >
    <option value="">All Statuses</option>
    <option value="open">Open</option>
    <option value="in_progress">In Progress</option>
    <option value="resolved">Resolved</option>
    <option value="closed">Closed</option>
  </select>
  <select
    value={priorityFilter}
    onChange={(e) => setPriorityFilter(e.target.value)}
    className="px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500/80"
  >
    <option value="">All Priorities</option>
    <option value="low">Low</option>
    <option value="medium">Medium</option>
    <option value="high">High</option>
    <option value="urgent">Urgent</option>
  </select>
</div>
```

The old table’s body rendered this block directly, with no `isLoading` or empty-state branch:

```tsx
<tbody className="divide-y divide-slate-800/50 text-xs">
  {tickets.map((ticket) => (
    <tr key={ticket.id} className="hover:bg-slate-800/40 transition-colors">
      <td className="py-3.5 px-4">
        <div className="font-bold text-slate-100">{ticket.subject}</div>
        <div className="text-[11px] text-slate-400">{ticket.user_email}</div>
      </td>
      <td className="py-3.5 px-4 text-slate-300 capitalize">
        {ticket.category || 'General'}
      </td>
      <td className="py-3.5 px-4">
        <span
          className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
            ticket.priority === 'urgent'
              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              : ticket.priority === 'high'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                : 'bg-slate-800 text-slate-300 border border-slate-700'
          }`}
        >
          {ticket.priority}
        </span>
      </td>
      <td className="py-3.5 px-4">
        <span
          className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full ${
            ticket.status === 'open'
              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
              : ticket.status === 'in_progress'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          }`}
        >
          {ticket.status}
        </span>
      </td>
      <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
        {safeFormatDate(ticket.updated_at)}
      </td>
      <td className="py-3.5 px-4 text-right">
        <button onClick={() => selectTicket(ticket.id)}>Open Drawer</button>
      </td>
    </tr>
  ))}
</tbody>
```

This is the original tickets table body.

### P4 — `FilterTabs` props

The shared component accepts tab IDs and labels, the active tab ID, and a change callback; it optionally supports `variant` and `className`:

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

The tickets page now uses status tabs for All/Open/In Progress/Resolved/Closed and retains a native select only for the separate priority filter.

### P5 — `useAdminSupport` before the change

The hook held status and priority filters but no page, page size, or total state. Its list fetch passed only the filters and set the returned array:

```ts
const [statusFilter, setStatusFilter] = useState<string>('');
const [priorityFilter, setPriorityFilter] = useState<string>('');

const list = await adminApiClient.getTickets(
  {
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
  },
  totp_code
);
setTickets(list);
```

The API client returned `res.data?.rows || []`, discarding `total`. The hook now tracks page/page size/total and requests the backend's `page` and `per_page` parameters.

## Implementation

### Controller error handling

Each ticket controller method now catches failures, logs the error and request ID through `logger.error`, and returns HTTP 500 with `{ error: 'Internal server error', code: 'TICKET_ACTION_FAILED' }`.

```diff
- const result = await this.support.listTickets(...);
- res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
+ try {
+   const result = await this.support.listTickets(...);
+   res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
+ } catch (error) {
+   logger.error('Support ticket list failed', {
+     error: error instanceof Error ? error.message : String(error),
+     request_id: req.correlationId,
+   });
+   res.status(500).json({ error: 'Internal server error', code: 'TICKET_ACTION_FAILED' });
+ }
```

The same error handling pattern is applied to `getTicketById` and `updateTicket`.

### Repository joins

List rows and ticket details now return current user email/name from the relational user record. The list count query remains a ticket-only count query.

```diff
- SELECT * FROM admin.support_tickets ${whereClause}
- ORDER BY created_at DESC LIMIT ... OFFSET ...
+ SELECT t.*, u.email AS user_email, u.display_name AS user_name
+ FROM admin.support_tickets t
+ LEFT JOIN app_auth.users u ON t.user_id = u.id
+ ${whereClause}
+ ORDER BY t.created_at DESC
+ LIMIT ... OFFSET ...
```

```diff
- SELECT * FROM admin.support_tickets WHERE id = $1
+ SELECT t.*, u.email AS user_email, u.display_name AS user_name
+ FROM admin.support_tickets t
+ LEFT JOIN app_auth.users u ON t.user_id = u.id
+ WHERE t.id = $1
```

Status/priority filters now qualify their columns with the ticket alias.

### Frontend states and pagination

The status filter uses shared `FilterTabs`; `TableLoading` and `TableEmpty` replace the previous blank table area while loading or when no tickets match. Previous/Next controls appear only when `totalTickets > pageSize` and are disabled at the corresponding bounds. Status/priority changes reset the page to 1. The API client now preserves `{ rows, total }` and sends `per_page`; the hook stores and passes through `total`.

The list and drawer show `user_name` alongside `user_email`. The drawer keeps the joined user fields when an update response, which returns the raw ticket row, does not include them.

### Repository test

The new test verifies the SQL and returned joined values for both list and detail retrieval:

```ts
it('joins support tickets to current user email and display name', async () => {
  const { client, repository } = createRepository();
  client.query
    .mockResolvedValueOnce({ rows: [{ count: 1 }] })
    .mockResolvedValueOnce({
      rows: [
        {
          id: 'ticket-1',
          user_id: 'user-1',
          user_email: 'current@example.com',
          user_name: 'Current User',
          subject: 'Account question',
        },
      ],
    })
    .mockResolvedValueOnce({
      rows: [
        {
          id: 'ticket-1',
          user_id: 'user-1',
          user_email: 'current@example.com',
          user_name: 'Current User',
          subject: 'Account question',
        },
      ],
    });

  const result = await repository.listSupportTickets({ page: 1, perPage: 20 });
  const query = client.query.mock.calls[1][0] as string;
  const ticket = await repository.getSupportTicketById('ticket-1');
  const detailQuery = client.query.mock.calls[2][0] as string;

  expect(query).toContain('LEFT JOIN app_auth.users u ON t.user_id = u.id');
  expect(query).toContain('u.email AS user_email');
  expect(query).toContain('u.display_name AS user_name');
  expect(detailQuery).toContain('LEFT JOIN app_auth.users u ON t.user_id = u.id');
  expect(detailQuery).toContain('u.email AS user_email');
  expect(detailQuery).toContain('u.display_name AS user_name');
  expect(result.rows[0]).toMatchObject({
    user_email: 'current@example.com',
    user_name: 'Current User',
  });
  expect(ticket).toMatchObject({
    user_email: 'current@example.com',
    user_name: 'Current User',
  });
});
```

## Verification

- `npm run typecheck`: **0 errors**.
- `npx tsc --noEmit`: **0 errors**.
- Focused `tests/admin/adminRepository.test.ts`: **7/7 passed**.
- Full `npm test` run 1: **57 suites passed; 387 tests passed** (430.101 s, exit code 0).
- Full `npm test` run 2: **57 suites passed; 387 tests passed** (324.963 s, exit code 0).

An earlier full-suite attempt encountered a transient test-database connection timeout in the unrelated wallet concurrency suite; that attempt failed, then a complete retry passed (57/57 suites, 387/387 tests). The two recorded final full-suite runs both passed.

`git diff --check` is clean. The final `git diff --stat` for this task is:

```text
 .../src/components/admin/TicketDetailDrawer.tsx    |   4 +-
 frontend/src/hooks/admin/useAdminSupport.ts        |  38 +++-
 frontend/src/pages/admin/SupportTicketsPage.tsx    | 200 +++++++++++++--------
 frontend/src/services/admin/adminApiClient.ts      |   5 +-
 src/modules/admin/controllers/AdminController.ts   |  48 +++--
 src/modules/admin/repositories/AdminRepository.ts  |  21 ++-
 tests/admin/adminRepository.test.ts                |  48 +++++
 7 files changed, 261 insertions(+), 103 deletions(-)
```
