# MFA Setup Cycle Audit

## 1. End-to-End Data Flow

1. **Frontend Call** (`frontend/src/pages/settings/components/SecurityTab.tsx`):
   ```ts
   const response = await apiClient.post<ApiEnvelope<MfaSetup>>('/api/v1/auth/mfa/setup', {
     label: mfaLabel,
   });
   ```
   The React frontend sends a JSON payload `{ label: "user@example.com" }` to `POST /api/v1/auth/mfa/setup`.

2. **Middleware Context** (`src/shared/middleware/authMiddleware.ts`):
   The `authenticate` middleware validates the Bearer access token. `TokenService.generateAccessToken` signs JWTs containing `{ sub, role, permissions, jti, mfa_verified }`, but **omits `email`**.
   Therefore, `(req as AuthenticatedRequest).user.email` is always `undefined`.

3. **Controller Extraction** (`src/modules/auth/controllers/authController.ts`):
   ```ts
   async setupMfa(req: Request, res: Response): Promise<void> {
     const authReq = req as AuthenticatedRequest;
     try {
       const result = await this.authService.setupMfa(authReq.user.sub, authReq.user.email || '');
       res.status(200).json({ data: result });
     } catch (error) {
       res.status(400).json({ error: (error as Error).message });
     }
   }
   ```
   `authController.setupMfa` ignores `req.body.label` and `req.body.email`. It passes `authReq.user.email || ''` (which evaluates to `""`) as the `email` argument to `authService.setupMfa`.

4. **Service & Library Call** (`src/modules/auth/services/mfaService.ts`):
   ```ts
   async generateMfaSetup(email: string, _userId: string) {
     const secret = this.totp.generateSecret();
     const otpauth = this.totp.toURI({
       label: email, // Evaluates to ""
       issuer: 'SkiesPro',
       secret,
     });
   ```
   `mfaService` calls `otplib`'s `this.totp.toURI({ label: "", ... })`. `otplib` throws:
   `Error: Label is required for URI generation. Example: { label: 'user@example.com' }`

5. **HTTP Response**:
   `authController.setupMfa` catches the thrown error and returns `HTTP 400 { "error": "Label is required for URI generation. Example: { label: 'user@example.com' }" }`.

---

## 2. The Exact Failure Point (File:Line)

- **Root Cause File 1**: `src/modules/auth/controllers/authController.ts` Line 183
  ```ts
  const result = await this.authService.setupMfa(authReq.user.sub, authReq.user.email || '');
  ```
  *Issue*: Relies on `authReq.user.email` (which is omitted from access token JWT claims) and ignores `req.body.label` / `req.body.email`.

- **Root Cause File 2**: `src/modules/auth/services/mfaService.ts` Line 19
  ```ts
  const otpauth = this.totp.toURI({ label: email, issuer: 'SkiesPro', secret });
  ```
  *Issue*: `otplib` enforces that `label` must be a non-empty string.

---

## 3. Payload Mismatch Analysis

| Layer | Value Passed | Result |
| :--- | :--- | :--- |
| **Frontend Request** | `{ label: "user@example.com" }` | Transmitted in `req.body.label` |
| **JWT Access Token Claims** | `{ sub, role, permissions, jti, mfa_verified }` | `email` is absent |
| **`req.user.email`** | `undefined` | Evaluates to `undefined` |
| **`authController.setupMfa`** | `authReq.user.email \|\| ''` | Passes `""` to service |
| **`otplib.totp.toURI`** | `{ label: "" }` | Throws `Label is required for URI generation` |

---

## 4. Recommended Fix (Advisory)

Update `AuthController.setupMfa` in `src/modules/auth/controllers/authController.ts` to read `req.body.label` or `req.body.email` from the request body, or fetch the user record via `this.authService` / `userRepo.findById(authReq.user.sub)` to retrieve `user.email`:

```ts
async setupMfa(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  try {
    const label = req.body.label || req.body.email || authReq.user.email;
    const result = await this.authService.setupMfa(authReq.user.sub, label);
    res.status(200).json({ data: result });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
}
```

---

## 5. Constraints Honored (Confirmed Read-Only)

- Read-Only constraint strictly honored: Zero code files modified.
- Audit report saved to `reports/TraderUI/09-mfa-setup-audit.md`.

---

## Follow-up: Fixes

### T1 — `authController.setupMfa` Fix
Updated `setupMfa` in `src/modules/auth/controllers/authController.ts` to extract `label` from `req.body.label || req.body.email || authReq.user.email || 'SkiesPro Trader'`:

```ts
  async setupMfa(req: Request, res: Response): Promise<void> {
    const authReq = req as AuthenticatedRequest;
    try {
      const label = req.body.label || req.body.email || authReq.user.email || 'SkiesPro Trader';
      const result = await this.authService.setupMfa(authReq.user.sub, label);
      res.status(200).json({ data: result });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }
```

### T2 — Session Revocation Route Verification
Confirmed `DELETE /api/v1/users/sessions/:id` route in `UserService.ts` and `UserController.ts`:
1. `UserService.revokeSession` checks `if (currentJti && session.access_token_jti === currentJti)` and throws `Error('Cannot revoke current session. Use logout instead.')`.
2. `UserController.revokeSession` catches errors and returns HTTP 200 `{ data: { message: 'Session revoked successfully' } }` upon revoking non-current sessions.

### T3 — Test Suite & Typecheck Verification
- **Backend Typecheck**: Executed `npm run typecheck` — **0 errors**.
- **Consecutive Full Backend Suite Runs** (`npm test`):
  - **Run 1**: `62 passed, 62 total` test suites; `405 passed, 405 total` tests (361.355 s).
  - **Run 2**: `62 passed, 62 total` test suites; `405 passed, 405 total` tests (399.057 s).

---

## Scope Confirmations
- Zero frontend files modified (`frontend/*` untouched).
- Zero admin files or other trading modules touched.
