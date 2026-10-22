# Phase 4 (4-Eyes): Add Reject/Cancel Path Execution Report

## Status
Executed & Verified

---

## Pre-Check Findings (P1 - P6)

### P1: 4-Eyes Action Table
- Table backing 4-eyes actions: `admin.admin_actions`
- Original schema columns: `id`, `admin_id`, `action_type`, `target_user_id`, `details`, `requires_approval`, `approved_by`, `approved_at`, `created_at`.
- Status CHECK constraint: None originally existed directly on `admin.admin_actions` (status was dynamically computed or synthesized as `'pending'`). Migration 040 adds explicit `status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'))` alongside `rejected_by`, `rejection_reason`, and `rejected_at`.

### P2: Approval Structure Reference
- `AdminWalletService.approveAction(actionId, approvedBy)` and `AdminRepository.approveAdminAction(actionId, approvedBy)` were located in `src/modules/admin/services/AdminWalletService.ts` and `src/modules/admin/repositories/AdminRepository.ts`.
- Exact mirror implementation was created for `rejectAction` / `rejectAdminAction` without any wallet mutations.

### P3: Controller & Route Registration
- `AdminController.approveAction` and route `/actions/:id/approve` in `src/modules/admin/admin.routes.ts` were inspected.
- Middleware chain: `requireAdminRole(['super_admin'])` -> `requireAdminMFA`.
- Mirrored for `/actions/:id/reject` with `AdminController.rejectAction`.

### P4: Frontend Component Inspection
- Located `FourEyesActionCard.tsx` and `FourEyesApprovalPage.tsx`.
- Updated `FourEyesActionCard.tsx` with a secondary "Reject Action" button (outline danger styling) and an inline interactive modal asking for mandatory rejection reason and optional TOTP code.

### P5: Frontend API Client Inspection
- Located `adminApiClient.approveAction` in `frontend/src/services/admin/adminApiClient.ts`.
- Mirrored with `adminApiClient.rejectAction(id, payload)` passing `reason` and header `X-Admin-MFA-Token`.

### P6: Migration Sequence
- Highest migration found: `039_b2c_ops_recovery.sql`.
- New migration created: `040_add_reject_to_4eyes.sql`.

---

## Migration Applied (040)

```sql
-- Migration 040: Add reject/cancel columns and status constraint to admin.admin_actions

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'admin.admin_actions'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE admin.admin_actions DROP CONSTRAINT ' || constraint_name;
  END IF;
END $$;

-- Add new columns to admin.admin_actions
ALTER TABLE admin.admin_actions 
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES app_auth.users(id),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

-- Backfill status for existing approved actions
UPDATE admin.admin_actions 
  SET status = 'approved' 
  WHERE approved_at IS NOT NULL AND status = 'pending';

-- Add CHECK constraint
ALTER TABLE admin.admin_actions
  ADD CONSTRAINT admin_actions_status_check 
  CHECK (status IN ('pending', 'approved', 'rejected'));
```

### Migration Execution Output
```
Running migration: 040_add_reject_to_4eyes.sql
✓ Migration 040_add_reject_to_4eyes.sql completed
```

---

## New Backend Methods

### `AdminRepository.ts`
```typescript
async approveAdminAction(actionId: string, approvedBy: string): Promise<any> {
  const result = await this.query<any>(
    `UPDATE admin.admin_actions
     SET approved_by = $1, approved_at = NOW(), status = 'approved'
     WHERE id = $2 AND status = 'pending'
     RETURNING *`,
    [approvedBy, actionId]
  );

  return result.rows[0] || null;
}

async rejectAdminAction(id: string, adminId: string, reason: string): Promise<any> {
  const result = await this.query<any>(
    `UPDATE admin.admin_actions
     SET status = 'rejected',
         rejected_by = $1,
         rejection_reason = $2,
         rejected_at = NOW()
     WHERE id = $3 AND status = 'pending'
     RETURNING *`,
    [adminId, reason, id]
  );
  return result.rows[0] || null;
}

async getAdminActionForUpdate(id: string): Promise<any | null> {
  const result = await this.query<any>(
    `SELECT * FROM admin.admin_actions WHERE id = $1 FOR UPDATE`,
    [id]
  );
  return result.rows[0] || null;
}
```

### `AdminWalletService.ts`
```typescript
async approveAction(
  actionId: string,
  approvedBy: string
): Promise<{ status: string; actionId: string; approvedBy: string }> {
  const action = await this.repo.getAdminActionForUpdate(actionId);
  if (!action) {
    throw new Error('Action not found');
  }
  const currentStatus = action.status || (action.approved_at ? 'approved' : action.rejected_at ? 'rejected' : 'pending');
  if (currentStatus !== 'pending') {
    throw new Error(`Cannot approve action with status '${currentStatus}'`);
  }

  const updated = await this.repo.approveAdminAction(actionId, approvedBy);
  if (!updated) {
    throw new Error('Cannot approve action');
  }

  await this.audit.createEntry({
    actorId: approvedBy,
    action: 'admin_action_approved',
    affectedEntity: 'admin_action',
    entityId: actionId,
    details: {
      approved_by: approvedBy,
      action_type: updated.action_type,
    },
  });

  return {
    status: 'approved',
    actionId,
    approvedBy,
  };
}

async rejectAction(
  id: string,
  adminId: string,
  reason: string
): Promise<{ status: string; actionId: string; rejectedBy: string; reason: string }> {
  if (!reason || reason.trim() === '') {
    throw new Error('Rejection reason is required');
  }

  const action = await this.repo.getAdminActionForUpdate(id);
  if (!action) {
    throw new Error('Action not found');
  }

  const currentStatus = action.status || (action.approved_at ? 'approved' : action.rejected_at ? 'rejected' : 'pending');
  if (currentStatus !== 'pending') {
    throw new Error(`Cannot reject action with status '${currentStatus}'`);
  }

  const updated = await this.repo.rejectAdminAction(id, adminId, reason.trim());
  if (!updated) {
    throw new Error('Cannot reject action');
  }

  await this.audit.createEntry({
    actorId: adminId,
    action: 'admin_action_rejected',
    affectedEntity: 'admin_action',
    entityId: id,
    details: {
      rejected_by: adminId,
      rejection_reason: reason.trim(),
      action_type: action.action_type,
    },
  });

  return {
    status: 'rejected',
    actionId: id,
    rejectedBy: adminId,
    reason: reason.trim(),
  };
}
```

### `AdminController.ts`
```typescript
async rejectAction(req: Request, res: Response): Promise<void> {
  const authReq = req as AdminAuthenticatedRequest;
  try {
    const id = req.params.id;
    const adminId = authReq.user?.sub || (authReq.user as any)?.id;
    const { reason } = req.body || {};

    if (!reason || typeof reason !== 'string' || reason.trim() === '') {
      res.status(400).json({ error: 'reason is required' });
      return;
    }

    const result = await this.wallets.rejectAction(id, adminId, reason);
    res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
  } catch (error: any) {
    if (error.message.includes('not found') || error.message.includes('Cannot reject')) {
      res.status(409).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

### `admin.routes.ts`
```typescript
router.put(
  '/actions/:id/reject',
  requireAdminRole(['super_admin']),
  requireAdminMFA,
  (req: Request, res: Response) => controller.rejectAction(req, res)
);
```

---

## Frontend Modal Snippet

```tsx
{/* Reject Modal in FourEyesActionCard.tsx */}
{isRejectModalOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
    <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-6 relative">
      <button
        onClick={() => setIsRejectModalOpen(false)}
        className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center justify-center">
          <XCircle className="w-5 h-5 text-rose-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-100">Reject Action</h3>
          <p className="text-xs text-rose-400 font-medium">Cancellation Enforcement</p>
        </div>
      </div>

      <p className="text-xs text-slate-300 mb-4 bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg">
        Are you sure you want to reject this adjustment? This will cancel the requested action.
      </p>

      {rejectError && (
        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center gap-2 text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{rejectError}</span>
        </div>
      )}

      <form onSubmit={handleConfirmRejection} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Reason for rejection <span className="text-rose-400">*</span>
          </label>
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Specify mandatory rejection justification..."
            rows={3}
            required
            className="w-full p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-rose-500/80 text-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            TOTP / MFA Code (Required for Super Admin)
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              maxLength={6}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-rose-500/80 text-center font-mono tracking-widest text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => setIsRejectModalOpen(false)}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !rejectionReason.trim()}
            className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors shadow-lg shadow-rose-600/20"
          >
            {isSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
          </button>
        </div>
      </form>
    </div>
  </div>
)}
```

---

## Test Results

### `tests/admin/fourEyesReject.test.ts`
- **Happy Path**: Super admin with valid MFA and reason rejects pending action -> 200, status becomes `'rejected'`, `rejected_by` matches admin ID, `rejection_reason` matches (PASS)
- **No Wallet Mutation**: Rejection does not mutate user wallet balances (`balance` and `locked_balance` remain untouched) (PASS)
- **Missing Reason**: Rejection request without reason returns 400 (PASS)
- **Already Resolved (Conflict)**: Attempting to reject an already approved or rejected action returns 409 (PASS)
- **Unauthorized Role**: Non-super_admin admin returns 403 (PASS)
- **Missing MFA**: Super admin request without MFA step up returns 403 (PASS)

---

## Full Test Suite Results (Consecutive Runs)

### Run 1
- **Test Suites**: 55 passed, 55 total
- **Tests**: 375 passed, 375 total

### Run 2
- **Test Suites**: 55 passed, 55 total
- **Tests**: 375 passed, 375 total

---

## File Modifications Summary

### `git diff --stat`
```
 .../src/components/admin/FourEyesActionCard.tsx    | 161 ++++++++++++++++++++-
 frontend/src/pages/admin/FourEyesApprovalPage.tsx  |  13 +-
 frontend/src/services/admin/adminApiClient.ts      |  11 ++
 src/modules/admin/admin.routes.ts                  |   6 +
 src/modules/admin/controllers/AdminController.ts   |  23 +++
 src/modules/admin/repositories/AdminRepository.ts  |  28 +++-
 src/modules/admin/services/AdminWalletService.ts   |  50 ++++++-
 7 files changed, 277 insertions(+), 15 deletions(-)
```
