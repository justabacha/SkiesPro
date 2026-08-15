# WORK PACKAGE: WP-07_PAYMENT_MODULE_BACKEND

---

## §1 Work Package Identity

| Field | Value |
|-------|-------|
| **WP-ID** | WP-07 |
| **Name** | Payment Module Backend (M-Pesa Integration) |
| **Phase** | Phase 3 (Wallet & Payments) |
| **Module** | Backend / Payments |
| **Critical Path** | Yes |
| **Estimated Effort** | XL (Fibonacci: 13) |
| **Executor** | AI Agent / Backend Dev |
| **Owner Review Required** | Yes |

---

## §2 Before You Start

### §2.1 Prerequisites (Must Be Complete)
| WP-ID | Name | Status |
|-------|------|--------|
| WP-02 | Database Setup | ✅ Complete |
| WP-04 | Auth Module (Backend) | ✅ Complete |
| WP-06 | Wallet Module (Backend) | ✅ Complete |
| WP-19 | Frontend Wallet UI | ✅ Complete |
| WP-07 | Payment Module Backend | ✅ Complete |

**Cannot start until ALL prerequisites are COMPLETE.**

### §2.2 Documents to Read
| Document | Sections | Why Needed |
|----------|----------|------------|
| docs/ProjectAnswers.md | §C | M-Pesa limits, fees, and shortcodes. |
| docs/11_IMPLEMENTATION_SPECIFICATION.md | §7.4 | Payment module pattern and security rules. |
| docs/06_DATABASE_DESIGN_SPECIFICATION.md | §5.19-5.23 | Payments schema and tables. |
| docs/07_API_DESIGN_SPECIFICATION.md | §10 | Payment API endpoints and DTOs. |
| docs/09_SECURITY_ARCHITECTURE_AND_THREAT_MODEL.md | §10 | HMAC signature and webhook security. |
| docs/14_DEVELOPER_HANDBOOK_AND_CODING_STANDARDS.md | §5 | Backend standards and logging. |

### §2.3 Decisions Already Made

**READ `docs/ProjectAnswers.md` FIRST.**

| Decision | Value | Source |
|----------|-------|--------|
| Primary Gateway | M-Pesa (Daraja API) | ProjectAnswers.md §C1 |
| Min Deposit | 500 KES | ProjectAnswers.md §C7 |
| Max Deposit | 100,000 KES | ProjectAnswers.md §C8 |
| Min Withdrawal | 1,500 KES | ProjectAnswers.md §C9 |
| Max Withdrawal | 60,000 KES | ProjectAnswers.md §C10 |
| Withdrawal Fee | 2% | ProjectAnswers.md §C11 |
| Base Currency | KES | ProjectAnswers.md §C12 |

### §2.4 Decisions Pending (Ask Owner If Not in ProjectAnswers.md)

| Item | Value in ProjectAnswers.md | Why Needed | Blocker? |
|------|---------------------------|------------|----------|
| Production Shortcode | [PENDING] | Real payment processing | No (Use Sandbox) |
| Daraja Live Keys | [PENDING] | Real payment processing | No (Use Sandbox) |

### §2.5 Secret Handling Rule

**NEVER hardcode secrets, API keys, passwords, or connection strings in code.**

- Use `process.env.MPESA_CONSUMER_KEY`, etc.
- All Daraja credentials MUST be stored in `.env` or Secrets Manager.
- Use `crypto` for generating secure `Idempotency-Key` or validating HMACs.

---

## §3 What You'll Build

### §3.1 Scope & E2E Acceptance Criteria
- [ ] **M-Pesa Gateway Adapter (Task 3.6)**:
    - **AC1**: Implement `MpesaMockAdapter` to simulate successful STK Push for unblocking frontend development.
    - **AC2**: Implement `DarajaMpesaAdapter` to connect to Safaricom Sandbox/Production APIs.
- [ ] **Deposit Flow (Task 3.4)**:
    - **AC3**: `POST /payments/deposit/initiate` validates amount and triggers STK Push via adapter.
    - **AC4**: `POST /payments/deposit/callback` handles Daraja webhook, verifies signature, and logs raw payload.
    - **AC5**: On successful payment, credit the user's wallet using `WalletService` (Double-entry).
- [ ] **Withdrawal Flow (Task 3.5)**:
    - **AC6**: `POST /payments/withdraw/request` verifies KYC status and available balance.
    - **AC7**: Lock withdrawal amount in `wallet.wallets` and create `pending` withdrawal record.
- [ ] **Idempotency & Integrity (Task 3.6)**:
    - **AC8**: Enforce `Idempotency-Key` header on all initiation requests.
    - **AC9**: Prevent duplicate processing of the same M-Pesa `CheckoutRequestID`.

### §3.2 Out of Scope
- [ ] Automated B2C Payout execution (Manual approval required for V1).
- [ ] Card/Crypto gateways.
- [ ] Admin approval UI (Handled in WP-20).

### §3.3 Deliverables (To be created)
| Deliverable | Format | Location |
|-------------|--------|----------|
| Payment Routes | File | `src/modules/payments/payment.routes.ts` |
| Payment Controller | File | `src/modules/payments/controllers/paymentController.ts` |
| Payment Service | File | `src/modules/payments/services/paymentService.ts` |
| M-Pesa Adapters | Folder | `src/modules/payments/adapters/mpesa/` |
| Payment Repository | File | `src/modules/payments/repositories/paymentRepository.ts` |

---

## §4 Technical Specification

### §4.1 Architecture
- **Adapter Pattern**: Define an interface `IPaymentGateway` with methods `initiateStkPush` and `queryTransaction`.
- **Factory**: `MpesaGatewayFactory` to return `Mock` or `Daraja` implementation based on `.env`.
- **Transaction**: Use database transactions to ensure `payments.deposits` status and `wallet.ledger_entries` are updated atomically.

### §4.2 Database
| Table | Purpose | Key Columns | Constraints |
|-------|---------|-------------|-------------|
| `payments.deposits` | Tracks STK Push requests | `id`, `user_id`, `status`, `checkout_request_id` | PK, FK(user_id), CHECK(status) |
| `payments.withdrawals` | Tracks withdrawal requests | `id`, `user_id`, `status`, `amount`, `fee` | PK, FK(user_id), CHECK(status) |
| `payments.idempotency_keys` | Prevents duplicate requests | `key`, `response_payload`, `expires_at` | PK, UNIQUE(key) |
| `payments.payment_gateways` | Gateway config | `id`, `name`, `is_active` | PK |
| `payments.payment_webhook_logs`| Audit trail | `id`, `raw_payload`, `gateway_id` | PK, FK(gateway_id) |

### §4.3 API Endpoints
| Method | Path | Request DTO | Response | Auth | Rate Limit |
|--------|------|-------------|----------|------|------------|
| POST | `/api/v1/payments/deposit/initiate` | `DepositInitDto` | `DepositResponseDto` | JWT | 10/min |
| POST | `/api/v1/payments/deposit/callback` | `DarajaCallbackDto` | `200 OK` | Public | - |
| GET | `/api/v1/payments/deposit/{id}/status` | - | `DepositStatusDto` | JWT | 60/min |
| POST | `/api/v1/payments/withdraw/request` | `WithdrawRequestDto` | `WithdrawResponseDto` | JWT | 5/min |
| GET | `/api/v1/payments/withdraw/{id}/status` | - | `WithdrawStatusDto` | JWT | 60/min |
| GET | `/api/v1/payments/gateways` | - | `GatewayListDto` | JWT | 60/min |

### §4.4 UI Screens
| Screen | Route | Components | API Calls |
|--------|-------|------------|-----------|
| Wallet Overview | `/wallet` | `StatCards`, `TransactionTable` | `GET /wallets/balance`, `GET /wallets/ledger` |
| Deposit | `/wallet/deposit` | `DepositForm`, `MpesaLogo` | `POST /payments/deposit/initiate` |
| Withdraw | `/wallet/withdraw` | `WithdrawForm`, `BalanceCheck` | `POST /payments/withdraw/request` |

### §4.5 Security Requirements
| Requirement | Implementation | Reference |
|-------------|---------------|-----------|
| HMAC Validation | Webhook signature verification | SATM §10.1 |
| Idempotency | Idempotency-Key header + DB table | ADS §1.5, SATM §6.4 |
| KYC Enforcement | Withdrawal blocked if KYC not verified | SATM §10.2 |
| Withdrawal Hold | 24h hold after password change | SATM §10.2 |
| Fraud Detection | Velocity checks on deposits | SATM §10.2 |

---

## §5 Manual Steps for Owner

### §5.1 Environment Configuration
Add these to your root `.env`:
```bash
# Gateway Mode: MOCK or DARAJA
PAYMENT_GATEWAY_MODE=MOCK

# Daraja Sandbox Credentials
MPESA_ENVIRONMENT=sandbox
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_PASSKEY=
MPESA_SHORTCODE=174379
MPESA_CALLBACK_URL=https://your-public-url.com/api/v1/payments/deposit/callback
```

### §5.2 Daraja Sandbox Setup
1. Register on [developer.safaricom.co.ke](https://developer.safaricom.co.ke).
2. Create a "Lipa na M-Pesa Sandbox" app.
3. Obtain your **Consumer Key** and **Secret**.

### §5.3 Verification Steps
```bash
# Run tests
npm test tests/payments/

# Verify health
curl http://localhost:3000/health
```

---

## §6 Testing Requirements

| Test Type | Coverage Target | Test IDs |
|-----------|----------------|----------|
| Unit tests | M-Pesa Adapter Logic | PAY-UNIT-001 |
| Integration tests | Deposit + Ledger Credit | PAY-INT-001 |
| Validation tests | KES Min/Max limits | PAY-VAL-001 |
| Security tests | Webhook IP/Signature Check | PAY-SEC-001 |

### §6.1 Specific Test Scenarios
- **Idempotency**: Submit same `Idempotency-Key` twice; verify second request returns cached response.
- **Double Payout**: Simulate two concurrent callback hits for same `CheckoutRequestID`; verify only one credit occurs.
- **Rounding**: Verify withdrawal fee (2%) is calculated correctly with 4 decimal places in DB.

---

## §7 Validation & Done Criteria

### §7.1 Code Quality Checklist
- [ ] No direct `pgPool.query` in services (use Repositories).
- [ ] Error messages for M-Pesa failures are user-friendly.
- [ ] All financial writes logged with `correlation_id`.

### §7.2 Functional Verification
- [ ] STK Push triggers on phone in `DARAJA` mode (Sandbox).
- [ ] Wallet balance increases automatically upon "Success" callback.
- [ ] Withdrawal fails if `kyc_status !== 'verified'`.

### §7.3 Owner Sign-Off
| Check | Verified By | Date |
|-------|-------------|------|
| Feature works as described | | |
| Manual steps completed | | |
| Deployed to staging | | |

---

## §8 Handoff

### §8.1 Next Work Package
| WP-ID | Name | Why This Next |
|-------|------|---------------|
| WP-08 | Pricing Service | Enables live trading. |
| WP-20 | Admin Dashboard | To approve the withdrawals created in WP-07. |

---

## §9 Risks & Blockers

| Risk | Probability | Impact | Mitigation | Owner |
|------|-------------|--------|-----------|-------|
| Daraja Downtime | Medium | High | Implement retry logic for STK requests. | Executor |
| Webhook reachability | High | Critical | Use `Ngrok` for local dev; verify Render SSL. | Owner |

---

## §10 Change Log

| Date | Change | By |
|------|--------|-----|
| 2026-08-15 | Created WP-07 Blueprint | Agent |
| 2026-08-15 | Revised based on review report (fixed references, added missing endpoints, added security/sign-off sections) | Agent |

---

## §11 Final Checklist
[ ] All prerequisites complete
[ ] All decisions provided
[ ] All deliverables produced at listed paths
[ ] All tests (Unit/Int) passing
[ ] Manual steps documented & verified
[ ] Owner sign-off obtained
[ ] Next WP identified
[ ] Handoff notes written

**END OF WORK PACKAGE WP-07**
