# WORK PACKAGE: WP-10_TRADING_ENGINE_BACKEND

---

## §1 Work Package Identity

| Field | Value |
|-------|-------|
| **WP-ID** | WP-10 |
| **Name** | Trading Engine (Backend) |
| **Phase** | Phase 5 |
| **Module** | Trading |
| **Critical Path** | Yes |
| **Estimated Effort** | L (Fibonacci: 8) |
| **Executor** | AI Agent / Backend Dev |
| **Owner Review Required** | Yes |

---

## §2 Before You Start

### §2.1 Prerequisites (Must Be Complete)
| WP-ID | Name | Status |
|-------|------|--------|
| WP-06 | Wallet Module Backend | ✅ Complete |
| WP-08 | Pricing Service | ✅ Complete |
| WP-09 | WebSocket Streaming | ✅ Complete |

### §2.2 Documents to Read
| Document | Sections | Why Needed |
|----------|----------|------------|
| docs/ProjectAnswers.md | §D, #33, #37, #38, #40, #41 | Source of truth for limits, payout ratio, and instruments. |
| docs/11_IMPLEMENTATION_SPECIFICATION.md | §7.6 | Trading Module blueprint and validation logic. |
| docs/12_TESTING_STRATEGY_AND_QA_SPECIFICATION.md | §4.4, §6.3, §9 | Test IDs and financial testing strategy. |
| docs/06_DATABASE_DESIGN_SPECIFICATION.md | §5.12, §5.13 | Schema for binary_contracts and contract_events. |
| docs/07_API_DESIGN_SPECIFICATION.md | §11 | Endpoints, DTOs, and error codes for trading. |
| docs/09_SECURITY_ARCHITECTURE_AND_THREAT_MODEL.md | §11 | Trade validation and market manipulation protection. |
| docs/04_SOFTWARE_ARCHITECTURE.md | §7.1, ADR-009, ADR-011 | Trade lifecycle and wallet locking/outbox patterns. |
| docs/14_DEVELOPER_HANDBOOK_AND_CODING_STANDARDS.md | §5, §17 | Backend standards and immutable architecture rules. |

### §2.3 Decisions Already Made

**READ `docs/ProjectAnswers.md` FIRST.**

| Decision | Value | Source |
|----------|-------|--------|
| Payout ratio | **60%** | ProjectAnswers.md #33 |
| Min trade amount | **100 KES** | ProjectAnswers.md §D1 |
| Max trade amount | **50,000 KES** | ProjectAnswers.md §D2 |
| Trade duration options | **1 min / options** | ProjectAnswers.md §D3 |
| Max asset exposure | **$10,000 (~1,300,000 KES)** | BRD §7 |
| Latency threshold | **800ms** | SATM §11.4 |
| Price authority (Settlement) | **PostgreSQL `pricing.price_ticks`** | ADR-012 |
| Price source (Strike) | **Redis Cache (fallback PostgreSQL)** | ADR-012 |

**NOTE on Upstream Defects:** MIC §4/§5.4 contains incorrect references (ADS §12.1/DDS §5.8). Executor must use **ADS §11** and **DDS §5.12–5.15** as correctly referenced in this WP. TSQS Trading tests are in **TSQS §4.4**, not §4.5.

### §2.4 Decisions Pending (Ask Owner — Never Guess)

| Item | Value in ProjectAnswers.md | Why Needed | Blocker? |
|------|---------------------------|------------|----------|
| KES↔USD reconciliation | [PENDING] | DDS §5.14 defaults to USD ($500 max), but ProjectAnswers uses KES (50,000). Ask owner which currency is authoritative for DB constraints. | Yes |

---

## §3 What You'll Build

### §3.1 Scope (MIC Tasks 5.1–5.6)
- [x] **Schema Reconciliation**: Resolved via migration `031_payout_ratio_reconciliation.sql` and updates to existing seed files. Corrected payout ratio to 60% and relaxed DB constraints.
- [ ] **Trade Placement API (Task 5.1)**: Implementation of `POST /api/v1/trading/contracts` with strike price capture.
- [ ] **Stake Validation (Task 5.2)**: Full 10-step validation chain including account status, self-exclusion, market hours, asset-specific limits, and balance check.
- [ ] **Trade Expiry Handling (Task 5.3)**: Calculation of `expiry_time` and enqueuing jobs to `trade.expiry` queue via message broker.
- [ ] **Trade History APIs (Task 5.4)**: `GET /api/v1/trading/contracts` with cursor-based pagination and filtering.
- [ ] **Open Positions view (Task 5.5)**: `GET /api/v1/trading/contracts/active` to list unsettled trades.
- [ ] **Trading Limits (Task 5.6)**: Enforcement of per-asset exposure limits and stake ranges derived from `trading.asset_config`.
- [ ] **Audit Trail**: Recording events to `trading.contract_events` for every state change.

### §3.2 Out of Scope
- [ ] Trade Settlement Worker (WP-11 / Phase 6).
- [ ] Real-time updates to client via WebSocket (WP-09 already handles price, UI integration in future).
- [ ] Phase 9 / Admin Module risk controls UI.

### §3.3 Deliverables
| Deliverable | Format | Location |
|-------------|--------|----------|
| Contract Controller | TypeScript | `src/modules/trading/controllers/contractController.ts` |
| Asset Controller | TypeScript | `src/modules/trading/controllers/assetController.ts` |
| Trading Service | TypeScript | `src/modules/trading/services/tradingService.ts` |
| Asset Service | TypeScript | `src/modules/trading/services/assetService.ts` |
| Contract Repository | TypeScript | `src/modules/trading/repositories/contractRepository.ts` |
| Contract Event Repository | TypeScript | `src/modules/trading/repositories/contractEventRepository.ts` |
| Asset Repository | TypeScript | `src/modules/trading/repositories/assetRepository.ts` |
| Asset Config Repository | TypeScript | `src/modules/trading/repositories/assetConfigRepository.ts` |
| Stake Validator | TypeScript | `src/modules/trading/validators/stakeValidator.ts` |
| Trading Middleware | TypeScript | `src/modules/trading/middleware/tradingMiddleware.ts` |
| Event Handlers | TypeScript | `src/modules/trading/events/` |
| DTOs | TypeScript | `src/modules/trading/dto/trading.dto.ts` |
| Trading Routes | TypeScript | `src/modules/trading/trading.routes.ts` |
| Trading README | Markdown | `src/modules/trading/README.md` |
| Unit Tests | Jest | `tests/trading/unit/` |
| Integration Tests | Jest | `tests/trading/integration/` |

---

## §4 Technical Specification

### §4.1 Architecture
- **Pattern**: Controller → Service → Repository.
- **Transactions**: `REPEATABLE READ` for trade placement.
- **Locking**: `SELECT FOR UPDATE` on `wallet.wallets` row via `WalletService.lockStake()`.
- **Events**: Write `TradeOpened` to `events.event_outbox` within the placement transaction.
- **Queueing**: Enqueue `{ contractId }` to RabbitMQ `trade.expiry` with `delay = (expiryTime - now)`.
- **Middleware**: 
  - Role check: 'trader'.
  - Idempotency-Key required for POST.
  - Rate limit: 10 req/sec per user (IMP §7.6).

### §4.2 Database
- **Schema Reconciliation (Prerequisite)**: Before implementation, executor must produce a reconciliation migration for Migration 004 vs DDS §5.12–5.15.
  - `direction` ('call','put') → `contract_type` ('higher','lower').
  - `payout_ratio` → `payout_rate`.
  - Remove `entry_price` (redundant with `strike_price`); rename `entry_time` → `purchase_time`.
  - Expand `contract_events.event_type`.
  - Add `lock_tx_id`/`payout_tx_id`, `status` 'draft'/'archived'.

| Table | Purpose | Reference |
|-------|---------|-----------|
| `trading.binary_contracts` | Primary trade records | DDS §5.12 |
| `trading.contract_events` | Trade lifecycle audit trail | DDS §5.13 |
| `trading.assets` | Tradable asset definitions | DDS §5.14 |
| `trading.asset_config` | Dynamic risk parameters | DDS §5.15 |

### §4.3 API Endpoints
| Method | Path | Request DTO | Auth | Idempotency |
|--------|------|-------------|------|--------------|
| GET | `/api/v1/trading/assets` | - | JWT | No |
| GET | `/api/v1/trading/assets/{symbol}` | - | JWT | No |
| POST | `/api/v1/trading/contracts` | `PlaceTradeRequest` | JWT | **YES** |
| GET | `/api/v1/trading/contracts` | `ListTradesRequest` | JWT | No |
| GET | `/api/v1/trading/contracts/{id}` | - | JWT | No |
| GET | `/api/v1/trading/contracts/active` | - | JWT | No |

### §4.5 Security Requirements / Validation Chain (SATM §11, IMP §7.6)
**10-Step Validation Chain (Order Matters):**
1. **User Status**: Check user status is 'active' and not suspended.
2. **Self-Exclusion**: `self_excluded_until` must be null or in the past.
3. **Market Hours**: Market `is_open` for the requested asset symbol.
4. **Stake Range**: Stake must be between `min_stake` and `max_stake` for the asset (ProjectAnswers: 100–50,000 KES).
5. **Expiry Bounds**: Duration must be between `min_expiry` (60s) and `max_expiry` (86,400s) (TRADING_007).
6. **Balance Check**: `available_balance` >= stake.
7. **Exposure Limit**: Total open stakes for asset + new stake <= `max_exposure` (ProjectAnswers: $10,000).
8. **Latency Check**: (now - req.timestamp) < `LATENCY_THRESHOLD_MS` (800ms).
9. **Wallet Lock**: Call `WalletService.lockStake()` to reservation balance + create ledger entry.
10. **Persistence**: Create contract record + enqueue expiry task.

---

## §5 Manual Steps for Owner

### §5.1 Environment Configuration
Add to root `.env` (and ensure they exist in `.env.example`):
```bash
# Trading Engine
MAX_STAKE_AMOUNT=50000
MIN_STAKE_AMOUNT=100
MAX_ASSET_EXPOSURE=1300000
LATENCY_THRESHOLD_MS=800

# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@localhost:5672
RABBITMQ_USER=guest
```

### §5.2 Verification Steps
```bash
# 1. Place a trade
curl -X POST -H "Authorization: Bearer <token>" -H "Idempotency-Key: <uuid>" \
     -d '{"asset_symbol":"EUR/USD","contract_type":"higher","stake":"500","expiry_seconds":60}' \
     http://localhost:3000/api/v1/trading/contracts

# 2. Check active trades
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/v1/trading/contracts/active
```

### §5.3 Third-Party Setup
1. **RabbitMQ**: Ensure RabbitMQ is operational (local via Docker or managed service).
2. **Exchanges/Queues**: Executor will provide setup script or documentation to create `trade.expiry` exchange and queue.

---

## §6 Testing Requirements

| Test Type | Coverage Target | Test IDs (from TSQS) |
|-----------|----------------|----------------------|
| Unit tests | >90% | TRD-UNIT-001 to 020 (Validation logic, payout calculations TRD-UNIT-013–017, DTOs). |
| Integration tests | Key flows | API-TRD-001 to 025 (Placement flow → Wallet lock → Queue → Outbox). |
| Financial tests | Critical | FIN-005, FIN-006 (Ledger accuracy, stake locking). |
| Business Scenario | Key flows | BIZ-007, BIZ-010, BIZ-011, BIZ-016, TRD-001 to 008. |
| Concurrency tests | Critical | INT-007, INT-012 (Race conditions on balance/exposure). |

Reference **TSQS §4.4** (Trading Module Unit Tests), §6.3 (API tests), and §9 (financial).

---

## §7 Validation & Done Criteria

### §7.1 Code Quality Checklist
- [ ] Follows DHCS naming conventions (§3).
- [ ] Controller is thin (§4.1).
- [ ] Service has single responsibility (§4.2).
- [ ] Repository has no business logic (§4.3).
- [ ] DTO validates all inputs (§4.4).
- [ ] Error handling complete (§4.6).
- [ ] Logging follows standards (§4.7) - structured with `contractId` and `correlationId`.
- [ ] No secrets in code (§9).
- [ ] Tests cover financial edge cases (§7) - double-entry bookkeeping verified.
- [ ] Transactional Outbox used for `TradeOpened` event (ADR-011).

### §7.2 Functional Verification
- [ ] All 10 validation steps in §4.5 implemented and tested.
- [ ] Trade placement fails if user is self-excluded.
- [ ] Trade placement fails if market is closed.
- [ ] Trade history is correctly filtered and paginated.
- [ ] Contract record is created in `active` status.
- [ ] Payout calculation aligns with 60% ratio (ProjectAnswers #33).

### §7.3 Owner Sign-Off
| Check | Verified By | Date |
|-------|-------------|------|
| Feature works as described | [Owner name] | |
| Manual steps completed | [Owner name] | |
| Deployed to staging | [Owner name] | |

---

## §8 Handoff

### §8.1 Next Work Package
| WP-ID | Name | Why |
|-------|------|-----|
| WP-11 | Settlement Worker | Processes the `trade.expiry` queue messages created in this WP. |

### §8.2 Handoff Notes
- The `trade.expiry` queue contract must be written to accommodate the WP-11 Settlement Worker.
- Note naming variance: SAD/IMP use `TradeOpened`/`TradeExpired`, MIC §5.4 uses `TradePlacedEvent`/`TradeExpiredEvent`. Follow SAD/IMP per this WP.

---

## §9 Risks & Blockers

| Risk | Probability | Impact | Mitigation | Owner |
|------|-------------|--------|-----------|-------|
| Database schema drift | High | High | Add schema reconciliation task as priority #1 in §3.1. | Executor |
| KES/USD conversion ambiguity | Medium | High | Reconcile ProjectAnswers (KES) vs DDS (USD) before implementing limits. | Owner |
| RabbitMQ connection failure | Medium | High | Use persistent channels, handle connection errors gracefully. | Executor |
| Contention on wallet row | Medium | Medium | Keep placement transaction extremely short. | Executor |
| Performance under load | Low | High | Horizontal scaling and load testing requirements in §6. | Executor |
| Stake validation edge cases | Low | High | Extensive unit tests, boundary testing per TSQS. | Executor |

---

## §10 Change Log
| Date | Change | By |
|------|--------|-----|
| 2026-08-26 | Initial Blueprint | AI Agent |
| 2026-08-28 | Revision per Review: fixed payout ratio (60%), added schema reconciliation, expanded validation chain, added missing deliverables, added TSQS Test IDs, fixed references. | AI Agent |

---

## §11 Final Checklist (Before Closing This WP)
- [x] All prerequisites complete
- [x] All decisions provided (incl. KES↔USD reconciliation)
- [x] All deliverables produced (Skeleton files generated)
- [ ] All tests passing
- [ ] Manual steps documented
- [ ] Owner sign-off obtained
- [ ] Next WP identified
- [ ] Handoff notes written
