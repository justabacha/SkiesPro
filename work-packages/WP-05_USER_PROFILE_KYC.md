# Work Package: WP-05 User Profile & KYC (Stripped MVP)

## §1 Work Package Identity

| Field | Value |
|-------|-------|
| **WP-ID** | WP-05 |
| **Name** | User Profile & KYC (MVP) |
| **Phase** | Phase 2 (User Management) |
| **Module** | User |
| **Critical Path** | Yes |
| **Estimated Effort** | 3 |
| **Executor** | Backend Developer / AI Agent |
| **Owner Review Required** | Yes |

---

## §2 Before You Start

### §2.1 Prerequisites (Must Be Complete)
| WP-ID | Name | Status |
|-------|------|--------|
| WP-04 | Auth Module Backend | ✅ Complete |

### §2.2 Documents to Read
| Document | Sections | Why Needed |
|----------|----------|------------|
| docs/ProjectAnswers.md | ALL | Source of truth for business rules (KYC requirements). |
| docs/11_IMPLEMENTATION_SPECIFICATION.md | §7.2 | User module blueprint. |
| docs/06_DATABASE_DESIGN_SPECIFICATION.md | §5.1 | User schema and tables. |
| docs/07_API_DESIGN_SPECIFICATION.md | §9 | User/Profile API definitions. |
| docs/14_DEVELOPER_HANDBOOK_AND_CODING_STANDARDS.md | §5 | Backend coding standards. |

### §2.3 Decisions Already Made
| Decision | Value | Source |
|----------|-------|--------|
| KYC Provider | SumSub (Deferred for MVP) | ProjectAnswers.md #35 |
| KYC required for trading | **false** (MVP) | ProjectAnswers.md |
| KYC required for withdrawal | **true** | ProjectAnswers.md |
| KYC Statuses | unverified, pending, verified, rejected | Migration 024 / DDS |

### §2.4 Decisions Pending
| Item | Status | Why Needed | Blocker? |
|------|--------|------------|----------|
| Avatar Storage | `[PENDING]` | Storage for user profile images | No (Skip for MVP or use URL string) |

### §2.5 Secret Handling Rule
**NEVER hardcode secrets.** Use `process.env.VAR_NAME`.

---

## §3 What You'll Build

### §3.1 Scope (STRIPPED MVP)
Implementation of a simplified User Profile and KYC tracking system:

- [ ] **Database Column**: Add `avatar_url` to `app_auth.users` table.
- [ ] **Get Profile**: `GET /api/v1/users/profile` — returns authenticated user's data (email, display_name, phone, avatar_url, kyc_status).
- [ ] **Update Profile**: `PUT /api/v1/users/profile` — allows updating `display_name`, `phone`, and `avatar_url`.
- [ ] **Get KYC Status**: `GET /api/v1/users/kyc/status` — returns current KYC status string.
- [ ] **Initiate KYC**: `POST /api/v1/users/kyc/initiate` — transition status from `unverified` to `pending`. Logs the initiation.

### §3.2 Out of Scope (MVP)
- Document uploads (ID cards, passports, etc.).
- Integration with SumSub or any external KYC service.
- Admin dashboard for KYC review (handled in WP-09).
- Automatic identity verification.

### §3.3 Deliverables
| Deliverable | Format | Location |
|-------------|--------|----------|
| Database Migration | SQL File | `migrations/025_add_avatar_url.sql` |
| User Module Code | TypeScript Files | `src/modules/user/` |
| Repository Update | TypeScript Files | `src/modules/auth/repositories/userRepository.ts` |
| DTOs & Validators | TypeScript Files | `src/modules/user/dto/` |
| Unit & Integration Tests | Jest Files | `tests/user/` |

---

## §4 Technical Specification

### §4.1 Architecture
- **Pattern**: [Controller → Service → Repository].
- **Middleware**: Use `authenticate` from `authMiddleware.ts` to ensure all requests are JWT-authorized.

### §4.2 Database
Reference **DDS §5.1**.
- Table: `app_auth.users`.
- Columns to use: `id`, `email`, `display_name`, `phone`, `avatar_url` (new), `kyc_status`.

### §4.3 API Endpoints
Reference **ADS §8** & **ADS §15**.

| Method | Path | Request DTO | Response | Auth | Rate Limit |
|--------|------|-------------|----------|------|------------|
| GET | /api/v1/users/profile | None | `ProfileResponseDto` | JWT | 60/min |
| PUT | /api/v1/users/profile | `UpdateProfileDto` | `ProfileResponseDto` | JWT | 10/min |
| GET | /api/v1/users/kyc/status | None | `KycStatusDto` | JWT | 60/min |
| POST | /api/v1/users/kyc/initiate | None | `KycStatusDto` | JWT | 5/hour |

### §4.4 Security Requirements
- **Owner-Only**: Users must only be able to view and update their own profile (enforced via `req.user.sub` from JWT).
- **Validation**: `display_name` (2-100 chars), `phone` (valid E.164 if provided).

---

## §5 Manual Steps for Owner

### §5.1 Database Migration
The executor will provide `migrations/025_add_avatar_url.sql`. You must run it in the Supabase SQL Editor.

---

## §6 Testing Requirements

| Test Type | Coverage Target |
|-----------|-----------------|
| Unit tests | Service logic for status transitions |
| Integration tests | Profile CRUD operations |
| Security tests | Verify user A cannot update user B's profile |

---

## §7 Validation & Done Criteria

### §7.1 Code Quality Checklist
- [ ] No direct database queries in controllers.
- [ ] Profile updates correctly sanitize input.
- [ ] KYC initiation only works if status is `unverified` or `rejected`.

### §7.2 Functional Verification
- [ ] Call `GET /profile` → verify all fields return correctly.
- [ ] Call `PUT /profile` → verify `display_name` changes.
- [ ] Call `POST /kyc/initiate` → verify status becomes `pending`.

---

## §8 Handoff

### §8.1 Next Work Package
| WP-ID | Name | Why This Next |
|-------|------|---------------|
| WP-06 | Wallet Module Backend | Needs user identity and KYC status (for withdrawals). |

---

## §9 Risks & Blockers
| Risk | Probability | Impact | Mitigation | Owner |
|------|-------------|--------|------------|-------|
| Avatar Storage missing | Low | Low | Use external URL strings for MVP | Executor |
