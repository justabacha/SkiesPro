# Independent Architecture Review
## Project: Independent Online Binary Trading Platform
### Prepared by: Independent Principal Software Architect

---

## Review Declaration

This document constitutes a formal, independent architectural review of the submitted documentation set for the Binary Trading Platform project. The reviewer has evaluated each document as submitted and has applied no prior knowledge of or bias toward the original design decisions. All findings are based exclusively on the documentation set provided.

**Documents Reviewed:**
| Document | Version | Date |
| :--- | :--- | :--- |
| [01_BUSINESS_REQUIREMENTS.md](file:///c:/Users/user/Downloads/bullion-terminal_3/docs/01_BUSINESS_REQUIREMENTS.md) | 1.0.0 | 2026-07-22 |
| [02_SYSTEM_REQUIREMENTS.md](file:///c:/Users/user/Downloads/bullion-terminal_3/docs/02_SYSTEM_REQUIREMENTS.md) | 1.0.0 | 2026-07-22 |
| [03_DOMAIN_MODEL.md](file:///c:/Users/user/Downloads/bullion-terminal_3/docs/03_DOMAIN_MODEL.md) | 1.0.0 | 2026-07-22 |
| [04_SOFTWARE_ARCHITECTURE.md](file:///c:/Users/user/Downloads/bullion-terminal_3/docs/04_SOFTWARE_ARCHITECTURE.md) | 1.0.0 | 2026-07-22 |
| [PROJECT_PLAN.md](file:///c:/Users/user/Downloads/bullion-terminal_3/public/PROJECT_PLAN.md) | 1.0.0 | 2026-07-22 |

**Review Date:** 2026-07-22
**Reviewer Role:** Independent Principal Software Architect

---

## Revision History

| Date | Version | Description |
| :--- | :--- | :--- |
| 2026-07-22 | 1.0.0 | Initial independent architecture review. |

---

## Table of Contents

1. [Overall Assessment](#1-overall-assessment)
2. [Requirement Coverage Verification](#2-requirement-coverage-verification)
3. [Domain Model Review](#3-domain-model-review)
4. [Architecture Review](#4-architecture-review)
5. [Financial Integrity Review](#5-financial-integrity-review)
6. [Security Review](#6-security-review)
7. [Scalability Review](#7-scalability-review)
8. [Failure Analysis (Chaos Simulation)](#8-failure-analysis-chaos-simulation)
9. [Operational Review](#9-operational-review)
10. [Risk Register](#10-risk-register)
11. [Improvement Recommendations](#11-improvement-recommendations)
12. [Approval Decision & Mandatory Actions](#12-approval-decision--mandatory-actions)

---

## 1. Overall Assessment

### Executive Summary

The submitted architecture documentation is structurally coherent and demonstrates a sound understanding of the domain. The foundational decisions — Modular Monolith, double-entry ledger, queue-based settlement with idempotency, and Redis-backed price distribution — are professionally reasoned and appropriate for a Version 1 financial platform of this type.

However, the documentation contains **several gaps of material consequence** that, if carried forward into implementation without resolution, could result in financial data loss, double-settlement, balance corruption, or security vulnerabilities. These are not theoretical concerns — they are identified failure modes with documented paths to occurrence.

The architecture is not **rejected**, but it is **not approved as-is**.

### Overall Readiness Score

```
╔══════════════════════════════════════════════════════════╗
║  IMPLEMENTATION READINESS SCORE                          ║
║                                                          ║
║    Documentation Completeness:   74 / 100                ║
║    Architectural Soundness:      72 / 100                ║
║    Financial Safety:             61 / 100  ⚠️            ║
║    Security Posture:             65 / 100  ⚠️            ║
║    Operational Readiness:        58 / 100  ⚠️            ║
║                                                          ║
║    COMPOSITE SCORE:              66 / 100                ║
║                                                          ║
║    STATUS: APPROVED WITH MANDATORY CHANGES               ║
╚══════════════════════════════════════════════════════════╝
```

A score of 66 reflects a solid conceptual foundation with significant unresolved implementation-critical details. The platform **must not proceed to development** until the mandatory changes in Section 12 are addressed.

---

## 2. Requirement Coverage Verification

### BRD → Architecture Traceability Check

| BRD Business Requirement | Architecture Support Found | Gap Status |
| :--- | :--- | :--- |
| User Registration & KYC | Auth Module + KYC Module defined. | ✅ Covered |
| Internal Wallet System | Wallet Module with double-entry ledger. | ✅ Covered |
| Deposit System (Mobile Money) | Payment Module + webhook handler defined. | ✅ Covered |
| Withdrawal System with Admin Review | Payment Module + Admin Module approval flow. | ✅ Covered |
| Trading Engine (Binary Options) | Trading Engine Module defined. | ✅ Covered |
| Settlement Engine | Settlement Worker defined. | ✅ Covered |
| Real-Time Price Streaming | Price Feed Service + WebSocket Gateway. | ✅ Covered |
| Admin Back-Office Dashboard | Admin Operations Module. | ✅ Covered |
| Referral System | **Referenced in Domain Model but has NO module defined in SAD.** | ❌ **GAP** |
| Notification Service | Notification Worker defined. | ✅ Covered |
| Risk Engine | Risk Engine Module defined. | ✅ Covered |
| Audit Log | Audit Worker + immutable log pattern. | ✅ Covered |
| Configurable Payout Rates | Admin Module + Platform Configuration entity. | ✅ Covered |
| Draw Settlement (Stake Refund) | Mentioned in BRD decision, referenced in settlement flow. | ⚠️ Defined in BRD but settlement worker logic for Draw case not detailed in SRS. |
| Transparency of Payment Fees | BRD decision recorded but **no module or UI flow defines how fee transparency is enforced architecturally.** | ❌ **GAP** |
| Inactivity Fee Assessment | Inactivity Worker referenced in SAD background section. | ✅ Covered |
| Responsible Trading (Self-Exclusion) | Referenced in BRD. **No module defines how self-exclusion is enforced at the trade placement validation step.** | ❌ **GAP** |

### SRS → Architecture Traceability Check

| SRS Requirement ID | Architecture Support | Status |
| :--- | :--- | :--- |
| FR-ATH-001 to FR-ATH-004 | Auth Module covers all four. | ✅ |
| FR-KYC-001 to FR-KYC-003 | User Module + Compliance Module + external KYC provider. | ✅ |
| FR-WLT-001 to FR-WLT-003 | Wallet Module covers all three. | ✅ |
| FR-DEP-001, FR-DEP-002 | Payment Module covers both. | ✅ |
| FR-WTH-001 to FR-WTH-003 | Payment + Admin Module covers all three. | ✅ |
| FR-TRD-001 to FR-TRD-003 | Trading Engine Module covers all three. | ✅ |
| FR-SET-001 to FR-SET-003 | Settlement Worker covers all three. | ✅ |
| FR-MKT-001 to FR-MKT-003 | Price Feed Service covers all three. | ✅ |
| FR-ADM-001 to FR-ADM-003 | Admin Module covers all three. | ✅ |
| NFR-PER-001 (API < 200ms) | Mentioned as a target but **no caching strategy for API responses beyond Redis prices is defined.** | ⚠️ |
| NFR-PER-002 (WS < 50ms) | Redis Pub/Sub is the distribution mechanism. Latency SLA achievable but not proven. | ⚠️ |
| NFR-PER-003 (Settlement < 2s) | Queue-based worker should achieve this, but **no queue processing SLA commitment is stated.** | ⚠️ |
| EH-001 to EH-006 (Error Handling) | Error handling scenarios are described at a high level. **No dead-letter queue recovery process is architecturally defined beyond "manual review."** | ⚠️ |

### Identified Gaps Summary

> [!IMPORTANT]
> **Three material requirement gaps exist that must be resolved before architecture is approved:**
> 1. The **Referral System** is a documented BRD requirement with no architectural module defined in the SAD.
> 2. **Fee transparency enforcement** has no architectural mechanism defined. The BRD decision exists; the software path does not.
> 3. **Self-exclusion enforcement** at the trade placement gate is missing. A user who has activated self-exclusion must be blocked at the API level. No module currently owns this check.

---

## 3. Domain Model Review

### Domain Boundary Assessment

| Domain | Boundary Clarity | Ownership Clarity | Concerns |
| :--- | :--- | :--- | :--- |
| **Identity** | ✅ Clear | ✅ Clear | None. |
| **Trading** | ✅ Clear | ✅ Clear | The boundary between Trading and Settlement is correct — Settlement runs as a worker, not inside the Trading module. |
| **Wallet** | ✅ Strong | ✅ Strong | Single-write authority is the right call. Well-defined. |
| **Payments** | ⚠️ Partial | ⚠️ Partial | **The Payment domain owns both Deposits and Withdrawals — these are sufficiently different workflows that they warrant distinct subdomains.** Withdrawal involves admin approvals; Deposit involves gateway callbacks. Bundling them risks coupling. |
| **Market Data** | ✅ Clear | ✅ Clear | Correctly isolated. Abstraction layer over providers is the right architecture. |
| **Compliance** | ❌ Absent | ❌ Absent | **The Compliance domain is referenced in the Domain Catalogue but receives no module definition in the SAD.** KYC approval logic is attributed to the Admin Module, which is incorrect — Compliance should be a distinct module with its own domain boundary. |
| **Referral** | ❌ Absent | ❌ Absent | Referenced in BRD and mentioned in the Domain Model under "future expansion" — but this is a **V1 business requirement**, not a future feature. |

### Aggregate Design Assessment

The three identified aggregates (User, Wallet, Trading) are correctly scoped. However, two issues require attention:

**Issue 1: The Settlement aggregate is missing.**
The Settlement Worker is defined as an infrastructure process, not a domain entity. Settlement requires its own aggregate root (`Settlement`) with defined state transitions (`Pending → Evaluated → Completed → Failed`). Without this, the Settlement state is implied from the contract status field, which creates an ambiguous ownership boundary between the Trading module and the Settlement worker.

**Issue 2: The Payment aggregate conflates two distinct business flows.**
Deposits and Withdrawals should be modelled as independent aggregates. A `Deposit` flows one way (gateway in → wallet credit). A `Withdrawal` flows the opposite way (admin approval → gateway out → wallet debit). They share no state and have incompatible lifecycle models. Combining them in one aggregate is a design smell.

---

## 4. Architecture Review

### Challenge: Is the Modular Monolith the Correct Choice?

**Finding: Yes, with reservations.**

The Modular Monolith choice is the correct call for V1. The reasoning — ACID transaction scope, small team, operational simplicity — is sound. However, the documentation asserts that modules can later be extracted as microservices "cleanly." This is correct only if the database access pattern is enforced from day one.

> [!WARNING]
> **The SAD does not specify who owns which database tables, nor does it enforce a one-schema-per-module access pattern.** If all modules share one schema with unrestricted cross-module table access, the monolith becomes an entangled ball of code that cannot be extracted without a painful rewrite. The architectural decision to use a Modular Monolith is only sound if the schema isolation is explicitly enforced.

**Recommendation**: The architecture must define a **database schema-per-module** access pattern (e.g., `auth.*`, `wallet.*`, `trading.*`) from the start. Modules must never query another module's schema tables directly.

---

### Challenge: Is the Price Feed Service a Module or a Separate Process?

**Finding: This is ambiguous and must be resolved.**

The SAD diagram shows the Price Feed Service within the core monolith's scope in some diagrams and as an external component in others. The Price Feed Service has fundamentally different operational characteristics from the core API:
- It runs persistent long-lived connections to external providers.
- It must remain operational even if the API server restarts.
- Its scaling requirements differ from the API (one producer, many consumers).

**A restart of the API server should not disconnect the price feed.** If the Price Feed Service is embedded in the monolith process, this is exactly what will happen. This is not a future concern — it is a V1 correctness issue.

**Recommendation**: The Price Feed Service must be defined as a **separate process** from the core API monolith, even in V1. It is a standalone service that writes to Redis. This is not microservices complexity — it is a single extra process.

---

### Challenge: Should CQRS Be Introduced Now?

**Finding: Partially yes, specifically for admin and reporting.**

The SAD's self-review notes that the Admin module's broad read scope is a concern and that a CQRS read model is "planned." This review finds that the deferral is acceptable for V1, but the **reporting module must query the read replica, not the primary database**, and this must be enforced architecturally from day one — not as a future enhancement. The SAD already states this (reporting queries the read replica), which is correct. No change needed — but it must be enforced during implementation.

---

### Challenge: Is Redis Used Correctly?

**Finding: Redis is over-relied upon in a dangerous way.**

Redis is used as:
1. Price tick cache (appropriate)
2. Session store (appropriate)
3. Rate limit counter (appropriate)
4. Pub/Sub distribution channel (appropriate)
5. **Source of truth for settlement price at expiry** (dangerous)

Point 5 is the critical concern. When a contract expires and the Settlement Worker retrieves the settlement price from Redis, it is retrieving a value from a volatile in-memory store. If Redis has evicted the key, restarted, or the key's TTL expired before the worker processed the job, the settlement price is **unrecoverable**. The SAD's self-review correctly identifies this but then only says "the Pricing Service must also persist ticks to a time-series table." This is correct but is listed as a weak point — it must be elevated to a mandatory requirement.

---

### Challenge: Is the Event Bus Architecture Correctly Defined?

**Finding: The dual event bus definition is an architectural inconsistency.**

The SAD describes:
- An **internal event bus** within the monolith for domain decoupling.
- A **message queue** for delivering jobs to background workers.

The problem: in Section 4 (High-Level Architecture diagram), the flow shows `EventBus → Queue → Workers`. This means the internal event bus feeds into the external message queue. But in Section 5 (Communication Patterns), these are described as separate systems used for different purposes. This contradicts the visual flow in the diagram.

This ambiguity is dangerous. Developers implementing from this documentation will face an architectural decision that should already be resolved: **Is there one event system or two? What is the boundary?**

**Required Resolution**: The architecture must explicitly state whether financial domain events (e.g., `DepositCompleted`, `TradeSettled`) are published to an **in-process event bus** or directly to an **external durable message broker**. Given the self-review's own finding that in-process events can be lost on crash, financial events must route through the durable broker. This must be stated as a firm decision, not a suggestion.

---

## 5. Financial Integrity Review

This section represents the highest-priority review area. Financial systems that fail here expose the platform to direct monetary losses and regulatory liability.

### Wallet Concurrency & Race Condition Analysis

**Scenario**: Two trade placements arrive simultaneously for the same user. Both requests read the user's balance (e.g., $100), both determine sufficient funds exist (stake: $60 each), and both proceed to debit.

**Expected result**: Second trade is rejected due to insufficient balance.
**Risk if not handled**: Both debits succeed, resulting in a $-20 balance — violating the non-negative balance invariant.

**Architecture review finding**: The SAD states that database-level row locking within transactions protects against this. This is correct **if** the wallet update uses a `SELECT FOR UPDATE` pattern or equivalent pessimistic locking. However, **the architecture does not mandate or specify which isolation level or locking strategy is required**. This is a critical implementation specification that must not be left to the developer to decide at coding time.

> [!CAUTION]
> **Finding: CRITICAL.** The architecture asserts race condition protection but does not define the mechanism. Without specifying `SELECT FOR UPDATE`, optimistic locking with a version field, or application-level serialization, two concurrent trade placements on the same wallet can bypass the balance check.

---

### Settlement Idempotency Analysis

**Scenario**: A settlement job is picked up by Worker A. Worker A processes the job, calls the Wallet Module to credit the user, succeeds, and then crashes before acknowledging the message queue. The queue redelivers the job to Worker B.

**Expected result**: Worker B detects the contract is already settled and discards the job.
**Risk**: Worker B re-settles the contract, crediting the user twice.

**Architecture review finding**: The SAD states that the settlement worker "checks the contract status before processing" and discards the job if the contract is in a terminal state. This is a correct idempotency mechanism. **However, there is a race condition between the check and the state update:**

```
Worker A: Check status → Active (safe to proceed)
Worker B: Check status → Active (safe to proceed)  ← Concurrent
Worker A: Credit wallet, update status → Won
Worker B: Credit wallet, update status → Won  ← DOUBLE SETTLEMENT
```

This is a classic **check-then-act race condition**. The protection requires either:
1. A database-level atomic compare-and-swap: `UPDATE contracts SET status = 'settling' WHERE id = ? AND status = 'active'` — only proceed if exactly 1 row was updated.
2. A distributed lock on the contract ID before processing.

> [!CAUTION]
> **Finding: CRITICAL.** The idempotency mechanism described is insufficient to prevent double-settlement under concurrent worker dequeue scenarios. This requires an atomic status transition operation, not a separate read-then-write pattern.

---

### Ledger Integrity Analysis

The double-entry ledger design is correct in principle. Every financial movement creates two ledger entries that balance. The architecture correctly states ledger records are immutable.

**One gap identified**: The architecture does not define who is permitted to initiate a **manual ledger adjustment** (FR-ADM-003). The SAD states the Admin Module can credit or debit a wallet to correct discrepancies. However, there is no defined constraint that manual adjustments must also produce balanced double-entry records. If a Super Admin can write a single debit entry without a corresponding credit, the ledger's mathematical integrity can be violated through the admin path.

> [!IMPORTANT]
> **Finding: HIGH.** Manual wallet adjustments via the Admin Module must route through the same Wallet Module ledger API as all other financial operations — never via a direct database bypass. The architecture must explicitly prohibit any direct database write path that circumvents the Wallet Module, even for administrators.

---

### Payment Replay Attack Analysis

The architecture mandates HMAC signature validation for payment webhooks. This is correct. The idempotency key check prevents duplicate processing.

**Gap identified**: The architecture does not define the **time window for idempotency key validity**. If idempotency keys are stored indefinitely, storage grows unboundedly. If they expire too soon (e.g., 24 hours), a replayed webhook with a gateway reference older than 24 hours can successfully re-process. Payment providers typically retry for 72+ hours.

**Finding: MEDIUM.** Idempotency key retention policy must be defined and set to a minimum of 7 days, aligned with the maximum gateway retry window.

---

### Settlement Price Integrity Analysis

**Scenario**: A contract expires at 14:00:00.000. The settlement worker retrieves the price from Redis at 14:00:00.250. The Redis price key has been overwritten three times since 14:00:00.000.

**Question**: Is the retrieved price the correct settlement price?

The architecture uses a single `price:{symbol}:latest` cache key with a 2-second TTL. This means the Redis cache holds only the most recent tick, not the tick at the exact expiry timestamp.

> [!CAUTION]
> **Finding: CRITICAL.** The settlement price retrieved from Redis is the current price at the time the worker processes the job, not the price at the exact expiry timestamp. For a fast-moving market, these can differ materially. This is legally significant — the settlement price must be the provably correct price at the moment of expiry, not the price when the worker happened to process the settlement.

**Required**: The Pricing Service must write a persistent, time-indexed price record (a time-series store or PostgreSQL table) that the Settlement Worker queries using the exact expiry timestamp. Redis can remain as a low-latency cache for live charting, but it cannot serve as the authoritative settlement price source.

---

### Draw Settlement Logic Analysis

The BRD clearly states: if expiry price equals strike price exactly, the stake is returned. The settlement worker's described logic includes a Draw case. However, exact floating-point equality is mathematically problematic for financial price data stored as decimals.

**Finding: MEDIUM.** The definition of "equality" for Draw settlement must be specified. Does a price of 1.234500 equal 1.23450? Does 1.23450000001 equal 1.23450? The architecture must define the precision model and rounding rules for price comparison in settlement.

---

## 6. Security Review

### Authentication Review

| Control | Status | Finding |
| :--- | :--- | :--- |
| JWT signature algorithm specified | ⚠️ | RS256 is mentioned in the SRS. The SAD does not re-confirm or mandate this. RS256 (asymmetric) is correct; HS256 (symmetric shared secret) would be a weaker choice if chosen during implementation. |
| Token revocation mechanism | ⚠️ | Token blacklisting in Redis is described for logout. However, the architecture does not address what happens if Redis is unavailable — does the API gateway accept all non-expired tokens as valid? This creates a revocation bypass during Redis outage. |
| Refresh token security | ❌ | The SAD mentions refresh tokens in HTTP-only cookies but does not define the rotation policy. A stolen refresh token that is never rotated grants indefinite access. Token rotation on each use is required. |
| MFA enforcement scope | ❌ | MFA is listed as an optional user-level feature. The architecture does not mandate MFA for Administrator or Finance Officer accounts. Privileged accounts accessing real money must require MFA by policy. |

### Authorization Review

| Control | Status | Finding |
| :--- | :--- | :--- |
| RBAC enforcement | ✅ | Role-based permissions matrix defined. |
| Privilege escalation prevention | ⚠️ | The Admin Module has write access to the User Module and can modify user roles. There is no defined guard preventing an Admin from elevating another account to Super Admin — a privilege escalation path. |
| Inter-module trust | ⚠️ | Within a monolith, modules trust each other implicitly. There is no mechanism described to prevent one module from directly calling another module's database queries. This must be enforced by code architecture discipline. |
| Admin action approval | ❌ | For critical actions (e.g., manual wallet adjustments, account unlocking), the architecture does not require a second-approver workflow (four-eyes principle). A single compromised admin account could manipulate balances without a second authorization. |

### API Security Review

| Control | Status | Finding |
| :--- | :--- | :--- |
| Rate limiting | ✅ | Defined at gateway level. |
| Input validation | ✅ | Defined at module boundary. |
| CSRF protection | ⚠️ | Mentioned in SRS but not architecturally placed. For a REST API using JWT Bearer tokens (not cookies), CSRF is not applicable to API endpoints. However, if any form endpoints exist in the admin panel that use cookie-based auth, CSRF tokens are required. This distinction is not made. |
| SQL injection | ✅ | Parameterized queries mandated. |
| Secrets management | ⚠️ | Environment-variable injection is described. The architecture does not specify whether a secrets manager (e.g., HashiCorp Vault, AWS Secrets Manager) is required or if plain environment variables on servers are acceptable. For a financial platform, plaintext `.env` files on servers are insufficient. |

### Audit Logging Review

The audit logging design is sound in principle — all privileged actions produce immutable records. **One significant gap**: the architecture does not define whether the audit log is **tamper-evident** (i.e., cryptographically chained so that a deletion or modification is detectable). An audit log that can be silently modified by a database administrator is not a real audit log.

**Finding: HIGH.** Audit log entries should include a cryptographic hash of the previous entry (hash-chained), or be written to an append-only log that database users cannot delete or modify.

---

## 7. Scalability Review

### Projected Load Analysis

| User Count | Expected Concurrent Trades | Settlements/Second | DB Write Load | Assessment |
| :--- | :--- | :--- | :--- | :--- |
| 10 users | < 10 | < 0.1/s | Trivial | ✅ Architecture handles easily |
| 1,000 users | ~50 concurrent | ~1/s | Low | ✅ Single DB instance sufficient |
| 10,000 users | ~500 concurrent | ~10/s | Moderate | ✅ With connection pooling |
| 100,000 users | ~5,000 concurrent | ~100/s | High | ⚠️ Read replica essential; settlement workers must scale |
| 1,000,000 users | ~50,000 concurrent | ~1,000/s | Critical | ❌ Single-primary PostgreSQL becomes bottleneck; module extraction required |

### Bottleneck Identification

**Bottleneck 1: PostgreSQL Primary Write Path**
All wallet ledger writes, trade insertions, and settlement updates go to a single PostgreSQL primary. At 100+ settlements per second with concurrent deposit/withdrawal traffic, the primary becomes the rate-limiting factor. The architecture correctly identifies this but labels it a "future" concern. This could become relevant at the 50,000–100,000 active user threshold.

**Bottleneck 2: Settlement Worker Queue Depth**
If 10,000 contracts all expire at the same minute (common in binary options, where traders typically pick standard expiry durations like 5 minutes), the queue will accumulate 10,000 jobs simultaneously. The architecture says to "pre-scale workers" before market events but provides no concrete auto-scaling trigger based on queue depth. **Queue depth monitoring with automated worker scaling triggers is mandatory.**

**Bottleneck 3: WebSocket Connection Limits**
The WebSocket Gateway pool needs to support persistent connections. At 10,000 concurrent users with open price streaming connections, and each WebSocket node handling ~1,000 connections, 10 gateway instances are required. The architecture does not define per-node connection limits or auto-scaling triggers for WebSocket nodes. This must be specified.

**Bottleneck 4: Redis Single Point of Truth**
For pricing, Redis Cluster is described. For session state, the same Redis is used. These have different availability, access patterns, and failure consequences. A Redis failure affecting session state takes down authentication. A Redis failure affecting pricing takes down trading. These must be **separate Redis clusters** to prevent cross-contamination of failure impact.

---

## 8. Failure Analysis (Chaos Simulation)

### Simulation 1: Primary Database Unavailable

**Scenario**: PostgreSQL primary goes down during peak trading hours.

| Component | Behaviour | Acceptable? |
| :--- | :--- | :--- |
| API → Wallet reads | Returns 503 immediately. | ✅ |
| API → Trade placement | Rejected. No balance lock possible. | ✅ |
| Settlement Worker | Message requeue — cannot update contract status. Workers retry. | ✅ |
| Price streaming | Unaffected — Redis-backed. | ✅ |
| Payment webhooks | Cannot write pending transaction — webhook callback fails, gateway will retry. | ⚠️ Risk of retry storm. |
| Time to recovery | Depends on standby promotion time. **Not defined in architecture.** | ❌ RTO not specified. |

**Gap**: Recovery Time Objective (RTO) and Recovery Point Objective (RPO) are not defined anywhere in the documentation. For a financial platform, these are mandatory operational commitments.

---

### Simulation 2: Redis Cluster Unavailable

**Scenario**: Redis cluster goes down.

| Component | Behaviour | Acceptable? |
| :--- | :--- | :--- |
| Authentication | JWT validation cannot check token blacklist → **all logged-out tokens become valid again.** | ❌ Critical security regression |
| Price streaming | WebSocket nodes lose Pub/Sub feed → all clients lose price updates. | ❌ Trading must halt. |
| Rate limiting | Counters lost → rate limiting temporarily disabled. | ❌ Potential attack window. |
| Settlement price lookup | Cannot retrieve settlement price → settlement halts. | ❌ Financial operations freeze. |
| Trade placement | Cannot check exposure counters → trades may exceed limits. | ❌ Risk controls bypass. |

**Finding: CRITICAL.** Redis unavailability simultaneously triggers five failure modes, including a security regression (revoked tokens become valid) and a risk control bypass. The architecture describes Redis Sentinel/Cluster but does not describe the **fail-safe behaviour** when Redis is fully unreachable. The system must define what it does when Redis is down: the safest position is to halt authenticated operations and queue requests until Redis recovers.

---

### Simulation 3: Settlement Worker Crashes Mid-Processing

**Scenario**: Worker retrieves a job, credits the wallet, then crashes before updating the contract status to "Won."

**Architecture response**: Message is redelivered. Worker B checks contract status: still "Active" (the status update failed). Worker B re-processes. Wallet is credited again.

> [!CAUTION]
> This is the double-settlement scenario identified in Section 5. The wallet credit and the contract status update are **two separate operations** — if they are not wrapped in a single atomic unit, a crash between them creates the double-settlement condition. The architecture does not define the transactional boundary that protects this. **This must be resolved before development begins.**

---

### Simulation 4: Payment Gateway Offline

**Scenario**: M-Pesa gateway goes offline for 4 hours.

| Component | Behaviour |
| :--- | :--- |
| New deposits | Checkout sessions created, STK push fails. Transaction stays Pending. User sees error. |
| Withdrawal disbursements | Cannot dispatch. Approved withdrawals queue. |
| Webhook retries | Gateway cannot deliver callbacks. Transactions cannot complete. |
| Recovery | When gateway recovers, outstanding webhooks deliver. Idempotency keys prevent double-credit. |

**Assessment**: This failure mode is reasonably handled by the architecture. The idempotency key mechanism is the critical protection. However, **the architecture does not define the maximum Pending transaction age before it is auto-cancelled and funds released**. A Pending deposit with locked funds that never completes must have a defined timeout policy.

---

### Simulation 5: Unexpected Deployment Rollback

**Scenario**: A new version is deployed to production. A critical bug is discovered. The deployment is rolled back to the previous version.

**Questions not addressed by the architecture**:
1. If the new version added a new database column, does the rollback break the old version?
2. If the new version changed an event schema, are events already in the queue parseable by the old version?
3. If the new version committed financial ledger entries in a new format, how does the old version handle them?

**Finding: HIGH.** The architecture makes no mention of database migration versioning, backward-compatible schema changes, or event schema versioning. For a financial platform, a deployment that corrupts in-flight transactions during rollback is a serious operational risk. Zero-downtime deployment and rollback safety must be an architectural requirement.

---

## 9. Operational Review

### Monitoring & Alerting Assessment

| Area | Defined? | Quality |
| :--- | :--- | :--- |
| API metrics | ✅ | Request rates, error rates, latency defined. |
| Settlement latency tracking | ✅ | Settlement processing latency listed as a metric. |
| Queue depth monitoring | ⚠️ | Mentioned but no alert thresholds defined. |
| Price feed health | ✅ | Listed as a health check component. |
| Wallet reconciliation alerts | ✅ | Reconciliation worker defined. |
| RTO / RPO commitments | ❌ | Not defined anywhere. |
| On-call escalation | ❌ | PagerDuty/Slack mentioned as alert destination but no escalation path defined. |
| Backup verification | ❌ | Backup service is shown in deployment diagram but no backup testing or restoration drill is specified. |
| DB failover procedure | ❌ | Read replica exists but the failover procedure (automated vs. manual, time estimate) is not described. |

### Deployment Safety Assessment

**Missing from architecture:**
- Zero-downtime deployment strategy (blue-green or rolling deployment).
- Database migration strategy (how schema changes are applied without downtime).
- Rollback procedure and safety guarantees.
- Worker drain strategy (how to stop workers gracefully without abandoning in-flight jobs).

---

## 10. Risk Register

| # | Risk Description | Category | Likelihood | Impact | Severity | Recommended Mitigation | Owner | Priority |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| R-001 | Double-settlement due to concurrent worker dequeue and non-atomic status transition | Financial | Medium | Critical | 🔴 **CRITICAL** | Atomic CAS update on contract status before processing | Architecture | **P0** |
| R-002 | Settlement price from Redis is wrong tick (not exact expiry timestamp) | Financial | High | Critical | 🔴 **CRITICAL** | Persist ticks to time-series store; query by timestamp | Architecture | **P0** |
| R-003 | Wallet race condition on concurrent trade placements | Financial | Medium | Critical | 🔴 **CRITICAL** | Mandate `SELECT FOR UPDATE` or optimistic locking with version field | Architecture | **P0** |
| R-004 | Redis unavailability causes revoked tokens to become valid | Security | Low | Critical | 🔴 **CRITICAL** | Define fail-closed behaviour: halt auth on Redis failure | Architecture | **P0** |
| R-005 | In-process event bus loses financial events on crash | Financial | Medium | High | 🟠 **HIGH** | Route financial events through durable external broker | Architecture | **P1** |
| R-006 | Manual admin wallet adjustment bypasses double-entry ledger | Financial | Low | High | 🟠 **HIGH** | Route admin adjustments through Wallet Module API only | Architecture | **P1** |
| R-007 | MFA not required for privileged admin accounts | Security | Medium | High | 🟠 **HIGH** | Mandate MFA for Finance, Admin, Risk, Super Admin roles | Security | **P1** |
| R-008 | Audit logs not tamper-evident | Compliance | Low | High | 🟠 **HIGH** | Implement hash-chained or append-only audit log | Architecture | **P1** |
| R-009 | Settlement worker settlement price precision / Draw detection | Financial | Medium | Medium | 🟡 **MEDIUM** | Define decimal precision model and rounding rules for comparison | Architecture | **P2** |
| R-010 | Referral system has no architectural module | Product | High | Medium | 🟡 **MEDIUM** | Define Referral Module in SAD before development | Architecture | **P2** |
| R-011 | Deployment rollback corrupts in-flight transactions | Operational | Low | High | 🟡 **MEDIUM** | Define migration versioning and backward-compatible schema policy | DevOps | **P2** |
| R-012 | Self-exclusion not enforced at trade placement gate | Product / Compliance | Medium | Medium | 🟡 **MEDIUM** | Add self-exclusion check to Risk Engine validation chain | Architecture | **P2** |
| R-013 | Price Feed Service embedded in API process; restart breaks feed | Operational | High | Medium | 🟡 **MEDIUM** | Define Price Feed Service as a separate, independent process | Architecture | **P2** |
| R-014 | Refresh token rotation policy not defined | Security | Medium | Medium | 🟡 **MEDIUM** | Define refresh token rotation on use; absolute expiry policy | Security | **P2** |
| R-015 | Queue depth spike at mass contract expiry not auto-scaled | Scalability | Medium | Medium | 🟡 **MEDIUM** | Define queue depth alert threshold and auto-scaling trigger | DevOps | **P2** |
| R-016 | RTO/RPO not defined | Operational | — | High | 🟡 **MEDIUM** | Define and document Recovery Time and Recovery Point Objectives | Product | **P2** |
| R-017 | Redis session and pricing on same cluster | Infrastructure | Low | Medium | 🟡 **MEDIUM** | Separate Redis clusters for sessions and pricing | DevOps | **P3** |
| R-018 | Admin privilege escalation (admin elevating user roles) | Security | Low | Medium | 🟡 **MEDIUM** | Guard against role elevation via permission scope limits | Security | **P3** |

---

## 11. Improvement Recommendations

### 🔴 Critical — Must Fix Before Development Begins

**CR-001: Define the atomic settlement status transition**
The settlement worker must use an atomic database operation to transition contract status from `Active` to `Settling` before any financial operation occurs. If this atomic update affects 0 rows, the job is a duplicate and must be discarded. This single change closes the double-settlement vulnerability.

**CR-002: Implement a persistent tick price store**
The Pricing Service must write every price tick to a persistent time-indexed store (e.g., a `price_ticks` table in PostgreSQL, or a time-series database). Settlement workers must retrieve the settlement price by querying `price_ticks WHERE symbol = ? AND tick_time <= ?` at the contract expiry timestamp. Redis remains for live display only.

**CR-003: Mandate wallet locking mechanism explicitly**
The architecture must specify the exact locking strategy for concurrent wallet updates: pessimistic locking (`SELECT FOR UPDATE`) or optimistic locking (version field with retry). The choice must be documented and enforced in the Wallet Module specification.

**CR-004: Define Redis fail-closed behaviour**
When Redis is unreachable: authentication must refuse to validate tokens (fail closed, not fail open), rate limiting must default to a conservative fixed-rate fallback, and trading must halt. The architecture must document this explicitly.

**CR-005: Route all financial events through the durable message broker**
Remove the in-process event bus for financial domain events. All events involving money (`DepositCompleted`, `TradeOpened`, `TradeSettled`, `WalletCredited`, `WalletDebited`, `WithdrawalApproved`) must be published directly to the external durable message broker to survive application restarts.

---

### 🟠 High Priority

**HP-001: Define the Referral Module**
The Referral System is a V1 business requirement. It must receive a module definition in the SAD before development begins, including its domain boundaries, event subscriptions (`TradeSettled`, `UserRegistered`), and how referral rewards are computed and credited.

**HP-002: Mandate MFA for privileged roles**
The authentication architecture must define that Finance Officer, Risk Manager, Compliance Officer, Admin, and Super Admin accounts are required to configure and use MFA. A policy-level flag on role definitions must enforce this.

**HP-003: Implement tamper-evident audit logging**
Audit log entries must include a hash of the previous entry (content + prior hash), creating a cryptographic chain. Any deletion or modification breaks the chain and is detectable. Alternatively, audit logs must be written to an append-only storage backend where database administrators cannot delete rows.

**HP-004: Define the Referral domain aggregate**
Once the Referral Module is defined, the Referral aggregate must include a lifecycle (Pending → Validated → Rewarded → Expired) and clear ownership rules for who can initiate or cancel a referral.

---

### 🟡 Medium Priority

**MP-001: Define the Price Feed Service as a separate process**
Separate the Price Feed Service from the API monolith process. It should run as an independent, always-on daemon that reconnects independently from API deployments.

**MP-002: Define the settlement decimal precision model**
Specify the number of decimal places used for price comparison in settlement, and the exact rule for Draw detection. Example: "Prices are stored and compared at 5 decimal places. A Draw is declared if the absolute difference between expiry and strike prices is less than 0.00001."

**MP-003: Define database schema isolation boundaries**
Specify that each module may only read and write to its own named schema. Cross-module data access must use module APIs, never direct SQL queries to another module's tables.

**MP-004: Define deployment and rollback safety policies**
Document zero-downtime deployment strategy, schema migration versioning approach, backward-compatible event schema policies, and worker drain procedures.

**MP-005: Add self-exclusion enforcement to the Risk Engine**
The Risk Engine validation chain (called during trade placement) must include a check against the user's self-exclusion status. A self-excluded user must receive a `403 Forbidden` response with an appropriate message.

---

### 🔵 Low Priority

**LP-001: Define RTO and RPO targets**
Recovery Time Objective and Recovery Point Objective must be documented and agreed with the business. They drive infrastructure decisions about backup frequency, standby promotion strategy, and incident response SLAs.

**LP-002: Separate Redis clusters for session and pricing concerns**
Prevent a failure in the price streaming cluster from affecting authentication session state, and vice versa.

**LP-003: Define idempotency key retention window**
Specify a minimum 7-day retention for payment idempotency keys, aligned with typical payment gateway retry windows.

**LP-004: Define queue depth auto-scaling triggers**
Specify the queue depth threshold at which the settlement worker fleet automatically scales out, and the idle threshold at which it scales in.

---

### 🔮 Future Enhancements (Post-V1)

**FE-001: CQRS read model for admin and reporting**
As the admin data surface grows, introduce a dedicated read model (CQRS read side) built from domain events, allowing admin dashboards and reports to query without touching the primary write database.

**FE-002: Four-eyes principle for critical admin actions**
For high-risk admin operations (manual wallet adjustments, Super Admin account creation), implement a dual-approval workflow requiring a second authorized admin to confirm.

---

## 12. Approval Decision & Mandatory Actions

### Implementation Readiness Checklist

| # | Mandatory Action | Status | Priority |
| :--- | :--- | :--- | :--- |
| 1 | Atomic settlement status transition defined and documented | ❌ Open | P0 Critical |
| 2 | Persistent price tick store specified for settlement | ❌ Open | P0 Critical |
| 3 | Wallet concurrent access locking strategy explicitly defined | ❌ Open | P0 Critical |
| 4 | Redis fail-closed behaviour documented | ❌ Open | P0 Critical |
| 5 | Financial domain events routed through durable broker | ❌ Open | P0 Critical |
| 6 | Referral Module defined in SAD | ❌ Open | P1 High |
| 7 | MFA mandated for privileged roles in Auth architecture | ❌ Open | P1 High |
| 8 | Tamper-evident audit log mechanism specified | ❌ Open | P1 High |
| 9 | Price Feed Service defined as separate process | ❌ Open | P2 Medium |
| 10 | Decimal precision model for settlement defined | ❌ Open | P2 Medium |
| 11 | Database schema isolation policy defined | ❌ Open | P2 Medium |
| 12 | Deployment & rollback safety policy documented | ❌ Open | P2 Medium |
| 13 | Self-exclusion enforcement added to Risk Engine chain | ❌ Open | P2 Medium |

---

### 📋 Final Approval Decision

```
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║   ARCHITECTURE REVIEW VERDICT                                     ║
║                                                                   ║
║   APPROVED WITH MANDATORY CHANGES                                 ║
║                                                                   ║
║   The architectural foundation is sound and professionally        ║
║   conceived. The core technology choices (Modular Monolith,       ║
║   PostgreSQL, Redis, queue-based settlement, double-entry         ║
║   ledger) are correct for this domain and team profile.           ║
║                                                                   ║
║   However, FIVE CRITICAL findings (CR-001 through CR-005)         ║
║   represent direct paths to financial data loss and security      ║
║   regression. These are not edge cases — they are predictable,    ║
║   reproducible failure modes under normal operating conditions.   ║
║                                                                   ║
║   CONDITION FOR APPROVAL:                                         ║
║   The five Critical recommendations must be resolved and          ║
║   incorporated into an updated Architecture Document              ║
║   (v1.1) before any module development begins.                    ║
║                                                                   ║
║   The three High Priority recommendations must be addressed       ║
║   before the end of Milestone 2.                                  ║
║                                                                   ║
║   Development may begin on non-financial scaffolding              ║
║   (environment setup, CI/CD pipelines, frontend layout)           ║
║   while the architecture is being updated.                        ║
║                                                                   ║
║   Composite Readiness Score: 66 / 100                             ║
║   Required Score for Full Approval: ≥ 80 / 100                   ║
║                                                                   ║
║   Reviewer: Independent Principal Software Architect              ║
║   Date: 2026-07-22                                                ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```
