# Wave 1 — Settings Frontend

## Pre-execution verification

- `frontend/src/shared/hooks/useAuth.ts` forwards the auth context; `frontend/src/shared/context/AuthContext.tsx` defines `User` with `mfaEnabled` (camel case) but **does not include `phone`**. It does not include the backend snake-case `mfa_enabled` field either. The Settings UI therefore reads the authoritative `mfa_enabled`, `phone`, and profile data from `GET /api/v1/users/profile`; it does not assume the auth context type contains them.
- The shared client is `frontend/src/shared/services/apiClient.ts`. It applies the configured API base URL, adds the current access token's Authorization header, and sends requests with `credentials: 'include'`. It sets JSON Content-Type by default; multipart requests need to leave Content-Type unset so the browser can add the boundary. The avatar flow uses this client with `FormData` support.
- Slice 1 confirms route mounting in `src/infrastructure/routes.ts`: `/api/v1/users` mounts user routes and `/api/v1/auth` mounts auth routes. The exact paths are `/api/v1/users/profile`, `/api/v1/users/profile/avatar`, `/api/v1/users/password`, `/api/v1/users/email-change/initiate`, `/api/v1/users/email-change/verify`, `/api/v1/users/sessions`, `/api/v1/users/sessions/:id`, `/api/v1/users/deactivate`, `/api/v1/auth/mfa/setup`, `/api/v1/auth/mfa/verify-setup`, `/api/v1/auth/mfa/disable`, and `/api/v1/auth/mfa/backup-codes/regenerate`.
- API shape verification: avatar expects multipart field `image`; profile fields are `display_name` and `phone`; password expects `current_password` and `new_password`; email initiation expects `new_email` and `password`, while verification expects `token`; MFA setup returns `secret` and `qr_code_url`, verification takes `totp_code`, and disable/backup regeneration take `code` or `password`. Session responses include `id`, `user_agent`, `ip_address`, `last_seen_at`, and `is_current`.
- **Email token contract discrepancy:** the implementation brief calls for a six-digit email code, but Slice 1's `verifyEmailChange` route accepts a `token`, and the initiate endpoint returns a verification JWT as `data.token`. The UI accepts and submits the backend's verification token (rather than inventing a six-digit token the API cannot verify).

## Implementation

- Added `frontend/src/pages/settings/SettingsPage.tsx` with a profile-backed Settings shell and `FilterTabs` pills for Profile, Security, Sessions, and Danger Zone.
- Added `frontend/src/pages/settings/components/ProfileTab.tsx`: editable display name/phone, read-only email, profile save, and JPEG/PNG avatar upload using multipart `image`.
- Added `frontend/src/pages/settings/components/SecurityTab.tsx`: backend-parity password validation with live strength criteria; MFA setup/verification, disable and backup-code flows; and double-opt-in email change using the API's verification token.
- Added `frontend/src/pages/settings/components/SessionsTab.tsx`: fetches active sessions, displays device/IP/last seen/current status, and revokes non-current sessions.
- Added `frontend/src/pages/settings/components/DangerZone.tsx`: password-confirmed account deactivation followed by logout and redirect to `/login`.
- Added `frontend/src/pages/settings/types.ts` for the profile DTO and API envelope.
- Replaced the `/settings` route placeholder with `SettingsPage` in `frontend/src/router/index.tsx`.
- Updated `frontend/src/shared/services/apiClient.ts` so `FormData` passes through `post()` unchanged and requests leave `Content-Type` unset for the browser-generated multipart boundary. This shared-client change is required for the requested avatar endpoint and preserves existing auth/cookie handling.
- Updated only the `pills-themed` branch of `frontend/src/shared/components/FilterTabs.tsx` to use semantic theme tokens. This shared-component adjustment is required for the Settings tab bar to meet light/dark theme safety; other variants were not changed.
- Expanded `frontend/vitest.config.ts` to include both the existing history tests and Settings tests, without sweeping in unrelated admin test files that are not Vitest suites.
- Added `frontend/src/tests/settings/SettingsPage.test.tsx` covering all tabs, strict password validation and submission, profile save, MFA disable, and revocation of a non-current session.
- Email contract deviation: the Slice 1 API verifies a JWT `token`, not a six-digit code; the UI accepts the verification token and explicitly informs the user of that contract.

## Verification

- Focused Settings UI tests: **5/5 passed**.
- Frontend UI suite (`npm run test:ui`): **14/14 passed in both consecutive runs** (Settings: 5; History: 9).
- Frontend typecheck (`npm run typecheck`): **passed**.
- Frontend lint on changed frontend files: **passed**. The repository-wide frontend lint command reports pre-existing warnings in untouched admin/trading files and exits nonzero; no lint errors were reported for the changed files.
- Theme scan of `frontend/src/pages/settings`: **no hardcoded `slate-*`, `gray-*`, `zinc-*`, or hex colors found**.
- Root Jest suite (`npm test -- --runInBand --forceExit`): **Run 1 passed, 62/62 suites and 405/405 tests (452.474 s); Run 2 passed, 62/62 suites and 405/405 tests (435.201 s)**. `TEST_DATABASE_URL` is declared in the local `.env`; its value is intentionally not included in this report.

## Scope confirmation

- No backend files, migrations, or `frontend/src/modules/admin/*` files were changed for this frontend slice.
- Existing backend Slice 1 changes were already present in the worktree and were preserved.
- Trade, Wallet, History, Dashboard, KYC, Referrals, Support, and the other trader pages were not modified. The existing History test suite was included in the UI test run but its source files were not changed.
- `git status --short` after validation:
  ```text
   M frontend/src/router/index.tsx
   M frontend/src/shared/components/FilterTabs.tsx
   M frontend/src/shared/services/apiClient.ts
   M frontend/vitest.config.ts
   M src/modules/auth/auth.routes.ts
   M src/modules/auth/controllers/authController.ts
   M src/modules/auth/repositories/mfaRepository.ts
   M src/modules/auth/repositories/userRepository.ts
   M src/modules/auth/services/authService.ts
   M src/modules/user/controllers/UserController.ts
   M src/modules/user/dto/ProfileResponseDto.ts
   M src/modules/user/services/UserService.ts
   M src/modules/user/user.routes.ts
   M src/shared/middleware/authMiddleware.ts
  ?? frontend/src/pages/settings/
  ?? frontend/src/tests/settings/
  ?? migrations/042_add_settings_columns.sql
  ?? reports/TraderUI/07-wave1-settings-backend.md
  ?? reports/TraderUI/08-wave1-settings-frontend.md
  ?? tests/user/settings.test.ts
  ```
- The backend, migration, and settings integration-test entries above are pre-existing Slice 1 work from the handoff; this Settings frontend slice did not modify backend or admin files.
- `git diff --check` passed. The requested implementation is complete; the earlier full-repository frontend lint reports unrelated warnings in existing admin/trading files, while ESLint on the changed frontend files passed.

---

## Follow-up: Fixes

### T1 — MFA Setup 400 Error Fix (`SecurityTab.tsx`)
Updated `startMfaSetup` in `frontend/src/pages/settings/components/SecurityTab.tsx` to pass `{ label: profile.email || 'user@example.com' }` to `POST /api/v1/auth/mfa/setup`, matching the backend requirements for generating the TOTP label/URI.

### T2 — URL Deep-Linking for Tabs (`SettingsPage.tsx`)
Updated `frontend/src/pages/settings/SettingsPage.tsx` using `useSearchParams` from `react-router-dom`. The active tab is read from query param `?tab=` (defaulting to `'profile'`). Tab changes trigger `setSearchParams({ tab: newTab })`.

### T3 — Navbar Profile Dropdown Link (`Navbar.tsx`)
Updated the "Profile" option in `frontend/src/shared/components/layout/Navbar.tsx` to `<Link to="/settings?tab=profile" ...>`, navigating directly to the Profile tab on click.

### T4 — Header Avatar & Refresh Integration (`AuthContext.tsx`, `Navbar.tsx`, `ProfileTab.tsx`)
1. **`AuthContext.tsx`**: Updated `User` interface to include `avatarUrl?: string | null` and added `updateUser: (updates: Partial<User>) => void` to `AuthContextType`.
2. **`Navbar.tsx`**: Renders `user.avatarUrl` in an `<img>` tag inside the top avatar button, falling back to initial when null.
3. **`ProfileTab.tsx`**: Triggers `updateUser({ avatarUrl: response.data.avatar_url })` immediately upon successful upload so the Navbar avatar updates instantly without a page reload.

### T5 — Verification & Test Results
- **Frontend Unit/UI Tests**: Added test case in `SettingsPage.test.tsx` verifying `{ label: 'trader@example.com' }` is passed to MFA setup. Executed 2x consecutive test runs (`cd frontend && npm run test:ui`):
  - Run 1: **15/15 passed** (Settings: 6, History: 9)
  - Run 2: **15/15 passed** (Settings: 6, History: 9)
- **Typechecks**:
  - Frontend typecheck (`cd frontend && npx tsc --noEmit`): **0 errors**
  - Backend typecheck (`npm run typecheck`): **0 errors**
- **Zero Backend / Admin Files Touched**: Verified via `git status` that zero backend (`src/`) or admin (`frontend/src/modules/admin/*`) files were modified.
