# Wave 1 Read-Only Audit Report: Settings (`/settings`) & History (`/history`)

## Overview
De-risking and technical feasibility audit for Wave 1 trader-facing pages: **Settings** (`/settings`) and **History** (`/history`). This audit verifies existing backend contracts, frontend reusable components, mode-awareness, and provides sized feasibility matrices for implementation planning.

---

# SECTION 1: SETTINGS PAGE (`/settings`) AUDIT

### 1. Contract Verification

#### Endpoints & Methods
- **`GET /api/v1/user/profile`**:
  - Middleware: `authenticate`, `rateLimit('authenticated')` ([user.routes.ts:28](file:///C:/SkiesPro/src/modules/user/user.routes.ts#L28)).
  - Response DTO (`ProfileResponseDto`):
    ```typescript
    {
      id: string;
      email: string;
      display_name: string;
      phone: string | null;
      avatar_url: string | null;
      kyc_status: 'unverified' | 'pending' | 'verified' | 'rejected';
      created_at: string;
    }
    ```
  - Error Codes: `401 Unauthorized` (unauthenticated), `404 Not Found` (user missing).
- **`PUT /api/v1/user/profile`**:
  - Middleware: `authenticate`, `rateLimit('authenticated')`, `updateProfileValidator` ([user.routes.ts:32](file:///C:/SkiesPro/src/modules/user/user.routes.ts#L32)).
  - Request DTO (`UpdateProfileDto`): `{ display_name?: string, phone?: string }`.
  - Response DTO: `ProfileResponseDto`.
  - Error Codes: `400 Bad Request` (validation error), `401 Unauthorized`.
- **`POST /api/v1/user/profile/avatar`**:
  - Middleware: `authenticate`, `rateLimit('authenticated')`, Multer memory storage (JPEG/PNG max 2MB) ([user.routes.ts:42](file:///C:/SkiesPro/src/modules/user/user.routes.ts#L42)).
  - Response DTO: `{ data: { avatar_url: string }, meta: { request_id: string } }`.
  - Storage: Fully implemented via Supabase Storage bucket `'avatars'` in [supabaseStorage.ts](file:///C:/SkiesPro/src/shared/storage/supabaseStorage.ts).
- **MFA Endpoints**:
  - `POST /api/v1/auth/mfa/setup`: Generates TOTP secret URI and backup codes ([auth.routes.ts:111](file:///C:/SkiesPro/src/modules/auth/auth.routes.ts#L111)).
  - `POST /api/v1/auth/mfa/verify-setup`: Confirms TOTP code and enables MFA ([auth.routes.ts:115](file:///C:/SkiesPro/src/modules/auth/auth.routes.ts#L115)).

#### Audit Corrections to General Audit
- The general audit claimed avatar storage might need to be built. **Correction**: Supabase Storage for avatars is **ALREADY BUILT** in `SupabaseStorageClient` ([supabaseStorage.ts:10](file:///C:/SkiesPro/src/shared/storage/supabaseStorage.ts#L10)) and fully wired in `UserService.uploadAvatar`.
- Authenticated change password endpoint (`PUT /api/v1/user/password`) is **MISSING** on backend and must be added.

---

### 2. Frontend Reuse Verification

- **`useAuth()`**: [shared/hooks/useAuth.ts](file:///C:/SkiesPro/frontend/src/shared/hooks/useAuth.ts). Interface: `{ user: User | null, isAuthenticated: boolean, isLoading: boolean, logout: () => Promise<void> }`. Standalone, wrapped by `AuthContext`.
- **`PasswordInput`**: [shared/components/PasswordInput.tsx](file:///C:/SkiesPro/frontend/src/shared/components/PasswordInput.tsx). Interface: `InputProps`. Standalone, built-in show/hide toggle.
- **`FormGroup`**: [shared/components/FormGroup.tsx](file:///C:/SkiesPro/frontend/src/shared/components/FormGroup.tsx). Interface: `{ label?: string; error?: string; children: React.ReactNode }`.
- **`Input`**: [shared/components/Input.tsx](file:///C:/SkiesPro/frontend/src/shared/components/Input.tsx). Interface: `InputProps`.
- **`Button`**: [shared/components/Button.tsx](file:///C:/SkiesPro/frontend/src/shared/components/Button.tsx). Interface: `ButtonProps` (`isLoading`, `variant`, `disabled`).
- **`Card`**: [shared/components/Card.tsx](file:///C:/SkiesPro/frontend/src/shared/components/Card.tsx). Interface: `CardProps`.
- **`Modal`**: [shared/components/Modal.tsx](file:///C:/SkiesPro/frontend/src/shared/components/Modal.tsx). Interface: `{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }`.
- **`Toast`**: [shared/components/Toast.tsx](file:///C:/SkiesPro/frontend/src/shared/components/Toast.tsx). Standalone.

---

### 3. Mode-Awareness Check
- The Settings page is an account-level global settings page (`real` vs `demo` mode-agnostic). No mode switching is required for profile or security settings.

---

### 4. Settings Feasibility Matrix

| Item | Verdict | Files Touched | New Endpoint? | Migration? | Test Surface | Risk |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **S1. Profile view/edit** | **S** | `SettingsPage.tsx` | No | No | Unit & Form tests | Low |
| **S2. Avatar upload** | **S** | `SettingsPage.tsx` | No (Already built in `supabaseStorage.ts`) | No | File upload tests | Low |
| **S3. Change password** | **M** | `user.routes.ts`, `UserController.ts`, `UserService.ts`, `UserRepository.ts`, `SettingsPage.tsx` | Yes (`PUT /api/v1/user/password`) | No | Auth & Password tests | Low-Med |
| **S4. MFA enable + verify** | **S** | `SettingsPage.tsx` | No (`POST /mfa/setup`, `/mfa/verify-setup` exist) | No | TOTP flow tests | Low |
| **S5. MFA disable** | **S** | `auth.routes.ts`, `authController.ts`, `authService.ts`, `mfaRepository.ts`, `SettingsPage.tsx` | Yes (`POST /api/v1/auth/mfa/disable`) | No | MFA disable tests | Low |
| **S6. MFA backup codes** | **S** | `SettingsPage.tsx` | No (Returned in `/mfa/verify-setup` response) | No | UI display tests | Low |
| **S7. Email change** | **XL** | Out of Wave 1 | Yes | No | Complex email verification flow | High (Skip for W1) |
| **S8. Password policy** | **S** | `frontend/src/shared/utils/validation/authSchemas.ts` | No | No | Mirror `auth.routes.ts:18` regex | Low |
| **S9. Session invalidation on pwd change** | **S** | `authService.ts` | No | No | Delete `app_auth.sessions` by `user_id` | Low |

---

### 5. Implementation Surface (Files)

#### Files to CREATE
- `frontend/src/pages/settings/SettingsPage.tsx` (replaces `<Placeholder title="User Settings" />`).
- `frontend/src/pages/settings/components/ProfileTab.tsx`
- `frontend/src/pages/settings/components/SecurityTab.tsx`
- `frontend/src/pages/settings/components/MfaModal.tsx`
- `tests/user/changePassword.test.ts`

#### Files to MODIFY
- `frontend/src/router/index.tsx` (import `SettingsPage` instead of `Placeholder`).
- `src/modules/user/user.routes.ts` (register `PUT /password`).
- `src/modules/user/controllers/UserController.ts` (add `changePassword`).
- `src/modules/user/services/UserService.ts` (add `changePassword`).
- `src/modules/auth/repositories/userRepository.ts` (add `updatePassword`).
- `src/modules/auth/auth.routes.ts` (register `POST /mfa/disable`).
- `src/modules/auth/controllers/authController.ts` (add `disableMfa`).
- `src/modules/auth/services/authService.ts` (add `disableMfa`).

#### FROZEN Files (DO NOT TOUCH)
- `src/modules/admin/*`
- `src/modules/trading/services/tradingService.ts`
- `src/modules/wallet/services/walletService.ts`
- `migrations/*`

---

### 6. Settings Open Questions & Recommendations

1. **Question**: Should email change be supported in Wave 1?
   - **Recommendation**: **NO**. Email change requires double-opt-in email verification and token invalidation. Keep email read-only in Wave 1 to minimize risk.
2. **Question**: Where should `PUT /api/v1/user/password` live?
   - **Recommendation**: In `user.routes.ts` under authenticated user profile management.
3. **Question**: How should backup codes be shown during MFA setup?
   - **Recommendation**: Display in a printable/copyable modal upon successful `POST /mfa/verify-setup`.

---

### 7. Settings Risk Register

| Risk | Prob | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| Password change without re-authenticating current password | Low | High | Enforce `bcrypt.compare` against `user.password_hash` in `UserService.changePassword` |
| Invalid file upload (>2MB or non-image) | Low | Low | Enforce Multer 2MB memory limit + frontend mime-type check |

---

# SECTION 2: HISTORY PAGE (`/history`) AUDIT

### 1. Contract Verification

#### Endpoints & Methods
- **`GET /api/v1/trading/contracts`** (Real Mode) / **`GET /api/v1/demo/trading/contracts`** (Demo Mode):
  - Middleware: `authenticateToken` (`authenticate`) ([trading.routes.ts:25](file:///C:/SkiesPro/src/modules/trading/trading.routes.ts#L25)).
  - Query Parameters:
    - `status?: string` (`'won' | 'lost' | 'draw' | 'cancelled' | 'active'`)
    - `asset_symbol?: string` (e.g. `'EUR/USD'`)
    - `limit?: number` (defaults to `20`)
    - `cursor?: string` (ISO timestamp cursor for `purchase_time < cursor`)
  - Response DTO (`{ status: "success", data: TradeResponse[] }`):
    ```typescript
    interface TradeResponse {
      id: string;
      user_id: string;
      asset_symbol: string;
      stake: string;
      contract_type: 'higher' | 'lower';
      strike_price: string;
      expiry_price?: string;
      payout_rate: string;
      potential_payout: string;
      purchase_time: string;
      expiry_time: string;
      status: 'active' | 'won' | 'lost' | 'draw' | 'cancelled';
    }
    ```
  - Error Codes: `401 Unauthorized`, `500 Internal Server Error`.

#### Audit Corrections to General Audit
- The general audit accurately identified that backend contract history endpoints are **BACKEND-READY** and that `<TradeHistory />` component is already implemented.

---

### 2. Frontend Reuse Verification

- **`<TradeHistory />`**: [frontend/src/modules/trading/components/TradeHistory.tsx](file:///C:/SkiesPro/frontend/src/modules/trading/components/TradeHistory.tsx). Props: `{ contracts: BinaryContract[]; isLoading?: boolean }`. Works standalone. Already renders strike price, expiry price, stake, payout, and outcome badge (`won`/`lost`/`draw`).
- **`useTrading`**: [frontend/src/modules/trading/hooks/useTrading.ts](file:///C:/SkiesPro/frontend/src/modules/trading/hooks/useTrading.ts). Exposes `tradeHistory`, `isLoadingHistory`, `getContracts()`. Is already subscribed to `useAccountMode()`.
- **`FilterTabs`**: [frontend/src/shared/components/FilterTabs.tsx](file:///C:/SkiesPro/frontend/src/shared/components/FilterTabs.tsx). Reusable tab bar for status filtering.
- **`TableLoading` & `TableEmpty`**: [frontend/src/shared/components/](file:///C:/SkiesPro/frontend/src/shared/components/). Reusable loading and empty state wrappers.

---

### 3. Mode-Awareness Check
- **`useTrading` is ALREADY MODE-AWARE**. It reads `accountMode` from `useAccountMode()`, calling `tradingService.getContracts(..., accountMode)` which automatically switches between `/api/v1/trading/contracts` (`real`) and `/api/v1/demo/trading/contracts` (`demo`).

---

### 4. History Feasibility Matrix

| Item | Verdict | Files Touched | New Endpoint? | Migration? | Test Surface | Risk |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **H1. Standalone render** | **S** | `HistoryPage.tsx` | No | No | Component render tests | Low |
| **H2. Cursor Pagination** | **S** | `HistoryPage.tsx` | No (Backend `contractRepository.ts:125` supports `cursor`) | No | Pagination tests | Low |
| **H3. Status & Asset Filters** | **S** | `HistoryPage.tsx` | No (Backend `contractRepository.ts:118` supports `status` & `asset_symbol`) | No | Filter tests | Low |
| **H4. Real vs Demo switch** | **S** | `HistoryPage.tsx` | No (Already built in `useTrading`) | No | Mode switch tests | Low |
| **H5. Outcome fields** | **S** | `TradeHistory.tsx` | No | No | Visual validation | Low |
| **H6. CSV export** | **S** | `frontend/src/shared/utils/csvExporter.ts`, `HistoryPage.tsx` | No (Frontend Blob download) | No | CSV format tests | Low |
| **H7. Loading & Empty states** | **S** | `HistoryPage.tsx` | No | No | State render tests | Low |
| **H8. Single contract detail** | **S** | `HistoryPage.tsx` | No (`GET /api/v1/trading/contracts/:id` exists) | No | Contract detail tests | Low |

---

### 5. Implementation Surface (Files)

#### Files to CREATE
- `frontend/src/pages/history/HistoryPage.tsx` (replaces `<Placeholder title="Trade History" />`).
- `frontend/src/shared/utils/csvExporter.ts` (CSV download helper).
- `frontend/src/tests/history/HistoryPage.test.tsx`

#### Files to MODIFY
- `frontend/src/router/index.tsx` (import `HistoryPage` instead of `Placeholder`).

#### FROZEN Files (DO NOT TOUCH)
- `src/modules/admin/*`
- `src/modules/trading/*` (backend controller/repository already complete)
- `migrations/*`

---

### 6. History Open Questions & Recommendations

1. **Question**: Should CSV export be client-side or server-side?
   - **Recommendation**: **Client-side**. Generating CSV in browser from fetched `tradeHistory` array using `Blob` is fast, zero-server-overhead, and requires no new backend endpoint.
2. **Question**: Should trade history auto-refresh upon new trade settlement?
   - **Recommendation**: **YES**. `useTrading` already listens to settlement WS events and re-fetches trade history automatically.

---

### 7. History Risk Register

| Risk | Prob | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| Large history dataset slowing page load | Low | Low | Backend uses `LIMIT 20` and cursor pagination (`purchase_time < cursor`) |

---

# CROSS-PAGE SECTION

- **Shared Dependencies**: `useAuth()` (for user session/profile), `useAccountMode()` (for account mode state), `safeFormatters.ts` (for number/currency formatting).
- No blocking shared dependencies or cross-module coupling.

---

# REPORT FOOTER

- **Read-Only Status**: Confirmed read-only inspection. No code, migrations, routes, tests, or config modified.
- **Admin Isolation**: Admin modules (`/admin/*`) and frozen backend engines were not modified or touched.
- **Daraja Isolation**: Safaricom Daraja B2C OTP configuration was not touched or blocked on.
- **Scope Restriction**: Other 4 trader pages were not touched or re-audited.
- **Git Status**: Clean working directory (expect only the report file untracked).
- Report saved at: `reports/TraderUI/02-wave1-settings-history-audit.md`.

Executed & Verified
