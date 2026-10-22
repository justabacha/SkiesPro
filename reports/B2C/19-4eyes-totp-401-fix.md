# 4-Eyes Reject TOTP 401 → 400 Semantic Correction Report

## Status
Executed & Verified

---

## Pre-Check Findings (P1 - P5)

### P1: Frontend API Client Interceptor (`ApiClient.request` in `apiClient.ts`)
- The response interceptor checks `response.status === 401`.
- If true and the path is not part of `/auth/login`, `/auth/refresh`, or `/auth/admin-mfa/step-up`, it unconditionally invokes `this.onUnauthorizedCallback()`, wiping the session state and redirecting the user to the login screen.
- **Finding**: Any endpoint returning `401 Unauthorized` triggers global logout. A wrong TOTP code is a request validation error (client input mistake), not an expired/invalid user session. Therefore, returning `401` for invalid TOTP caused the logout bug.

### P2: `AdminController.rejectAction` Catch Block & Status Codes
- Previously caught TOTP/MFA service errors and returned `401 Unauthorized`.
- **Correction**: Updated to return `400 Bad Request` with structured error code `code: 'INVALID_TOTP'` (and `VALIDATION_ERROR` for missing reasons, `CONFLICT` for already resolved actions, and `INTERNAL_ERROR` for 500s).

### P3: `AdminController.approveAction` Error Handling
- Relies on service/middleware error handling, returning appropriate validation and authorization statuses (e.g. 403 for step-up enforcement) without triggering session logout.

### P4: `AdminWalletService.rejectAction` TOTP Validation
- Validates 6-digit TOTP codes and step-up tokens, throwing descriptive errors when validation fails. Left unchanged as requested.

### P5: Codebase Audit for 401 Misuse (`rg "status\(401\)" src/`)
- Audit results for endpoints returning `401`:
  - `src/modules/admin/controllers/AdminController.ts:317` (`PUT /actions/:id/reject`): Previously returned 401 for missing/invalid TOTP → **Corrected to 400 (`INVALID_TOTP`)**.
  - `src/modules/admin/controllers/AdminController.ts:330` (`PUT /actions/:id/reject`): Previously returned 401 for invalid TOTP message → **Corrected to 400 (`INVALID_TOTP`)**.
  - `src/modules/admin/middleware/adminAuthMiddleware.ts`: Returns 401 for unauthenticated requests (Correct session failure handling).
  - `src/modules/auth/controllers/authController.ts`: Returns 401 for login/refresh failures (Correct session failure handling).
  - `src/shared/middleware/authMiddleware.ts`: Returns 401 for invalid/expired JWT tokens (Correct session failure handling).

---

## Full Controller Catch Block (`AdminController.rejectAction`)

### Before
```typescript
    } catch (error: any) {
      if (
        error.message.includes('Invalid') ||
        error.message.includes('TOTP') ||
        error.message.includes('MFA') ||
        error.message.includes('code')
      ) {
        res.status(401).json({ error: error.message });
        return;
      }
      if (error.message.includes('not found') || error.message.includes('Cannot reject')) {
        res.status(409).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
```

### After
```typescript
    } catch (error: any) {
      const msg = error.message || '';

      if (
        msg.includes('Invalid or missing TOTP') ||
        msg.includes('Invalid TOTP') ||
        msg.includes('Invalid MFA') ||
        msg.includes('TOTP code is required')
      ) {
        res.status(400).json({ error: msg, code: 'INVALID_TOTP' });
        return;
      }

      if (msg.includes('reason is required')) {
        res.status(400).json({ error: msg, code: 'VALIDATION_ERROR' });
        return;
      }

      if (msg.includes('not found') || msg.includes('Cannot reject')) {
        res.status(409).json({ error: msg, code: 'CONFLICT' });
        return;
      }

      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
```

---

## Frontend Error Handling Diff (`FourEyesActionCard.tsx`)

```diff
    } catch (err: any) {
-     setRejectError(err.message || 'Failed to reject action.');
+     const code = err.code || err.response?.data?.code;
+     const errorMsg = err.message || err.response?.data?.error;
+     if (code === 'INVALID_TOTP') {
+       setRejectError('Invalid TOTP code. Please check your authenticator and try again.');
+     } else if (errorMsg) {
+       setRejectError(errorMsg);
+     } else {
+       setRejectError('Failed to reject action.');
+     }
    }
```

---

## Test Results

### `tests/admin/fourEyesReject.test.ts`
- **Bad TOTP returns 400 (`INVALID_TOTP`)**: PASS
- **Missing TOTP returns 400 (`INVALID_TOTP`)**: PASS
- **Session remains valid after bad TOTP submission**: PASS (subsequent `GET /api/v1/auth/me` returns 200)
- **Genuine session error with invalid/expired JWT returns 401**: PASS

### Full Test Suite Runs (2x Consecutive)
- **Run 1**: 55 test suites passed, 378/378 tests passed.
- **Run 2**: 55 test suites passed, 378/378 tests passed.

---

## Typecheck Results
- **Backend Typecheck (`npm run typecheck`)**: 0 errors.
- **Frontend Typecheck (`cd frontend && npx tsc --noEmit`)**: 0 errors.

---

## Git Diff Stat
```
 frontend/src/components/admin/FourEyesActionCard.tsx    | 11 +++--
 reports/B2C/MANUAL_TASKS.md                        |  8 ++++
 src/modules/admin/controllers/AdminController.ts   | 20 ++++++++-
 tests/admin/fourEyesReject.test.ts                 | 49 +++++++++++++---------
 4 files changed, 62 insertions(+), 26 deletions(-)
```

---

## MANUAL_TASKS.md Excerpt (Tech Debt Audit Entry)

```markdown
## Tech Debt: 401 Misuse Audit
Endpoints returning 401 for non-session errors should be changed to 400 (validation) or 403 (authorization). Audit findings:
- [`src/modules/admin/controllers/AdminController.ts:317`](file:///C:/SkiesPro/src/modules/admin/controllers/AdminController.ts#L317) — `PUT /actions/:id/reject` — previously returned 401 for missing/invalid TOTP — corrected to 400 (`INVALID_TOTP`).
- [`src/modules/admin/controllers/AdminController.ts:330`](file:///C:/SkiesPro/src/modules/admin/controllers/AdminController.ts#L330) — `PUT /actions/:id/reject` — previously returned 401 for invalid TOTP error message — corrected to 400 (`INVALID_TOTP`).
```
