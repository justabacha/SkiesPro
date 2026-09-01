# API Design Specification (ADS)
## Project: Independent Online Binary Trading Platform

---

## Revision History

| Date | Version | Description | Author |
| :--- | :--- | :--- | :--- |
| 2026-07-22 | 1.0.0 | Initial API Design Specification. Derived from BRD v1.0, SRS v1.0, Domain Model v1.0, Software Architecture v1.1, Architecture Review v1.0, and Database Design Specification v1.0. | Lead Software Architect / Antigravity |

---

## Cross-References

| Document | Location |
| :--- | :--- |
| Business Requirements Document | [docs/01_BUSINESS_REQUIREMENTS.md](file:///c:/Users/user/Downloads/bullion-terminal_3/docs/01_BUSINESS_REQUIREMENTS.md) |
| System Requirements Specification | [docs/02_SYSTEM_REQUIREMENTS.md](file:///c:/Users/user/Downloads/bullion-terminal_3/docs/02_SYSTEM_REQUIREMENTS.md) |
| Domain Model Specification | [docs/03_DOMAIN_MODEL.md](file:///c:/Users/user/Downloads/bullion-terminal_3/docs/03_DOMAIN_MODEL.md) |
| Software Architecture v1.1 | [docs/04_SOFTWARE_ARCHITECTURE.md](file:///c:/Users/user/Downloads/bullion-terminal_3/docs/04_SOFTWARE_ARCHITECTURE.md) |
| Architecture Review v1.0 | [docs/05_ARCHITECTURE_REVIEW.md](file:///c:/Users/user/Downloads/bullion-terminal_3/docs/05_ARCHITECTURE_REVIEW.md) |
| Database Design Specification | [docs/06_DATABASE_DESIGN_SPECIFICATION.md](file:///c:/Users/user/Downloads/bullion-terminal_3/docs/06_DATABASE_DESIGN_SPECIFICATION.md) |

---

## Table of Contents

1. [API Philosophy](#1-api-philosophy)
2. [Authentication](#2-authentication)
3. [API Standards](#3-api-standards)
4. [Standard Request Format](#4-standard-request-format)
5. [Standard Response Format](#5-standard-response-format)
6. [Error Catalogue](#6-error-catalogue)
7. [Authentication APIs](#7-authentication-apis)
8. [User APIs](#8-user-apis)
9. [Wallet APIs](#9-wallet-apis)
10. [Payment APIs](#10-payment-apis)
11. [Trading APIs](#11-trading-apis)
12. [Pricing APIs](#12-pricing-apis)
13. [Referral APIs](#13-referral-apis)
14. [Admin APIs](#14-admin-apis)
15. [Compliance APIs](#15-compliance-apis)
16. [Internal APIs](#16-internal-apis)
17. [WebSocket API](#17-websocket-api)
18. [Security](#18-security)
19. [Versioning Strategy](#19-versioning-strategy)
20. [API Validation Checklist](#20-api-validation-checklist)

---

## 1. API Philosophy

### 1.1 REST Conventions

The platform exposes a RESTful HTTP API. Resources are identified by nouns, and operations are expressed through HTTP verbs. All endpoints return JSON. The API follows these principles:

| Principle | Application |
| :--- | :--- |
| **Resource-Oriented** | URLs represent resources (`/users`, `/contracts`, `/wallets`), not actions. Actions are expressed via HTTP verbs. |
| **Stateless** | Each request contains all information needed for processing. No server-side session state. Authentication is derived from JWT per request. |
| **Idempotent Where Required** | All financial write operations (deposits, withdrawals, trade placement) accept an `Idempotency-Key` header. Duplicate requests with the same key return the original response. |
| **Consistent Error Model** | All errors follow a uniform structure with machine-readable codes and human-readable messages. |
| **Versioned** | All endpoints are prefixed with `/api/v1`. Breaking changes require a new version. |

### 1.2 JSON Format

- All request and response bodies use `Content-Type: application/json`.
- All numeric values for monetary amounts use string-formatted decimals to preserve precision (e.g., `"100.50"`).
- Timestamps use ISO 8601 format with UTC timezone: `2026-07-22T14:30:00.000Z`.
- UUIDs are formatted as lowercase hyphenated strings: `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"`.

### 1.3 Versioning Strategy

- All public endpoints are prefixed with `/api/v1/`.
- Internal endpoints use `/internal/v1/` prefix and are not accessible from the public internet.
- WebSocket endpoints use `/ws/v1/` prefix.
- See [Section 19](#19-versioning-strategy) for deprecation and breaking change policies.

### 1.4 Stateless Design

The API is stateless at the HTTP layer. Authentication state is carried in JWT Bearer tokens. No server-side session store is consulted for request routing. Redis is used for token revocation blacklisting and rate limiting, but its unavailability does not break request processing — it degrades gracefully (see SAD v1.1 §12).

### 1.5 Idempotency

All POST endpoints that modify financial state **require** an `Idempotency-Key` header. The server caches the response for a given key and returns it for duplicate requests. Idempotency keys are retained for a minimum of 7 days (per Architecture Review CR-004 recommendation).

**Endpoints requiring idempotency:**
- `POST /api/v1/payments/deposit/initiate`
- `POST /api/v1/payments/withdraw/request`
- `POST /api/v1/trading/contracts`
- `POST /api/v1/admin/wallets/adjust`

### 1.6 Error Handling Philosophy

- Errors are returned with appropriate HTTP status codes.
- The response body contains a structured error object with a machine-readable `code`, human-readable `message`, and optional `details` array for validation errors.
- Business rule violations return HTTP 422 (Unprocessable Entity).
- Authentication failures return HTTP 401 (Unauthorized).
- Authorization failures return HTTP 403 (Forbidden).
- Rate limit violations return HTTP 429 (Too Many Requests).
- Server errors return HTTP 500 (Internal Server Error) with a generic message and a server-side logged error reference.

---

## 2. Authentication

### 2.1 Login Flow

```mermaid
sequenceDiagram
    autonumber
    Client->>API: POST /api/v1/auth/login (email, password)
    API->>Auth Module: Validate credentials
    Auth Module->>Database: Query user by email
    Database-->>Auth Module: User record + password hash
    Auth Module->>Auth Module: Verify password hash (bcrypt/Argon2id)
    alt MFA Enabled
        Auth Module-->>API: 200 { requires_mfa: true, mfa_session_token }
        API-->>Client: 200 { requires_mfa: true, mfa_session_token }
        Client->>API: POST /api/v1/auth/mfa/verify (mfa_session_token, totp_code)
        API->>Auth Module: Validate TOTP code
        Auth Module->>Database: Verify TOTP secret + code
        Auth Module-->>API: MFA validated
    end
    Auth Module->>Database: Create session record
    Auth Module->>Redis: Cache access token JTI (for revocation check)
    Auth Module-->>API: { access_token, refresh_token, expires_in }
    API-->>Client: 200 { access_token, refresh_token, expires_in, user }
```

### 2.2 Token Structure

| Token | Type | TTL | Storage | Rotation |
| :--- | :--- | :--- | :--- | :--- |
| **Access Token** | JWT (RS256) | 15 minutes | Client memory (not localStorage) | Re-issued via refresh |
| **Refresh Token** | Opaque string | 7 days | HTTP-only secure cookie + database hash | Rotated on each use; old token invalidated |

### 2.3 JWT Claims

```json
{
  "sub": "user-uuid",
  "role": "trader",
  "permissions": ["trade:create", "wallet:read"],
  "jti": "unique-token-id",
  "iat": 1680000000,
  "exp": 1680000900
}
```

### 2.4 Token Refresh Flow

```mermaid
sequenceDiagram
    autonumber
    Client->>API: POST /api/v1/auth/refresh (refresh_token in cookie)
    API->>Auth Module: Hash refresh token, lookup in database
    Auth Module->>Database: Find session by refresh_token_hash
    Database-->>Auth Module: Session record
    alt Session valid and not expired
        Auth Module->>Auth Module: Rotate refresh token (generate new, hash, store)
        Auth Module->>Redis: Invalidate old access token JTI
        Auth Module->>Redis: Cache new access token JTI
        Auth Module-->>API: { access_token, new_refresh_token }
        API-->>Client: 200 { access_token, refresh_token, expires_in }
    else Session expired or revoked
        Auth Module-->>API: 401 { code: "AUTH_002", message: "Session expired" }
        API-->>Client: 401 Unauthorized
    end
```

### 2.5 Logout

```mermaid
sequenceDiagram
    autonumber
    Client->>API: POST /api/v1/auth/logout (Authorization: Bearer access_token)
    API->>Auth Module: Validate access token
    Auth Module->>Redis: Add JTI to revocation blacklist (TTL = token expiry)
    Auth Module->>Database: Mark session as revoked
    Auth Module-->>API: 200 { message: "Logged out successfully" }
    API-->>Client: 200 OK
```

### 2.6 Session Expiration

- Access tokens expire after 15 minutes. Clients must refresh before expiry.
- Refresh tokens expire after 7 days. After expiry, the user must re-authenticate.
- Password changes invalidate all active sessions (all refresh tokens for that user are revoked).
- Account suspension immediately revokes all sessions.
- Inactivity logout: no automatic server-side timeout beyond token expiry; clients should implement idle detection.

---

## 3. API Standards

### 3.1 URL Naming

| Convention | Example |
| :--- | :--- |
| Plural nouns for collections | `/api/v1/users`, `/api/v1/contracts` |
| Singular for singletons | `/api/v1/wallets/balance` |
| Sub-resources for relationships | `/api/v1/users/{id}/kyc` |
| Actions as last segment | `/api/v1/payments/deposit/initiate` |

### 3.2 HTTP Verbs

| Verb | Usage | Idempotent |
| :--- | :--- | :--- |
| `GET` | Retrieve resources | ✅ Yes |
| `POST` | Create resources or trigger actions | ❌ No (use Idempotency-Key) |
| `PUT` | Full resource replacement | ✅ Yes |
| `PATCH` | Partial resource update | ✅ Yes |
| `DELETE` | Remove resources | ✅ Yes |

### 3.3 Status Codes

| Code | Meaning | Usage |
| :--- | :--- | :--- |
| `200` | OK | Successful GET, PUT, PATCH, DELETE |
| `201` | Created | Successful POST (resource created) |
| `202` | Accepted | Async operation accepted (e.g., withdrawal request) |
| `204` | No Content | Successful DELETE |
| `400` | Bad Request | Malformed request body or parameters |
| `401` | Unauthorized | Missing or invalid authentication |
| `403` | Forbidden | Authenticated but insufficient permissions |
| `404` | Not Found | Resource does not exist |
| `409` | Conflict | Duplicate idempotency key with different request |
| `422` | Unprocessable Entity | Business rule violation |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Unexpected server error |
| `503` | Service Unavailable | Temporary outage (e.g., price feed down) |

### 3.4 Pagination

The API supports two pagination strategies:

**Cursor-based pagination** (default for real-time data like trades, ledger entries):
```
GET /api/v1/wallets/ledger?cursor=eyJpZCI6MTAwMH0&limit=50
```

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `cursor` | string (base64) | Opaque cursor from previous response's `meta.next_cursor` |
| `limit` | integer (1–100) | Maximum items per page (default: 20) |

**Offset-based pagination** (for admin dashboards, reports):
```
GET /api/v1/admin/users?page=1&per_page=25
```

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `page` | integer (≥1) | Page number (default: 1) |
| `per_page` | integer (1–100) | Items per page (default: 25) |

### 3.5 Filtering

Filter parameters use the format `filter[field]=value`:

```
GET /api/v1/trading/contracts?filter[status]=active&filter[asset_symbol]=EUR/USD
```

Multiple values for the same field use comma separation:
```
GET /api/v1/trading/contracts?filter[status]=active,settling
```

### 3.6 Sorting

Sort parameters use the format `sort=field` for ascending, `sort=-field` for descending:

```
GET /api/v1/trading/contracts?sort=-created_at
GET /api/v1/admin/users?sort=email
```

### 3.7 Rate Limiting

| Scope | Limit | Window | Response Header |
| :--- | :--- | :--- | :--- |
| Unauthenticated (by IP) | 60 requests | 1 minute | `X-RateLimit-Remaining` |
| Authenticated (by token) | 300 requests | 1 minute | `X-RateLimit-Remaining` |
| Trading endpoints | 10 requests | 1 second | `X-RateLimit-Remaining` |

Rate limit headers are returned on every response:
```
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 287
X-RateLimit-Reset: 1680000900
```

### 3.8 Request IDs and Correlation IDs

| Header | Format | Purpose | Set By |
| :--- | :--- | :--- | :--- |
| `X-Request-ID` | UUID | Uniquely identifies a single HTTP request. Included in response. | Client (optional) or server (auto-generated if absent) |
| `X-Correlation-ID` | UUID | Traces a logical operation across multiple services. Propagated to workers and events. | Client (optional) |

The server always returns `X-Request-ID` in the response, matching the client-provided value or a generated one.

---

## 4. Standard Request Format

### 4.1 Common Headers

| Header | Required | Description |
| :--- | :--- | :--- |
| `Authorization` | For protected endpoints | `Bearer <access_token>` |
| `Content-Type` | For requests with body | `application/json` |
| `Idempotency-Key` | For financial POST endpoints | UUID v4 string |
| `X-Request-ID` | Optional | Client-generated request ID |
| `X-Correlation-ID` | Optional | Client-generated correlation ID |

### 4.2 Example Request

```http
POST /api/v1/trading/contracts HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
Content-Type: application/json
Idempotency-Key: a1b2c3d4-e5f6-7890-abcd-ef1234567890
X-Request-ID: f1e2d3c4-b5a6-7890-abcd-ef1234567890
X-Correlation-ID: 123e4567-e89b-12d3-a456-426614174000

{
  "asset_symbol": "EUR/USD",
  "contract_type": "higher",
  "stake": "50.00",
  "expiry_seconds": 300
}
```

---

## 5. Standard Response Format

### 5.1 Successful Response

```json
{
  "data": {
    "id": "c7b8a9d0-e1f2-3456-abcd-ef1234567890",
    "type": "contract",
    "attributes": {
      "asset_symbol": "EUR/USD",
      "contract_type": "higher",
      "stake": "50.00",
      "status": "active",
      "strike_price": "1.123450",
      "purchase_time": "2026-07-22T14:30:00.000Z",
      "expiry_time": "2026-07-22T14:35:00.000Z"
    }
  },
  "meta": {
    "request_id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890"
  }
}
```

### 5.2 Paginated Response

```json
{
  "data": [
    { "id": "...", "type": "contract", "attributes": { ... } },
    { "id": "...", "type": "contract", "attributes": { ... } }
  ],
  "meta": {
    "request_id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
    "page": 1,
    "per_page": 25,
    "total_count": 142,
    "total_pages": 6
  }
}
```

### 5.3 Cursor-Paginated Response

```json
{
  "data": [ ... ],
  "meta": {
    "request_id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
    "next_cursor": "eyJpZCI6MTAwMH0",
    "has_more": true
  }
}
```

### 5.4 Error Response

```json
{
  "error": {
    "code": "TRADING_001",
    "message": "Insufficient balance for trade stake.",
    "details": [
      {
        "field": "stake",
        "message": "Requested stake 500.00 exceeds available balance 120.00"
      }
    ],
    "request_id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890"
  }
}
```

### 5.5 Validation Error Response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "field": "stake",
        "message": "Stake must be a positive number"
      },
      {
        "field": "expiry_seconds",
        "message": "Expiry must be between 60 and 86400 seconds"
      }
    ],
    "request_id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890"
  }
}
```

### 5.6 Business Rule Failure Response

```json
{
  "error": {
    "code": "TRADING_003",
    "message": "Maximum asset exposure limit reached.",
    "details": [
      {
        "field": "asset_symbol",
        "message": "Current exposure for EUR/USD is 9,800.00. Maximum is 10,000.00. Requested stake 500.00 would exceed limit."
      }
    ],
    "request_id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890"
  }
}
```

---

## 6. Error Catalogue

### 6.1 Authentication Errors (AUTH_*)

| Code | HTTP Status | Message | Description |
| :--- | :--- | :--- | :--- |
| `AUTH_001` | 401 | Invalid credentials. | Email or password is incorrect. |
| `AUTH_002` | 401 | Session expired. | Refresh token has expired. User must re-authenticate. |
| `AUTH_003` | 401 | MFA required. | User has MFA enabled but did not provide a valid TOTP code. |
| `AUTH_004` | 403 | Account locked. | Account is temporarily locked due to too many failed login attempts. |
| `AUTH_005` | 401 | Session revoked. | Token has been revoked (logout, password change, or admin action). |
| `AUTH_006` | 403 | MFA not configured. | Privileged role requires MFA but user has not set it up. |
| `AUTH_007` | 400 | Invalid refresh token. | Refresh token is malformed or does not match any session. |

### 6.2 Trading Errors (TRADING_*)

| Code | HTTP Status | Message | Description |
| :--- | :--- | :--- | :--- |
| `TRADING_001` | 422 | Insufficient balance. | Available balance is less than the requested stake. |
| `TRADING_002` | 422 | Maximum exposure exceeded. | Total open stakes for this asset would exceed the configured limit. |
| `TRADING_003` | 422 | Trade rejected due to latency. | Request-to-execution latency exceeded 800ms threshold. |
| `TRADING_004` | 503 | Market closed. | The requested asset market is currently closed for trading. |
| `TRADING_005` | 403 | Self-exclusion active. | User has an active self-exclusion period. Trade placement is blocked. |
| `TRADING_006` | 422 | Stake outside limits. | Stake is below minimum or above maximum for this asset. |
| `TRADING_007` | 422 | Invalid expiry duration. | Expiry duration is outside the allowed range for this asset. |
| `TRADING_008` | 404 | Contract not found. | No contract exists with the given ID. |

### 6.3 Payment Errors (PAYMENT_*)

| Code | HTTP Status | Message | Description |
| :--- | :--- | :--- | :--- |
| `PAYMENT_001` | 502 | Payment gateway error. | The external payment gateway returned an error or is unreachable. |
| `PAYMENT_002` | 400 | Invalid webhook signature. | Payment webhook HMAC signature does not match. Possible tampering. |
| `PAYMENT_003` | 422 | Withdrawal under review. | Withdrawal has been queued for manual review and is not yet approved. |
| `PAYMENT_004` | 409 | Duplicate idempotency key. | Idempotency key matches a previous request with different parameters. |
| `PAYMENT_005` | 422 | KYC not verified. | User must complete KYC verification before withdrawing. |
| `PAYMENT_006` | 422 | Withdrawal amount below minimum. | Requested amount is below the minimum withdrawal threshold. |
| `PAYMENT_007` | 422 | Withdrawal hold active. | Account is subject to a 24-hour withdrawal freeze (password change detected). |

### 6.4 Ledger Errors (LEDGER_*)

| Code | HTTP Status | Message | Description |
| :--- | :--- | :--- | :--- |
| `LEDGER_001` | 422 | Insufficient funds. | Wallet balance is insufficient for the requested operation. |
| `LEDGER_002` | 422 | Wallet locked. | Wallet is locked due to pending withdrawal or administrative action. |
| `LEDGER_003` | 500 | Ledger integrity violation. | A ledger operation would violate the non-negative balance invariant. This is a system error. |

### 6.5 KYC Errors (KYC_*)

| Code | HTTP Status | Message | Description |
| :--- | :--- | :--- | :--- |
| `KYC_001` | 403 | KYC not verified. | User has not completed KYC verification. Required for withdrawals. |
| `KYC_002` | 422 | KYC documents pending. | Documents have been submitted and are under review. |
| `KYC_003` | 422 | KYC verification rejected. | Submitted documents were rejected. User must re-submit. |

### 6.6 System Errors (SYSTEM_*)

| Code | HTTP Status | Message | Description |
| :--- | :--- | :--- | :--- |
| `SYSTEM_001` | 500 | Internal server error. | An unexpected error occurred. The error has been logged. |
| `SYSTEM_002` | 503 | Service unavailable. | A required dependency (database, price feed, payment gateway) is temporarily unavailable. |
| `SYSTEM_003` | 429 | Rate limit exceeded. | Too many requests. Retry after the time specified in the `Retry-After` header. |
| `SYSTEM_004` | 400 | Invalid request. | Request body failed schema validation. |

---

## 7. Authentication APIs

### 7.1 POST /api/v1/auth/register

**Purpose**: Create a new user account.

**Request**:
```json
{
  "email": "user@example.com",
  "password": "SecureP@ss123",
  "display_name": "John Doe",
  "phone": "+254712345678",
  "referral_code": "REF123" (optional)
}
```

**Response** (201 Created):
```json
{
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "user@example.com",
    "display_name": "John Doe",
    "status": "unverified",
    "created_at": "2026-07-22T14:30:00.000Z"
  },
  "meta": { "request_id": "..." }
}
```

**Validation**:
- Email: valid format, unique, max 255 chars
- Password: minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 digit, 1 special character
- Display name: 2–100 characters
- Phone: valid E.164 format, unique
- Referral code: must exist and be active if provided

**Permissions**: None (public endpoint).

**Business Rules**:
- Email must not already be registered.
- Phone must not already be registered.
- If referral code is provided, the referrer must be an active user.

**Possible Errors**: `AUTH_001` (email taken), `VALIDATION_ERROR`, `SYSTEM_004`

---

### 7.2 POST /api/v1/auth/login

**Purpose**: Authenticate user credentials and issue tokens.

**Request**:
```json
{
  "email": "user@example.com",
  "password": "SecureP@ss123"
}
```

**Response** (200 OK) — without MFA:
```json
{
  "data": {
    "access_token": "eyJhbGciOiJSUzI1NiIs...",
    "refresh_token": "dGhpcyBpcyBhIHJlZnJl...",
    "expires_in": 900,
    "token_type": "Bearer",
    "user": {
      "id": "a1b2c3d4-...",
      "email": "user@example.com",
      "display_name": "John Doe",
      "role": "trader",
      "kyc_status": "verified"
    }
  },
  "meta": { "request_id": "..." }
}
```

**Response** (200 OK) — with MFA required:
```json
{
  "data": {
    "requires_mfa": true,
    "mfa_session_token": "temp-session-token-uuid"
  },
  "meta": { "request_id": "..." }
}
```

**Validation**: Email and password are required.

**Permissions**: None (public endpoint).

**Business Rules**:
- Account must not be locked (failed attempts < 5).
- Account must not be suspended or closed.
- If MFA is enabled, return `requires_mfa: true` instead of tokens.

**Possible Errors**: `AUTH_001`, `AUTH_004`, `SYSTEM_004`

---

### 7.3 POST /api/v1/auth/mfa/verify

**Purpose**: Complete MFA challenge during login.

**Request**:
```json
{
  "mfa_session_token": "temp-session-token-uuid",
  "totp_code": "123456"
}
```

**Response** (200 OK):
```json
{
  "data": {
    "access_token": "eyJhbGciOiJSUzI1NiIs...",
    "refresh_token": "dGhpcyBpcyBhIHJlZnJl...",
    "expires_in": 900,
    "token_type": "Bearer",
    "user": { ... }
  },
  "meta": { "request_id": "..." }
}
```

**Validation**: TOTP code must be 6 digits.

**Permissions**: Valid `mfa_session_token` from login step.

**Business Rules**: TOTP code must be valid for the user's MFA secret. Code window: 30 seconds.

**Possible Errors**: `AUTH_003`, `AUTH_002` (session token expired), `SYSTEM_004`

---

### 7.4 POST /api/v1/auth/logout

**Purpose**: Invalidate current session.

**Request**: No body required. `Authorization: Bearer <access_token>` header required.

**Response** (200 OK):
```json
{
  "data": {
    "message": "Logged out successfully."
  },
  "meta": { "request_id": "..." }
}
```

**Permissions**: Authenticated user.

**Business Rules**: Access token JTI is added to Redis revocation blacklist. Session record is marked as revoked.

**Possible Errors**: `AUTH_002` (token expired — still accepted for logout), `AUTH_005`

---

### 7.5 POST /api/v1/auth/refresh

**Purpose**: Issue new access token using refresh token.

**Request**: Refresh token sent in HTTP-only cookie or request body:
```json
{
  "refresh_token": "dGhpcyBpcyBhIHJlZnJl..."
}
```

**Response** (200 OK):
```json
{
  "data": {
    "access_token": "eyJhbGciOiJSUzI1NiIs...",
    "refresh_token": "bmV3IHJlZnJl...",
    "expires_in": 900,
    "token_type": "Bearer"
  },
  "meta": { "request_id": "..." }
}
```

**Permissions**: Valid refresh token.

**Business Rules**:
- Refresh token is rotated: old token is invalidated, new token is issued.
- Old access token JTI is added to revocation blacklist.

**Possible Errors**: `AUTH_002`, `AUTH_007`, `SYSTEM_004`

---

### 7.6 POST /api/v1/auth/forgot-password

**Purpose**: Initiate password reset flow.

**Request**:
```json
{
  "email": "user@example.com"
}
```

**Response** (200 OK — always returns success to prevent email enumeration):
```json
{
  "data": {
    "message": "If the email exists, a reset link has been sent."
  },
  "meta": { "request_id": "..." }
}
```

**Permissions**: None (public endpoint).

**Business Rules**: If email exists, generate a password reset token (1-hour TTL) and send via email. Always return success regardless of whether email exists.

**Possible Errors**: `SYSTEM_004`

---

### 7.7 POST /api/v1/auth/reset-password

**Purpose**: Complete password reset.

**Request**:
```json
{
  "token": "reset-token-from-email",
  "new_password": "NewSecureP@ss456"
}
```

**Response** (200 OK):
```json
{
  "data": {
    "message": "Password has been reset successfully."
  },
  "meta": { "request_id": "..." }
}
```

**Permissions**: Valid reset token.

**Business Rules**:
- Token must not be expired (1-hour TTL).
- Token must not have been used previously.
- All active sessions for the user are revoked.
- Password history is checked (last 5 passwords cannot be reused).

**Possible Errors**: `AUTH_002` (token expired), `VALIDATION_ERROR`, `SYSTEM_004`

---

### 7.8 POST /api/v1/auth/verify-email

**Purpose**: Verify email address after registration.

**Request**:
```json
{
  "token": "email-verification-token"
}
```

**Response** (200 OK):
```json
{
  "data": {
    "message": "Email verified successfully."
  },
  "meta": { "request_id": "..." }
}
```

**Permissions**: Valid verification token.

**Business Rules**: Token must not be expired (24-hour TTL). User status transitions from `unverified` to `verified`.

**Possible Errors**: `AUTH_002` (token expired), `SYSTEM_004`

---

### 7.9 POST /api/v1/auth/mfa/setup

**Purpose**: Initialize MFA setup for authenticated user.

**Request**: No body required. `Authorization: Bearer <access_token>` header required.

**Response** (200 OK):
```json
{
  "data": {
    "secret": "JBSWY3DPEHPK3PXP",
    "qr_code_url": "otpauth://totp/Example:user@example.com?secret=...&issuer=Example",
    "setup_completed": false
  },
  "meta": { "request_id": "..." }
}
```

**Permissions**: Authenticated user. Mandatory for privileged roles (Finance, Risk, Compliance, Admin, Super Admin).

**Business Rules**: If MFA is already enabled, return existing configuration. Secret is encrypted before storage.

**Possible Errors**: `AUTH_002`, `SYSTEM_004`

---

### 7.10 POST /api/v1/auth/mfa/verify-setup

**Purpose**: Confirm MFA setup by verifying a TOTP code.

**Request**:
```json
{
  "totp_code": "123456"
}
```

**Response** (200 OK):
```json
{
  "data": {
    "message": "MFA has been enabled successfully.",
    "recovery_codes": ["XXXX-XXXX-XXXX", ...]
  },
  "meta": { "request_id": "..." }
}
```

**Permissions**: Authenticated user with pending MFA setup.

**Business Rules**: TOTP code must match the generated secret. On success, `mfa_enabled` is set to `true` on the user record. Recovery codes (10 codes, single-use) are generated and displayed once.

**Possible Errors**: `AUTH_003`, `SYSTEM_004`

---

## 8. User APIs

### 8.1 GET /api/v1/users/profile

**Purpose**: Retrieve authenticated user's profile.

**Permissions**: Authenticated user.

**Response** (200 OK):
```json
{
  "data": {
    "id": "a1b2c3d4-...",
    "email": "user@example.com",
    "display_name": "John Doe",
    "phone": "+254712345678",
    "kyc_status": "verified",
    "mfa_enabled": true,
    "created_at": "2026-07-22T14:30:00.000Z"
  },
  "meta": { "request_id": "..." }
}
```

**Possible Errors**: `AUTH_002`

---

### 8.2 PUT /api/v1/users/profile

**Purpose**: Update authenticated user's profile.

**Request**:
```json
{
  "display_name": "John Updated",
  "phone": "+254712345679"
}
```

**Permissions**: Authenticated user.

**Business Rules**: Phone must be unique. Email changes are not permitted via this endpoint (use support).

**Possible Errors**: `AUTH_002`, `VALIDATION_ERROR`, `SYSTEM_004`

---

### 8.3 GET /api/v1/users/settings

**Purpose**: Retrieve user preferences and settings.

**Permissions**: Authenticated user.

**Response** (200 OK):
```json
{
  "data": {
    "notifications": {
      "email": true,
      "sms": false,
      "push": true
    },
    "trading": {
      "default_expiry_seconds": 300,
      "max_daily_loss": "500.00",
      "max_daily_deposit": "1000.00"
    },
    "display": {
      "theme": "dark",
      "currency": "KES",
      "timezone": "Africa/Nairobi"
    }
  },
  "meta": { "request_id": "..." }
}
```

**Possible Errors**: `AUTH_002`

---

### 8.4 PUT /api/v1/users/settings

**Purpose**: Update user preferences.

**Permissions**: Authenticated user.

**Business Rules**: `max_daily_loss` and `max_daily_deposit` are self-imposed limits enforced by the Risk Engine.

**Possible Errors**: `AUTH_002`, `VALIDATION_ERROR`

---

### 8.5 GET /api/v1/users/notifications/preferences

**Purpose**: Retrieve notification channel preferences.

**Permissions**: Authenticated user.

**Possible Errors**: `AUTH_002`

---

### 8.6 PUT /api/v1/users/notifications/preferences

**Purpose**: Update notification channel preferences.

**Permissions**: Authenticated user.

**Possible Errors**: `AUTH_002`, `VALIDATION_ERROR`

---

### 8.7 POST /api/v1/users/self-exclusion

**Purpose**: Activate self-exclusion for responsible trading.

**Request**:
```json
{
  "duration_days": 30
}
```

**Permissions**: Authenticated user.

**Business Rules**: Duration must be between 1 and 365 days. Once set, self-exclusion cannot be removed early. The `self_excluded_until` field is set on the user record. Trade placement is blocked (TRADING_005).

**Possible Errors**: `AUTH_002`, `VALIDATION_ERROR`

---

## 9. Wallet APIs

### 9.1 GET /api/v1/wallets/balance

**Purpose**: Retrieve current wallet balances.

**Permissions**: Authenticated user.

**Response** (200 OK):
```json
{
  "data": {
    "balance": "1500.0000",
    "locked_balance": "200.0000",
    "available_balance": "1300.0000",
    "currency": "KES"
  },
  "meta": { "request_id": "..." }
}
```

**Possible Errors**: `AUTH_002`

---

### 9.2 GET /api/v1/wallets/ledger

**Purpose**: Retrieve paginated ledger entry history.

**Query Parameters**:
- `cursor` (optional): Cursor for pagination.
- `limit` (optional, default 20, max 100): Items per page.
- `filter[reference_type]` (optional): Filter by type (deposit, withdrawal, trade_stake, trade_win, etc.).
- `filter[date_from]` (optional): Start date (ISO 8601).
- `filter[date_to]` (optional): End date (ISO 8601).

**Permissions**: Authenticated user.

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": 1001,
      "transaction_id": "uuid",
      "entry_type": "debit",
      "amount": "50.0000",
      "balance_before": "1300.0000",
      "balance_after": "1250.0000",
      "reference_type": "trade_stake",
      "reference_id": "contract-uuid",
      "description": "Stake lock for EUR/USD Higher",
      "created_at": "2026-07-22T14:30:00.000Z"
    }
  ],
  "meta": {
    "request_id": "...",
    "next_cursor": "eyJpZCI6MTAwMH0",
    "has_more": true
  }
}
```

**Possible Errors**: `AUTH_002`

---

### 9.3 GET /api/v1/wallets/statements

**Purpose**: Generate a time-bounded account statement.

**Query Parameters**:
- `date_from` (required): Start date (ISO 8601).
- `date_to` (required): End date (ISO 8601).
- `format` (optional, default `json`): Response format (`json` or `csv`).

**Permissions**: Authenticated user.

**Business Rules**: Maximum date range is 365 days. Statements are generated from immutable ledger entries.

**Possible Errors**: `AUTH_002`, `VALIDATION_ERROR`

---

## 10. Payment APIs

### 10.1 POST /api/v1/payments/deposit/initiate

**Purpose**: Initiate a deposit transaction.

**Request**:
```json
{
  "amount": "100.00",
  "currency": "KES",
  "gateway_id": 1,
  "phone": "+254712345678" (optional, for mobile money),
  "redirect_url": "https://app.example.com/deposit/complete" (optional, for card)
}
```

**Headers**: `Idempotency-Key` (required).

**Permissions**: Authenticated user.

**Response** (201 Created):
```json
{
  "data": {
    "deposit_id": "uuid",
    "status": "pending",
    "gateway_reference": "provider-tx-ref",
    "gateway_action": {
      "type": "stk_push" | "redirect_url",
      "value": "https://gateway.example.com/pay/..."
    },
    "amount": "100.00",
    "fee": "0.00",
    "net_amount": "100.00"
  },
  "meta": { "request_id": "..." }
}
```

**Business Rules**:
- Amount must be ≥ minimum deposit ($10.00).
- Gateway must be active.
- Idempotency key prevents duplicate deposits.

**Possible Errors**: `PAYMENT_001`, `PAYMENT_004`, `VALIDATION_ERROR`, `AUTH_002`

---

### 10.2 POST /api/v1/payments/deposit/callback

**Purpose**: Webhook endpoint for payment gateway callbacks.

**Request**: Raw payload from payment gateway (format varies by provider). No authentication — relies on HMAC signature verification.

**Permissions**: None (public endpoint — secured by HMAC signature).

**Response** (200 OK):
```json
{
  "data": {
    "status": "completed",
    "deposit_id": "uuid"
  },
  "meta": { "request_id": "..." }
}
```

**Business Rules**:
- HMAC signature is verified before processing.
- Idempotency key (gateway reference) is checked against 7-day retention store.
- Duplicate callbacks return cached 200 response.
- On success, `DepositCompleted` event is written to the Transactional Outbox.

**Possible Errors**: `PAYMENT_002` (signature invalid), `PAYMENT_004` (duplicate with different params)

---

### 10.3 GET /api/v1/payments/deposit/{id}/status

**Purpose**: Check deposit transaction status.

**Permissions**: Authenticated user (owner of deposit).

**Response** (200 OK):
```json
{
  "data": {
    "id": "uuid",
    "status": "completed",
    "amount": "100.00",
    "fee": "0.00",
    "gateway_reference": "provider-tx-ref",
    "completed_at": "2026-07-22T14:35:00.000Z"
  },
  "meta": { "request_id": "..." }
}
```

**Possible Errors**: `AUTH_002`, `404` (not found)

---

### 10.4 POST /api/v1/payments/withdraw/request

**Purpose**: Request a withdrawal.

**Request**:
```json
{
  "amount": "50.00",
  "currency": "KES",
  "gateway_id": 1,
  "phone": "+254712345678",
  "account_details": {} (optional, provider-specific)
}
```

**Headers**: `Idempotency-Key` (required).

**Permissions**: Authenticated user.

**Response** (202 Accepted):
```json
{
  "data": {
    "withdrawal_id": "uuid",
    "status": "pending",
    "amount": "50.00",
    "fee": "1.50",
    "net_amount": "48.50",
    "estimated_processing_time": "4 hours"
  },
  "meta": { "request_id": "..." }
}
```

**Business Rules**:
- KYC must be verified (KYC_001).
- Amount must be ≥ minimum withdrawal ($15.00).
- Available balance must be sufficient.
- If amount exceeds auto-approval limit ($100.00), status is `pending_review`.
- 24-hour withdrawal hold applies if password was changed recently.
- Idempotency key prevents duplicate requests.

**Possible Errors**: `KYC_001`, `PAYMENT_005`, `PAYMENT_006`, `PAYMENT_007`, `LEDGER_001`, `PAYMENT_004`, `VALIDATION_ERROR`, `AUTH_002`

---

### 10.5 GET /api/v1/payments/withdraw/{id}/status

**Purpose**: Check withdrawal transaction status.

**Permissions**: Authenticated user (owner of withdrawal).

**Response** (200 OK):
```json
{
  "data": {
    "id": "uuid",
    "status": "approved",
    "amount": "50.00",
    "fee": "1.50",
    "net_amount": "48.50",
    "review_note": null,
    "completed_at": null
  },
  "meta": { "request_id": "..." }
}
```

**Possible Errors**: `AUTH_002`, `404`

---

### 10.6 GET /api/v1/payments/gateways

**Purpose**: List available payment gateways.

**Permissions**: Authenticated user.

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": 1,
      "name": "M-Pesa",
      "provider_type": "mobile_money",
      "min_deposit": "10.00",
      "max_deposit": "5000.00",
      "min_withdrawal": "15.00",
      "max_withdrawal": "5000.00",
      "is_active": true
    }
  ],
  "meta": { "request_id": "..." }
}
```

**Possible Errors**: `AUTH_002`

---

## 11. Trading APIs

### 11.1 GET /api/v1/trading/assets

**Purpose**: List all tradable assets.

**Permissions**: Authenticated user.

**Response** (200 OK):
```json
{
  "data": [
    {
      "symbol": "EUR/USD",
      "name": "Euro / US Dollar",
      "asset_type": "forex",
      "is_active": true,
      "min_stake": "1.00",
      "max_stake": "500.00",
      "min_expiry_seconds": 60,
      "max_expiry_seconds": 86400,
      "pip_decimal_places": 5
    }
  ],
  "meta": { "request_id": "..." }
}
```

**Possible Errors**: `AUTH_002`

---

### 11.2 GET /api/v1/trading/assets/{symbol}

**Purpose**: Get details for a specific asset.

**Permissions**: Authenticated user.

**Possible Errors**: `AUTH_002`, `404`

---

### 11.3 POST /api/v1/trading/contracts

**Purpose**: Place a binary options trade.

**Request**:
```json
{
  "asset_symbol": "EUR/USD",
  "contract_type": "higher",
  "stake": "50.00",
  "expiry_seconds": 300
}
```

**Headers**: `Idempotency-Key` (required).

**Permissions**: Authenticated user with role `trader`.

**Response** (201 Created):
```json
{
  "data": {
    "id": "c7b8a9d0-e1f2-3456-abcd-ef1234567890",
    "asset_symbol": "EUR/USD",
    "contract_type": "higher",
    "stake": "50.00",
    "payout_rate": "0.60",
    "status": "active",
    "strike_price": "1.123450",
    "purchase_time": "2026-07-22T14:30:00.000Z",
    "expiry_time": "2026-07-22T14:35:00.000Z"
  },
  "meta": { "request_id": "..." }
}
```

**Business Validation** (in order of evaluation):
1. User account is active and not suspended.
2. Self-exclusion check: `self_excluded_until` must be null or in the past (TRADING_005).
3. Asset is active and market is open (TRADING_004).
4. Stake is within asset limits (TRADING_006).
5. Expiry duration is within asset limits (TRADING_007).
6. Available balance ≥ stake (TRADING_001).
7. Asset exposure limit check (TRADING_002).
8. Latency check: request-to-execution < 800ms (TRADING_003).
9. Wallet Module: `SELECT FOR UPDATE` lock on wallet, debit stake, write ledger entry.
10. Trading Module: Write contract record with strike price, enqueue expiry job.

**Possible Errors**: `TRADING_001`–`TRADING_007`, `PAYMENT_004`, `VALIDATION_ERROR`, `AUTH_002`

---

### 11.4 GET /api/v1/trading/contracts/{id}

**Purpose**: Get contract details including settlement outcome.

**Permissions**: Authenticated user (owner of contract) or Admin.

**Response** (200 OK):
```json
{
  "data": {
    "id": "c7b8a9d0-...",
    "asset_symbol": "EUR/USD",
    "contract_type": "higher",
    "stake": "50.00",
    "payout_rate": "0.60",
    "status": "won",
    "strike_price": "1.123450",
    "expiry_price": "1.124500",
    "payout_amount": "80.00",
    "purchase_time": "2026-07-22T14:30:00.000Z",
    "expiry_time": "2026-07-22T14:35:00.000Z",
    "settled_at": "2026-07-22T14:35:01.500Z"
  },
  "meta": { "request_id": "..." }
}
```

**Settlement Visibility**: The `expiry_price` and `payout_amount` fields are populated only after settlement completes. Before settlement, they are `null`.

**Possible Errors**: `AUTH_002`, `TRADING_008` (404)

---

### 11.5 GET /api/v1/trading/contracts

**Purpose**: List user's trade history with filtering.

**Query Parameters**:
- `cursor` (optional): Cursor for pagination.
- `limit` (optional, default 20, max 100).
- `filter[status]` (optional): `active`, `won`, `lost`, `draw`, `settling`.
- `filter[asset_symbol]` (optional).
- `filter[date_from]` (optional).
- `filter[date_to]` (optional).
- `sort` (optional, default `-purchase_time`).

**Permissions**: Authenticated user.

**Possible Errors**: `AUTH_002`

---

### 11.6 GET /api/v1/trading/contracts/active

**Purpose**: List currently active (unsettled) contracts.

**Permissions**: Authenticated user.

**Response** (200 OK): Same structure as contract list, filtered to `status=active`.

**Possible Errors**: `AUTH_002`

---

## 12. Pricing APIs

### 12.1 GET /api/v1/pricing/assets

**Purpose**: List available assets with current market status.

**Permissions**: Authenticated user.

**Response** (200 OK):
```json
{
  "data": [
    {
      "symbol": "EUR/USD",
      "name": "Euro / US Dollar",
      "asset_type": "forex",
      "is_market_open": true,
      "current_price": "1.123450",
      "change_24h": "+0.0023"
    }
  ],
  "meta": { "request_id": "..." }
}
```

**Possible Errors**: `AUTH_002`

---

### 12.2 GET /api/v1/pricing/assets/{symbol}/price

**Purpose**: Get current price for a specific asset.

**Permissions**: Authenticated user.

**Response** (200 OK):
```json
{
  "data": {
    "symbol": "EUR/USD",
    "price": "1.123450",
    "bid": "1.123440",
    "ask": "1.123460",
    "tick_time": "2026-07-22T14:30:00.000Z"
  },
  "meta": { "request_id": "..." }
}
```

**Source**: Redis cache (low-latency). Falls back to PostgreSQL `price_ticks` table if Redis is unavailable.

**Possible Errors**: `AUTH_002`, `404`

---

### 12.3 GET /api/v1/pricing/assets/{symbol}/candles

**Purpose**: Get historical OHLC candle data for charting.

**Query Parameters**:
- `granularity` (required): `60`, `300`, `900`, `3600`, `86400` (seconds).
- `from` (required): Start time (ISO 8601).
- `to` (required): End time (ISO 8601).
- `limit` (optional, default 500, max 1000).

**Permissions**: Authenticated user.

**Response** (200 OK):
```json
{
  "data": [
    {
      "open_time": "2026-07-22T14:00:00.000Z",
      "close_time": "2026-07-22T14:01:00.000Z",
      "open_price": "1.123400",
      "high_price": "1.123500",
      "low_price": "1.123300",
      "close_price": "1.123450",
      "volume": "1500.00"
    }
  ],
  "meta": { "request_id": "..." }
}
```

**Possible Errors**: `AUTH_002`, `VALIDATION_ERROR`

---

### 12.4 GET /api/v1/pricing/status

**Purpose**: Get market status for all assets.

**Permissions**: Authenticated user.

**Response** (200 OK):
```json
{
  "data": {
    "overall_status": "open",
    "assets": {
      "EUR/USD": { "is_open": true, "next_open": null, "next_close": "2026-07-22T21:00:00.000Z" },
      "XAU/USD": { "is_open": true, "next_open": null, "next_close": "2026-07-22T20:30:00.000Z" }
    }
  },
  "meta": { "request_id": "..." }
}
```

**Possible Errors**: `AUTH_002`

---

## 13. Referral APIs

### 13.1 GET /api/v1/referral/codes

**Purpose**: List user's referral codes.

**Permissions**: Authenticated user.

**Response** (200 OK):
```json
{
  "data": [
    {
      "code": "JOHNDOE",
      "is_active": true,
      "use_count": 5,
      "max_uses": null,
      "created_at": "2026-07-22T14:30:00.000Z"
    }
  ],
  "meta": { "request_id": "..." }
}
```

**Possible Errors**: `AUTH_002`

---

### 13.2 POST /api/v1/referral/codes/generate

**Purpose**: Generate a new referral code.

**Request**:
```json
{
  "max_uses": 100 (optional, null = unlimited)
}
```

**Permissions**: Authenticated user.

**Business Rules**: Maximum 5 active codes per user. Code is auto-generated (8 alphanumeric characters).

**Possible Errors**: `AUTH_002`, `VALIDATION_ERROR`

---

### 13.3 GET /api/v1/referral/invites

**Purpose**: List users referred by the authenticated user.

**Permissions**: Authenticated user.

**Possible Errors**: `AUTH_002`

---

### 13.4 GET /api/v1/referral/commissions

**Purpose**: List referral commission history.

**Query Parameters**:
- `cursor` (optional).
- `limit` (optional, default 20).
- `filter[date_from]` (optional).
- `filter[date_to]` (optional).

**Permissions**: Authenticated user.

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "uuid",
      "referred_user": "jane@example.com",
      "amount": "2.50",
      "status": "paid",
      "created_at": "2026-07-22T14:30:00.000Z"
    }
  ],
  "meta": { "request_id": "..." }
}
```

**Possible Errors**: `AUTH_002`

---

### 13.5 GET /api/v1/referral/statistics

**Purpose**: Get referral performance statistics.

**Permissions**: Authenticated user.

**Response** (200 OK):
```json
{
  "data": {
    "total_referred": 5,
    "active_referred": 3,
    "total_commission_earned": "150.00",
    "pending_commission": "12.50",
    "commission_this_month": "25.00"
  },
  "meta": { "request_id": "..." }
}
```

**Possible Errors**: `AUTH_002`

---

## 14. Admin APIs

All Admin endpoints require authentication with a role that has the `admin` permission or higher. All admin actions are logged to the immutable audit log.

### 14.1 User Management

| Method | Endpoint | Purpose | Permissions |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/admin/users` | List all users (paginated, filterable) | Admin, Super Admin |
| `GET` | `/api/v1/admin/users/{id}` | Get user details | Admin, Super Admin |
| `PUT` | `/api/v1/admin/users/{id}/status` | Suspend, activate, or close user | Admin, Super Admin |
| `GET` | `/api/v1/admin/users/{id}/ledger` | View user's ledger entries | Finance, Admin, Super Admin |

**PUT /api/v1/admin/users/{id}/status**:
```json
{
  "status": "suspended",
  "reason": "Violation of terms of service"
}
```

### 14.2 KYC Review

| Method | Endpoint | Purpose | Permissions |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/admin/kyc/pending` | List pending KYC submissions | Compliance, Admin, Super Admin |
| `GET` | `/api/v1/admin/kyc/{id}` | Get KYC document details | Compliance, Admin, Super Admin |
| `PUT` | `/api/v1/admin/kyc/{id}/review` | Approve or reject KYC documents | Compliance, Admin, Super Admin |

**PUT /api/v1/admin/kyc/{id}/review**:
```json
{
  "action": "approve" | "reject",
  "note": "Document is valid and matches provided details."
}
```

### 14.3 Withdrawal Approvals

| Method | Endpoint | Purpose | Permissions |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/admin/withdrawals/pending` | List pending withdrawals | Finance, Admin, Super Admin |
| `GET` | `/api/v1/admin/withdrawals/{id}` | Get withdrawal details | Finance, Admin, Super Admin |
| `PUT` | `/api/v1/admin/withdrawals/{id}/approve` | Approve withdrawal for disbursement | Finance, Admin, Super Admin |
| `PUT` | `/api/v1/admin/withdrawals/{id}/reject` | Reject withdrawal | Finance, Admin, Super Admin |

**PUT /api/v1/admin/withdrawals/{id}/approve**:
```json
{
  "note": "Approved after manual review."
}
```

### 14.4 Risk Dashboard

| Method | Endpoint | Purpose | Permissions |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/admin/risk/dashboard` | Get platform risk overview | Risk Manager, Admin, Super Admin |
| `GET` | `/api/v1/admin/risk/exposure` | Get per-asset exposure breakdown | Risk Manager, Admin, Super Admin |
| `PUT` | `/api/v1/admin/risk/asset-config/{symbol}` | Update asset payout rate, limits | Risk Manager, Admin, Super Admin |

### 14.5 Platform Settings

| Method | Endpoint | Purpose | Permissions |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/admin/settings` | List all platform settings | Admin, Super Admin |
| `PUT` | `/api/v1/admin/settings` | Update platform settings | Admin, Super Admin |
| `GET` | `/api/v1/admin/settings/{key}` | Get specific setting | Admin, Super Admin |

**Four-Eyes Principle**: Changes to settings affecting financial parameters (payout rates, fee structures, withdrawal limits) require a second administrator to confirm via a separate approval endpoint.

### 14.6 Reports

| Method | Endpoint | Purpose | Permissions |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/admin/reports/daily-revenue` | Daily revenue summary | Finance, Admin, Super Admin |
| `GET` | `/api/v1/admin/reports/trade-volume` | Trade volume report | Finance, Admin, Super Admin |
| `GET` | `/api/v1/admin/reports/user-registrations` | User registration report | Admin, Super Admin |
| `GET` | `/api/v1/admin/reports/settlement-performance` | Settlement latency report | Admin, Super Admin |

All report endpoints support `date_from` and `date_to` query parameters and `format` (json/csv).

### 14.7 Audit Logs

| Method | Endpoint | Purpose | Permissions |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/admin/audit-logs` | Query audit log entries | Admin, Super Admin, Compliance |

**Query Parameters**: `actor_id`, `action`, `affected_entity`, `date_from`, `date_to`, `page`, `per_page`.

### 14.8 Support Tickets

| Method | Endpoint | Purpose | Permissions |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/admin/support/tickets` | List support tickets | Support, Admin, Super Admin |
| `GET` | `/api/v1/admin/support/tickets/{id}` | Get ticket details | Support, Admin, Super Admin |
| `PUT` | `/api/v1/admin/support/tickets/{id}` | Update ticket (status, response) | Support, Admin, Super Admin |

### 14.9 Wallet Adjustments

| Method | Endpoint | Purpose | Permissions |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/admin/wallets/adjust` | Manual wallet adjustment | Super Admin only |

**Headers**: `Idempotency-Key` (required).

**Request**:
```json
{
  "user_id": "uuid",
  "amount": "100.00",
  "type": "credit" | "debit",
  "reason": "Ledger discrepancy correction - Deposit ID: DEP-12345"
}
```

**Business Rules**:
- Must route through Wallet Module API (never direct DB — per ADR-009).
- Produces double-entry ledger records.
- Amounts > $500 require second administrator confirmation (four-eyes principle).
- All adjustments are logged to the immutable audit log.

**Possible Errors**: `LEDGER_001`, `LEDGER_002`, `PAYMENT_004`, `VALIDATION_ERROR`

---

## 15. Compliance APIs

### 15.1 GET /api/v1/compliance/kyc/status

**Purpose**: Get user's KYC verification status.

**Permissions**: Authenticated user.

**Response** (200 OK):
```json
{
  "data": {
    "status": "verified",
    "documents": [
      {
        "type": "passport",
        "status": "approved",
        "submitted_at": "2026-07-20T10:00:00.000Z",
        "reviewed_at": "2026-07-21T14:00:00.000Z"
      }
    ]
  },
  "meta": { "request_id": "..." }
}
```

**Possible Errors**: `AUTH_002`

---

### 15.2 POST /api/v1/compliance/kyc/upload

**Purpose**: Upload KYC documents for verification.

**Request**: `multipart/form-data`
- `document_type`: `passport`, `national_id`, `drivers_license`, `proof_of_address`, `selfie`
- `file`: File upload (max 5MB, accepted formats: PDF, JPG, PNG)

**Permissions**: Authenticated user.

**Response** (201 Created):
```json
{
  "data": {
    "document_id": "uuid",
    "document_type": "passport",
    "status": "pending",
    "message": "Document received and queued for review."
  },
  "meta": { "request_id": "..." }
}
```

**Business Rules**:
- File is scanned for malware before storage.
- File hash (SHA-256) is recorded for integrity verification.
- Maximum 5 documents per user.

**Possible Errors**: `AUTH_002`, `VALIDATION_ERROR`, `SYSTEM_004`

---

### 15.3 GET /api/v1/compliance/aml/flags

**Purpose**: Get AML flags raised against the user's account.

**Permissions**: Authenticated user.

**Response** (200 OK):
```json
{
  "data": [
    {
      "flag_type": "suspicious_activity",
      "severity": "low",
      "details": { "reason": "Multiple rapid deposits without trading activity" },
      "created_at": "2026-07-22T14:30:00.000Z",
      "resolved": false
    }
  ],
  "meta": { "request_id": "..." }
}
```

**Possible Errors**: `AUTH_002`

---

## 16. Internal APIs

> [!WARNING]
> The following endpoints are **NOT PUBLIC**. They are accessible only from within the internal network or via service-to-service authentication. They are documented here for completeness and should not be exposed to the public internet.

### 16.1 Settlement Worker APIs

| Method | Endpoint | Purpose | Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/internal/v1/settlement/resolve` | Resolve a single contract | Internal service token |
| `POST` | `/internal/v1/settlement/batch-resolve` | Resolve multiple expired contracts | Internal service token |

### 16.2 Pricing Service APIs

| Method | Endpoint | Purpose | Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/internal/v1/pricing/ticks` | Ingest price tick from Price Feed Service | Internal service token |
| `POST` | `/internal/v1/pricing/candles` | Ingest OHLC candle aggregation | Internal service token |

### 16.3 Notification Service APIs

| Method | Endpoint | Purpose | Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/internal/v1/notifications/send` | Send a notification (email, SMS, push) | Internal service token |
| `POST` | `/internal/v1/notifications/batch` | Send batch notifications | Internal service token |

### 16.4 Outbox Relay APIs

| Method | Endpoint | Purpose | Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/internal/v1/outbox/publish` | Publish an outbox event to the message broker | Internal service token |
| `GET` | `/internal/v1/outbox/pending` | Get count of pending outbox events | Internal service token |

### 16.5 Internal Authentication

Internal APIs authenticate using a pre-shared service token passed in the `X-Internal-Auth` header. Tokens are rotated every 24 hours and distributed via the secrets manager. Internal endpoints are not accessible from the public internet — they are bound to the internal network interface only.

---

## 17. WebSocket API

### 17.1 Connection

**URL**: `wss://api.example.com/ws/v1`

**Authentication**: JWT access token passed as a query parameter:
```
wss://api.example.com/ws/v1?token=eyJhbGciOiJSUzI1NiIs...
```

### 17.2 Connection Lifecycle

```mermaid
sequenceDiagram
    autonumber
    Client->>WebSocket Gateway: Connect wss://.../ws/v1?token=JWT
    WebSocket Gateway->>Auth Module: Validate JWT
    Auth Module-->>WebSocket Gateway: Valid (User ID, Role)
    WebSocket Gateway-->>Client: Connection established (event: connected)
    Client->>WebSocket Gateway: Subscribe to channels (JSON message)
    WebSocket Gateway-->>Client: Subscription confirmed (event: subscribed)
    Note over Client,WebSocket Gateway: Bidirectional message flow
    Client->>WebSocket Gateway: Ping (every 30 seconds)
    WebSocket Gateway-->>Client: Pong
    Note over Client,WebSocket Gateway: On disconnect
    WebSocket Gateway-->>Client: Close frame (code, reason)
    Client->>WebSocket Gateway: Reconnect with exponential backoff
```

### 17.3 Heartbeats

- Client sends a ping message every 30 seconds.
- Server responds with a pong message.
- If no message is received for 60 seconds, the server closes the connection with code 4001.
- If the server does not respond to 3 consecutive pings, the client should disconnect and reconnect.

**Ping message**:
```json
{ "type": "ping" }
```

**Pong response**:
```json
{ "type": "pong", "timestamp": "2026-07-22T14:30:00.000Z" }
```

### 17.4 Subscriptions

After connection, the client sends a subscribe message:

```json
{
  "type": "subscribe",
  "channels": [
    { "channel": "price", "symbol": "EUR/USD" },
    { "channel": "price", "symbol": "XAU/USD" },
    { "channel": "trades" },
    { "channel": "notifications" }
  ]
}
```

**Unsubscribe**:
```json
{
  "type": "unsubscribe",
  "channels": [
    { "channel": "price", "symbol": "EUR/USD" }
  ]
}
```

### 17.5 Reconnect Policy

| Attempt | Delay | Notes |
| :--- | :--- | :--- |
| 1st | 1 second | Immediate retry |
| 2nd | 5 seconds | Exponential backoff |
| 3rd | 15 seconds | Exponential backoff |
| 4th+ | 30 seconds (capped) | Max delay |

After 5 failed attempts, the client should prompt the user to refresh the page. On reconnection, the client must re-subscribe to all channels. The server does not persist subscription state across disconnections.

### 17.6 Message Formats

**Price Stream** (server → client):
```json
{
  "type": "price",
  "symbol": "EUR/USD",
  "price": "1.123450",
  "bid": "1.123440",
  "ask": "1.123460",
  "tick_time": "2026-07-22T14:30:00.000Z"
}
```

**Trade Stream** (server → client):
```json
{
  "type": "trade",
  "event": "settled",
  "contract_id": "c7b8a9d0-...",
  "status": "won",
  "strike_price": "1.123450",
  "expiry_price": "1.124500",
  "payout_amount": "90.00",
  "settled_at": "2026-07-22T14:35:01.500Z"
}
```

**Notification Stream** (server → client):
```json
{
  "type": "notification",
  "id": "uuid",
  "category": "deposit",
  "title": "Deposit Received",
  "body": "Your deposit of $100.00 has been credited.",
  "created_at": "2026-07-22T14:30:00.000Z"
}
```

**Error Stream** (server → client):
```json
{
  "type": "error",
  "code": "WS_001",
  "message": "Invalid subscription channel.",
  "request_id": "uuid"
}
```

### 17.7 Available Channels

| Channel | Direction | Description | Requires Auth |
| :--- | :--- | :--- | :--- |
| `price.{symbol}` | Server → Client | Real-time price ticks for a specific asset | Yes |
| `trades` | Server → Client | Trade lifecycle events for the authenticated user | Yes |
| `notifications` | Server → Client | User notifications (deposits, withdrawals, KYC updates) | Yes |
| `wallet` | Server → Client | Wallet balance change events | Yes |

---

## 18. Security

### 18.1 Rate Limiting

| Scope | Limit | Window | Enforcement |
| :--- | :--- | :--- | :--- |
| Unauthenticated (by IP) | 60 requests | 1 minute | Redis counter, fallback to in-app |
| Authenticated (by token) | 300 requests | 1 minute | Redis counter, fallback to in-app |
| Trading endpoints | 10 requests | 1 second | Redis counter |
| Login attempts (by IP) | 5 attempts | 15 minutes | Redis counter |
| Login attempts (by email) | 5 attempts | 15 minutes | Database counter |

Rate limit exceeded responses include `Retry-After` header and use HTTP 429.

### 18.2 Replay Attack Prevention

- All financial POST endpoints require an `Idempotency-Key` header (UUID v4).
- Idempotency keys are stored for 7 days minimum.
- Requests with a previously used key return the cached response.
- Requests with a previously used key but different request body return HTTP 409 (Conflict).

### 18.3 Idempotency

All endpoints that modify financial state are idempotent via the `Idempotency-Key` mechanism. Non-financial POST endpoints (e.g., KYC upload) are idempotent via natural key constraints (e.g., document hash).

### 18.4 Input Validation

- All request bodies are validated against JSON Schema at the API Gateway level.
- String lengths are bounded (max 255 chars for most fields).
- Numeric values are checked for range and precision.
- SQL injection is prevented via parameterized queries (mandated by SAD v1.1 §12).
- XSS is prevented via output encoding and Content-Type enforcement.

### 18.5 Payload Limits

| Endpoint Category | Max Payload Size |
| :--- | :--- |
| Standard API requests | 10 KB |
| KYC file uploads | 5 MB per file |
| WebSocket messages | 64 KB |

### 18.6 File Upload Limits

| Constraint | Value |
| :--- | :--- |
| Max file size | 5 MB |
| Accepted formats | PDF, JPG, PNG |
| Max files per upload | 5 |
| Malware scanning | Required before storage |

### 18.7 MFA

- MFA (TOTP) is mandatory for Finance Officer, Risk Manager, Compliance Officer, Administrator, and Super Administrator roles.
- MFA is optional but recommended for Trader roles.
- MFA setup is enforced at login: users with privileged roles cannot complete login without MFA configured.

### 18.8 Authorization

- Role-Based Access Control (RBAC) is enforced at the module boundary (SAD v1.1 §12).
- Every protected endpoint checks the user's role against the required permission.
- The permissions matrix from SRS v1.0 §4 is enforced at the API Gateway and module levels.
- Direct database access by administrators is prohibited (SAD v1.1 ADR-009).

### 18.9 OWASP Considerations

| OWASP Category | Mitigation |
| :--- | :--- |
| **Broken Access Control** | RBAC enforced at every module boundary. Role elevation requires Super Admin. |
| **Cryptographic Failures** | TLS 1.3 for all traffic. Passwords hashed with bcrypt/Argon2id. Secrets in vault, not code. |
| **Injection** | Parameterized queries only. No dynamic SQL. Input validation at gateway. |
| **Insecure Design** | Rate limiting, idempotency, fail-safe defaults. Architecture review completed. |
| **Security Misconfiguration** | Per-module database schemas with restricted users. No default credentials. |
| **Vulnerable Components** | Dependency scanning in CI/CD pipeline. Regular updates. |
| **Auth Failures** | JWT with RS256. Token revocation via Redis blacklist. MFA for privileged roles. |
| **Data Integrity Failures** | Immutable ledger entries. Hash-chained audit logs. Idempotency keys. |
| **Logging Failures** | Structured logging with request IDs. No sensitive data in logs. |
| **SSRF** | Outbound network requests restricted to allowlisted endpoints. |

---

## 19. Versioning Strategy

### 19.1 Current Version

The current API version is **v1**, accessible at `/api/v1/`.

### 19.2 Deprecation Policy

| Phase | Action | Timeline |
| :--- | :--- | :--- |
| **Announcement** | New version announced with migration guide. | 6 months before deprecation |
| **Deprecation** | Old version returns `Sunset` and `Deprecation` headers. | 3 months before removal |
| **Removal** | Old version returns HTTP 410 Gone. | On sunset date |

**Deprecation headers**:
```
Deprecation: true
Sunset: Sat, 22 Jul 2027 00:00:00 GMT
```

### 19.3 Future Compatibility

- All API changes are additive within a version: new fields in responses, new optional parameters, new endpoints.
- Breaking changes (removing fields, changing types, removing endpoints) require a new version.
- Clients must ignore unknown fields in responses (forward compatibility).

### 19.4 Breaking Changes

The following constitute breaking changes and require a new API version:

1. Removal or renaming of an existing endpoint.
2. Removal or renaming of a response field.
3. Changing a required field to optional or vice versa.
4. Changing the data type of an existing field.
5. Changing the HTTP status code for an existing success case.
6. Adding a new required request parameter.

The following are NOT breaking changes:

1. Adding a new endpoint.
2. Adding a new optional field to a response.
3. Adding a new optional request parameter.
4. Changing the order of fields in a JSON object.
5. Adding new error codes.

---

## 20. API Validation Checklist

### 20.1 Business Requirement Coverage

| BRD Requirement | API Endpoint(s) | Status |
| :--- | :--- | :--- |
| User Registration | `POST /api/v1/auth/register` | ✅ |
| KYC Verification | `POST /api/v1/compliance/kyc/upload`, `GET /api/v1/compliance/kyc/status` | ✅ |
| Deposit Funds | `POST /api/v1/payments/deposit/initiate`, `POST /api/v1/payments/deposit/callback` | ✅ |
| Withdrawal Request | `POST /api/v1/payments/withdraw/request` | ✅ |
| Binary Trade Execution | `POST /api/v1/trading/contracts` | ✅ |
| Trade Settlement | `POST /internal/v1/settlement/resolve` (internal) | ✅ |
| Real-Time Price Streaming | WebSocket `price.{symbol}` channel | ✅ |
| Admin Back-Office | All `/api/v1/admin/*` endpoints | ✅ |
| Referral System | All `/api/v1/referral/*` endpoints | ✅ |
| Notification Service | WebSocket `notifications` channel, `POST /internal/v1/notifications/send` | ✅ |
| Risk Engine | `PUT /api/v1/admin/risk/asset-config/{symbol}`, `GET /api/v1/admin/risk/dashboard` | ✅ |
| Audit Log | `GET /api/v1/admin/audit-logs` | ✅ |
| Self-Exclusion | `POST /api/v1/users/self-exclusion` | ✅ |
| Draw Settlement | `POST /api/v1/trading/contracts/{id}` (expiry_price = strike_price → draw) | ✅ |

### 20.2 System Requirement Coverage

| SRS Requirement | API Endpoint(s) | Status |
| :--- | :--- | :--- |
| FR-ATH-001 (Registration) | `POST /api/v1/auth/register` | ✅ |
| FR-ATH-002 (Login) | `POST /api/v1/auth/login` | ✅ |
| FR-ATH-003 (MFA) | `POST /api/v1/auth/mfa/verify`, `POST /api/v1/auth/mfa/setup` | ✅ |
| FR-ATH-004 (Logout) | `POST /api/v1/auth/logout` | ✅ |
| FR-KYC-001 (KYC Submission) | `POST /api/v1/compliance/kyc/upload` | ✅ |
| FR-KYC-002 (KYC Status) | `GET /api/v1/compliance/kyc/status` | ✅ |
| FR-KYC-003 (Admin KYC) | `GET /api/v1/admin/kyc/pending`, `PUT /api/v1/admin/kyc/{id}/review` | ✅ |
| FR-WLT-001 (Wallet Query) | `GET /api/v1/wallets/balance` | ✅ |
| FR-WLT-002 (Ledger Ingestion) | All financial POST endpoints (via Wallet Module) | ✅ |
| FR-WLT-003 (Reconciliation) | `GET /api/v1/admin/reports/daily-revenue` | ✅ |
| FR-DEP-001 (Deposit Initiation) | `POST /api/v1/payments/deposit/initiate` | ✅ |
| FR-DEP-002 (Webhook Handler) | `POST /api/v1/payments/deposit/callback` | ✅ |
| FR-WTH-001 (Withdrawal Request) | `POST /api/v1/payments/withdraw/request` | ✅ |
| FR-WTH-002 (Approval Routing) | `GET /api/v1/admin/withdrawals/pending` | ✅ |
| FR-WTH-003 (Disbursement) | `PUT /api/v1/admin/withdrawals/{id}/approve` | ✅ |
| FR-TRD-001 (Trade Placement) | `POST /api/v1/trading/contracts` | ✅ |
| FR-TRD-002 (Strike Price) | `POST /api/v1/trading/contracts` (strike_price in response) | ✅ |
| FR-TRD-003 (Active Trades) | `GET /api/v1/trading/contracts/active` | ✅ |
| FR-SET-001 (Expiry Scheduler) | `POST /internal/v1/settlement/resolve` (internal) | ✅ |
| FR-SET-002 (Contract Resolution) | `POST /internal/v1/settlement/resolve` (internal) | ✅ |
| FR-SET-003 (Payout Settlement) | `POST /internal/v1/settlement/resolve` (internal) | ✅ |
| FR-MKT-001 (Price Feed) | `POST /internal/v1/pricing/ticks` (internal) | ✅ |
| FR-MKT-002 (Tick Streaming) | WebSocket `price.{symbol}` channel | ✅ |
| FR-MKT-003 (OHLC Query) | `GET /api/v1/pricing/assets/{symbol}/candles` | ✅ |
| FR-ADM-001 (User Management) | `GET /api/v1/admin/users`, `PUT /api/v1/admin/users/{id}/status` | ✅ |
| FR-ADM-002 (Risk Console) | `PUT /api/v1/admin/risk/asset-config/{symbol}` | ✅ |
| FR-ADM-003 (Wallet Adjustment) | `POST /api/v1/admin/wallets/adjust` | ✅ |

### 20.3 Aggregate Validation

| Aggregate | Exposed Operations | Valid? |
| :--- | :--- | :--- |
| **User Aggregate** | Register, login, logout, refresh, profile CRUD, settings, self-exclusion | ✅ |
| **Wallet Aggregate** | Balance read, ledger history, statements | ✅ |
| **Trading Aggregate** | Asset list, contract create, contract read, contract list, active contracts | ✅ |
| **Settlement Aggregate** | Internal resolve only (not public) | ✅ |
| **Payment Aggregate** | Deposit initiate, deposit callback, deposit status, withdraw request, withdraw status | ✅ |
| **Compliance Aggregate** | KYC upload, KYC status, AML flags | ✅ |
| **Referral Aggregate** | Codes CRUD, invites, commissions, statistics | ✅ |

### 20.4 Wallet Module Bypass Check

| Endpoint | Bypasses Wallet Module? | Status |
| :--- | :--- | :--- |
| `POST /api/v1/trading/contracts` | No — calls Wallet Module for stake lock | ✅ |
| `POST /api/v1/payments/deposit/callback` | No — writes to outbox, Wallet Module consumes | ✅ |
| `POST /api/v1/payments/withdraw/request` | No — checks balance via Wallet Module | ✅ |
| `POST /api/v1/admin/wallets/adjust` | No — routes through Wallet Module API | ✅ |
| `PUT /api/v1/admin/withdrawals/{id}/approve` | No — triggers Wallet Module via event | ✅ |

### 20.5 ADR Compliance Check

| ADR | Requirement | API Compliance |
| :--- | :--- | :--- |
| **ADR-009** (Wallet Locking) | All wallet modifications use `SELECT FOR UPDATE` | ✅ All financial endpoints route through Wallet Module with pessimistic locking |
| **ADR-010** (Settlement Atomicity) | Atomic CAS on contract status | ✅ Internal settlement endpoint uses atomic status transition |
| **ADR-011** (Transactional Outbox) | Financial events via outbox | ✅ Deposit callback, trade placement, settlement all write to outbox |
| **ADR-012** (Price Authority) | Settlement price from PostgreSQL | ✅ Pricing API reads from Redis (cache), settlement reads from `price_ticks` table |

### 20.6 Financial Idempotency Check

| Endpoint | Idempotency-Key Required? | Status |
| :--- | :--- | :--- |
| `POST /api/v1/payments/deposit/initiate` | ✅ Yes | ✅ |
| `POST /api/v1/payments/withdraw/request` | ✅ Yes | ✅ |
| `POST /api/v1/trading/contracts` | ✅ Yes | ✅ |
| `POST /api/v1/admin/wallets/adjust` | ✅ Yes | ✅ |
| `POST /api/v1/payments/deposit/callback` | ✅ Yes (via gateway reference) | ✅ |

### 20.7 Authentication Compliance (SAD v1.1)

| SAD v1.1 Requirement | API Implementation | Status |
| :--- | :--- | :--- |
| JWT with RS256 | ✅ Access tokens use RS256 | ✅ |
| 15-minute access token TTL | ✅ `expires_in: 900` | ✅ |
| 7-day refresh token with rotation | ✅ Refresh token rotated on each use | ✅ |
| MFA mandated for privileged roles | ✅ MFA setup enforced at login for privileged roles | ✅ |
| Token revocation on logout | ✅ JTI added to Redis blacklist | ✅ |
| Redis fail-closed for auth | ✅ Token validation falls back to signature-only (15-min bound) | ✅ |
| Rate limiting per IP and token | ✅ 60/300 req/min limits defined | ✅ |

---

## End of API Design Specification v1.0