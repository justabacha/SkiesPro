# Read-Only Diagnosis Report: 4-Eyes Reject TOTP Logout Bug

## Status
Read-Only Diagnosis Complete

---

## 1. Frontend Interceptor Code (`frontend/src/shared/services/apiClient.ts`)

```typescript
// Special handling for 401 Unauthorized
const isAdminStepUpRequest = normalizedPath === '/api/v1/auth/admin-mfa/step-up';
const isRefreshRequest = normalizedPath === '/api/v1/auth/refresh';
const isLoginRequest = normalizedPath === '/api/v1/auth/login';

if (
  response.status === 401 &&
  this.onUnauthorizedCallback &&
  !isAdminStepUpRequest &&
  !isRefreshRequest &&
  !isLoginRequest
) {
  this.onUnauthorizedCallback();
}
```

### Analysis:
- The global `ApiClient` response interceptor checks if `response.status === 401`. If true, it unconditionally invokes `this.onUnauthorizedCallback()`, which clears credentials and logs the user out (redirecting to `/login`).
- It only exempts `/auth/login`, `/auth/refresh`, and `/auth/admin-mfa/step-up`. Any other endpoint returning `401` triggers an unconditioned session termination.

---

## 2. Backend Middleware Code (`src/modules/admin/middleware/adminAuthMiddleware.ts`)

```typescript
export const requireAdminMfa = (req: Request, res: Response, next: NextFunction): void => {
  const user = (req as AdminAuthenticatedRequest).user;
  ...
  if (!hasValidAdminMfaToken(req, user)) {
    res.status(403).json({
      error: 'A valid, unexpired administrator MFA step-up token is required',
      code: 'MFA_STEP_UP_REQUIRED',
    });
    return;
  }
  next();
};
```

### Analysis:
- `requireAdminMfa` returns **403 Forbidden** (`MFA_STEP_UP_REQUIRED`) when a step-up token is missing or expired.
- For the `/actions/:id/reject` route, `requireAdminMFA` was removed from the route definition so that explicit TOTP code validation could be performed directly in `AdminWalletService.rejectAction`.

---

## 3. Controller vs. Service Logic Comparison

### `AdminController.rejectAction` & `AdminWalletService.rejectAction`
When an invalid TOTP code is submitted during rejection:
1. `AdminWalletService.rejectAction` evaluates `totpCode` against the admin's encrypted secret or step-up token. If invalid, it throws an error (`'Invalid or missing TOTP code'`).
2. `AdminController.rejectAction` catches this error and responds with **`401 Unauthorized`**:
   ```typescript
   if (
     error.message.includes('Invalid') ||
     error.message.includes('TOTP') ||
     error.message.includes('MFA') ||
     error.message.includes('code')
   ) {
     res.status(401).json({ error: error.message });
     return;
   }
   ```

### Comparison with Approve:
- `approveAction` relies on `requireAdminMFA` (returning `403 Forbidden` if step-up token is missing/invalid) or was not performing direct inline TOTP secret verification in the same manner as reject. When reject returns `401`, the global frontend API client interceptor intercepts it and logs the admin out.

---

## 4. Frontend Reject Handler (`FourEyesActionCard.tsx`)

```typescript
  const handleConfirmRejection = async (e: React.FormEvent) => {
    e.preventDefault();
    ...
    try {
      ...
      await adminApiClient.rejectAction(action.id, {
        reason: rejectionReason.trim(),
        totp_code: totpCode,
      });
      ...
    } catch (err: any) {
      setRejectError(err.message || 'Failed to reject action.');
    } finally {
      setIsSubmitting(false);
    }
  };
```

### Analysis:
- The component correctly wraps the API call in a `try/catch` block and sets `rejectError`.
- However, before the catch block can handle the error, the global `ApiClient` response interceptor intercepts the `401 Unauthorized` response, triggers `onUnauthorizedCallback()`, and terminates the user session/logs the admin out.

---

## 5. Root Cause Hypothesis
When an admin enters an invalid TOTP code during the 4-eyes rejection flow, `AdminController.rejectAction` correctly rejects the request with HTTP status **401 Unauthorized**. However, the frontend's global `ApiClient` response interceptor intercepts **any** 401 response (unless whitelisted for login/refresh/step-up) and blindly triggers global logout/session destruction (`onUnauthorizedCallback`). This causes the admin to be kicked back to the login screen instead of displaying the error message inside the modal.

---

## 6. Recommended Fix Approach
1. **Option A (API Client Interceptor Update)**: Update `ApiClient.request` in `frontend/src/shared/services/apiClient.ts` to check whether a 401 error is an action-level rejection error (or check if `normalizedPath` contains `/actions/`), OR allow 401s to propagate to callers without triggering global logout if they are part of guarded operational modals (e.g., passing an exemption header or checking error codes like `INVALID_TOTP`).
2. **Option B (Status Code Adjustment)**: Change `AdminController.rejectAction` to return `400 Bad Request` or `422 Unprocessable Entity` for invalid TOTP codes instead of `401 Unauthorized`. This prevents the global 401 interceptor from triggering while still allowing the frontend modal to catch the error and display the validation message.
