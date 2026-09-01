# Database Design Deviations (MVP)

**Purpose:** Documents accepted deviations from the Database Design Specification (DDS) for MVP release.  
**Date:** 2026-08-01  
**Status:** Accepted for MVP - Will be addressed in future iterations

---

## Overview

The following deviations from `docs/06_DATABASE_DESIGN_SPECIFICATION.md` have been accepted for the MVP release. These are non-critical deviations that do not affect core functionality but should be addressed in future work packages.

---

## Accepted Deviations

### 1. Column Type Differences

| Table | Column | DDS Type | Migration Type | Impact | Future Action |
|-------|--------|----------|-----------------|--------|---------------|
| `app_auth.roles` | `id` | SMALLSERIAL | UUID | LOW - Works but less efficient | Address in WP-03 if needed |
| `app_auth.permissions` | `id` | SMALLSERIAL | UUID | LOW - Works but less efficient | Address in WP-03 if needed |
| `wallet.ledger_entries` | `id` | BIGSERIAL | UUID | LOW - Works but less efficient for high-volume tables | Address in WP-04 if needed |

**Rationale:** UUIDs are more portable for distributed systems and easier to work with in application code. SMALLSERIAL/BIGSERIAL are more efficient but require sequence management. For MVP, UUIDs are acceptable.

---

### 2. Column Name Differences (Not Fixed)

| Table | DDS Name | Migration Name | Impact | Future Action |
|-------|----------|-----------------|--------|---------------|
| `app_auth.users` | `display_name` | `display_name` | NONE - Fixed in migration 022 | - |
| `trading.binary_contracts` | `contract_type` | `contract_type` | NONE - Fixed in migration 022 | - |
| `trading.binary_contracts` | `stake` | `stake` | NONE - Fixed in migration 022 | - |
| `trading.binary_contracts` | `payout_rate` | `payout_rate` | NONE - Fixed in migration 022 | - |
| `trading.binary_contracts` | `purchase_time` | `purchase_time` | NONE - Fixed in migration 022 | - |
| `app_auth.users` | `status` | `status` | NONE - Added in migration 019 | - |
| `app_auth.users` | `kyc_status` enum | `kyc_status` enum | MEDIUM - Different enum values | Update enum values in WP-03 |
| `app_auth.sessions` | `access_token_jti` | `access_token_jti` | NONE - Added in migration 019 | - |
| `app_auth.sessions` | `token_hash` | `token_hash` | LOW - Different name, same purpose | Consider renaming in WP-03 |
| `app_auth.user_roles` | `granted_at` | `granted_at` | NONE - Fixed in migration 022 | - |
| `app_auth.role_permissions` | `id` (surrogate) | `id` (UUID) | LOW - Unnecessary column | Remove in WP-03, use composite PK |

---

### 3. Enum Value Differences

| Table | Column | DDS Values | Migration Values | Impact | Future Action |
|-------|--------|------------|------------------|--------|---------------|
| `app_auth.users.kyc_status` | `kyc_status` | unverified/pending/verified/rejected | unverified/pending/verified/rejected | NONE - Fixed in migration 024 | - |
| `trading.binary_contracts.status` | `status` | draft/active/settling/won/lost/draw/cancelled/archived | active/settling/won/lost/draw/cancelled | MEDIUM - Missing 'draft' and 'archived' | Update in WP-05 |
| `trading.contract_events.event_type` | `event_type` | created/stake_locked/expired/settling_acquired/settled/won/lost/draw/cancelled/archived | created/price_update/extended/settled/cancelled | MEDIUM - Different event types | Update in WP-05 |
| `pricing.candles.granularity_seconds` | `granularity_seconds` | 60/300/900/3600/86400 | Any positive integer | LOW - Less restrictive | Already fixed in migration 021 |

---

### 4. Missing Columns (Non-Critical)

| Table | Column | DDS Spec | Impact | Future Action |
|-------|--------|----------|--------|---------------|
| `app_auth.sessions` | `device_info` | JSONB | LOW - Device tracking | Add in WP-03 if needed |
| `trading.contract_events` | `details` | JSONB | NONE - Fixed in migration 022 | - |
| `pricing.candles` | `tick_count` | INTEGER | LOW - Charting metadata | Add in WP-06 if needed |
| `reporting.daily_revenue_summary` | `trade_count` | BIGINT | LOW - Reporting metric | Already fixed in migration 019 |

---

### 5. Schema Name Deviation

| Schema | DDS Name | Migration Name | Status |
|--------|----------|-----------------|--------|
| Auth | `auth` | `app_auth` | **INTENTIONAL** - Renamed to avoid Supabase conflict |

**Rationale:** Supabase reserves the `auth` schema for its built-in authentication system. Our custom auth schema was renamed to `app_auth` to prevent conflicts. This is documented in migration 001 and all foreign key references are updated accordingly.

---

### 6. Index Strategy Deviations

| Index | DDS Spec | Migration Status | Impact |
|-------|----------|------------------|--------|
| `audit_logs` partitioning | By quarter on `created_at` | Not implemented | LOW - Acceptable for MVP |
| `price_ticks` partitioning | By month on `tick_time` | Not implemented | LOW - Acceptable for MVP |
| `ledger_entries` partitioning | By month on `created_at` | Not implemented | LOW - Acceptable for MVP |

**Rationale:** Partitioning is a performance optimization for high-volume tables. For MVP with expected low to moderate volume, partitioning is not necessary and adds complexity. Will be implemented when volume scales.

---

### 7. Constraint Deviations

| Table | Constraint | DDS Spec | Migration Status | Impact |
|-------|------------|----------|------------------|--------|
| `app_auth.role_permissions` | Primary Key | Composite (role_id, permission_id) | Surrogate UUID `id` | LOW - Works but deviates |
| `wallet.wallets` | `available_balance` | Computed column | Generated column added in 021 | NONE - Fixed |

---

## Migration History

The following migrations were created to address critical deviations:

- **Migration 019:** Added critical missing columns (status, mfa_enabled, referral_code, etc.)
- **Migration 020:** Fixed seed data values (deposit/withdrawal limits, payout ratio, etc.)
- **Migration 021:** Added missing CHECK constraints, UNIQUE constraints, and indexes
- **Migration 022:** Renamed misnamed columns to match DDS (full_name → display_name, etc.)

---

## Future Work Package Actions

### WP-03 (Auth Module)
- Update `app_auth.users.kyc_status` enum values to match DDS
- Consider removing `app_auth.role_permissions.id` and using composite PK
- Add `app_auth.sessions.device_info` if device tracking is needed

### WP-04 (Wallet Module)
- Consider changing `wallet.ledger_entries.id` from UUID to BIGSERIAL for performance
- Implement partitioning on `wallet.ledger_entries` if volume scales

### WP-05 (Trading Module)
- Update `trading.binary_contracts.status` enum to include 'draft' and 'archived'
- Update `trading.contract_events.event_type` enum to match DDS

### WP-06 (Pricing Module)
- Add `pricing.candles.tick_count` if needed for charting

### WP-09 (Admin Module)
- Implement partitioning on `admin.audit_logs` by quarter

---

## Risk Assessment

| Risk Category | Level | Mitigation |
|---------------|-------|------------|
| Data Integrity | LOW | All critical constraints and foreign keys are in place |
| Performance | LOW | UUIDs are acceptable for MVP volume; partitioning deferred |
| Application Compatibility | LOW | Application code uses migration column names; no breaking changes |
| Future Migration | MEDIUM | Some column type changes (UUID → SMALLSERIAL) will require data migration |

---

## Conclusion

The accepted deviations are non-critical and do not prevent the MVP from functioning correctly. All critical issues (missing columns, wrong seed values, missing constraints) have been addressed in migrations 019-022. The remaining deviations are documented here for future reference and will be addressed in subsequent work packages as needed.

**Next Steps:**
1. Run migrations 019-022 in development environment
2. Verify all constraints and indexes are created correctly
3. Update application code to use new column names (if any)
4. Proceed to WP-03 (Auth Module) development

---

## 4. Hardening Enhancements (Post-Audit)

| Area | Deviation | Reason |
| :--- | :--- | :--- |
| `trading.binary_contracts` | Financial fields as Strings | Prevents floating-point rounding errors (Micro-shaving exploits). |
| `Logic` | Server-side Timestamping | Removed trust in client `requestTimestamp` to prevent Latency Arbitrage. |
| `Logic` | Oracle Gap Refund | Automatic `cancelled` status and refund if price feed is stale (>10s). |
| `Logic` | Locked Exposure Check | Moved exposure validation inside the database transaction with explicit row-locking to prevent burst-overexposure. |
| `Monitoring` | Infrastructure Only | Prometheus/Grafana infrastructure is provisioned but application-level telemetry is deferred to Phase 11. |

---

**Document Owner:** Database Team  
**Last Updated:** 2026-08-01  
**Next Review:** After WP-03 completion
