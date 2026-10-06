# WORK PACKAGE BLUEPRINT: WP-15 Admin Panel Backend APIs

> **Version**: 1.0.0  
> **Created At**: 2026-10-05  
> **Target Package**: `work-packages/WP-15_ADMIN_PANEL_BACKEND_APIS.md`  
> **Status**: Ready for Execution Blueprint  

---

## §1 Work Package Identity

| Field | Value |
|-------|-------|
| **WP-ID** | WP-15 |
| **Name** | Admin Panel Backend APIs |
| **Phase** | Phase 9 (Tasks 9.1–9.8) |
| **Module** | Admin / Compliance / Risk / Reporting |
| **Critical Path** | No (Parallel to Critical Path; prerequisite for Phase 10 Admin UI) |
| **Estimated Effort** | L (5 Story Points / 4–5 Sprints equivalent) |
| **Executor** | AI Agent / Backend Dev |
| **Owner Review Required** | Yes |

---

## §2 Before You Start

### §2.1 Prerequisites (Must Be Complete)

| WP-ID | Name | Status |
|-------|------|--------|
| **WP-01** | Project Scaffolding | ✅ Complete |
| **WP-02** | Database Setup | ✅ Complete |
| **WP-04** | Auth Module Backend | ✅ Complete |
| **WP-05** | User Profile & KYC Backend | ✅ Complete |
| **WP-06** | Wallet Module Backend | ✅ Complete |
| **WP-07** | Payment Module Backend | ✅ Complete |
| **WP-10** | Trading Engine Backend | ✅ Complete |
| **WP-11** | Settlement Worker | ✅ Complete |

> **Rule**: WP-15 requires Phase 2 (Auth & User) to be complete. It reads from and invokes APIs in Auth, Wallet, Payments, Trading, Settlement, and Compliance modules.

### §2.2 Documents to Read

| Document | Sections | Why Needed |
|----------|----------|------------|
| `docs/ProjectAnswers.md` | ALL | Source of truth for business parameters, roles, and project identity |
| `docs/15_MASTER_IMPLEMENTATION_CHECKLIST.md` | §4 (Phase 9, Tasks 9.1–9.8) | Task definitions, dependencies, and exit criteria |
| `docs/11_IMPLEMENTATION_SPECIFICATION.md` | §3.11, §7.9, §11, §12 | Admin Module blueprint, controller/service map, audit jobs |
| `docs/06_DATABASE_DESIGN_SPECIFICATION.md` | §3.2, §5.1, §5.9, §5.30–5.34, §10, §12 | Schema definitions for `admin.*`, `app_auth.users`, ledger, audit logs |
| `docs/07_API_DESIGN_SPECIFICATION.md` | §3.7, §8, §10, §11, §12, §14 | Endpoint specifications, DTO formats, RBAC header rules, rate limits |
| `docs/09_SECURITY_ARCHITECTURE_AND_THREAT_MODEL.md` | §5.3, §6, §12.1–12.2, §13.1 | RBAC Permission matrix, four-eyes principle, hash-chained audit logs |
| `docs/10_INFRASTRUCTURE_AND_DEVOPS_SPECIFICATION.md` | §9.2, §16.3 | Queue naming, read replica routing for heavy reports |
| `docs/14_DEVELOPER_HANDBOOK_AND_CODING_STANDARDS.md` | §5, §15, §16 | Express/TS backend architecture, thin controllers, double-entry safety |

### §2.3 Missing Dependencies Flag

> [!WARNING]
> **MISSING DEPENDENCY NOTICE**:
> Specification documents reference Architecture Decision Records (`ADR-003`, `ADR-009`, `ADR-010`, `ADR-011`, `ADR-012`). However, no `docs/adr/` directory exists in the project tree.
> **Executor Instruction**: Rely on `docs/06_DATABASE_DESIGN_SPECIFICATION.md` (DDS), `docs/07_API_DESIGN_SPECIFICATION.md` (ADS), `docs/09_SECURITY_ARCHITECTURE_AND_THREAT_MODEL.md` (SATM), and `docs/11_IMPLEMENTATION_SPECIFICATION.md` (IMP) as authoritative sources. Never write directly to external module database schemas; route all write operations through owning module services/APIs per SATM §5.2.

### §2.4 Decisions Already Made

Extracted directly from `docs/ProjectAnswers.md`:

| Decision | Value | Source |
|----------|-------|--------|
| **Business Name** | SKIESPRO | `ProjectAnswers.md` §1 |
| **Node.js Version** | 22.x LTS | `ProjectAnswers.md` §2 |
| **Backend Framework** | Express.js | `ProjectAnswers.md` §3 |
| **Language** | TypeScript | `ProjectAnswers.md` §5 |
| **Database Provider** | Supabase (PostgreSQL 15+) | `ProjectAnswers.md` §10 |
| **JWT Expiration** | 15 minutes | `ProjectAnswers.md` §15 |
| **Refresh Token Expiry** | 7 days | `ProjectAnswers.md` §16 |
| **MFA Method** | TOTP (Google Authenticator) | `ProjectAnswers.md` §17 |
| **Access Control** | Role-Based Access Control (RBAC) | `ProjectAnswers.md` §22 |
| **Admin Subdomain** | `admin` | `ProjectAnswers.md` §24 |
| **Payout Ratio** | 60% | `ProjectAnswers.md` §33 |
| **Price Validation Threshold** | Within 5% of previous tick | `ProjectAnswers.md` §37 |
| **Stale Price Threshold** | 30 seconds | `ProjectAnswers.md` §38 |
| **Admin Roles Allowed** | `support`, `finance`, `risk_manager`, `compliance`, `admin`, `super_admin` | `ProjectAnswers.md` §22 & DDS §5.1 |
| **Audit Log Hash Algorithm** | SHA-256 (Cryptographic Hash Chain) | SATM §12.2 & DDS §5.30 |
| **Admin Rate Limit** | 300 requests / minute | ADS §3.7 & IMP §7.9 |
| **Four-Eyes Threshold** | Manual Wallet Adjustments > $500 (or equivalent KES) / Financial Settings | SATM §5.3, IMP §7.9 |

### §2.5 Decisions Pending (Owner Input Required)

| Item | Status | Why Needed | Blocker? |
|------|--------|------------|----------|
| **Primary Domain** (`B1`) | `[PENDING]` | Required for CORS policy, SSL cookies, and callback URLs | No (Use `localhost` / sandbox staging fallback) |
| **Support Email** (`F4`) | `[PENDING]` | Used in support ticket resolution templates & system emails | No (Use `support@skiespro.co.ke` fallback) |
| **Daraja M-Pesa Prod Keys** (`C4-C6`) | `[PENDING]` | Required for live withdrawal disbursements | No (Mock adapter / Sandbox used in dev) |
| **Legal / Compliance Retention** (`E6`) | `[PENDING]` | Default configured to 7 years per spec; needs legal confirmation | No (7-year partition retention applied) |

### §2.6 Secret Handling Rule

> [!CAUTION]
> **NEVER HARDCODE SECRETS, API KEYS, JWT SECRETS, OR PASSWORDS IN SOURCE CODE.**
> - Read `.env.example` for variable names only.
> - Access configuration via `process.env.VAR_NAME` or a dedicated `configService`.
> - Executor must document environment variable additions for the owner.

---

## §3 What You'll Build

### §3.1 Scope

The executor will implement the full backend module for **WP-15: Admin Panel Backend APIs** covering Tasks 9.1–9.8 of Phase 9 in `docs/15_MASTER_IMPLEMENTATION_CHECKLIST.md`:

- [x] **Task 9.1: Admin Authentication & RBAC Middleware** — JWT + TOTP MFA enforcement for admin endpoints, role permission verification middleware (`support`, `finance`, `risk_manager`, `compliance`, `admin`, `super_admin`).
- [x] **Task 9.2: User Management APIs** — Paginated user listing, user detail inspection, account status updates (`active`, `suspended`, `closed`), user ledger history view.
- [x] **Task 9.3: Wallet Oversight & Manual Adjustment APIs** — Platform wallet balance oversight, manual ledger credit/debit adjustments (`POST /api/v1/admin/wallets/adjust`) with mandatory idempotency key, double-entry ledger routing, and four-eyes principle check for adjustments > $500.
- [x] **Task 9.4: Trade Monitoring APIs** — Active exposure monitoring, trade history inspection, trade voiding / manual intervention triggers.
- [x] **Task 9.5: Settlement Oversight APIs** — Failed settlement queue inspection, manual retry trigger, settlement latency metrics.
- [x] **Task 9.6: Risk Controls & Platform Parameter Overrides** — Risk dashboard metrics, per-asset exposure breakdown, asset payout rate & trading limit updates (`PUT /api/v1/admin/risk/asset-config/:symbol`).
- [x] **Task 9.7: Compliance & KYC Review APIs** — Pending KYC queue retrieval, KYC document detail inspection, KYC approval/rejection endpoint (`PUT /api/v1/admin/kyc/:id/review`).
- [x] **Task 9.8: Reporting, Analytics & Audit Logging** — Daily revenue summary, trade volume reports, user registration analytics, settlement performance, audit log search API (`GET /api/v1/admin/audit-logs`), and daily hash-chain verification scheduled job (`AuditChainVerification`).
- [x] **Support Ticket Management APIs** — Listing, reading, and updating support ticket status/responses.

### §3.2 Out of Scope

- [ ] Admin Portal Frontend UI screens (Handled in **WP-14** / **WP-20** Admin Frontend UI).
- [ ] Third-party automated KYC integration SDKs (SumSub provider adapters handled in Compliance Module).
- [ ] Production deployment orchestration (Handled in Phase 11).

### §3.3 Deliverables

| Deliverable | Format | Location |
|-------------|--------|----------|
| Admin Controllers (9 controllers) | TypeScript | `backend/src/modules/admin/controllers/` |
| Admin Services (9 services) | TypeScript | `backend/src/modules/admin/services/` |
| Admin Repositories (3 repositories) | TypeScript | `backend/src/modules/admin/repositories/` |
| Admin DTOs & Validation Schemas | TypeScript (Zod/Joi) | `backend/src/modules/admin/dtos/` |
| Admin RBAC & Audit Middleware | TypeScript | `backend/src/modules/admin/middleware/` |
| Hash-Chain Audit Verification Job | TypeScript | `backend/src/modules/admin/jobs/auditChainVerification.job.ts` |
| Admin SQL Migration (Schema & Views) | SQL | `backend/src/database/migrations/035_admin_schema_and_views.sql` |
| Unit & Integration Test Suite | TypeScript (Jest) | `backend/src/modules/admin/tests/` |

---

## §4 Technical Specification

### §4.1 Architecture

The Admin Module follows the standard layered pattern defined in `DHCS §5`:

```mermaid
graph TD
    Client[Admin Frontend / Postman] -->|HTTP / Request| Router[Express Router /api/v1/admin/*]
    Router --> AuthMw[AdminAuthMiddleware JWT + MFA]
    AuthMw --> RbacMw[RBACPermissionMiddleware]
    RbacMw --> RateMw[RateLimitMiddleware 300 req/min]
    RateMw --> AuditMw[AuditLoggingMiddleware]
    AuditMw --> Ctrl[Admin Controllers]
    Ctrl --> Svc[Admin Services]
    
    Svc -->|Read queries| Views[Admin Database Views / Read Replica]
    Svc -->|Write operations| ModuleAPIs[Owning Module Services Auth/Wallet/Trading/Compliance]
    Svc -->|Log actions| AuditRepo[AuditLogRepository]
    
    ModuleAPIs --> Outbox[Outbox Event Table]
    AuditRepo --> AuditTable[admin.audit_logs Hash-Chained]
```

Key Architectural Principles:
1. **Thin Controllers, Rich Services**: Controllers parse input, pass DTOs to services, and return standardized JSON responses.
2. **No Direct Schema Mutating Bypasses**: Per SATM §5.2 and ADR-009, write operations on user balances or KYC status MUST call the respective domain service (e.g., `WalletService.createAdminAdjustment()`, `KYCService.reviewDocument()`), ensuring domain validation, outbox events, and ledger invariants are preserved.
3. **Immutable Audit Chain**: Every write endpoint automatically records an entry in `admin.audit_logs` with SHA-256 hash chaining (`entry_hash = SHA256(previous_entry_hash + actor_id + action + details + created_at)`).

### §4.2 RBAC Middleware & Security Rules

Permission Enforcement Matrix (from `SATM §5.3`):

| Admin Action | Target Route | Required Roles | Special Rules |
|--------------|--------------|----------------|---------------|
| List / View Users | `GET /api/v1/admin/users*` | `admin`, `super_admin` | Paginated |
| Change User Status | `PUT /api/v1/admin/users/:id/status` | `admin`, `super_admin` | Reason required, audit logged |
| View User Ledger | `GET /api/v1/admin/users/:id/ledger` | `finance`, `admin`, `super_admin` | Read-only |
| List Pending KYC | `GET /api/v1/admin/kyc/pending` | `compliance`, `admin`, `super_admin` | — |
| Review KYC | `PUT /api/v1/admin/kyc/:id/review` | `compliance`, `admin`, `super_admin` | Reason required |
| List Pending Withdrawals | `GET /api/v1/admin/withdrawals/pending` | `finance`, `admin`, `super_admin` | — |
| Approve/Reject Withdrawal | `PUT /api/v1/admin/withdrawals/:id/approve` | `finance`, `admin`, `super_admin` | Generates outbox disbursement event |
| View Risk Dashboard | `GET /api/v1/admin/risk/*` | `risk_manager`, `admin`, `super_admin` | — |
| Update Asset Config | `PUT /api/v1/admin/risk/asset-config/:symbol` | `risk_manager`, `admin`, `super_admin` | Four-eyes check if payout ratio modified |
| Platform Settings | `GET/PUT /api/v1/admin/settings*` | `admin`, `super_admin` | Four-eyes check for financial params |
| Reports & Analytics | `GET /api/v1/admin/reports/*` | `finance`, `admin`, `super_admin` | Executed against read replica |
| Search Audit Logs | `GET /api/v1/admin/audit-logs` | `compliance`, `admin`, `super_admin` | Immutable log search |
| Support Tickets | `GET/PUT /api/v1/admin/support/tickets*` | `support`, `admin`, `super_admin` | Status transition validation |
| Manual Wallet Adjust | `POST /api/v1/admin/wallets/adjust` | `super_admin` ONLY | **Four-eyes principle** if amount > $500; requires `Idempotency-Key` header |

### §4.3 Database Schemas & Referenced Tables

Tables owned by Admin Module (Schema `admin`):

| Table | Purpose | Key Columns | Constraints |
|-------|---------|-------------|-------------|
| `admin.audit_logs` | Cryptographic hash-chained audit log | `id` (BIGSERIAL), `entry_hash` (VARCHAR 64), `previous_entry_hash` (VARCHAR 64), `actor_id` (UUID), `action` (VARCHAR 100), `affected_entity` (VARCHAR 50), `entity_id` (UUID), `details` (JSONB), `ip_address` (INET), `user_agent` (TEXT), `created_at` (TIMESTAMPTZ) | PK (`id`), INSERT-only (RLS blocks UPDATE/DELETE), Index on `created_at`, `actor_id`, `(affected_entity, entity_id)` |
| `admin.admin_actions` | Track four-eyes approval workflows | `id` (UUID), `admin_id` (UUID), `action_type` (VARCHAR 50), `target_user_id` (UUID), `details` (JSONB), `requires_approval` (BOOL), `approved_by` (UUID), `approved_at` (TIMESTAMPTZ), `created_at` (TIMESTAMPTZ) | PK (`id`), FK to `app_auth.users` |
| `admin.support_tickets` | User support ticket tracking | `id` (UUID), `user_id` (UUID), `subject` (VARCHAR 255), `status` (VARCHAR 20), `priority` (VARCHAR 10), `assigned_to` (UUID), `created_at`, `resolved_at` | PK (`id`), FK to `app_auth.users`, Status CHECK |
| `admin.system_jobs` | Background job state & health tracking | `id` (UUID), `job_name`, `status`, `last_run_at`, `next_run_at`, `error_details` (JSONB) | PK (`id`) |

External Tables Read/Modified via Owning Services:
- `app_auth.users` — Status updates (`active`, `suspended`, `closed`), role inspection.
- `wallet.wallets` & `wallet.ledger_entries` — Balance oversight & manual adjustment entries.
- `compliance.kyc_documents` — KYC review status updates.
- `payments.withdrawals` — Withdrawal manual approval / rejection.
- `trading.contracts` — Trade monitoring & voiding.

### §4.4 API Endpoints Specification

All endpoints are prefixed with `/api/v1/admin` and require JWT authentication + active Admin MFA session.

| Method | Path | Request DTO | Response DTO | Required RBAC Role | Rate Limit |
|--------|------|-------------|--------------|-------------------|------------|
| `GET` | `/users` | Query: `page`, `per_page`, `status`, `search` | `PaginatedUsersResponseDto` | `admin`, `super_admin` | 300/min |
| `GET` | `/users/:id` | Params: `id` | `UserDetailsResponseDto` | `admin`, `super_admin` | 300/min |
| `PUT` | `/users/:id/status` | `UpdateUserStatusDto` (`status`, `reason`) | `UserStatusUpdatedDto` | `admin`, `super_admin` | 300/min |
| `GET` | `/users/:id/ledger` | Params: `id`, Query: `page`, `per_page` | `PaginatedLedgerResponseDto` | `finance`, `admin`, `super_admin` | 300/min |
| `GET` | `/kyc/pending` | Query: `page`, `per_page` | `PaginatedKycPendingDto` | `compliance`, `admin`, `super_admin` | 300/min |
| `GET` | `/kyc/:id` | Params: `id` | `KycDetailResponseDto` | `compliance`, `admin`, `super_admin` | 300/min |
| `PUT` | `/kyc/:id/review` | `ReviewKycDto` (`action`, `note`) | `KycReviewResultDto` | `compliance`, `admin`, `super_admin` | 300/min |
| `GET` | `/withdrawals/pending` | Query: `page`, `per_page` | `PaginatedWithdrawalsDto` | `finance`, `admin`, `super_admin` | 300/min |
| `GET` | `/withdrawals/:id` | Params: `id` | `WithdrawalDetailDto` | `finance`, `admin`, `super_admin` | 300/min |
| `PUT` | `/withdrawals/:id/approve` | `ApproveWithdrawalDto` (`note`) | `WithdrawalActionResultDto` | `finance`, `admin`, `super_admin` | 300/min |
| `PUT` | `/withdrawals/:id/reject` | `RejectWithdrawalDto` (`reason`) | `WithdrawalActionResultDto` | `finance`, `admin`, `super_admin` | 300/min |
| `GET` | `/risk/dashboard` | None | `RiskDashboardOverviewDto` | `risk_manager`, `admin`, `super_admin` | 300/min |
| `GET` | `/risk/exposure` | None | `AssetExposureListDto` | `risk_manager`, `admin`, `super_admin` | 300/min |
| `PUT` | `/risk/asset-config/:symbol` | `UpdateAssetConfigDto` (`payout_rate`, `min_stake`, `max_stake`) | `AssetConfigUpdatedDto` | `risk_manager`, `admin`, `super_admin` | 300/min |
| `GET` | `/settings` | None | `PlatformSettingsListDto` | `admin`, `super_admin` | 300/min |
| `GET` | `/settings/:key` | Params: `key` | `PlatformSettingItemDto` | `admin`, `super_admin` | 300/min |
| `PUT` | `/settings` | `UpdateSettingsDto` (`key`, `value`, `reason`) | `SettingUpdatedResultDto` | `admin`, `super_admin` | 300/min |
| `GET` | `/reports/daily-revenue` | Query: `date_from`, `date_to`, `format` | `DailyRevenueReportDto` | `finance`, `admin`, `super_admin` | 300/min |
| `GET` | `/reports/trade-volume` | Query: `date_from`, `date_to`, `format` | `TradeVolumeReportDto` | `finance`, `admin`, `super_admin` | 300/min |
| `GET` | `/reports/user-registrations` | Query: `date_from`, `date_to` | `UserRegistrationsReportDto` | `admin`, `super_admin` | 300/min |
| `GET` | `/reports/settlement-performance` | Query: `date_from`, `date_to` | `SettlementPerformanceReportDto` | `admin`, `super_admin` | 300/min |
| `GET` | `/audit-logs` | Query: `actor_id`, `action`, `affected_entity`, `date_from`, `date_to`, `page`, `per_page` | `PaginatedAuditLogsResponseDto` | `compliance`, `admin`, `super_admin` | 300/min |
| `GET` | `/support/tickets` | Query: `status`, `priority`, `page`, `per_page` | `PaginatedTicketsDto` | `support`, `admin`, `super_admin` | 300/min |
| `GET` | `/support/tickets/:id` | Params: `id` | `TicketDetailDto` | `support`, `admin`, `super_admin` | 300/min |
| `PUT` | `/support/tickets/:id` | `UpdateTicketDto` (`status`, `response`, `assigned_to`) | `TicketUpdatedDto` | `support`, `admin`, `super_admin` | 300/min |
| `POST` | `/wallets/adjust` | `AdjustWalletDto` (`user_id`, `amount`, `type`, `reason`) + Header: `Idempotency-Key` | `WalletAdjustmentResultDto` | `super_admin` ONLY | 60/min |

### §4.5 Security Requirements & Audit Logging

1. **Authentication & Authorization**:
   - Every request must present a valid Bearer JWT.
   - User claims must include a valid administrative role (`support`, `finance`, `risk_manager`, `compliance`, `admin`, `super_admin`).
   - MFA requirement: JWT payload must indicate `mfa_verified: true`.
2. **Cryptographic Hash Chaining**:
   - When an audit log entry $N$ is created:
     $$\text{entry\_hash}_N = \text{SHA256}(\text{previous\_entry\_hash}_{N-1} \parallel \text{actor\_id} \parallel \text{action} \parallel \text{affected\_entity} \parallel \text{details\_json} \parallel \text{created\_at})$$
   - Daily job `AuditChainVerification` iterates through the partition verifying $\text{entry\_hash}_N$. If mismatch found $\rightarrow$ trigger Critical alert (SATM §12.3).
3. **Four-Eyes Approval Workflow**:
   - For `POST /api/v1/admin/wallets/adjust` with amount > $500 (or equivalent KES 65,000):
     - Action is saved to `admin.admin_actions` with `requires_approval = TRUE`, status `pending`.
     - Executing admin receives status `pending_second_approval`.
     - Second admin with `super_admin` role calls `PUT /api/v1/admin/actions/:id/approve` to release funds.

---

## §5 Manual Steps for Owner

### §5.1 Database Setup / Seeding Initial Super Admin

The owner must run this SQL script in Supabase SQL Editor to seed the initial Super Admin account and RBAC roles:

```sql
-- Step 1: Ensure admin schema and audit table exist
CREATE SCHEMA IF NOT EXISTS admin;

-- Step 2: Seed initial Super Admin user in app_auth.users if not existing
-- Email confirmed from ProjectAnswers.md §A3: its.phestone@gmail.com
INSERT INTO app_auth.users (id, email, encrypted_password, role, status, email_confirmed_at, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'its.phestone@gmail.com',
  '$2a$12$eImiTXuWVxfM37uY4JANjO5E/8vM6nI5K0m6pGv9zZJ1K5wP4g6.e', -- Temporary default: Change immediately!
  'super_admin',
  'active',
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET 
  role = 'super_admin',
  updated_at = NOW();

-- Step 3: Grant permissions to app_admin role
GRANT USAGE ON SCHEMA admin TO app_admin;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA admin TO app_admin;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_admin;
```

### §5.2 Environment Configuration

Add the following variables to `.env`:

```bash
# Admin Panel Security Configuration
ADMIN_JWT_SECRET=super_secret_admin_jwt_key_change_in_production
ADMIN_MFA_ENFORCED=true
ADMIN_FOUR_EYES_THRESHOLD_USD=500.00
ADMIN_RATE_LIMIT_RPM=300

# Dedicated Admin DB Connection (Reserve Pool)
ADMIN_DATABASE_URL=postgresql://app_admin:password@localhost:5432/skiespro?sslmode=disable
```

### §5.3 Verification Steps

Run the following commands to verify admin backend APIs:

```bash
# 1. Run unit & integration test suite for Admin module
npm run test backend/src/modules/admin/tests

# 2. Run audit chain verification check manually
npx ts-node backend/src/modules/admin/jobs/runAuditVerification.ts

# 3. Test non-admin authorization rejection (Expect 403 Forbidden)
curl -X GET http://localhost:3000/api/v1/admin/users \
  -H "Authorization: Bearer USER_ROLE_JWT_TOKEN"
```

---

## §6 Testing Requirements

| Test Type | Coverage Target | Specific Test Scenarios |
|-----------|-----------------|-------------------------|
| **Unit Tests** | > 85% | - DTO validation logic (invalid status, missing reason).<br>- `AuditService` SHA-256 hash generation & verification.<br>- Four-eyes threshold evaluation ($500 trigger). |
| **Integration Tests** | Key Flows | - `PUT /api/v1/admin/users/:id/status` updates user status and inserts `admin.audit_logs` record.<br>- `POST /api/v1/admin/wallets/adjust` creates double-entry ledger record and updates user wallet balance.<br>- Four-eyes workflow: adjustment > $500 enters `pending` state until second super_admin approves. |
| **API / Security Tests** | All Endpoints | - Trader JWT blocked with `403 Forbidden` on all `/api/v1/admin/*` routes.<br>- Request missing `Idempotency-Key` on `/wallets/adjust` rejected with `400 Bad Request`.<br>- Rate limiting blocks requests exceeding 300 req/min. |
| **Hash Chain Verification** | Audit Integrity | - Simulate audit log tampering (update `details` in DB) $\rightarrow$ `AuditChainVerification` job flags `CHAIN_BROKEN`. |

---

## §7 Validation & Done Criteria

### §7.1 Code Quality Checklist

- [ ] All code written in TypeScript, strictly adhering to `DHCS §5` standards.
- [ ] Controllers are thin and handle HTTP concerns only (`DHCS §4.1`).
- [ ] Services carry domain logic and execute within database transactions where applicable.
- [ ] Every admin write operation triggers an immutable `admin.audit_logs` entry.
- [ ] No direct database writes to other module tables; all changes invoke owning module domain services.
- [ ] DTO inputs validated using Zod / Joi validators.
- [ ] No secrets or hardcoded credentials present in source files (`§2.6`).

### §7.2 Functional Verification

- [ ] Admin authentication and role-based access control verified for all 6 roles.
- [ ] User status management, KYC review, and withdrawal approvals functional.
- [ ] Risk dashboard and asset configuration override operational.
- [ ] Manual wallet adjustment enforces idempotency and four-eyes principle for amounts > $500.
- [ ] Reports query read-replica views cleanly.
- [ ] Audit log cryptographic hash chain validation passes cleanly.

### §7.3 Owner Sign-Off

| Check | Verified By | Date |
|-------|-------------|------|
| Admin APIs functional end-to-end | [Owner Name] | YYYY-MM-DD |
| Manual database seeding completed | [Owner Name] | YYYY-MM-DD |
| Staging environment endpoints verified | [Owner Name] | YYYY-MM-DD |

---

## §8 Handoff

### §8.1 Next Work Packages

| WP-ID | Name | Why This Next |
|-------|------|---------------|
| **WP-14 / WP-20** | Admin Frontend UI | Consumes all `/api/v1/admin/*` endpoints built in WP-15 to render the Admin Portal interface. |
| **WP-12** | Notifications Module Backend | Receives outbox events (`WithdrawalApproved`, `UserSuspended`, `KYCApproved`) to dispatch user notifications. |

### §8.2 Handoff Notes

- The Admin Panel APIs rely on standard JWT payload claims: `{ sub: userId, role: 'super_admin'|'admin'|..., mfa_verified: true }`.
- Ensure frontend clients include `Idempotency-Key: <UUID>` header when calling `POST /api/v1/admin/wallets/adjust`.
- Heavy report queries (daily revenue, trade volume) should connect to the read replica pool `ADMIN_DATABASE_URL` to protect live trading performance.

---

## §9 Risks & Blockers

| Risk | Probability | Impact | Mitigation | Owner |
|------|-------------|--------|------------|-------|
| **Audit log hash chain break due to concurrent inserts** | Medium | High | Use sequential ID assignment (`BIGSERIAL`) and database row-level locking / atomic sequence for `previous_entry_hash` computation. | Tech Lead |
| **Direct DB edits bypassing audit trail** | Low | High | Restrict DB permissions (`GRANT INSERT ON admin.audit_logs TO app_admin`; revoke `UPDATE`/`DELETE`). Enforce RLS. | DevOps |
| **Double payout on manual withdrawal approval** | Medium | Critical | Approval endpoint checks withdrawal state via Compare-And-Swap (`status = 'pending' -> 'approved'`) before emitting event. | Backend Lead |

---

## §10 Change Log

| Date | Change | By |
|------|--------|----|
| 2026-10-05 | Created complete WP-15 blueprint based on Master Implementation Checklist Phase 9 (Tasks 9.1–9.8) and project specifications. | Antigravity AI |

---

## §11 Final Checklist

- [x] All prerequisites verified.
- [x] All owner decisions extracted from `ProjectAnswers.md`.
- [x] All missing dependencies (`ADR` files) flagged clearly.
- [x] Complete technical specification & endpoint table provided.
- [x] Security rules and RBAC matrix fully defined.
- [x] Manual database setup script included.
- [x] Next work packages identified.
