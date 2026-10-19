# PHASE A AUDIT REPORT — SHARED COMPONENTS, KYC POLISH & APPROVALS WIRING

**Date**: May 2024  
**Scope**: Frontend Admin Console (`frontend/src/pages/admin/`, `components/admin/`, `hooks/admin/`, `services/admin/`) & Backend Admin Module (`src/modules/admin/`)  
**Status**: Completed (Read-Only Planning & Architectural Design)

> [!IMPORTANT]
> **GATE PASSED — Phase A — [Oct 19] — Shared Components, KYC Polish & Approvals Wiring verified**

---

## Executive Summary

This targeted audit covers three specific technical work items in preparation for Phase A execution:
1. **Shared UI Components**: Analysis of inline Filter Tabs and Table Loading/Empty states, with proposed unified reusable component interfaces.
2. **KYC UI Polish**: Diagnosis of broken image rendering in `KycDocumentViewer.tsx` and raw DB string formatting for document types.
3. **4-Eyes Approvals Wiring**: Root-cause analysis of hardcoded empty arrays on `FourEyesApprovalPage.tsx`, mapping the missing backend endpoint and frontend API client methods.

---

## 1. Shared Components Audit

### 1.1 Filter Tabs Inspection

Currently, filter tabs are implemented inline with two distinct styling variants across admin pages:

#### A. Underline Style Variant (`KycReviewPage.tsx`)
- **File & Lines**: `[KycReviewPage.tsx](file:///C:/SkiesPro/frontend/src/pages/admin/KycReviewPage.tsx#L61-L82)`
- **JSX & Tailwind Classes**:
  ```tsx
  <div className="flex flex-wrap gap-2 border-b border-slate-800">
    {([
      ['pending', 'Pending Review'],
      ['approved', 'Approved'],
      ['rejected', 'Rejected'],
      ['all', 'All Documents'],
    ] as const).map(([status, label]) => (
      <button
        key={status}
        onClick={() => {
          selectStatusFilter(status);
          clearSelectedKyc();
          setDecisionStatus(null);
        }}
        aria-pressed={statusFilter === status}
        className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
          statusFilter === status
            ? 'border-blue-500 text-blue-400'
            : 'border-transparent text-slate-400 hover:text-slate-200'
        }`}
      >
        {label}
      </button>
    ))}
  </div>
  ```

#### B. Filled Pill Style Variant (`ReportsDashboardPage.tsx`)
- **File & Lines**: `[ReportsDashboardPage.tsx](file:///C:/SkiesPro/frontend/src/pages/admin/ReportsDashboardPage.tsx#L57-L93)`
- **JSX & Tailwind Classes**:
  ```tsx
  <div className="flex border-b border-slate-800 bg-slate-900/60 rounded-xl p-1 gap-1">
    <button
      onClick={() => setActiveReportTab('revenue')}
      className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
        activeReportTab === 'revenue'
          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
          : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      <DollarSign className="w-4 h-4" /> Daily Revenue
    </button>
    {/* ... remaining tab buttons ... */}
  </div>
  ```

---

### 1.2 Table Loading and Empty States Inspection

The loading and empty states across all four dedicated table components share near-identical markup with slight styling variations:

| File & Lines | Loading State Markup | Empty State Markup |
|--------------|----------------------|--------------------|
| `[UserTable.tsx](file:///C:/SkiesPro/frontend/src/components/admin/UserTable.tsx#L52-L73)` | Container: `bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-8 text-center text-slate-400`<br>Spinner: `w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-3` | Container: `p-12 text-center text-slate-400`<br>Icon: `ShieldAlert (w-10 h-10 text-slate-600 mx-auto mb-3)`<br>Title: `No users found`<br>Subtitle: `Try adjusting your search query or filters.` |
| `[KycQueueTable.tsx](file:///C:/SkiesPro/frontend/src/components/admin/KycQueueTable.tsx#L16-L37)` | Container: `bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-8 text-center text-slate-400`<br>Spinner: `w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-3` | Container: `p-12 text-center text-slate-400`<br>Icon: `CheckCircle2 (w-10 h-10 text-emerald-500/80 mx-auto mb-3)`<br>Title: `No KYC applications found`<br>Subtitle: `There are no applications matching this status filter.` |
| `[PendingWithdrawalsTable.tsx](file:///C:/SkiesPro/frontend/src/components/admin/PendingWithdrawalsTable.tsx#L16-L37)` | Container: `bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-8 text-center text-slate-400`<br>Spinner: `w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-3` | Container: `p-12 text-center text-slate-400`<br>Icon: `CheckCircle2 (w-10 h-10 text-emerald-500/80 mx-auto mb-3)`<br>Title: `No Pending Withdrawals`<br>Subtitle: `All payout transactions have been processed.` |
| `[AuditLogsTable.tsx](file:///C:/SkiesPro/frontend/src/components/admin/AuditLogsTable.tsx#L10-L31)` | Container: `bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-8 text-center text-slate-400`<br>Spinner: `w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-3` | Container: `p-12 text-center text-slate-400`<br>Icon: `ShieldCheck (w-10 h-10 text-slate-600 mx-auto mb-3)`<br>Title: `No Audit Trail Records`<br>Subtitle: `No administrative events recorded matching current filter parameters.` |

---

### 1.3 Proposed Reusable Component Interfaces

To eliminate duplication and enforce UI consistency across all admin pages, we propose three new shared components:

#### 1. `FilterTabs` Component
Location: `frontend/src/shared/components/FilterTabs.tsx`

```typescript
import React from 'react';

export interface TabOption<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ElementType;
  badge?: string | number;
}

export interface FilterTabsProps<T extends string = string> {
  tabs: TabOption<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  variant?: 'underline' | 'pills'; // Default: 'underline'
  className?: string;
}
```

#### 2. `TableLoading` Component
Location: `frontend/src/shared/components/TableLoading.tsx`

```typescript
import React from 'react';

export interface TableLoadingProps {
  message?: string;
  className?: string;
}
```

#### 3. `TableEmpty` Component
Location: `frontend/src/shared/components/TableEmpty.tsx`

```typescript
import React from 'react';

export interface TableEmptyProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}
```

---

## 2. KYC UI Polish Audit

### 2.1 Broken Image Fallback Audit
- **File**: `[KycDocumentViewer.tsx](file:///C:/SkiesPro/frontend/src/components/admin/KycDocumentViewer.tsx#L40-L115)`
- **Current Behavior**:
  `KycDocumentViewer.tsx` checks if image URL fields (`id_front_url`, `id_back_url`, `selfie_url`, `proof_of_address_url`) are present.
  If present, it renders:
  ```tsx
  <img src={application.id_front_url} alt="ID Front" className="w-full h-full object-contain" />
  ```
  When seeded image URLs (such as `https://placehold.co/600x400` or invalid external links) fail to load over HTTP/HTTPS, the browser displays a broken image icon with raw alt text.

- **Proposed Solution**:
  Implement a local `imageErrors` state in `KycDocumentViewer.tsx`:
  ```typescript
  const [imageErrors, setImageErrors] = React.useState<Record<string, boolean>>({});

  const handleImageError = (key: string) => {
    setImageErrors((prev) => ({ ...prev, [key]: true }));
  };
  ```
  When `!url` OR `imageErrors[key] === true`, render a clean neutral placeholder box with an icon and warning text (e.g. `FileText` icon + "Document Image Unavailable").

---

### 2.2 Raw DB String Formatting Audit
- **Files**:
  - `[KycQueueTable.tsx](file:///C:/SkiesPro/frontend/src/components/admin/KycQueueTable.tsx#L55)`:
    ```tsx
    {app.doc_type || 'National ID'}
    ```
  - `[KycDocumentViewer.tsx](file:///C:/SkiesPro/frontend/src/components/admin/KycDocumentViewer.tsx#L120)`:
    ```tsx
    <span className="text-slate-200 font-semibold">{application.doc_type}</span>
    ```
- **Current Behavior**:
  Database values such as `national_id`, `proof_of_address`, `driving_license`, `passport`, or `selfie` render directly in snake_case lowercase.

- **Proposed Solution**:
  Add a `formatDocumentType` helper function in `[safeFormatters.ts](file:///C:/SkiesPro/frontend/src/shared/utils/safeFormatters.ts)`:
  ```typescript
  export const formatDocumentType = (docType?: string): string => {
    if (!docType) return 'National ID';
    const knownMap: Record<string, string> = {
      national_id: 'National ID',
      proof_of_address: 'Proof of Address',
      passport: 'Passport',
      driving_license: 'Driving License',
      drivers_license: "Driver's License",
      selfie: 'Biometric Selfie',
    };
    const key = docType.toLowerCase().trim();
    if (knownMap[key]) return knownMap[key];

    return key
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };
  ```

---

## 3. Approvals Page Wiring Audit

### 3.1 Current Implementation Root Cause
- **File**: `[FourEyesApprovalPage.tsx](file:///C:/SkiesPro/frontend/src/pages/admin/FourEyesApprovalPage.tsx#L11-L21)`
- **Current Code**:
  ```typescript
  const fetchApprovals = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch pending 4-eyes actions
      await adminApiClient.getPendingWithdrawals(); // Fallback/reuse or custom getApprovals if available
      setPendingActions([]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);
  ```
- **Finding**: `FourEyesApprovalPage.tsx` reuses `getPendingWithdrawals()` and hardcodes `setPendingActions([])`, guaranteeing an empty queue regardless of backend state.

---

### 3.2 Backend Endpoint Audit
- **Database Table**: `admin.admin_actions`
  - Columns: `id`, `admin_id`, `action_type`, `target_user_id`, `details` (JSONB), `requires_approval` (BOOLEAN), `approved_by` (UUID), `approved_at` (TIMESTAMPTZ), `created_at`.
- **Existing Approve Route**: `PUT /api/v1/admin/actions/:id/approve` in `[admin.routes.ts](file:///C:/SkiesPro/src/modules/admin/admin.routes.ts#L238)`
- **Missing Route**: `GET /api/v1/admin/actions/pending` is **NOT** defined in `admin.routes.ts` or `AdminController.ts`.

---

### 3.3 Required Changes for Live Wiring

#### A. Backend Changes (`src/modules/admin/`)

1. **`AdminRepository.ts`**: Add `getPendingAdminActions()`
   ```sql
   SELECT a.id,
          a.action_type,
          a.admin_id as actor_id,
          u.email as actor_email,
          'user' as target_entity,
          a.target_user_id as target_id,
          a.details,
          (a.details->>'amount')::numeric / 130.0 as amount_usd,
          'pending' as status,
          a.created_at
   FROM admin.admin_actions a
   LEFT JOIN auth.users u ON a.admin_id = u.id
   WHERE a.requires_approval = true AND a.approved_at IS NULL
   ORDER BY a.created_at DESC
   ```

2. **`AdminWalletService.ts`**: Add `listPendingActions()`
   Calls `this.repo.getPendingAdminActions()`.

3. **`AdminController.ts`**: Add `listPendingActions(req, res)`
   Calls `this.wallets.listPendingActions()` and returns `{ data: result, meta: { request_id: req.correlationId } }`.

4. **`admin.routes.ts`**: Register Route
   ```typescript
   router.get(
     '/actions/pending',
     requireAdminRole(['super_admin']),
     requireAdminMFA,
     (req: Request, res: Response) => controller.listPendingActions(req, res)
   );
   ```

#### B. Frontend Changes (`frontend/src/`)

1. **`adminApiClient.ts`**: Add `getPendingActions()`
   ```typescript
   async getPendingActions(totp_code?: string): Promise<PendingAction[]> {
     const headers: Record<string, string> = {};
     if (totp_code) headers['X-Admin-MFA-Token'] = totp_code;
     const res = await apiClient.get<ApiResponse<PendingAction[]>>(
       `/api/v1/admin/actions/pending`,
       { headers }
     );
     return Array.isArray(res.data) ? res.data : [];
   }
   ```

2. **`FourEyesApprovalPage.tsx`**: Wire to Live API
   ```typescript
   const fetchApprovals = useCallback(async () => {
     setIsLoading(true);
     setError(null);
     try {
       const actions = await adminApiClient.getPendingActions();
       setPendingActions(actions);
     } catch (err) {
       setError((err as Error).message);
     } finally {
       setIsLoading(false);
     }
   }, []);
   ```

---

## Deliverable File
This audit report has been saved to:
`[PHASE_A_AUDIT.md](file:///C:/SkiesPro/reports/PHASE_A_AUDIT.md)`
