# WORK PACKAGE: WP-06_WALLET_MODULE_BACKEND

---

## §1 Work Package Identity

| Field | Value |
|-------|-------|
| **WP-ID** | WP-06 |
| **Name** | Wallet Module Backend |
| **Phase** | Phase 3 (Wallet & Payments) |
| **Module** | Wallet / Payment |
| **Critical Path** | Yes |
| **Estimated Effort** | XL (Fibonacci: 13) |
| **Executor** | AI Agent / Backend Dev |
| **Owner Review Required** | Yes |

---

## §2 Before You Start

### §2.1 Prerequisites (Must Be Complete)
| WP-ID | Name | Status |
|-------|------|--------|
| WP-01 | Project Scaffolding | ✅ Complete |
| WP-02 | Database Setup | ✅ Complete |
| WP-04 | Auth Module Backend | ✅ Complete |
| WP-05 | User Profile & KYC | ✅ Complete |

**Cannot start until ALL prerequisites are COMPLETE.**

### §2.2 Documents to Read
| Document | Sections | Why Needed |
|----------|----------|------------|
| docs/ProjectAnswers.md | §C (M-Pesa Payments) | Supported currencies (KES), limits, and processing rules. |
| docs/06_DATABASE_DESIGN_SPECIFICATION.md | §5.9, §5.10, §5.11, §8, §9 | Wallet/Ledger schema, transaction design, and concurrency strategy. |
| docs/07_API_DESIGN_SPECIFICATION.md | §9 (Wallet), §10 (Payment) | Endpoint contracts, DTO shapes, and idempotency requirements. |
| docs/09_SECURITY_ARCHITECTURE_AND_THREAT_MODEL.md | §17.1 (Wallet/Payments) | Security controls: `SELECT FOR UPDATE`, immutable ledger, HMAC signatures. |
| docs/04_SOFTWARE_ARCHITECTURE.md | §15 (ADR-007, ADR-009, ADR-011) | Double-entry ledger, locking strategy, and transactional outbox. |
| docs/11_IMPLEMENTATION_SPECIFICATION.md | §7.3 (Wallet), §7.4 (Payment) | Module blueprints and service patterns. |
| docs/14_DEVELOPER_HANDBOOK_AND_CODING_STANDARDS.md | ALL | Naming conventions, error handling, and structured logging. |

**Read these BEFORE writing code.**

### §2.3 Decisions Already Made

**READ `docs/ProjectAnswers.md` FIRST.**

| Decision | Value | Source |
|----------|-------|--------|
| Authoritative DB | PostgreSQL | DDS §1.1 |
| Balance Data Type | NUMERIC(16,4) | DDS §18.4 |
| Locking Strategy | `SELECT FOR UPDATE` (Pessimistic) | ADR-009 |
| Ledger Pattern | Immutable Double-Entry | ADR-007, DDS §10.3 |
| Base Currency | **KES** (default) | ProjectAnswers.md §C7, DDS §5.9 |
| Supported Currencies | USD, KES, EUR, GBP | DDS §5.9 |
| Precision Rule | 4 decimal places for balances | DDS §18.4 |
| Min Deposit (KES) | 500 KES | ProjectAnswers.md §C7 |
| Min Withdrawal (KES) | 1,500 KES | ProjectAnswers.md §C9 |
| Withdrawal Fee | 2% | ProjectAnswers.md §C11 |

### §2.4 Decisions Pending (Ask Owner If Not in ProjectAnswers.md)

| Item | Value in ProjectAnswers.md | Why Needed | Blocker? |
|------|---------------------------|------------|----------|
| M-Pesa Shortcode | [PENDING] | Real payment processing | No (mock first) |
| Daraja Consumer Key | [PENDING] | Real payment processing | No (mock first) |

### §2.5 Secret Handling Rule

**NEVER hardcode secrets, API keys, passwords, or connection strings in code.**

- Use `process.env.DATABASE_URL`, `process.env.MPESA_CONSUMER_KEY`, etc.
- Reference `C:/SkiesPro/.env.example` for variable names.

---

## §3 What You'll Build

### §3.1 Scope
Clear description of what's IN scope:

- [ ] **Auth Refactor**: Update `AuthService.register` to emit a `UserRegisteredEvent` to `events.event_outbox`.
- [ ] **Wallet Core**: Logic for wallet creation triggered by user registration events.
- [ ] **Balance Management**: Atomic `balance` and `locked_balance` tracking.
- [ ] **Real-time Balance Column**: Add and maintain a calculated `available_balance` column via triggers.
- [ ] **Double-Entry Ledger**: Immutable audit trail for every fund movement (Debits/Credits).
- [ ] **Financial APIs**: Endpoints for balance checks, ledger history, and statements.
- [ ] **Payment Requests**: Logic for initiating deposits and withdrawal requests.
- [ ] **Idempotency Layer**: Enforcement of `Idempotency-Key` for all financial POSTs.
- [ ] **Async Jobs**: Daily reconciliation worker (Balance sum vs Ledger sum).

### §3.2 Out of Scope
- [ ] Real M-Pesa API integration (handled in WP-07).
- [ ] Real Trading Engine logic (handled in WP-08).
- [ ] UI Screens (handled in Frontend WPs).

### §3.3 Deliverables
| Deliverable | Format | Location |
|-------------|--------|----------|
| Available Balance Migration | SQL File | `migrations/026_add_available_balance_trigger.sql` |
| Wallet Module | Folder | `src/modules/wallet/` |
| Payment Module | Folder | `src/modules/payments/` |
| Wallet APIs | TS Files | `src/modules/wallet/controllers/` |
| Ledger Services | TS Files | `src/modules/wallet/services/` |
| Outbox Producer | TS Code | Updated `src/modules/auth/services/authService.ts` |
| Reconciliation Worker | TS File | `src/modules/wallet/workers/reconciliationWorker.ts` |
| Test Suite | TS Files | `tests/wallet/`, `tests/payments/` |

---

## §4 Technical Specification

### §4.1 Architecture
- **Service Pattern**: WalletService (Balance/Status) and LedgerService (Entries/Double-entry).
- **Transaction Pattern**: BEGIN → SELECT FOR UPDATE wallet → Validate → Perform logic → INSERT Ledger → UPDATE Wallet → COMMIT.
- **Outbox Pattern**: Financial events (Credit/Debit) must be written to `events.event_outbox` in the same transaction (ADR-011).
- **Double-Entry Invariant**: Every financial operation MUST produce balanced entries: `SUM(credits) - SUM(debits) = 0` for any `transaction_id`.
- **Rounding**: Round to 4 decimal places using a safe decimal library (e.g., `decimal.js` or `bignumber.js`).

### §4.2 Database
| Table | Purpose | Key Columns | Constraints |
|-------|---------|-------------|-------------|
| `wallet.wallets` | User balances | `user_id`, `balance`, `locked_balance`, `available_balance` | `available_balance` >= 0 |
| `wallet.ledger_entries` | Immutable audit trail | `transaction_id`, `amount`, `entry_type`, `reference_type` | INSERT-only |
| `payments.deposits` | Deposit tracking | `gateway_reference`, `amount`, `status` | UNIQUE ref |
| `payments.withdrawals` | Withdrawal tracking | `amount`, `net_amount`, `fee`, `status` | amount > 0 |

**Note**: All foreign keys to users must reference **`app_auth.users`**.

### §4.3 API Endpoints
| Method | Path | Request DTO | Response | Auth | Rate Limit |
|--------|------|-------------|----------|------|------------|
| GET | `/api/v1/wallets/balance` | None | `BalanceResponseDto` | JWT | 60/min |
| GET | `/api/v1/wallets/ledger` | `CursorPaginationDto` | `LedgerListResponse` | JWT | 60/min |
| POST | `/api/v1/payments/deposit/initiate` | `DepositInitiateDto` | `DepositResponseDto` | JWT | 30/min |
| POST | `/api/v1/payments/withdraw/request` | `WithdrawRequestDto` | `WithdrawResponseDto` | JWT | 10/min |

### §4.4 Security Requirements
| Requirement | Implementation | Reference |
|-------------|---------------|-----------|
| Double-Spend Prevention | `SELECT FOR UPDATE` on wallet row | ADR-009 |
| Non-Negative Available Balance | CHECK constraint + Pre-check in Service | DDS §10.2 |
| Ledger Immutability | Restricted DB User Permissions (SELECT/INSERT only) | DDS §10.4 |
| KYC Enforcement | Withdrawal service must check `app_auth.users.kyc_status == 'verified'` | SATM §17.1 |

---

## §5 Manual Steps for Owner

### §5.1 Database Permissions
Ensure the application's database user (`app_wallet`) has the following permissions:
```sql
GRANT SELECT, INSERT ON wallet.ledger_entries TO app_wallet;
REVOKE UPDATE, DELETE ON wallet.ledger_entries FROM app_wallet;
```

### §5.2 Environment Configuration
Add these variables to your local `.env`:
```bash
# Minimums (in base units - KES)
MIN_DEPOSIT_KES=500
MIN_WITHDRAWAL_KES=1500
WITHDRAWAL_FEE_PERCENT=2
```

### §5.3 Verification Steps
```bash
# Run concurrency tests specifically
npm test tests/wallet/concurrency.test.ts
# Run reconciliation check
ts-node scripts/reconcile-wallets.ts
```

---

## §6 Testing Requirements

| Test Type | Coverage Target | Test IDs |
|-----------|----------------|----------|
| Unit tests | >90% for Ledger logic | WLT-UNIT-001 |
| Integration tests | Complete Deposit -> Ledger -> Balance flow | WLT-INT-001 |
| Concurrency tests | 10 parallel debits exceeding balance | WLT-CON-001 |
| Security tests | 403 when unverified KYC user withdraws | WLT-SEC-001 |

---

## §7 Validation & Done Criteria

### §7.1 Code Quality Checklist
- [ ] Follows PascalCase for classes, snake_case for DB columns.
- [ ] No `any` types used in Ledger calculations.
- [ ] Transactions are short-lived (no external API calls inside).
- [ ] Audit logs are created for every balance adjustment.

### §7.2 Functional Verification
- [ ] User registration emits `UserRegisteredEvent`.
- [ ] `UserRegisteredEvent` triggers the creation of a `wallet.wallets` row.
- [ ] Deposit initiation returns a 201 and creates a `pending` deposit record.
- [ ] Withdrawal request fails if `available_balance` < `amount`.
- [ ] Every balance change has balanced `credit` and `debit` ledger entries.
- [ ] Reconciliation worker returns "Balanced" for a clean state.

---

## §8 Handoff

### §8.1 Next Work Package
| WP-ID | Name | Why This Next |
|-------|------|---------------|
| WP-07 | Payment Gateway (M-Pesa) | Requires the core wallet/payment state machines to be functional. |

### §8.2 Handoff Notes
The Ledger is the source of truth. If `wallets.balance` and `SUM(ledger_entries)` mismatch, the system should halt or alert. Ensure the `Outbox Relay` is configured to pick up `LedgerUpdatedEvent` for the notification system.

---

## §9 Risks & Blockers

| Risk | Probability | Impact | Mitigation | Owner |
|------|-------------|--------|-----------|-------|
| Lock Deadlock | Low | High | Standardize lock order: User -> Wallet -> Ledger. | Executor |
| Float Precision Error | Medium | High | Use `NUMERIC` in SQL and `Decimal` library in TS. | Executor |
| Ledger Imbalance | Low | Critical | Automated daily reconciliation job. | Executor |

---

## §10 Change Log

| Date | Change | By |
|------|--------|-----|
| 2026-08-12 | Created WP-06 Blueprint | AI Agent |
| 2026-08-12 | Revised for Codebase Alignment (Audit v1) | AI Auditor |

---

**END OF WORK PACKAGE WP-06**
