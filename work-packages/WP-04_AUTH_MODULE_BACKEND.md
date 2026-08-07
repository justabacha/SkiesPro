# Work Package: WP-04 Auth Module Backend

## §1 Work Package Identity

| Field | Value |
|-------|-------|
| **WP-ID** | WP-04 |
| **Name** | Auth Module Backend |
| **Phase** | Phase 2 (Authentication) |
| **Module** | Auth |
| **Critical Path** | Yes |
| **Estimated Effort** | 8 |
| **Executor** | Backend Developer / AI Agent |
| **Owner Review Required** | Yes |

---

## §2 Before You Start

### §2.1 Prerequisites (Must Be Complete)
| WP-ID | Name | Status |
|-------|------|--------|
| WP-01 | Project Scaffolding | ✅ Complete |
| WP-02 | Database Setup | ✅ Complete |
| WP-03 | Core Infrastructure | ✅ Complete |

### §2.2 Documents to Read
| Document | Sections | Why Needed |
|----------|----------|------------|
| docs/ProjectAnswers.md | ALL | Source of truth for all business decisions (MFA method, JWT expiry). |
| docs/11_IMPLEMENTATION_SPECIFICATION.md | §7.1 | Auth module implementation blueprint. |
| docs/06_DATABASE_DESIGN_SPECIFICATION.md | §5.1–§5.8 | Auth schema, tables, and constraints. |
| docs/07_API_DESIGN_SPECIFICATION.md | §7 | Auth API endpoint definitions, DTOs, and flows. |
| docs/09_SECURITY_ARCHITECTURE_AND_THREAT_MODEL.md | §4 | Auth security requirements (RS256, Bcrypt, Lockout). |
| docs/14_DEVELOPER_HANDBOOK_AND_CODING_STANDARDS.md | §5 | Backend coding patterns and standards. |

**Note:** Schema definitions verified against actual migration files 001–022.

### §2.3 Decisions Already Made
| Decision | Value | Source |
|----------|-------|--------|
| Password Hashing | **Bcrypt (cost factor 12)** | ProjectAnswers.md #19 |
| Access Token Algorithm | **RS256** (Asymmetric) | SATM §4.1 |
| Access Token TTL | **15 minutes** | ProjectAnswers.md #15 |
| Refresh Token Type | **Opaque 32-byte string**, hashed in DB | SATM §4.2 |
| Refresh Token TTL | **7 days** | ProjectAnswers.md #16 |
| Refresh Token Rotation | **Enabled** (rotated on every use) | SATM §4.2 |
| MFA Method | **TOTP** (Google Authenticator) | ProjectAnswers.md #17 |
| Password History | **Last 5 passwords** cannot be reused | SATM §4.3 |
| Failed Login Limit | **5 attempts** before lockout | ProjectAnswers.md #19 |
| Lockout Duration | **15 minutes** (increasing on repeat) | SATM §4.3 |

### §2.4 Decisions Pending
| Item | Value in ProjectAnswers.md | Why Needed | Blocker? |
|------|---------------------------|------------|----------|
| Email Sender Address | `[PENDING]` | For verification/reset emails | No (use mock/config) |
| SMS Provider for Kenya | `Africa's Talking` | If SMS MFA is ever added | No |

### §2.5 Secret Handling Rule
**NEVER hardcode secrets.**
- Use `process.env.JWT_PRIVATE_KEY`
- Use `process.env.JWT_PUBLIC_KEY`
- Use `process.env.TOTP_ENCRYPTION_KEY`
- Ensure all variables are listed in `.env.example`.

---

## §3 What You'll Build

### §3.1 Scope
Implementation of the full Authentication Module backend as per Phase 2 of the Master Implementation Checklist:

- [ ] **User Registration**: Create user, hash password, generate verification token.
- [ ] **Email Verification**: Token-based status transition from `unverified` to `verified`.
- [ ] **Login & Session Management**: Issue RS256 JWTs and rotated refresh tokens.
- [ ] **MFA (TOTP)**: Setup flow, verification during login, recovery code generation.
- [ ] **Password Management**: Secure reset flow (token-based), history enforcement.
- [ ] **Logout**: Token revocation via Redis blacklist (fail-closed support).
- [ ] **RBAC Enforcement**: Middleware to check roles and permissions.

### §3.2 Out of Scope
- Frontend UI screens (handled in WP-05).
- Actual SMTP server integration (use a shared utility/mock for sending).
- KYC implementation (Phase 10 / WP-11).

### §3.3 Deliverables
| Deliverable | Format | Location |
|-------------|--------|----------|
| Auth Module Code | TypeScript Files | `src/modules/auth/` |
| Auth Middleware | TypeScript Files | `src/shared/middleware/` |
| Repository Layer | TypeScript Files | `src/modules/auth/repositories/` |
| Service Layer | TypeScript Files | `src/modules/auth/services/` |
| DTOs & Validators | TypeScript Files | `src/modules/auth/dto/`, `src/modules/auth/validators/` |
| Unit & Integration Tests | Jest Files | `tests/auth/` |

---

## §4 Technical Specification

### §4.1 Architecture
- **Pattern**: [Controller → Service → Repository] per DHCS §3.1.
- **Events**:
  - `UserRegisteredEvent`: Triggered after successful registration.
  - `SessionCreatedEvent`: Triggered after successful login.
- **Workers**:
  - `EmailVerificationWorker`: Processes verification email sending.
  - `PasswordResetWorker`: Processes reset email sending.

### §4.2 Database
Reference **DDS §5.1–§5.8** for full table definitions in `app_auth` schema.
- `app_auth.users`: Central user identity.
- `app_auth.sessions`: Active refresh tokens and JTI tracking.
- `app_auth.mfa_tokens`: Encrypted TOTP secrets.
- `app_auth.password_reset_tokens`: Short-lived reset hashes.
- `app_auth.roles` & `app_auth.permissions`: RBAC structures.

**Note:** Schema definitions verified against actual migration files 001–022. Column `display_name` used instead of `full_name`.

### §4.3 API Endpoints
Reference **ADS §7** for full request/response schemas.

| Method | Path | Request DTO | Response | Auth | Rate Limit |
|--------|------|-------------|----------|------|------------|
| POST | /api/v1/auth/register | `RegisterDto` | `UserResponseDto` | Public | 5/min |
| GET | /api/v1/auth/verify-email | Query: token | `{ message: string }` | Public | 10/min |
| POST | /api/v1/auth/login | `LoginDto` | `TokenResponseDto` OR `MfaRequiredDto` | Public | 5/15min |
| POST | /api/v1/auth/mfa/verify | `MfaVerifyDto` | `TokenResponseDto` | Public | 5/min |
| POST | /api/v1/auth/refresh | `RefreshDto` | `TokenResponseDto` | Public | 30/min |
| POST | /api/v1/auth/logout | None | `{ message: string }` | JWT | 10/min |
| POST | /api/v1/auth/forgot-password | `ForgotPwDto` | `{ message: string }` | Public | 3/hour |
| POST | /api/v1/auth/reset-password | `ResetPwDto` | `{ message: string }` | Public | 3/hour |
| POST | /api/v1/auth/mfa/setup | None | `MfaSetupResponseDto` | JWT | 5/hour |

**Note 1:** User must be authenticated to set up MFA.
**Note 2:** Rate limiting implemented via existing `rateLimit.ts` middleware from WP-03.

### §4.4 Security Requirements
| Requirement | Implementation | Reference |
|-------------|---------------|-----------|
| Password Hashing | Bcrypt cost factor 12 | SATM §4.3 |
| Asymmetric JWT | RS256 with 2048-bit keys | SATM §4.1 |
| Token Revocation | Redis JTI Blacklist | SATM §4.5 |
| MFA Encryption | AES-256-GCM for TOTP secrets | SATM §7.1 |
| No Enumeration | Generic messages for forgot-password | ADS §7.6 |
| RBAC | Permissions matrix middleware | SATM §5.3 |

---

## §5 Manual Steps for Owner

### §5.1 Environment Configuration
The owner must generate RSA keys for JWT signing:
```bash
# Generate private key
openssl genrsa -out private.pem 2048
# Extract public key
openssl rsa -in private.pem -outform PEM -pubout -out public.pem
```
Add content to `.env` as `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` (base64 encoded recommended).

### §5.2 Database Initialization
Verify seed data for roles and permissions:
```bash
# Migrations were applied via Supabase SQL Editor in WP-02
# Verify seeds exist: SELECT * FROM app_auth.roles;
```

---

## §6 Testing Requirements

| Test Type | Coverage Target |
|-----------|-----------------|
| Unit tests | >90% for services |
| Integration tests | Full login/refresh flow |
| Security tests | MFA bypass prevention |
| Security tests | Expired token rejection |

**Note:** Test scenarios defined below. Formal test IDs to be added to TSQS after implementation.

---

## §7 Validation & Done Criteria

### §7.1 Code Quality Checklist
- [ ] Uses Bcrypt for all password operations.
- [ ] RS256 implementation verified against sample token.
- [ ] No `any` types in DTOs or services.
- [ ] Refresh token rotation invalidates old tokens immediately.
- [ ] MFA secret is never logged or returned in plaintext after setup.

### §7.2 Functional Verification
- [ ] Register new user → verify email → status is 'verified'.
- [ ] Login → receive 15-min JWT + 7-day Refresh token.
- [ ] Refresh → receive new JWT + new Refresh token.
- [ ] Login (MFA active) → receive 401/200 MFA challenge → complete MFA → receive tokens.

---

## §8 Handoff

### §8.1 Next Work Package
| WP-ID | Name | Why This Next |
|-------|------|---------------|
| WP-05 | Auth Screens (Frontend) | Depends on backend endpoints. |
| WP-06 | Wallet Module Backend | Depends on User Identity. |

---

## §9 Risks & Blockers
| Risk | Probability | Impact | Mitigation | Owner |
|------|-------------|--------|------------|-------|
| RSA Key configuration error | Medium | High | Provide clear key generation script | Executor |
| Redis connectivity issues | Low | Medium | Ensure fallback to signature-only validation | Executor |
