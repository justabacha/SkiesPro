# Trader UI Audit — 2026-10-24

## 1. Executive Summary

The Trader UI (Trader-facing web application) has two fully implemented pages (**Trade** at `/trading` and **Wallet** at `/wallet`). However, six sidebar navigation links (**Dashboard**, **History**, **KYC Flow**, **Referrals**, **Support**, and **Settings**) currently render dead `<Placeholder>` stubs ("Work Package in progress..."). 

Our audit reveals that three of these six features (**History**, **Settings**, and **KYC Status/Initiate**) have existing backend services and endpoints that are **BACKEND-READY** or partially ready, while three features (**Dashboard**, **Referrals**, and **Support Ticket Creation**) require backend controller/route development (**BOTH-MISSING** or **FRONTEND-STUB**).

| Page | Gap Classification | Backend Ready? | Frontend State | Blocking Issues |
| :--- | :--- | :--- | :--- | :--- |
| **1. Dashboard** | **BOTH-MISSING** | No (no trader dashboard API) | `<Placeholder>` stub at `/` & `/dashboard` | Needs backend aggregation endpoint |
| **2. History** | **BACKEND-READY** | Yes (`GET /api/v1/trading/contracts`) | `<Placeholder>` stub at `/history` | None — reusable `<TradeHistory />` component exists |
| **3. KYC Flow** | **FRONTEND-STUB** | Partial (`GET /kyc/status`, `POST /kyc/initiate`) | `<Placeholder>` stub at `/kyc` | Missing document upload API (`POST /kyc/documents`) |
| **4. Referrals** | **BOTH-MISSING** | No (schema exists, no API routes) | `<Placeholder>` stub at `/referrals` | Needs referral controller, service & API routes |
| **5. Support** | **FRONTEND-STUB** | Partial (Admin support API exists) | `<Placeholder>` stub at `/support` | Missing trader ticket creation & thread APIs |
| **6. Settings** | **BACKEND-READY** | Yes (`GET/PUT /api/v1/user/profile`, `POST /auth/mfa/*`) | `<Placeholder>` stub at `/settings` | None — backend profile & MFA endpoints ready |

---

## 2. Per-Page Findings

### 2.1 Dashboard Page (`/` and `/dashboard`)
- **Frontend (A)**:
  - File: Renders `<Placeholder title="Dashboard" />` in [index.tsx:24-25](file:///C:/SkiesPro/frontend/src/router/index.tsx#L24-L25).
  - Registered Routes: `{ index: true, element: <Placeholder title="Dashboard" /> }` and `{ path: 'dashboard', element: <Placeholder title="Dashboard" /> }`.
  - Sidebar Link: [Sidebar.tsx:15](file:///C:/SkiesPro/frontend/src/shared/components/layout/Sidebar.tsx#L15) (`href: '/'`) and [MobileNav.tsx:13](file:///C:/SkiesPro/frontend/src/shared/components/layout/MobileNav.tsx#L13) (`href: '/'`). Target matches.
  - Guard: Protected via `<ProtectedRoute>` in `router/index.tsx`.
  - Hardcoded Values: Static string `"Work Package in progress..."`.
  - Shared Components Needed: `Card`, `Button`, `Badge`, `Spinner`, `formatKES`, `useWallet`.
- **Backend (B)**:
  - **MISSING — no controller/service/route found** for trader dashboard aggregations (win rate, quick trade stats, recent activity).
  - Existing DB Tables: `trading.binary_contracts`, `wallet.wallets`, `wallet.ledger_entries`.
- **Gap Classification (C)**: **BOTH-MISSING**
- **Reuse Notes (D)**:
  - Should reuse `useWallet` hook for balance cards.
  - Should reuse `AccountModeContext` (`useAccountMode()`) for real vs demo dashboard metrics.

---

### 2.2 History Page (`/history`)
- **Frontend (A)**:
  - File: Renders `<Placeholder title="Trade History" />` in [index.tsx:29](file:///C:/SkiesPro/frontend/src/router/index.tsx#L29).
  - Registered Route: `{ path: 'history', element: <Placeholder title="Trade History" /> }`.
  - Sidebar Link: [Sidebar.tsx:18](file:///C:/SkiesPro/frontend/src/shared/components/layout/Sidebar.tsx#L18) (`href: '/history'`). Target matches.
  - Guard: Protected via `<ProtectedRoute>`.
  - Shared Components Needed: Reusable component [TradeHistory.tsx](file:///C:/SkiesPro/frontend/src/modules/trading/components/TradeHistory.tsx) already exists in trading module.
- **Backend (B)**:
  - Existing Route: `GET /api/v1/trading/contracts` (and `GET /api/v1/demo/trading/contracts` for demo mode) in [trading.routes.ts:25](file:///C:/SkiesPro/src/modules/trading/trading.routes.ts#L25).
  - Auth: `authenticateToken` middleware required.
  - Response DTO: Array of `BinaryContract` objects (`id`, `asset_symbol`, `contract_type`, `stake`, `strike_price`, `expiry_price`, `payout_rate`, `potential_payout`, `purchase_time`, `expiry_time`, `status`, `settled_at`).
- **Gap Classification (C)**: **BACKEND-READY**
- **Reuse Notes (D)**:
  - Directly reuse `useTrading` hook (`getContracts()`) and `<TradeHistory />` component from [frontend/src/modules/trading/components/TradeHistory.tsx](file:///C:/SkiesPro/frontend/src/modules/trading/components/TradeHistory.tsx).

---

### 2.3 KYC Flow Page (`/kyc`)
- **Frontend (A)**:
  - File: Renders `<Placeholder title="KYC Verification" />` in [index.tsx:31](file:///C:/SkiesPro/frontend/src/router/index.tsx#L31).
  - Registered Route: `{ path: 'kyc', element: <Placeholder title="KYC Verification" /> }`.
  - Sidebar Link: [Sidebar.tsx:20](file:///C:/SkiesPro/frontend/src/shared/components/layout/Sidebar.tsx#L20) (`href: '/kyc'`). Target matches.
  - Guard: Protected via `<ProtectedRoute>`.
  - Shared Components Needed: `Card`, `Badge`, `Button`, `FormGroup`, `Input`, `Toast`, `TableLoading`.
- **Backend (B)**:
  - Existing Routes in [user.routes.ts:57-65](file:///C:/SkiesPro/src/modules/user/user.routes.ts#L57-L65):
    - `GET /api/v1/user/kyc/status` $\rightarrow$ returns `{ data: { kyc_status: 'unverified' | 'pending' | 'verified' | 'rejected' } }`.
    - `POST /api/v1/user/kyc/initiate` $\rightarrow$ sets status to `'pending'` and returns `{ data: { kyc_status: 'pending' } }`.
  - Missing Route: No document upload endpoint (`POST /api/v1/user/kyc/documents`) for uploading document image/URL to `compliance.kyc_documents` table.
  - Existing DB Table: `compliance.kyc_documents` (`id`, `user_id`, `document_type`, `document_number`, `document_url`, `status`, `submitted_at`).
- **Gap Classification (C)**: **FRONTEND-STUB**
- **Reuse Notes (D)**:
  - Reuse `useAuth()` for user profile and `kycStatus`.
  - Reuse `formatDocumentType` helper from [safeFormatters.ts](file:///C:/SkiesPro/frontend/src/shared/utils/safeFormatters.ts#L36).

---

### 2.4 Referrals Page (`/referrals`)
- **Frontend (A)**:
  - File: Renders `<Placeholder title="Referral System" />` in [index.tsx:30](file:///C:/SkiesPro/frontend/src/router/index.tsx#L30).
  - Registered Route: `{ path: 'referrals', element: <Placeholder title="Referral System" /> }`.
  - Sidebar Link: [Sidebar.tsx:19](file:///C:/SkiesPro/frontend/src/shared/components/layout/Sidebar.tsx#L19) (`href: '/referrals'`). Target matches.
  - Guard: Protected via `<ProtectedRoute>`.
  - Shared Components Needed: `Card`, `Button`, `Input`, `Toast`, `TableEmpty`.
- **Backend (B)**:
  - **MISSING — no controller/service/route found** for referral dashboard, code lookup, or commission earnings tracking.
  - Existing DB Tables & Columns:
    - `app_auth.users.referral_code` (generated at registration in [authService.ts:69](file:///C:/SkiesPro/src/modules/auth/services/authService.ts#L69)).
    - `referral.referral_codes` (`owner_id`, `code`, `created_at`).
    - `referral.referrals` (`referrer_id`, `referred_user_id`, `referral_code`, `status`).
    - `referral.referral_commissions` (`referral_id`, `commission_amount`, `status`, `created_at`).
- **Gap Classification (C)**: **BOTH-MISSING**
- **Reuse Notes (D)**:
  - Reuse `useAuth()` to read `user.referralCode`.
  - Reuse `Card`, `Input`, and `Toast` for referral link copy-to-clipboard functionality.

---

### 2.5 Support Page (`/support`)
- **Frontend (A)**:
  - File: Renders `<Placeholder title="Support Tickets" />` in [index.tsx:32](file:///C:/SkiesPro/frontend/src/router/index.tsx#L32).
  - Registered Route: `{ path: 'support', element: <Placeholder title="Support Tickets" /> }`.
  - Sidebar Link: [Sidebar.tsx:21](file:///C:/SkiesPro/frontend/src/shared/components/layout/Sidebar.tsx#L21) (`href: '/support'`). Target matches.
  - Guard: Protected via `<ProtectedRoute>`.
  - Shared Components Needed: `Card`, `Badge`, `Button`, `FormGroup`, `Input`, `Modal`, `TableLoading`, `TableEmpty`.
- **Backend (B)**:
  - Existing Admin Support API: `GET /api/v1/admin/support/tickets` and `PUT /api/v1/admin/support/tickets/:id` exist for admin staff.
  - Missing Trader Support API: No trader endpoints for creating a ticket (`POST /api/v1/user/support/tickets`) or listing own tickets (`GET /api/v1/user/support/tickets`).
  - Existing DB Table: `admin.support_tickets` (`id`, `user_id`, `subject`, `message`, `status`, `priority`, `created_at`, `updated_at`).
- **Gap Classification (C)**: **FRONTEND-STUB**
- **Reuse Notes (D)**:
  - Reuse `Badge` and `Modal` components.
  - Align ticket status badges (`open` = amber, `in_progress` = blue, `resolved` = emerald) with Admin UI conventions.

---

### 2.6 Settings Page (`/settings`)
- **Frontend (A)**:
  - File: Renders `<Placeholder title="User Settings" />` in [index.tsx:33](file:///C:/SkiesPro/frontend/src/router/index.tsx#L33).
  - Registered Route: `{ path: 'settings', element: <Placeholder title="User Settings" /> }`.
  - Sidebar Link: [Sidebar.tsx:22](file:///C:/SkiesPro/frontend/src/shared/components/layout/Sidebar.tsx#L22) (`href: '/settings'`). Target matches.
  - Guard: Protected via `<ProtectedRoute>`.
  - Shared Components Needed: `Card`, `Button`, `FormGroup`, `Input`, `PasswordInput`, `Modal`, `Toast`.
- **Backend (B)**:
  - Existing Routes in [user.routes.ts:28-48](file:///C:/SkiesPro/src/modules/user/user.routes.ts#L28-L48) & [auth.routes.ts:110-118](file:///C:/SkiesPro/src/modules/auth/auth.routes.ts#L110-L118):
    - `GET /api/v1/user/profile` $\rightarrow$ returns `ProfileResponseDto` (`id`, `email`, `display_name`, `phone`, `kyc_status`, `avatar_url`, `mfa_enabled`).
    - `PUT /api/v1/user/profile` $\rightarrow$ updates profile fields.
    - `POST /api/v1/user/profile/avatar` $\rightarrow$ updates avatar image.
    - `POST /api/v1/auth/mfa/setup` & `POST /api/v1/auth/mfa/verify-setup` $\rightarrow$ enables TOTP MFA.
  - Auth: `authenticate` JWT middleware required.
- **Gap Classification (C)**: **BACKEND-READY**
- **Reuse Notes (D)**:
  - Reuse `useAuth()` hook for profile management.
  - Reuse `PasswordInput` and `FormGroup` shared components.

---

## 3. Cross-Cutting Findings

### 3.1 Sidebar Routing Table
Location: [Sidebar.tsx:14-23](file:///C:/SkiesPro/frontend/src/shared/components/layout/Sidebar.tsx#L14-L23)

```typescript
const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutGrid },
  { name: 'Trade', href: '/trading', icon: LineChart },
  { name: 'Wallet', href: '/wallet', icon: Wallet },
  { name: 'History', href: '/history', icon: History },
  { name: 'Referrals', href: '/referrals', icon: Users },
  { name: 'KYC', href: '/kyc', icon: ShieldCheck },
  { name: 'Support', href: '/support', icon: Headphones },
  { name: 'Settings', href: '/settings', icon: Settings },
];
```

**Orphan Routes in `router/index.tsx`**:
- `/trade` (alias for `/trading` in `router/index.tsx:27`)
- `/menu` (mobile menu placeholder in `router/index.tsx:35`)
- `/design-system` (developer design system page in `router/index.tsx:34`)

### 3.2 Auth & Guard Matrix

| Route | Protected? | Guard Component | Role Check | Missing Guard Finding |
| :--- | :--- | :--- | :--- | :--- |
| `/` & `/dashboard` | Yes | `<ProtectedRoute>` | Authenticated Trader | None |
| `/trading` | Yes | `<ProtectedRoute>` | Authenticated Trader | None |
| `/wallet` | Yes | `<ProtectedRoute>` | Authenticated Trader | None |
| `/history` | Yes | `<ProtectedRoute>` | Authenticated Trader | None |
| `/referrals` | Yes | `<ProtectedRoute>` | Authenticated Trader | None |
| `/kyc` | Yes | `<ProtectedRoute>` | Authenticated Trader | None |
| `/support` | Yes | `<ProtectedRoute>` | Authenticated Trader | None |
| `/settings` | Yes | `<ProtectedRoute>` | Authenticated Trader | None |

*Finding*: Top-level route protection is uniformly applied via `<ProtectedRoute>`. However, action-level KYC gating is missing for live trade placement.

### 3.3 AccountModeContext / Demo-Mode Awareness

- **Mode-Aware Pages**: `TradingPage.tsx` and `WalletPage.tsx` subscribe to `useAccountMode()` to toggle between `real` and `demo` accounts.
- **Mode Awareness Needed for Dead Pages**:
  - **History Page (`/history`)**: MUST be mode-aware. Must query `GET /api/v1/trading/contracts` when in `real` mode and `GET /api/v1/demo/trading/contracts` when in `demo` mode.
  - **Dashboard Page (`/dashboard`)**: MUST be mode-aware. Must display balance and trade performance scoped to active `accountMode`.
  - **KYC, Referrals, Support, Settings**: Mode-agnostic (account-level global settings).

### 3.4 KYC Gating
- **Current Enforcement**: Only `WalletPage.tsx` enforces a KYC check via `disabled={user?.kycStatus !== 'verified'}` on the Withdraw button.
- **Missing KYC Enforcement**: `TradingPage.tsx` and `OrderForm.tsx` do NOT enforce `kyc.required_for_trading`. Unverified users can place binary option trades freely.

### 3.5 Test Account Reachability

| Account | Role / Status | Route Reachability | Behavior Differences |
| :--- | :--- | :--- | :--- |
| `just1abacha@gmail.com` | Verified Trader (`kyc_status = 'verified'`) | All routes reachable | Can click Withdraw on Wallet page |
| `ryan41rays@gmail.com` | Unverified Trader (`kyc_status = 'unverified'`) | All routes reachable | Withdraw button disabled on Wallet page |

---

## 4. Shared Component Inventory

| Component Name | File Path | Currently Used By | Recommended For |
| :--- | :--- | :--- | :--- |
| `Button` | `frontend/src/shared/components/Button.tsx` | Wallet, Trading, Auth | All 6 trader pages |
| `Input` | `frontend/src/shared/components/Input.tsx` | Wallet, Auth | Settings, Support, Referrals |
| `PasswordInput` | `frontend/src/shared/components/PasswordInput.tsx` | Auth | Settings (password reset) |
| `FormGroup` | `frontend/src/shared/components/FormGroup.tsx` | Wallet, Auth | Settings, Support |
| `Card` | `frontend/src/shared/components/Card.tsx` | Wallet, Trading | Dashboard, Settings, Referrals |
| `Badge` | `frontend/src/shared/components/Badge.tsx` | Wallet, Trading | Support, KYC, History |
| `Modal` | `frontend/src/shared/components/Modal.tsx` | Wallet, Trading | Support (New Ticket), Settings |
| `Toast` | `frontend/src/shared/components/Toast.tsx` | Auth | Settings, KYC, Support, Referrals |
| `TableLoading` | `frontend/src/shared/components/TableLoading.tsx` | Admin UI, Wallet | History, Support, Referrals |
| `TableEmpty` | `frontend/src/shared/components/TableEmpty.tsx` | Admin UI, Wallet | History, Support, Referrals |
| `FilterTabs` | `frontend/src/shared/components/FilterTabs.tsx` | Admin UI, Wallet | History, Support |

---

## 5. Recommended Fix Sequencing (Advisory Only)

1. **Settings Page (`/settings`)**: High value, **BACKEND-READY** (`GET/PUT /user/profile`, `POST /auth/mfa/*`). Enables users to manage profile, avatar, and MFA.
2. **History Page (`/history`)**: High value, **BACKEND-READY** (`GET /trading/contracts`). Reuses existing `<TradeHistory />` component with mode-awareness (`real` vs `demo`).
3. **KYC Flow Page (`/kyc`)**: Medium value, **FRONTEND-STUB**. Connects to `GET /user/kyc/status` and `POST /user/kyc/initiate`. Requires adding document upload API endpoint (`POST /user/kyc/documents`).
4. **Support Page (`/support`)**: Medium value, **FRONTEND-STUB**. Requires adding trader ticket creation endpoint (`POST /user/support/tickets`) to interact with existing `admin.support_tickets` DB table.
5. **Referrals Page (`/referrals`)**: Low-Medium value, **BOTH-MISSING**. Requires building trader referral controller & routes (`GET /user/referrals`) backed by existing `referral.*` DB tables.
6. **Dashboard Page (`/dashboard`)**: Low-Medium value, **BOTH-MISSING**. Requires building trader dashboard aggregation endpoint (`GET /user/dashboard`).

---

## 6. Open Questions / Unknowns

1. **KYC Document Storage Provider**: The database schema includes `compliance.kyc_documents.document_url`, but no cloud storage integration (e.g. S3 / Cloudinary / Supabase Storage) is currently configured in backend code for trader document uploads.
2. **Referral Commission Settlement**: `referral.referral_commissions` table exists in DB, but the trigger or background worker that calculates and credits commission to `wallet.wallets` upon trade settlement is not yet wired.

---

## 7. Constraints Honored

- **Read-Only**: No application code, migrations, routes, or tests were modified during this audit.
- **Admin Isolation**: Admin pages (`/admin/*`) and backend admin modules were not modified.
- **Daraja Isolation**: Safaricom Daraja B2C OTP configuration was not touched or blocked on.
- **Report Location**: Saved to [reports/TraderUI/01-trader-ui-audit.md](file:///C:/SkiesPro/reports/TraderUI/01-trader-ui-audit.md).

Read-Only Audit Completed
