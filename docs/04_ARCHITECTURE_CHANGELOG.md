# Architecture Change Log
## Project: Independent Online Binary Trading Platform

---

## Version 1.1 — 2026-07-22

### Overview

Version 1.1 addresses five Critical (P0), three High Priority (P1), and five Medium Priority (P2) findings from the Independent Architecture Review (docs/05_ARCHITECTURE_REVIEW.md).

---

## Change 1: Settlement Atomicity — Atomic Compare-And-Swap Status Transition

| Field | Detail |
| :--- | :--- |
| **Review Reference** | CR-001 / R-001 |
| **Problem** | The previous settlement idempotency mechanism used a read-then-write pattern (check contract status, then process, then update). Under concurrent worker dequeue, Worker A and Worker B could both read "Active", both process, and both credit the user — causing double-settlement. |
| **Previous Design** | Settlement Worker reads contract status → processes outcome → updates status. Idempotency was "check status before processing" without atomicity. |
| **New Design** | Settlement Worker executes an atomic `UPDATE contracts SET status = 'Settling' WHERE id = ? AND status = 'Active'` as the first operation. If the affected row count is 0, the job is a duplicate and is discarded. Only after acquiring the `Settling` status does the worker proceed with financial operations. On success, status transitions to `Won`/`Lost`/`Draw`. On failure after partial processing, the job is dead-lettered for manual review. |
| **Benefits** | Eliminates the check-then-act race condition. Guarantees exactly-once settlement. No distributed lock required. |
| **Trade-offs** | Adds a `Settling` intermediate state to the Contract entity lifecycle. Failed settlements after financial operations require manual reconciliation via dead-letter queue. |
| **Diagram Impact** | Settlement sequence diagram updated to show atomic status acquisition as step 1, before any financial operation. Contract state machine updated to include `Settling`. |

---

## Change 2: Price Authority — Persistent Time-Indexed Price Store

| Field | Detail |
| :--- | :--- |
| **Review Reference** | CR-002 / R-002 |
| **Problem** | Redis `price:{symbol}:latest` with a 2-second TTL is overwritten on each new tick. The Settlement Worker retrieves the current price at processing time, not the price at the exact contract expiry timestamp. For fast-moving markets, these can differ materially. The settlement price was not legally defensible. |
| **Previous Design** | Redis was the sole source of settlement prices. The SAD self-review noted this was a "weak point" but did not mandate a fix. |
| **New Design** | The Pricing Service (now a **separate process**) writes every price tick to a persistent `price_ticks` table in PostgreSQL with columns: `symbol`, `bid_price` (NUMERIC(12,6)), `ask_price` (NUMERIC(12,6)), `mid_price` (NUMERIC(12,6)), `tick_time` (TIMESTAMPTZ). The Settlement Worker queries `SELECT mid_price FROM pricing.price_ticks WHERE symbol = ? AND tick_time <= ? ORDER BY tick_time DESC LIMIT 1` using the contract's exact expiry timestamp. Redis retains its role for live charting and real-time Pub/Sub distribution only. |
| **Benefits** | Settlement price is provably correct and auditable. Legally defensible. Redis failure no longer prevents settlement (fallback to PostgreSQL query). |
| **Trade-offs** | Increased database write volume (~1 row per tick per symbol). Retention policy required (7 years for regulatory compliance). Table partitioning strategy recommended for performance at scale. |
| **Diagram Impact** | New `price_ticks` table in PostgreSQL schema. Settlement Worker now queries PostgreSQL (with Redis cache as optional fast path). Pricing Service extracted as separate process. |

---

## Change 3: Wallet Locking Strategy — Pessimistic Row-Level Locking

| Field | Detail |
| :--- | :--- |
| **Review Reference** | CR-003 / R-003 |
| **Problem** | The SAD asserted race condition protection but did not specify or mandate the locking mechanism. Two concurrent trade placements on the same wallet could both read sufficient balance and both proceed, resulting in a negative balance. |
| **Previous Design** | "Database-level row locking within transactions" was mentioned without specifying the mechanism. Isolation level was left to developer discretion. |
| **New Design** | All wallet-modifying operations within the Wallet Module must execute `SELECT ... FOR UPDATE` on the wallet row at the start of the database transaction. This pessimistic lock blocks concurrent readers until the transaction commits or rolls back. The isolation level is set to `REPEATABLE READ` to prevent phantom reads on ledger aggregation. |
| **Benefits** | Proven and reliable. No retry logic needed. Well-understood by all PostgreSQL developers. Prevents all balance race conditions. |
| **Trade-offs** | Reduced concurrent throughput on the same wallet (contention). At projected volumes (<500 concurrent wallet operations), this is negligible. Requires disciplined transaction scoping to avoid unnecessary lock duration. |
| **Alternatives Considered** | Optimistic locking (version field with retry) was rejected because retries could fail under high contention causing user-facing errors. `SERIALIZABLE` isolation was rejected due to higher abort rates and complexity. |
| **Diagram Impact** | Wallet Module specification updated to mandate `SELECT FOR UPDATE`. Ledger write operations wrapped in explicit transaction boundaries. |

---

## Change 4: Redis Failure & Session Validation — Fail-Closed Behaviour

| Field | Detail |
| :--- | :--- |
| **Review Reference** | CR-004 / R-004 |
| **Problem** | When Redis is unreachable, JWT blacklist validation cannot execute. Previously valid (but revoked) tokens would be accepted, creating a critical security regression. Rate limiting and price streaming also fail. |
| **Previous Design** | Redis was assumed always available. No fail-closed behaviour was defined. Token revocation relied on Redis blacklist checks on every request. |
| **New Design** | **Short-lived access tokens**: JWT access token TTL reduced to 15 minutes. Refresh tokens (with 7-day expiry) are used to obtain new access tokens. During Redis failure: 1) Token validation falls back to signature-only verification (JWT is self-validating for its 15-minute window). 2) New logins and token refreshes are blocked — the API gateway returns 503 Service Unavailable. 3) Existing authenticated sessions continue for the remainder of their 15-minute access token window. 4) Rate limiting defaults to a conservative per-IP fixed rate enforced in the application code (not Redis). 5) Trading is halted (cannot verify exposure counters). |
| **Benefits** | Revoked token exposure is bounded to a maximum of 15 minutes. System degrades safely rather than failing open. Security team can manually invalidate all tokens via a deployment if needed. |
| **Trade-offs** | Increased authentication server load (more frequent token refreshes). Users must re-authenticate after Redis recovery if their refresh window expired. Trading is degraded during Redis outage. |
| **Alternatives Considered** | Fail-open (accept any non-expired token) was rejected as unacceptable for a financial platform. In-process session cache fallback was rejected due to memory overhead and cache inconsistency across instances. |
| **Diagram Impact** | Auth flow diagram updated to show Redis check as optional fast-path, with signature-only fallback during outage. Fail-closed behaviour documented in fault tolerance table. |

---

## Change 5: Durable Financial Event Processing — Transactional Outbox Pattern

| Field | Detail |
| :--- | :--- |
| **Review Reference** | CR-005 / R-005 |
| **Problem** | The internal event bus within the monolithic application process is in-memory. If the application crashes before consumers process published events, financial events (DepositCompleted, TradeSettled, etc.) are permanently lost. |
| **Previous Design** | All domain events (financial and non-financial) were published to an in-process event bus. The architecture diagram showed `EventBus → Queue → Workers`, conflating in-process bus with durable broker. |
| **New Design** | **Transactional Outbox Pattern**: Financial domain events (`DepositCompleted`, `TradeOpened`, `TradeSettled`, `WalletCredited`, `WalletDebited`, `WithdrawalApproved`, `TradeSettled`) are written to an `event_outbox` table within the **same database transaction** as the state change that produced them. A dedicated **Outbox Relay** worker polls the outbox table and publishes events to the durable message broker (RabbitMQ/BullMQ). Consumers (Settlement Worker, Notification Worker, Audit Worker) subscribe to the broker and process events with idempotency guarantees. Non-financial events (UI refresh signals, analytics) may still use the in-process bus or publish to a lower-priority broker queue. |
| **Benefits** | Events survive application crashes — they are persisted atomically with the state change. Exactly-once event publication from the database. Consumers implement idempotent processing for exactly-once delivery semantics. Clear architectural boundary: in-process bus for non-critical events, durable broker for financial events. |
| **Trade-offs** | Additional infrastructure: `event_outbox` table, Outbox Relay worker. Increased database write volume. Relay worker adds ~10-50ms latency to event delivery. Requires careful monitoring of outbox table depth. |
| **Alternatives Considered** | Making the in-process bus persistent (write-ahead log) would add complexity without the benefit of the transactional guarantee. Kafka was considered but is operationally heavier than required for V1. |
| **Diagram Impact** | Architecture diagram updated: financial events flow through `DB (event_outbox)` → `Outbox Relay` → `Message Broker` → `Workers`. Non-financial events flow through `In-Process Bus` → `Workers`. Clear separation of event paths. |

---

## Change 6: New ADR — ADR-009 Wallet Locking Strategy

| Field | Detail |
| :--- | :--- |
| **Review Reference** | CR-003 |
| **Decision** | All wallet balance modifications must use pessimistic row-level locking (`SELECT FOR UPDATE`) within explicit database transactions. |
| **Context** | Financial integrity requires preventing race conditions on wallet balance updates. |
| **Consequences** | Guaranteed consistency. Slightly reduced concurrent throughput on the same wallet. |

---

## Change 7: New ADR — ADR-010 Settlement Atomicity

| Field | Detail |
| :--- | :--- |
| **Review Reference** | CR-001 |
| **Decision** | Settlement uses an atomic compare-and-swap operation to transition contract status from `Active` to `Settling` before any financial operation. |
| **Context** | Without atomic status transition, concurrent worker dequeue enables double-settlement. |
| **Consequences** | Guarantees exactly-once settlement. Requires `Settling` intermediate state and dead-letter handling for partial failures. |

---

## Change 8: New ADR — ADR-011 Durable Event Processing

| Field | Detail |
| :--- | :--- |
| **Review Reference** | CR-005 |
| **Decision** | All financial domain events use the Transactional Outbox pattern for reliable publication. |
| **Context** | In-process event bus loses events on application crash, which is unacceptable for financial operations. |
| **Consequences** | Events survive crashes. Exactly-once publication guarantee. Additional infrastructure (outbox table, relay worker). |

---

## Change 9: New ADR — ADR-012 Price Authority

| Field | Detail |
| :--- | :--- |
| **Review Reference** | CR-002 |
| **Decision** | The authoritative price source for settlement is the persistent `price_ticks` table in PostgreSQL. Redis is a cache for live display only. |
| **Context** | Redis cannot provide provably correct prices at exact timestamps due to its volatile, last-value-only storage model. |
| **Consequences** | Legally defensible settlement pricing. Increased database write volume. Pricing Service runs as a separate process. |

---

## Change 10: Updated ADR-003 — Redis Role Clarified

| Field | Detail |
| :--- | :--- |
| **Review Reference** | CR-002, CR-004 |
| **Change** | ADR-003 explicitly states Redis is used for caching, session storage, and Pub/Sub distribution only. It is NOT the source of truth for settlement prices or authoritative state. The persistent `price_ticks` table in PostgreSQL is the authoritative price store. Two separate Redis clusters are defined: one for sessions/rate-limiting, one for pricing. |
| **Previous** | Redis was described as the settlement price source. Single Redis cluster for all concerns. |
| **New** | Redis is cache-only for prices. Two clusters. Fail-closed behaviour documented. |

---

## Change 11: Updated ADR-005 — Event Bus Durability Clarified

| Field | Detail |
| :--- | :--- |
| **Review Reference** | CR-005 |
| **Change** | ADR-005 now distinguishes between financial events (published via Transactional Outbox to durable broker) and non-financial events (may use in-process bus). The architectural ambiguity between "internal event bus" and "message queue" is resolved. |
| **Previous** | Single event bus described ambiguously as both in-process and queue-backed. |
| **New** | Two-tier event architecture: durable broker for financial events, in-process bus for non-critical events. |

---

## Change 12: Updated ADR-008 — Settlement Idempotency Refined

| Field | Detail |
| :--- | :--- |
| **Review Reference** | CR-001 |
| **Change** | ADR-008 updated to specify atomic compare-and-swap as the idempotency mechanism, replacing the previous "check before process" approach. New `Settling` status added. Dead-letter queue handling for partial failures. |
| **Previous** | "Check contract status before processing" without atomicity guarantee. |
| **New** | `UPDATE ... SET status = 'Settling' WHERE status = 'Active'` as atomic acquisition. Row count check guarantees single processing. |

---

## Change 13: Price Feed Service as Separate Process

| Field | Detail |
| :--- | :--- |
| **Review Reference** | MP-001 (from CR-002) |
| **Change** | The Price Feed Service is defined as a standalone daemon process, independent of the API monolith. This prevents API server restarts from disconnecting the price feed. |
| **Previous** | Price Feed Service ambiguity — shown as both inside and outside the monolith in various diagrams. |
| **New** | Clearly documented as a separate, always-on process that writes ticks to both Redis (live streaming) and PostgreSQL `price_ticks` (persistence). It reconnects autonomously to data providers. |

---

## Change 14: Compliance Module Defined

| Field | Detail |
| :--- | :--- |
| **Review Reference** | Domain Model Review (Section 3 of review) |
| **Change** | The Compliance sub-domain is elevated to a first-class module in the SAD with its own domain boundary, owned entities (`KYC`, `ComplianceRule`), and events (`KYCApproved`, `KYCRejected`, `AMLRuleTriggered`). |
| **Previous** | Compliance was referenced in the Domain Catalogue but had no module definition in the SAD. KYC approval was incorrectly attributed to the Admin Module. |
| **New** | Compliance Module defined with domain isolation. KYC workflows owned by Compliance. Admin Module has read-only access to compliance data. |

---

## Change 15: Referral Module Defined

| Field | Detail |
| :--- | :--- |
| **Review Reference** | HP-001 / R-010 |
| **Change** | The Referral System is defined as a new module with its own domain boundaries. It subscribes to `UserRegistered` and `TradeSettled` events and manages commission computation. |
| **Previous** | No architectural definition. Referral was mentioned in BRD but absent from SAD. |
| **New** | Referral Module with `Referral` aggregate, commission calculation rules, and payout scheduling. |

---

## Change 16: Tamper-Evident Audit Log

| Field | Detail |
| :--- | :--- |
| **Review Reference** | HP-003 / R-008 |
| **Change** | Audit log entries now include a cryptographic hash chain. Each entry stores `previous_entry_hash` (SHA-256 of the previous entry's entire content). Any modification breaks the chain and is detectable. |
| **Previous** | Audit log was append-only but not cryptographically chained. A database administrator could silently delete or modify entries. |
| **New** | `audit_logs` table includes `entry_hash` (SHA-256 of this entry's content) and `previous_entry_hash` (SHA-256 of previous entry). Verification worker periodically validates chain integrity. |

---

## Change 17: MFA Mandate for Privileged Roles

| Field | Detail |
| :--- | :--- |
| **Review Reference** | HP-002 / R-007 |
| **Change** | Multi-Factor Authentication (TOTP) is architecturally mandated for all privileged roles: Finance Officer, Risk Manager, Compliance Officer, Administrator, and Super Administrator. |
| **Previous** | MFA was an optional user-level feature. |
| **New** | Role-based MFA enforcement. Privileged accounts cannot complete login without MFA. Policy enforced at the Auth Module level. |

---

## Change 18: Self-Exclusion Enforcement in Risk Engine

| Field | Detail |
| :--- | :--- |
| **Review Reference** | MP-005 / R-012 |
| **Change** | The Risk Engine validation chain (invoked during trade placement) now includes a check against the user's self-exclusion status. |
| **Previous** | Self-exclusion was referenced in the BRD but had no architectural enforcement point. |
| **New** | Risk Engine checks `user.self_excluded_until` before trade validation. If exclusion is active, trade placement returns 403 Forbidden. |

---

## Change 19: Database Schema Isolation

| Field | Detail |
| :--- | :--- |
| **Review Reference** | MP-003 |
| **Change** | Each domain module owns a dedicated PostgreSQL schema: `auth.*`, `wallet.*`, `trading.*`, `market.*`, `payments.*`, `compliance.*`, `referral.*`. Cross-module data access must use module APIs, not direct SQL queries. |
| **Previous** | No schema isolation defined. All modules shared the same schema, risking entanglement. |
| **New** | Schema-per-module enforced from day one. API layer is the only data access path for cross-module reads. |

---

## Change 20: Decimal Precision Model for Settlement

| Field | Detail |
| :--- | :--- |
| **Review Reference** | MP-002 / R-009 |
| **Change** | Settlement price comparison uses 5 decimal places. A Draw is declared if `ABS(expiry_price - strike_price) < 0.00001`. All prices stored as `NUMERIC(18,6)`. |
| **Previous** | No precision model defined. Draw detection based on floating-point equality, which is mathematically unreliable. |
| **New** | Precise decimal comparison with configurable precision threshold. |

---

## Summary of Risk Register Status

| Risk ID | Previous Status | New Status | Priority |
| :--- | :--- | :--- | :--- |
| R-001 (Double Settlement) | 🔴 Open | ✅ Resolved (CR-001) | P0 |
| R-002 (Settlement Price) | 🔴 Open | ✅ Resolved (CR-002) | P0 |
| R-003 (Wallet Race Condition) | 🔴 Open | ✅ Resolved (CR-003) | P0 |
| R-004 (Redis Fail-Open) | 🔴 Open | ✅ Resolved (CR-004) | P0 |
| R-005 (Event Bus Durability) | 🟠 Open | ✅ Resolved (CR-005) | P1 |
| R-006 (Admin Ledger Bypass) | 🟠 Open | ✅ Resolved (admin adjustments routed through Wallet API) | P1 |
| R-007 (MFA Not Mandated) | 🟠 Open | ✅ Resolved (HP-002) | P1 |
| R-008 (Audit Not Tamper-Evident) | 🟠 Open | ✅ Resolved (HP-003) | P1 |
| R-009 (Draw Precision) | 🟡 Open | ✅ Resolved (MP-002) | P2 |
| R-010 (Referral Module) | 🟡 Open | ✅ Resolved (HP-001) | P2 |
| R-011 (Rollback Safety) | 🟡 Open | ✅ Resolved (MP-004) | P2 |
| R-012 (Self-Exclusion) | 🟡 Open | ✅ Resolved (MP-005) | P2 |
| R-013 (Price Feed Embedded) | 🟡 Open | ✅ Resolved (MP-001 / CR-002) | P2 |
| R-014 (Refresh Token Rotation) | 🟡 Open | ✅ Resolved (CR-004 short-lived tokens) | P2 |
| R-015 (Queue Depth Auto-Scale) | 🟡 Open | ✅ Partially resolved (monitoring defined; scaling triggers documented) | P2 |
| R-016 (RTO/RPO Defined) | 🟡 Open | ✅ Resolved (defined in SAD v1.1) | P2 |
| R-017 (Redis Clusters) | 🟢 Open | ✅ Resolved (separate clusters defined) | P3 |
| R-018 (Admin Privilege Escalation) | 🟢 Open | ✅ Resolved (four-eyes principle documented for critical actions) | P3 |

---

## Remaining Issues

### Medium Priority (P2)
- **Queue depth auto-scaling triggers**: Implementation-level detail; architectural triggers defined but specific threshold tuning deferred to implementation phase.

### Low Priority (P3)
- No unresolved P3 issues.

---

*End of Architecture Change Log — Version 1.1*