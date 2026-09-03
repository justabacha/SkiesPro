# WORK PACKAGE: WP-11_SETTLEMENT_WORKER

---

## §1 Work Package Identity

| Field | Value |
| :--- | :--- |
| **WP-ID** | WP-11 |
| **Name** | Settlement Worker |
| **Phase** | Phase 6 |
| **Module** | Trading / Settlement |
| **Critical Path** | Yes |
| **Estimated Effort** | XL (Fibonacci: 13) |
| **Executor** | AI Agent / Backend Dev |
| **Owner Review Required** | Yes |

---

## §2 Before You Start

### §2.1 Prerequisites (Must Be Complete)
| WP-ID | Name | Status |
| :--- | :--- | :--- |
| WP-10 | Trading Engine (Backend) | ✅ Complete |
| WP-06 | Wallet Module Backend | ✅ Complete |
| WP-08 | Pricing Service | ✅ Complete |

### §2.2 Documents to Read
| Document | Sections | Why Needed |
| :--- | :--- | :--- |
| docs/ProjectAnswers.md | §D, #33 | Source of truth for payout ratio (60%). |
| docs/11_IMPLEMENTATION_SPECIFICATION.md | §3.9, §7.7 | Settlement Worker blueprint and step-by-step logic. |
| docs/06_DATABASE_DESIGN_SPECIFICATION.md | §5.12, §5.14, §8.2 | Database schema, Pip-Tolerance Draw Rule, and isolation levels. |
| docs/04_SOFTWARE_ARCHITECTURE.md | §3.9, §15 (ADR-010, ADR-011) | Settlement lifecycle, Atomic CAS pattern, and Transactional Outbox. |
| docs/09_SECURITY_ARCHITECTURE_AND_THREAT_MODEL.md | §11.2 | Settlement security and price authority rules. |
| docs/14_DEVELOPER_HANDBOOK_AND_CODING_STANDARDS.md | §5, §17 | Backend standards and immutable architecture. |
| docs/15_MASTER_IMPLEMENTATION_CHECKLIST.md | §4 (Phase 6), §7.3 | Tasks, acceptance criteria, and quality gates for financial modules. |
| docs/12_TESTING_STRATEGY_AND_QA_SPECIFICATION.md | §4.11, §6.3, §9 | Test IDs and financial testing strategy. |

### §2.3 Decisions Already Made
| Decision | Value | Source |
| :--- | :--- | :--- |
| Payout ratio | **60%** | ProjectAnswers.md #33 |
| Draw Rule (Pip-Tolerance) | **ABS(expiry - strike) < 0.00001** | DDS §5.14 (pip_decimal_places) |
| Oracle Gap Hard-Limit | **10 seconds** | Hardened WP-10 / IMP §7.7 |
| Price Authority | **PostgreSQL `pricing.price_ticks`** | ADR-012 |
| Transaction Isolation | **REPEATABLE READ** | DDS §8.2 |
| Terminal Statuses | **won, lost, draw, cancelled** | DDS §5.12 |

**NOTE on Phase Mapping**: Phase 6 in MIC ("Settlement & Workers") maps to Phase 8 in IMP ("Settlement"). Implementation must follow the technical requirements in IMP §7.7.

### §2.4 Decisions Pending (Ask Owner — Never Guess)
| Item | Status | Why Needed | Blocker? |
| :--- | :--- | :--- | :--- |
| None | ✅ Complete | All core settlement rules are defined. | |

### §2.5 Secret Handling Rule
**NEVER hardcode secrets in code.** Use `process.env.RABBITMQ_URL` etc. Reuse `pgPool` from `config/database.js`.

---

## §3 What You'll Build

### §3.1 Scope (MIC Tasks 6.1–6.6)
- [ ] **Settlement Runner (Task 6.1)**: Refine background process listening to RabbitMQ `trade.expiry`.
- [ ] **Atomic CAS Logic (Task 6.2)**: Implement `updateStatusCAS` to prevent double-settlement in distributed environments.
- [ ] **Payout Calculation (Task 6.3)**: Implementation of Win/Loss/Draw/Refund logic using 60% ratio and Pip-tolerance.
- [ ] **Idempotency Layer (Task 6.4)**: Ensure every message is acknowledged only after database commit.
- [ ] **Audit Trail (Task 6.5)**: Comprehensive logging to `trading.contract_events` and `wallet.ledger_entries`.
- [ ] **Outbox Pattern (Task 6.6)**: Emit `TradeSettled` event for downstream notification/UI updates via `events.event_outbox`.

### §3.2 Out of Scope
- [ ] Real-time WebSocket notifications to the client (Phase 4/10).
- [ ] Email/Push notification delivery (Phase 7).
- [ ] Daily Revenue Summary aggregation (Phase 9).

### §3.3 Deliverables
| Deliverable | Format | Location |
| :--- | :--- | :--- |
| Settlement Worker | TypeScript | `src/modules/trading/workers/settlementWorker.ts` |
| Payout Service | TypeScript | `src/modules/trading/services/payoutService.ts` |
| Settlement Repository | TypeScript | `src/modules/trading/repositories/settlementRepository.ts` |
| Idempotency Service | TypeScript | `src/shared/services/idempotencyService.ts` |
| Settlement Integration Tests | Jest | `tests/trading/integration/settlementIntegration.test.ts` |
| Settlement README | Markdown | `src/modules/trading/workers/README.md` |

---

## §4 Technical Specification

### §4.1 Architecture
- **Queue**: Listen to RabbitMQ `trade.expiry` queue.
- **Workflow**:
  1. Dequeue `{ contractId }`.
  2. **Atomic CAS**: `UPDATE binary_contracts SET status='settling' WHERE id=$1 AND status='active'`.
  3. If 0 rows → `ack()` and discard (already processed).
  4. Fetch settlement tick from `pricing.price_ticks` at `expiry_time`.
  5. **Oracle Gap Check**: If `now - tick_time > 10s` → `cancelAndRefund()`.
  6. Calculate Outcome: Win, Loss, or Draw (using 0.00001 tolerance from `trading.assets.pip_decimal_places`).
  7. **Financial TX (REPEATABLE READ)**:
     - Update wallet balance (`WalletService.credit`).
     - Write ledger entry (`LedgerRepository.create`).
     - Update contract to terminal status (`won`, `lost`, `draw`, or `cancelled`).
     - Record audit event in `trading.contract_events`.
     - Write `TradeSettled` record in `events.event_outbox` (ADR-011).
  8. `ack()` message.

### §4.2 Database
- **Schema**: `trading`, `wallet`, `events`.
- **Target Tables**: `trading.binary_contracts`, `trading.contract_events`, `wallet.wallets`, `wallet.ledger_entries`, `events.event_outbox`.

| Operation | Query Type | Consistency |
|-----------|------------|-------------|
| Status Lock | UPDATE ... WHERE status='active' | Atomic CAS |
| Payout | WalletService.credit() | Transactional |
| Audit | INSERT INTO contract_events | Transactional |
| Outbox | INSERT INTO event_outbox | Transactional |

### §4.5 Security Requirements (SATM §11.2)
- **Price Integrity**: Settlement MUST use PostgreSQL ticks, never Redis cache (ADR-012).
- **Zero Float Math**: All currency operations MUST use `Decimal.js` and string-based persistence.
- **Error Recovery**: If price tick is missing, the worker must nack/retry up to 3 times before moving to Dead Letter Queue (DLQ).
- **Isolation**: Use `REPEATABLE READ` for all financial updates (DDS §8.2).

---

## §5 Manual Steps for Owner

### §5.1 Environment Configuration
Ensure `ENABLE_SETTLEMENT_WORKER=true` is set in Render Dashboard or `.env`.

### §5.2 Verification Steps
1. Place a trade via the UI or curl.
2. Wait for expiration.
3. Verify `status` in `trading.binary_contracts` changes to `won`, `lost`, or `draw`.
4. Verify `wallet.ledger_entries` contains a matching credit entry for wins/refunds.
5. Verify `events.event_outbox` contains a `TradeSettled` event.

---

## §6 Testing Requirements

| Test Type | Coverage Target | Specific Scenarios / Test IDs |
| :--- | :--- | :--- |
| Unit Tests | >90% | SET-UNIT-001 to 010 (Outcome logic, CAS validation, Outbox writing). |
| Integration Tests | 100% Core Flows | SET-001 to 005 (Win/Loss/Draw for Higher/Lower). |
| Edge Case Tests | 100% | SET-006, SET-008, SET-009 (Missing Tick, Redis Down, Worker Crash). |
| Concurrency | Critical | SET-007 (100 simultaneous settlements, CAS proof). |

Reference **TSQS §4.11** (Settlement Module Unit Tests).

---

## §7 Validation & Done Criteria

### §7.1 Code Quality Checklist
- [ ] Atomic CAS pattern used for status transitions (ADR-010).
- [ ] No floating-point math in payout logic (uses `PayoutService` with `Decimal.js`).
- [ ] Transactional Outbox pattern implemented for `TradeSettled` (ADR-011).
- [ ] Worker handles RabbitMQ connection drops gracefully.
- [ ] Error messages in logs include `contractId` and `correlationId`.
- [ ] Module README exists and follows standards.

### §7.2 Functional Verification
- [ ] Winning trades credit user wallet with `stake * 1.6`.
- [ ] Draw trades refund `stake`.
- [ ] Stale ticks (>10s) trigger `cancelled` status and refund.
- [ ] Double-settlement attempt results in a single payout (CAS verified).
- [ ] `TradeSettled` event is visible in the outbox table.

---

## §8 Handoff

### §8.1 Next Work Package
| WP-ID | Name | Why |
| :--- | :--- | :--- |
| WP-12 | Notification System | Sends emails/alerts based on the `TradeSettled` outbox events created here. |

---

## §9 Risks & Blockers

| Risk | Probability | Impact | Mitigation | Owner |
| :--- | :--- | :--- | :--- | :--- |
| Database Lock Contention | Medium | Medium | Keep settlement transactions extremely tight. | Executor |
| Missing Price Ticks | Medium | High | Implement Oracle Gap refund + Retry strategy. | Executor |
| Double Payout Race Condition | Low | Critical | Strict implementation of the CAS update status. | Executor |
| Referenced Document Errors | Medium | Medium | Corrected in §2.2/§2.3 of this WP. | Owner |
| Incomplete Test Coverage | Medium | High | Enforced by SET-XXX test IDs in §6. | Executor |
| Missing Deliverables | High | High | Enforced by §3.3 deliverable list. | Executor |

---

## §10 Change Log
| Date | Change | By |
| :--- | :--- | :--- |
| 2026-09-01 | Initial WP-11 Blueprint | AI Agent |
| 2026-09-02 | Revision per Review: Corrected spec references, expanded scope (Task 6.6), added missing deliverables, added Test IDs, added missing risks. | AI Agent |

---

## §11 Final Checklist
- [x] All prerequisites complete
- [x] All decisions provided
- [x] All deliverables listed
- [ ] All tests passing
- [ ] Owner sign-off obtained
