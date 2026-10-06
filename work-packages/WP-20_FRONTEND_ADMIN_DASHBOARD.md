# WORK PACKAGE BLUEPRINT: WP-20_FRONTEND_ADMIN_DASHBOARD

---

## §1 Work Package Identity

| Field | Value |
|-------|-------|
| **WP-ID** | WP-20 |
| **Name** | Frontend Admin Dashboard |
| **Phase** | Phase 10 (Task 10.6) |
| **Module** | Frontend / Admin |
| **Critical Path** | Yes |
| **Estimated Effort** | XL (Fibonacci: 13) |
| **Executor** | AI Agent / Frontend Dev |
| **Owner Review Required** | Yes |

---

## §2 Before You Start

### §2.1 Prerequisites (Must Be Complete)
| WP-ID | Name | Status |
|-------|------|--------|
| WP-15 | Admin Panel Backend APIs | ✅ Complete |
| WP-16 | Frontend Design System | ✅ Complete |
| WP-17 | Frontend Auth Screens & App Shell | ✅ Complete |

**Prerequisite Notes:**
- **WP-15 Backend APIs**: Live and verified on backend (`/api/v1/admin/*`), including RBAC middleware, TOTP MFA step-up requirements, 4-eyes threshold ($500 USD), and audit log hash-chaining.
- **WP-16 Design System**: Glassmorphism UI tokens, Tailwind configuration, base UI components, modal overlays, and Lucide icons.
- **WP-17 Auth & App Shell**: User session management, JWT auth context (`useAuth`), login flows, and token persistence.
- **Dependency Audit Note**: References to "WP-14" in older project checklists as a work package file represent a `[MISSING DEPENDENCY]` (no `work-packages/WP-14.md` exists in tree). However, `docs/14_DEVELOPER_HANDBOOK_AND_CODING_STANDARDS.md` exists and serves as the governing standard.

### §2.2 Documents to Read
| Document | Sections | Why Needed |
|----------|----------|------------|
| `docs/ProjectAnswers.md` | §22, §24, §25, §31-32, §C | Source of truth for RBAC, subdomains, React framework, color palette, and currency (KES / USD threshold). |
| `docs/08_UI_UX_DESIGN_SPECIFICATION.md` | §8, §13 | Admin layout wireframes, navigation sidebar, glassmorphism dark theme tokens (#0F1117 background). |
| `docs/07_API_DESIGN_SPECIFICATION.md` | §16 | Admin API endpoint signatures, DTO contracts, error response structures. |
| `docs/09_SECURITY_ARCHITECTURE_AND_THREAT_MODEL.md` | §6 | Admin security rules, TOTP MFA step-up gating, session timeouts, and RBAC token isolation. |
| `docs/14_DEVELOPER_HANDBOOK_AND_CODING_STANDARDS.md` | §3.2, §5, §6 | React 18, TypeScript standards, Vite environment handling (`VITE_API_BASE_URL`), and component styling. |
| `docs/15_MASTER_IMPLEMENTATION_CHECKLIST.md` | Task 10.6 | Phase 10 task scope, exit criteria, and deliverable targets. |
| `reports/WP-15_EXECUTION_REPORT.md` | All | Live backend endpoint routes (`/api/v1/admin/*`), role permissions, verified DTO payloads, and 4-eyes approval specs. |

**Dependency Verification Status:**
- `docs/ProjectAnswers.md` — ✅ Verified (`C:/SkiesPro/docs/ProjectAnswers.md`)
- `docs/08_UI_UX_DESIGN_SPECIFICATION.md` — ✅ Verified (`C:/SkiesPro/docs/08_UI_UX_DESIGN_SPECIFICATION.md`)
- `docs/07_API_DESIGN_SPECIFICATION.md` — ✅ Verified (`C:/SkiesPro/docs/07_API_DESIGN_SPECIFICATION.md`)
- `docs/09_SECURITY_ARCHITECTURE_AND_THREAT_MODEL.md` — ✅ Verified (`C:/SkiesPro/docs/09_SECURITY_ARCHITECTURE_AND_THREAT_MODEL.md`)
- `docs/14_DEVELOPER_HANDBOOK_AND_CODING_STANDARDS.md` — ✅ Verified (`C:/SkiesPro/docs/14_DEVELOPER_HANDBOOK_AND_CODING_STANDARDS.md`)
- `docs/15_MASTER_IMPLEMENTATION_CHECKLIST.md` — ✅ Verified (`C:/SkiesPro/docs/15_MASTER_IMPLEMENTATION_CHECKLIST.md`)
- `reports/WP-15_EXECUTION_REPORT.md` — ✅ Verified (`C:/SkiesPro/reports/WP-15_EXECUTION_REPORT.md`)
- `work-packages/WP-14*.md` — ⚠️ `MISSING DEPENDENCY` (Cited in old checklist notes; substituted by `docs/14_DEVELOPER_HANDBOOK_AND_CODING_STANDARDS.md`).

### §2.3 Decisions Already Made

**READ `docs/ProjectAnswers.md` and `reports/WP-15_EXECUTION_REPORT.md` FIRST.**

| Decision | Value | Source |
|----------|-------|--------|
| **Frontend Stack** | React 18 + Vite + React Router v6 + Tailwind CSS | `docs/ProjectAnswers.md` §25, `frontend/package.json` |
| **Admin Route Prefix** | `/admin/*` (Pages in `frontend/src/pages/admin/`) | `docs/08_UI_UX_DESIGN_SPECIFICATION.md` §8 |
| **API Base Route** | `/api/v1/admin/*` | `reports/WP-15_EXECUTION_REPORT.md` |
| **Supported Admin Roles** | `support`, `finance`, `risk_manager`, `compliance`, `admin`, `super_admin` | `src/modules/admin/README.md`, `reports/WP-15_EXECUTION_REPORT.md` |
| **Primary Owner Account** | `its.phestone@gmail.com` (`super_admin`) | `reports/WP-15_EXECUTION_REPORT.md` |
| **UI Design Language** | Dark mode glassmorphism (#0F1117 bg, #2563EB primary, translucent glass panels) | `docs/ProjectAnswers.md` §31, `docs/08_UI_UX_DESIGN_SPECIFICATION.md` |
| **Base Currency** | KES (Kenyan Shillings) | `docs/ProjectAnswers.md` §C |
| **Four-Eyes Threshold** | Wallet adjustments > USD 500 (~65,000 KES) require 2nd Super Admin approval | `reports/WP-15_EXECUTION_REPORT.md` |
| **Audit Log Hash Chain** | SHA-256 (`sha256(prevHash + actorId + action + affectedEntity + details + createdAt)`) | `reports/WP-15_EXECUTION_REPORT.md` |
| **MFA Step-Up Requirement**| Mandatory TOTP prompt on write endpoints for admin users | `reports/WP-15_EXECUTION_REPORT.md` |

### §2.4 Decisions Pending (Ask Owner If Not in ProjectAnswers.md)

| Item | Value in ProjectAnswers.md | Why Needed | Blocker? |
|------|---------------------------|------------|----------|
| **Admin Subdomain Hosting** | `admin.skiespro.co.ke` vs path `/admin` | Production DNS routing | No (Non-blocking for Vite dev server / staging) |

### §2.5 Secret Handling Rule

**NEVER hardcode secrets, API keys, passwords, or connection strings in code.**

- Read `import.meta.env.VITE_API_BASE_URL` (or `process.env.NEXT_PUBLIC_API_URL` fallback) for API base URLs.
- Admin JWT tokens must be stored securely in memory / HTTP-only session cookies with the `mfa_verified` claim.
- Document: "Owner must configure `.env` before running".

---

## §3 What You'll Build

### §3.1 Scope & Acceptance Criteria
- [ ] **Admin Sidebar & Shell Layout (`/admin/*`)**:
  - **AC1**: Collapsible navigation sidebar rendering tabs filtered dynamically by user role (`support`, `finance`, `risk_manager`, `compliance`, `admin`, `super_admin`).
  - **AC2**: Header bar displaying active admin profile, role badge, MFA status indicator, global quick search, and active route breadcrumbs.
- [ ] **RBAC Route Guarding & Isolation**:
  - **AC3**: `<AdminProtectedRoute>` and `<HasRole>` components that inspect JWT role permissions and restrict access. Unprivileged access (e.g. `support` role accessing `/admin/wallets`) renders a 403 Access Denied fallback UI.
- [ ] **User Management Panel (`/admin/users`)**:
  - **AC4**: User search/filter table (by Email, Display Name, Status, KYC Level) with cursor/page pagination.
  - **AC5**: Detailed User Modal/Drawer rendering profile, wallet summary, KYC level, and recent trades.
  - **AC6**: User Status Toggle Modal allowing admins (`admin`, `super_admin`) to set status (`active`, `suspended`, `banned`) with mandatory reason input and TOTP MFA verification modal.
- [ ] **KYC Document Review Panel (`/admin/kyc`)**:
  - **AC7**: Pending KYC Queue displaying submission date, user details, and document links.
  - **AC8**: Side-by-side Document Inspection viewer (ID Card / Passport, Proof of Address, Selfie).
  - **AC9**: Approval / Rejection Modal submitting review decisions to `PUT /api/v1/admin/kyc/:id/review` with required reviewer notes.
- [ ] **Wallet Oversight & Manual Adjustment (`/admin/finance`)**:
  - **AC10**: System-wide wallet balance overview, liquidity ledger, and pending M-Pesa withdrawal requests table.
  - **AC11**: M-Pesa Withdrawal Approval/Rejection interface with instant status feedback.
  - **AC12**: Manual Wallet Adjustment Modal (`POST /api/v1/admin/wallets/adjust`). If adjustment amount > USD 500 (~65,000 KES), UI displays a prominent warning "Triggers 4-Eyes Approval" and routes the request into the Pending Approvals Queue.
- [ ] **Four-Eyes Approval Panel (`/admin/approvals`)**:
  - **AC13**: Super Admin queue for reviewing pending high-value wallet adjustments (> USD 500) and critical administrative actions.
  - **AC14**: Action Approval interface (`PUT /api/v1/admin/actions/:id/approve`) with TOTP step-up confirmation.
- [ ] **Audit Logs & Hash-Chain Verifier (`/admin/audit`)**:
  - **AC15**: Searchable, paginated audit trail table displaying Actor ID, Action Type, Target Entity, Timestamp, and Details payload.
  - **AC16**: "Verify Audit Chain" action button triggering `GET /api/v1/admin/audit-chain/verify` and rendering visual integrity indicators (e.g., Green "Chain Intact: 100% Verified" or Red "Tamper Alert").
- [ ] **Risk & Asset Management Dashboard (`/admin/risk`)**:
  - **AC17**: Live platform risk metrics showing aggregate open positions, payout exposure, win/loss ratio, and asset list.
  - **AC18**: Dynamic Asset Config Modal (`PUT /api/v1/admin/risk/asset-config/:symbol`) to update payout rates, min stake, and max stake per trade.
- [ ] **Support Ticket Management (`/admin/support`)**:
  - **AC19**: Ticket inbox for support staff displaying priority, status (`open`, `in_progress`, `resolved`, `closed`), and customer query history.
  - **AC20**: Ticket Resolution Drawer to update ticket status, assign agents, and dispatch response messages.
- [ ] **Reports & Analytics Dashboard (`/admin/reports`)**:
  - **AC21**: Interactive charts for Daily Revenue, Trade Volume, User Registrations, and Settlement Worker latency metrics.

### §3.2 Out of Scope
- [ ] Customer trading interface and chart widget (handled in WP-18).
- [ ] Backend API logic and SQL schema migrations (completed in WP-15).
- [ ] Automated SumSub external webhook handler (backend worker WP-05/WP-15).

### §3.3 Deliverables

**Note: The following frontend files will be implemented at these explicit paths within `frontend/src/`:**

| Deliverable | Format | Path |
|-------------|--------|------|
| **Admin Layout & Shell** | Component | `frontend/src/pages/admin/AdminLayout.tsx` |
| **Admin Sidebar** | Component | `frontend/src/components/admin/AdminSidebar.tsx` |
| **Admin Header** | Component | `frontend/src/components/admin/AdminHeader.tsx` |
| **Role Guard Component** | Component | `frontend/src/components/admin/HasRole.tsx` |
| **Protected Route Guard** | Component | `frontend/src/components/admin/AdminProtectedRoute.tsx` |
| **403 Access Denied UI** | Component | `frontend/src/components/admin/AccessDenied.tsx` |
| **MFA Step-Up Modal** | Component | `frontend/src/components/admin/MfaStepUpModal.tsx` |
| **User Management Page** | Page | `frontend/src/pages/admin/UserManagementPage.tsx` |
| **User List Table** | Component | `frontend/src/components/admin/UserTable.tsx` |
| **User Detail Drawer** | Component | `frontend/src/components/admin/UserDetailDrawer.tsx` |
| **User Status Modal** | Component | `frontend/src/components/admin/UserStatusModal.tsx` |
| **KYC Review Page** | Page | `frontend/src/pages/admin/KycReviewPage.tsx` |
| **KYC Queue Table** | Component | `frontend/src/components/admin/KycQueueTable.tsx` |
| **KYC Document Viewer** | Component | `frontend/src/components/admin/KycDocumentViewer.tsx` |
| **KYC Decision Modal** | Component | `frontend/src/components/admin/KycDecisionModal.tsx` |
| **Finance & Wallet Page** | Page | `frontend/src/pages/admin/FinanceOverviewPage.tsx` |
| **Withdrawals Table** | Component | `frontend/src/components/admin/PendingWithdrawalsTable.tsx` |
| **Withdrawal Modal** | Component | `frontend/src/components/admin/WithdrawalActionModal.tsx` |
| **Wallet Adjust Modal** | Component | `frontend/src/components/admin/WalletAdjustmentModal.tsx` |
| **Four-Eyes Queue Page** | Page | `frontend/src/pages/admin/FourEyesApprovalPage.tsx` |
| **Four-Eyes Action Card** | Component | `frontend/src/components/admin/FourEyesActionCard.tsx` |
| **Audit Logs Page** | Page | `frontend/src/pages/admin/AuditLogsPage.tsx` |
| **Audit Logs Table** | Component | `frontend/src/components/admin/AuditLogsTable.tsx` |
| **Chain Status Banner** | Component | `frontend/src/components/admin/AuditChainStatusBanner.tsx` |
| **Risk Dashboard Page** | Page | `frontend/src/pages/admin/RiskDashboardPage.tsx` |
| **Asset Config Modal** | Component | `frontend/src/components/admin/AssetConfigModal.tsx` |
| **Support Tickets Page** | Page | `frontend/src/pages/admin/SupportTicketsPage.tsx` |
| **Ticket Drawer** | Component | `frontend/src/components/admin/TicketDetailDrawer.tsx` |
| **Reports Dashboard Page**| Page | `frontend/src/pages/admin/ReportsDashboardPage.tsx` |
| **Platform Settings Tab** (Optional) | Component | `frontend/src/components/admin/SettingsTab.tsx` |
| **Admin API Client** | Service | `frontend/src/services/admin/adminApiClient.ts` |
| **Admin React Custom Hooks**| Custom Hooks | `frontend/src/hooks/admin/useAdminUsers.ts`, `useAdminKyc.ts`, `useAdminFinance.ts`, `useAdminRisk.ts`, `useAdminAudit.ts`, `useAdminSupport.ts`, `useAdminReports.ts` |
| **Admin Route Integration**| Router | `frontend/src/routes/adminRoutes.tsx` |
| **Admin Component Tests** | Test Files | `frontend/src/tests/admin/HasRole.test.tsx`, `UserStatusModal.test.tsx`, `WalletAdjustmentModal.test.tsx`, `AuditChainVerifier.test.tsx` |

---

## §4 Technical Specification

### §4.1 Architecture & Component Hierarchy

- **Framework & Router**: React 18 SPA, Vite build system, `react-router-dom` v6 routes under `/admin`.
- **State & Data Fetching**: Custom React hooks utilizing `adminApiClient.ts` for unified error handling, automatic JWT Bearer token attachment, MFA header handling, and response mapping.
- **Design System Tokens**: Dark mode glassmorphic styling based on WP-16 tokens:
  - Background: Dark slate/charcoal `#0F1117`
  - Cards & Modals: `bg-slate-900/80 backdrop-blur-md border border-slate-800/80 shadow-2xl`
  - Accent Colors: Primary Blue `#2563EB`, Success Emerald `#10B981`, Warning Amber `#F59E0B`, Danger Rose `#F43F5E`
  - Typography: Inter font family, clear hierarchy (`text-xs uppercase tracking-wider` for table headers).

```
[AdminLayout]
 ├── [AdminSidebar] (Role-filtered navigation links)
 ├── [AdminHeader] (Active profile, Role badge, MFA indicator, Search)
 └── [Main Content Area] (<Outlet /> wrapped in <AdminProtectedRoute>)
      ├── /admin/users      -> [UserManagementPage] -> [UserTable], [UserStatusModal]
      ├── /admin/kyc        -> [KycReviewPage]      -> [KycQueueTable], [KycDocumentViewer]
      ├── /admin/finance    -> [FinanceOverviewPage]-> [PendingWithdrawalsTable], [WalletAdjustmentModal]
      ├── /admin/approvals  -> [FourEyesApprovalPage]-> [FourEyesActionCard]
      ├── /admin/audit      -> [AuditLogsPage]       -> [AuditLogsTable], [AuditChainStatusBanner]
      ├── /admin/risk       -> [RiskDashboardPage]  -> [AssetConfigModal], [RiskExposureCard]
      ├── /admin/support    -> [SupportTicketsPage] -> [TicketDetailDrawer]
      └── /admin/reports    -> [ReportsDashboardPage]-> [RevenueChartWidget]
```

### §4.2 Backend API Mapping

Every screen and action in the WP-20 Frontend Admin Dashboard maps directly to a WP-15 backend endpoint registered under `/api/v1/admin`:

| Screen / Feature | UI Trigger / Event | HTTP Method & Endpoint | Required Roles | MFA Required | Response Payload |
|------------------|-------------------|------------------------|----------------|--------------|------------------|
| **User Management** | Page load / Search input | `GET /api/v1/admin/users` | `admin`, `super_admin` | No | `{ users: User[], pagination: {...} }` |
| **User Details** | Click User Row | `GET /api/v1/admin/users/:id` | `admin`, `super_admin` | No | `{ user: UserDetail }` |
| **User Status Toggle** | Submit Status Form | `PUT /api/v1/admin/users/:id/status` | `admin`, `super_admin` | **Yes** | `{ success: true, user: User }` |
| **User Ledger** | Open Ledger Tab | `GET /api/v1/admin/users/:id/ledger` | `finance`, `admin`, `super_admin` | **Yes** | `{ ledger: LedgerEntry[] }` |
| **KYC Queue** | Page load | `GET /api/v1/admin/kyc/pending` | `compliance`, `admin`, `super_admin` | **Yes** | `{ pending: KycApplication[] }` |
| **KYC Document View** | Click Application | `GET /api/v1/admin/kyc/:id` | `compliance`, `admin`, `super_admin` | **Yes** | `{ application: KycDetail }` |
| **KYC Decision** | Approve / Reject | `PUT /api/v1/admin/kyc/:id/review` | `compliance`, `admin`, `super_admin` | **Yes** | `{ success: true }` |
| **Pending Withdrawals**| Page load | `GET /api/v1/admin/withdrawals/pending` | `finance`, `admin`, `super_admin` | **Yes** | `{ withdrawals: Withdrawal[] }` |
| **Withdrawal Details** | Click Withdrawal Row | `GET /api/v1/admin/withdrawals/:id` | `finance`, `admin`, `super_admin` | **Yes** | `{ withdrawal: WithdrawalDetail }` |
| **Withdrawal Approval** | Click Approve | `PUT /api/v1/admin/withdrawals/:id/approve` | `finance`, `admin`, `super_admin` | **Yes** | `{ success: true, tx_hash: string }` |
| **Withdrawal Rejection**| Click Reject | `PUT /api/v1/admin/withdrawals/:id/reject` | `finance`, `admin`, `super_admin` | **Yes** | `{ success: true }` |
| **Wallet Adjustment** | Submit Adjustment Modal | `POST /api/v1/admin/wallets/adjust` | `super_admin` | **Yes** | `{ success: true, pending_four_eyes: boolean }` |
| **4-Eyes Action Approve**| Click Approve Action | `PUT /api/v1/admin/actions/:id/approve` | `super_admin` | **Yes** | `{ success: true, action: AdminAction }` |
| **Risk Overview** | Page load | `GET /api/v1/admin/risk/dashboard` | `risk_manager`, `admin`, `super_admin` | **Yes** | `{ risk_metrics: RiskData }` |
| **Risk Exposure** | Refresh Widget | `GET /api/v1/admin/risk/exposure` | `risk_manager`, `admin`, `super_admin` | **Yes** | `{ exposure: SymbolExposure[] }` |
| **Update Asset Config**| Save Asset Form | `PUT /api/v1/admin/risk/asset-config/:symbol` | `risk_manager`, `admin`, `super_admin` | **Yes** | `{ success: true, config: AssetConfig }` |
| **Audit Logs** | Page load / Filter | `GET /api/v1/admin/audit-logs` | `compliance`, `admin`, `super_admin` | **Yes** | `{ logs: AuditLog[], total: number }` |
| **Verify Audit Chain** | Click Verify Button | `GET /api/v1/admin/audit-chain/verify` | `compliance`, `admin`, `super_admin` | **Yes** | `{ valid: boolean, broken_at_id?: string }` |
| **Support Inbox** | Page load | `GET /api/v1/admin/support/tickets` | `support`, `admin`, `super_admin` | **Yes** | `{ tickets: Ticket[] }` |
| **Update Ticket** | Reply / Resolve | `PUT /api/v1/admin/support/tickets/:id` | `support`, `admin`, `super_admin` | **Yes** | `{ success: true, ticket: Ticket }` |
| **Daily Revenue Report** | Reports Tab / Daily Revenue | `GET /api/v1/admin/reports/daily-revenue` | `finance`, `admin`, `super_admin` | **Yes** | `{ daily_revenue: RevenueData[] }` |
| **Trade Volume Report** | Reports Tab / Trade Volume | `GET /api/v1/admin/reports/trade-volume` | `finance`, `admin`, `super_admin` | **Yes** | `{ trade_volume: VolumeData[] }` |
| **User Registrations Report** | Reports Tab / User Growth | `GET /api/v1/admin/reports/user-registrations` | `admin`, `super_admin` | **Yes** | `{ registrations: RegistrationData[] }` |
| **Settlement Performance** | Reports Tab / Settlement Latency | `GET /api/v1/admin/reports/settlement-performance` | `admin`, `super_admin` | **Yes** | `{ settlement_metrics: PerformanceData[] }` |
| **Platform Settings** (Optional) | Settings Tab / View Config | `GET /api/v1/admin/settings` | `admin`, `super_admin` | **Yes** | `{ settings: PlatformSettings[] }` |
| **Update Platform Settings** (Optional) | Settings Tab / Save Config | `PUT /api/v1/admin/settings` | `admin`, `super_admin` | **Yes** | `{ success: true, setting: PlatformSetting }` |

### §4.3 Role-Based Access Control (RBAC) & Component Matrix

Access to pages and components is gated using `<HasRole>` and `<AdminProtectedRoute>`:

| Route Path | UI Module / View | Allowed Roles | Forbidden Behavior |
|------------|------------------|---------------|--------------------|
| `/admin/users` | User Directory & Status Management | `admin`, `super_admin` | Render `<AccessDenied />` (403) |
| `/admin/kyc` | KYC Document Review Panel | `compliance`, `admin`, `super_admin` | Render `<AccessDenied />` (403) |
| `/admin/finance` | Withdrawal Approval & Ledger | `finance`, `admin`, `super_admin` | Render `<AccessDenied />` (403) |
| `/admin/wallets/adjust`| Manual Wallet Adjustment | `super_admin` | Button hidden / disabled |
| `/admin/approvals` | 4-Eyes Approval Queue | `super_admin` | Navigation tab hidden |
| `/admin/risk` | Risk Exposure & Asset Config | `risk_manager`, `admin`, `super_admin` | Render `<AccessDenied />` (403) |
| `/admin/audit` | Audit Trail & Chain Verification | `compliance`, `admin`, `super_admin` | Render `<AccessDenied />` (403) |
| `/admin/support` | Ticket Inbox & Support Actions | `support`, `admin`, `super_admin` | Accessible to support staff |
| `/admin/reports` | Business & Settlement Analytics | `finance`, `admin`, `super_admin` | Render `<AccessDenied />` (403) |

#### Component Gating Example (`HasRole`):
```tsx
import React from 'react';
import { useAuth } from '@/hooks/useAuth';

interface HasRoleProps {
  roles: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const HasRole: React.FC<HasRoleProps> = ({ roles, children, fallback = null }) => {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
};
```

### §4.4 Security Requirements & MFA Workflow

1. **TOTP MFA Step-Up Modal (`MfaStepUpModal.tsx`)**:
   - Write requests to protected endpoints requiring MFA check `user.mfa_verified`.
   - If MFA token is not active in current session, the UI intercepted modal opens prompting for the 6-digit TOTP code.
   - Upon verification, the header `X-Admin-MFA-Token` or TOTP code is injected into the payload and the request proceeds.
2. **Four-Eyes Workflow Threshold**:
   - Manual wallet adjustments > USD 500 (~65,000 KES) trigger the backend 4-eyes rule.
   - The UI intercepts the response (`pending_four_eyes: true`) and displays a notice: `"Adjustment submitted for 4-Eyes Super Admin Approval"`.
3. **Audit Hash Integrity Display**:
   - Audit log entries display a truncated hash badge (e.g. `a4f8...9b21`).
   - The "Verify Audit Chain" widget runs the SHA-256 verification API and displays an absolute pass/fail visual badge.
4. **Session Timeout & Anti-Token Leakage**:
   - Admin JWTs expire after 15 minutes.
   - Unhandled 401/403 API responses trigger `adminApiClient` interceptors to wipe session state and redirect to `/login?reason=session_expired`.

---

## §5 Manual Steps for Owner

The executor will implement the code, but you (Owner) must verify configuration and seed scripts:

### §5.1 Environment Configuration
Add the following frontend environment variables to your `frontend/.env` file:

```env
# Frontend API Base URL
VITE_API_BASE_URL=https://skiespro-api-njuw.onrender.com

# Admin Dashboard Config
VITE_ADMIN_DEFAULT_ROLE=super_admin
VITE_ADMIN_FOUR_EYES_THRESHOLD_USD=500
```

### §5.2 Seed Owner Admin Account
If not already executed, seed the primary administrative owner account in the backend database:

```bash
npx ts-node scripts/seed-admin-super-admin.ts
```

### §5.3 Verification Steps
Run the following commands in `C:/SkiesPro` to test and build the frontend admin dashboard:

```bash
# 1. Typecheck and lint frontend codebase
cd frontend
npm run typecheck
npm run lint

# 2. Run admin component & RBAC test suite
npm run test

# 3. Start local development server
npm run dev
```

---

## §6 Testing Requirements

| Test ID | Test Type | Coverage Focus | Target / Scenario |
|---------|-----------|----------------|-------------------|
| **ADM-FE-001** | Unit Test | `<HasRole>` Component | Verify children render for matching role (`admin`) and return fallback for unauthorized role (`support`). |
| **ADM-FE-002** | Unit Test | `<AdminProtectedRoute>` | Verify non-admin role is redirected to `/admin/403` or `/login`. |
| **ADM-FE-003** | Component Test | `UserStatusModal.tsx` | Verify status change requires reason input and dispatches `PUT /api/v1/admin/users/:id/status`. |
| **ADM-FE-004** | Component Test | `WalletAdjustmentModal.tsx` | Verify values > USD 500 show "Triggers 4-Eyes Approval" badge. |
| **ADM-FE-005** | Component Test | `AuditChainStatusBanner.tsx` | Verify green badge renders when `valid: true` and warning renders when `valid: false`. |
| **ADM-FE-006** | E2E Flow | RBAC Isolation Flow | Login as `support` staff and attempt navigation to `/admin/wallets`. Verify 403 screen renders and no sensitive data is leaked. |
| **ADM-FE-007** | E2E Flow | KYC Approval Flow | Login as `compliance`, review document in `KycDocumentViewer`, submit approval note, and verify table updates. |

---

## §7 Validation & Done Criteria

### §7.1 Code Quality Checklist
- [ ] Follows DHCS §3 naming conventions and Vite React standards.
- [ ] Components use glassmorphic dark theme tokens (#0F1117, translucent cards).
- [ ] No secrets or private tokens hardcoded in frontend files.
- [ ] All forms validate inputs using Zod or React Hook Form schemas.
- [ ] Error boundaries catch unhandled UI errors gracefully.
- [ ] All async API requests handle 401/403/500 HTTP errors gracefully.

### §7.2 Functional Verification
- [ ] All 21 Acceptance Criteria in §3.1 met.
- [ ] Role isolation verified for all 6 roles (`support`, `finance`, `risk_manager`, `compliance`, `admin`, `super_admin`).
- [ ] 4-Eyes approval notice triggers for adjustments > USD 500.
- [ ] Audit chain integrity verifier button functions and renders pass/fail status.
- [ ] All frontend tests pass (`npm run test`).

### §7.3 Owner Sign-Off

| Check | Verified By | Date |
|-------|-------------|------|
| Admin Dashboard UI layout & glassmorphic theme verified | [AMOS FX / Owner] | |
| RBAC role isolation verified across all sub-pages | [AMOS FX / Owner] | |
| Four-Eyes approval & KYC review flows operational | [AMOS FX / Owner] | |
| Deployed to Staging / Production | [AMOS FX / Owner] | |

---

## §8 Handoff

### §8.1 Next Work Package
| WP-ID | Name | Why This Next |
|-------|------|---------------|
| **WP-22** | End-to-End Integration & Launch Readiness | Connects Frontend Admin Dashboard, User Trading UI (WP-18), Wallet UI (WP-19), and Demo Trade Surface (WP-21) for full platform staging test pass. |

### §8.2 Handoff Notes
- All admin endpoints require `Authorization: Bearer <token>` and write endpoints require `mfa_verified: true`.
- Testing can be conducted locally using `npm run dev` in the `frontend/` directory pointing to `https://skiespro-api-njuw.onrender.com` or local Express backend.

---

## §9 Risks & Blockers

| Risk | Probability | Impact | Mitigation | Owner |
|------|-------------|--------|------------|-------|
| **RBAC Token Leakage / Privilege Escalation** | Low | High | Enforce both client-side route guards and server-side JWT claim validation on every API request. | Tech Lead |
| **Session Expiry During Multi-Step Approval** | Medium | Medium | Implement TOTP MFA step-up modal state recovery so admin work is not lost on token refresh. | AI / Executor |
| **Unhandled 403 Forbidden States** | Low | Medium | Provide explicit `<AccessDenied />` fallback component so UI does not crash or white-screen. | AI / Executor |
| **Timezone Mismatch in Audit Logs** | Low | Low | Format all timestamps in UTC ISO-8601 format across UI tables. | AI / Executor |

---

## §10 Change Log

| Date | Change | By |
|------|--------|----|
| 2026-07-28 | Initial Work Package Blueprint creation for WP-20 Frontend Admin Dashboard | Tech Lead / AI |

---

## §11 Final Checklist (Before Closing WP-20)
- [ ] All prerequisites (WP-15, WP-16, WP-17) verified complete.
- [ ] All deliverables in `frontend/src/pages/admin/` and `frontend/src/components/admin/` created.
- [ ] RBAC route protection tested across all 6 roles.
- [ ] Four-eyes modal & Audit chain verifier verified.
- [ ] Frontend tests passing (`npm run test`).
- [ ] Owner manual steps documented and executed.
- [ ] Owner sign-off obtained.
