# WP-20 Read-Only Diagnosis: User Profile Drawer & TOTP Verification Regressions

## Status
Read-Only Diagnosis Complete

---

## Task 1 — User Profile Drawer Regression Analysis

### 1. `UserDetailDrawer.tsx` Property Mapping
```tsx
const displayName =
  user?.display_name || (user as any)?.name || (user as any)?.full_name || user?.email || 'N/A';

const kesBalance =
  user?.wallet_balance_kes ?? (user as any)?.balance ?? (user as any)?.wallet?.balance ?? 0;

const winRateRaw =
  user?.win_rate_pct ?? (user as any)?.win_rate ?? (user as any)?.stats?.win_rate_pct;

const winRateStr =
  winRateRaw !== undefined && winRateRaw !== null ? `${Number(winRateRaw).toFixed(1)}%` : 'N/A';

const totalTrades =
  user?.total_trades ?? (user as any)?.stats?.total_trades ?? (user as any)?.trades_count ?? 0;

const recentTrades = user?.recent_trades || (user as any)?.trades || [];
```

### 2. Analysis of Blank / Hidden Drawer State
- **Root Cause 1 (Drawer Hidden During Load)**:
  In `useAdminUsers.ts`, calling `selectUser(id)` executes `setSelectedUser(null)` immediately before fetching details:
  ```ts
  const selectUser = useCallback(async (id: string) => {
    setSelectedUser(null);
    setIsDrawerLoading(true);
    // ...
  });
  ```
  In `UserManagementPage.tsx`, the drawer visibility is controlled by `isOpen={!!selectedUser}`.
  Because `selectedUser` is set to `null` while fetching, `isOpen` evaluates to `false`. The drawer is hidden during the API request, so the loading spinner inside `UserDetailDrawer` is never rendered.

- **Root Cause 2 (Fallback Display)**:
  If a user has 0 executed trades or `win_rate_pct = null` (as calculated by `AdminRepository.getUserById`), `totalTrades` evaluates to `0`, `winRateStr` evaluates to `'N/A'`, and `recentTrades` evaluates to `[]` (`"No recent trade history."`).

---

## Task 2 — TOTP Step-Up & Asset Config Modal Analysis

### 1. Submit Handler in `MfaStepUpModal.tsx`
```ts
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (code.length < 6) {
    setError('Please enter a 6-digit authenticator code.');
    return;
  }

  setIsSubmitting(true);
  setError(null);
  try {
    await onConfirm(code);
    setCode('');
    if (closeOnSuccess) onClose();
  } catch (err) {
    const error = err as Error & { status?: number; code?: string };
    const reason = error.status
      ? `Step-Up verification returned ${error.status}: ${error.message}`
      : error.message || 'Invalid MFA code. Please try again.';
    setError(reason);
  } finally {
    setIsSubmitting(false);
  }
};
```

### 2. Analysis:
- `setIsSubmitting(false)` is correctly placed inside `finally`. The button does not spin forever due to a missing `finally` block.
- Instead, `onConfirm(code)` in `AssetConfigModal` passes the raw 6-digit TOTP string (e.g. `'123456'`) into `payload.totp_code`, which `adminApiClient.updateAssetConfig` sets as header `X-Admin-MFA-Token`.
- On the backend, `requireAdminMFA` middleware parses `req.header('X-Admin-MFA-Token')` using `TokenService.validateAdminMfaToken(token)`.
- Because `'123456'` is a raw 6-digit code and not a signed JWT step-up token, `validateAdminMfaToken` returns `null`.
- The backend rejects the request with `403 Forbidden`: `code: "MFA_STEP_UP_REQUIRED"`.

---

## Task 3 — Network Trace Simulation & Step-Up Architecture

### 1. Step-Up Endpoint Architecture (`POST /api/v1/auth/admin-mfa/step-up`)
- **Endpoint**: `POST /api/v1/auth/admin-mfa/step-up`
- **Request Body**: `{ totp_code: string }`
- **Behavior**: Verifies the 6-digit TOTP code against `app_auth.mfa_tokens` for the authenticated administrator. If valid, generates and returns a signed 5-minute step-up JWT token:
  ```json
  {
    "data": {
      "admin_mfa_token": "eyJhbGciOi...",
      "expires_in": 300
    }
  }
  ```

### 2. Payload Mismatch
- `AssetConfigModal.tsx` bypasses `POST /api/v1/auth/admin-mfa/step-up` and attempts to send the raw 6-digit TOTP directly to `PUT /api/v1/admin/risk/asset-config/${encodedSymbol}`.
- `requireAdminMFA` on the protected write route expects a signed JWT token in header `X-Admin-MFA-Token`, causing `403 Forbidden`.

---

## Summary of Findings

1. **User Profile Drawer Visibility**: `useAdminUsers.ts` resets `selectedUser` to `null` before API request completion, causing `isOpen={!!selectedUser}` to evaluate to `false` and preventing the drawer (and its loading state) from displaying.
2. **MFA Step-Up Bypass**: `AssetConfigModal.tsx` passes raw 6-digit TOTP codes directly into `X-Admin-MFA-Token` headers instead of exchanging the code for a signed JWT step-up token via `POST /api/v1/auth/admin-mfa/step-up`.
3. **Backend Middleware Rejection**: `requireAdminMFA` on `/api/v1/admin/risk/asset-config/:symbol` rejects raw 6-digit codes with `403 Forbidden` (`MFA_STEP_UP_REQUIRED`), causing submission failures.
