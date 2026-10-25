# Domain Migration Impact Audit Report

## Executive Summary

The platform frontend has migrated from `skies-pro.vercel.app` to custom domains `skiespro.co.ke` and `www.skiespro.co.ke`. The backend API remains hosted on Render (`skiespro-api-njuw.onrender.com`).

Overall, the migration is **functioning correctly for core API requests**, but our audit identified **3 key areas requiring configuration and code alignment**:
1. **Hardcoded Fallback CORS Origins in Backend Code**: Fallback origins in `src/config/app.ts`, `src/index.ts`, and `src/shared/middleware/rateLimit.ts` contain `https://skies-pro.vercel.app`. If Render's `CORS_ORIGIN` environment variable is ever unset, CORS will revert to the old Vercel URL and block requests from `skiespro.co.ke`.
2. **Missing `FRONTEND_URL` for Future Email Deep Links**: Email verification and password reset workers currently run mock loggers. When real SMTP email sending is activated, backend code must read `process.env.FRONTEND_URL` configured as `https://skiespro.co.ke` so password reset links hit `https://skiespro.co.ke/reset-password?token=...`.
3. **Cross-Site Refresh Token Cookie Limitations**: Refresh tokens are set via `res.cookie` with `sameSite: 'none'` and `secure: true` without a `domain` attribute. Because frontend (`skiespro.co.ke`) and backend (`skiespro-api-njuw.onrender.com`) use different top-level domains, third-party cookie blocking in Safari/Chrome will affect cookie-based refresh, requiring the existing header-based / request body token refresh mechanism as primary.

---

## 1. Frontend Findings

- **Environment Configuration**: `frontend/.env.example` configures `VITE_API_BASE_URL=https://skiespro-api-njuw.onrender.com/api/v1`.
- **`vercel.app` Search Results**: **0 instances found in `frontend/src`**.
  - All internal links in navigation (`Sidebar.tsx`, `Navbar.tsx`, `MobileNav.tsx`) use relative route paths (`/trading`, `/wallet`, `/login`).
  - No hardcoded `vercel.app` URLs exist in frontend components, footers, or share buttons.
- **WebSocket URL**: `WebSocketClient.ts` reads `import.meta.env.VITE_WS_URL` which points to `wss://skiespro-api-njuw.onrender.com/ws/v1`.

---

## 2. Backend & Email Findings

- **Email Deep Link Base URL**:
  - In `src/modules/auth/controllers/authController.ts`, `forgotPassword`, `resetPassword`, and `verifyEmail` currently return static success JSON responses.
  - `EmailVerificationWorker.ts` and `PasswordResetWorker.ts` log tokens to console.
  - **Required Configuration**: Render environment variable `FRONTEND_URL` must be set to `https://skiespro.co.ke` (or `https://www.skiespro.co.ke`).
  - When real email templates are wired, deep links must be constructed as `${process.env.FRONTEND_URL}/verify-email?token=${token}` and `${process.env.FRONTEND_URL}/reset-password?token=${token}`.

---

## 3. Cookie & Auth Findings

- **`res.cookie()` Implementation** in [authController.ts](file:///C:/SkiesPro/src/modules/auth/controllers/authController.ts#L63):
  ```typescript
  res.cookie('refresh_token', authResult.refresh_token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  ```
- **Attributes**: `httpOnly: true`, `secure: true`, `sameSite: 'none'`, `path: '/'`. The `domain` attribute is omitted.
- **Cross-Domain Impact**: Omitted `domain` defaults to `skiespro-api-njuw.onrender.com`. Because modern browsers partition cross-site third-party cookies across different TLDs (`.co.ke` vs `.onrender.com`), cookie-based token refresh may be blocked in Safari/Incognito.
- **Mitigation**: The API client passes `Authorization: Bearer <access_token>` in HTTP headers for API calls, and `/auth/refresh` accepts `refresh_token` in request body as a resilient fallback.

---

## 4. WebSocket Findings

- **Frontend Connection**: `websocketService.ts` connects via `import.meta.env.VITE_WS_URL` (`wss://skiespro-api-njuw.onrender.com/ws/v1`).
- **Backend Origin Validation**: `PriceGateway` ([priceGateway.ts](file:///C:/SkiesPro/src/modules/pricing/websocket/priceGateway.ts)) validates JWT authentication on handshake (`?token=...`) and does not enforce origin domain restrictions. WebSocket connections from `https://skiespro.co.ke` connect and stream price ticks cleanly.

---

## 5. M-Pesa Webhook Confirmation

- **Callback URLs in Code and Environment**:
  - `MPESA_CALLBACK_URL`: `https://skiespro-api-njuw.onrender.com/api/v1/payments/deposit/callback?token=...`
  - `MPESA_B2C_RESULT_URL`: `https://skiespro-api-njuw.onrender.com/api/v1/payments/mpesa/b2c/result?token=...`
  - `MPESA_B2C_TIMEOUT_URL`: `https://skiespro-api-njuw.onrender.com/api/v1/payments/mpesa/b2c/timeout?token=...`
- **Confirmation**: All M-Pesa webhooks point directly to the Render backend (`skiespro-api-njuw.onrender.com`). They do **NOT** point to Vercel. M-Pesa STK deposits and B2C payout webhooks are **100% intact**.

---

## 6. Third-Party OAuth

- **Status**: Third-party social OAuth logins (Google, Facebook, Apple) are **not implemented** in the platform codebase. No redirect URI updates are required.

---

## 7. Impact Map & Recommended Fixes

| File / Environment Variable | Current Value / Pattern | Recommended Update |
| :--- | :--- | :--- |
| **Render `CORS_ORIGIN` Env Var** | `https://skies-pro.vercel.app` | `https://skiespro.co.ke,https://www.skiespro.co.ke,https://skies-pro.vercel.app,http://localhost:5173` |
| **Render `FRONTEND_URL` Env Var** | Unset or Vercel URL | `https://skiespro.co.ke` |
| `src/config/app.ts` | Default fallback includes `skies-pro.vercel.app` | Add `https://skiespro.co.ke,https://www.skiespro.co.ke` to default `CORS_ORIGIN` string |
| `src/index.ts` | Hardcoded `allowedOrigins` array contains `skies-pro.vercel.app` | Add `https://skiespro.co.ke` and `https://www.skiespro.co.ke` to fallback array |
| `src/shared/middleware/rateLimit.ts` | Hardcoded whitelist contains `skies-pro.vercel.app` | Add `https://skiespro.co.ke` and `https://www.skiespro.co.ke` to whitelist |

---

## Follow-up: Fallback Fixes Applied

### Files Updated
1. **`src/config/app.ts`**: Updated default `parseCorsOrigins()` string fallback to:
   `'http://localhost:5173,http://localhost:3000,https://skiespro.co.ke,https://www.skiespro.co.ke,https://skies-pro.vercel.app'`
2. **`src/index.ts`**: Updated fallback `allowedOrigins` array in `setCorsHeadersOnResponse` to:
   `['https://skiespro.co.ke', 'https://www.skiespro.co.ke', 'https://skies-pro.vercel.app', 'http://localhost:5173', 'http://localhost:3000', ...config.corsOrigin]`
3. **`src/shared/middleware/rateLimit.ts`**: Updated `allowedOrigins` whitelist array to:
   `['https://skiespro.co.ke', 'https://www.skiespro.co.ke', 'https://skies-pro.vercel.app', 'http://localhost:5173', 'http://localhost:3000']`
4. **`.env.example`**: Documented `FRONTEND_URL=https://skiespro.co.ke` and updated `CORS_ORIGIN=https://skiespro.co.ke,https://www.skiespro.co.ke,http://localhost:3000,http://localhost:5173`.

### Verification Results
- **TypeScript Typecheck (`npm run typecheck`)**: Exit code `0` (0 errors).
- **Test Suite Run 1 (`npm test`)**: **63/63 Test Suites Passed, 409/409 Tests Passed**.
- **Test Suite Run 2 (`npm test`)**: **63/63 Test Suites Passed, 409/409 Tests Passed**.

Executed & Verified
