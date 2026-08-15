# WORK PACKAGE: WP-19_FRONTEND_WALLET_AND_PAYMENT_UI

---

## §1 Work Package Identity

| Field | Value |
|-------|-------|
| **WP-ID** | WP-19 |
| **Name** | Frontend Wallet & Payment UI |
| **Phase** | Phase 10 (Frontend Implementation) |
| **Module** | Frontend / Wallet / Payments |
| **Critical Path** | Yes |
| **Estimated Effort** | M (Fibonacci: 5) |
| **Executor** | AI Agent / Frontend Dev |
| **Owner Review Required** | Yes |

---

## §2 Before You Start

### §2.1 Prerequisites (Must Be Complete)
| WP-ID | Name | Status |
|-------|------|--------|
| WP-06 | Wallet Module (Backend) | ✅ Complete |
| WP-16 | Frontend Design System | ✅ Complete |
| WP-17 | Frontend Auth Screens & App Shell | ✅ Complete |

**Note**: WP-07 (Payment Module Backend) is currently **Pending**. Scaffolding for Deposits/Withdrawals will be created, but actual execution flow (Daraja STK Push / Webhooks) will be integrated once WP-07 is complete.

### §2.2 Documents to Read
| Document | Sections | Why Needed |
|----------|----------|------------|
| docs/ProjectAnswers.md | §C | M-Pesa limits and fees (KES). |
| 11_IMPLEMENTATION_SPECIFICATION.md | §7.3, §7.4 | Wallet and Payment module patterns. |
| 06_DATABASE_DESIGN_SPECIFICATION.md | §5.9, §5.10 | Wallet and Ledger schema. |
| 07_API_DESIGN_SPECIFICATION.md | §9, §10 | Wallet and Payment API endpoints. |
| 08_UI_UX_DESIGN_SPECIFICATION.md | §8, §13 | Wallet layout and components. |
| 14_DEVELOPER_HANDBOOK_AND_CODING_STANDARDS.md | §3.2, §6 | React standards and `@/` aliases. |
| docs/15_MASTER_IMPLEMENTATION_CHECKLIST.md | 10.4, 10.5 | Scope coverage requirements. |

### §2.3 Decisions Already Made

**READ `docs/ProjectAnswers.md` FIRST.**

| Decision | Value | Source |
|----------|-------|--------|
| Base Currency | KES | ProjectAnswers.md §C |
| Min Deposit | 500 KES | ProjectAnswers.md §C7 |
| Min Withdrawal | 1,500 KES | ProjectAnswers.md §C9 |
| Withdrawal Fee | 2% | ProjectAnswers.md §C11 |
| Primary Gateway | M-Pesa | ProjectAnswers.md §C1 |

### §2.4 Decisions Pending (Ask Owner If Not in ProjectAnswers.md)

| Item | Value in ProjectAnswers.md | Why Needed | Blocker? |
|------|---------------------------|------------|----------|
| Backup Gateway | [PENDING] | Bank or Card option | No |

### §2.5 Secret Handling Rule

**NEVER hardcode secrets, API keys, passwords, or connection strings in code.**

- Use `import.meta.env.VITE_API_BASE_URL` for backend calls via `apiClient` (as per Vite standards in DHCS §6).
- Reference `.env.example` for all key names.
- Do not expose Daraja Consumer Secrets or Passkeys in the frontend; these MUST remain on the backend (WP-07). The frontend only transmits user identifiers (Phone) and amounts.

---

## §3 What You'll Build

### §3.1 Scope & E2E Acceptance Criteria
- [ ] **Wallet Overview Page (Task 10.4)**:
    - **AC1**: Display current Balance, Locked Balance, and Available Balance in KES.
    - **AC2**: Display Status badge for User KYC level (e.g., Unverified, Pending, Verified).
- [ ] **Transaction History Table (Task 10.4)**:
    - **AC3**: Cursor-paginated list of ledger entries with Type, Amount, Status, and Date.
    - **AC4**: Details modal for viewing transaction metadata (Reference ID, Description).
- [ ] **Deposit Flow (Task 10.5)**:
    - **AC5**: Amount input with KES quick-select buttons (500, 1000, 5000).
    - **AC6**: M-Pesa Phone validation (Safaricom format: 07xx, 01xx, +254xx).
    - **AC7**: Modal handling STK Push "Processing" and "Success/Fail" feedback.
- [ ] **Withdrawal Flow (Task 10.5)**:
    - **AC8**: Amount input with available balance check and KYC blocking if not "Verified".
    - **AC9**: Live calculation display for 2% fee and net payout.
- [ ] **Navbar Integration**:
    - **AC10**: Replace placeholder `$0.00` in top navbar with real-time KES balance fetched via `useWallet`.

### §3.2 Out of Scope
- [ ] Actual M-Pesa Daraja integration logic (handled in WP-07 Backend).
- [ ] Manual withdrawal approval screens (handled in WP-20 Admin Dashboard).
- [ ] Crypto/Card gateway integration (future phase).

### §3.3 Deliverables
**Note: The following files do not yet exist and must be implemented at these paths.**

| Deliverable | Format | Location |
|-------------|--------|----------|
| Wallet Page | File | `frontend/src/pages/wallet/WalletPage.tsx` |
| Deposit Form | Component | `frontend/src/pages/wallet/components/DepositForm.tsx` |
| Withdraw Form | Component | `frontend/src/pages/wallet/components/WithdrawForm.tsx` |
| Ledger Table | Component | `frontend/src/pages/wallet/components/TransactionHistory.tsx` |
| Wallet Hook | Hook | `frontend/src/shared/hooks/useWallet.ts` |

---

## §4 Technical Specification

### §4.1 Architecture
- **State Management**: Implement `useWallet` hook to encapsulate `apiClient` calls for balance and ledger.
- **Polling**: Implement short-polling (every 30s) for balance updates while the user is on the `/wallet` route.
- **Formatting**: Create `currencyUtils.ts` to format KES values (e.g., `KES 1,250.00`) using monospace font as per UDS §2.1.

### §4.2 Database
None (Frontend only).

### §4.3 API Endpoints
| Method | Path | Request DTO | Use Case |
|--------|------|-------------|----------|
| GET | `/api/v1/wallets/balance` | - | Fetch current balances |
| GET | `/api/v1/wallets/ledger` | `CursorParams` | Fetch transaction history |
| POST | `/api/v1/payments/deposit/initiate` | `DepositDto` | Start M-Pesa push |
| POST | `/api/v1/payments/withdraw/request` | `WithdrawDto` | Submit withdrawal |

Reference ADS §9 and §10.

### §4.4 UI Screens
| Screen | Route | Components | API Calls |
|--------|-------|------------|-----------|
| Wallet Overview | `/wallet` | `StatCards`, `TransactionTable` | `GET /wallets/balance`, `GET /wallets/ledger` |
| Deposit | `/wallet/deposit` | `DepositForm`, `MpesaLogo` | `POST /payments/deposit/initiate` |
| Withdraw | `/wallet/withdraw` | `WithdrawForm`, `BalanceCheck` | `POST /payments/withdraw/request` |

---

## §5 Manual Steps for Owner

### §5.1 Environment Configuration
Add the following to `frontend/.env` (or `.env.local` for local development):
```bash
# Backend URL
VITE_API_BASE_URL=https://skiespro-api-njuw.onrender.com/api/v1

# Required for display but handled by backend
VITE_MPESA_SHORTCODE=123456
```

### §5.2 Daraja Sandbox Setup
1. Ensure the backend (WP-07) is configured with Daraja credentials.
2. To test the frontend STK Push flow, use a Safaricom test phone number in the Deposit form.
3. Verify that the frontend correctly transitions from "Processing" to "Success" once the backend webhook is triggered.

### §5.3 Verification Steps
```bash
cd frontend
npm install
npm run dev
# 1. Navigate to /wallet
# 2. Verify that balance is fetched from the backend (ensure WP-06 is running)
# 3. Test pagination on the transaction list
# 4. Open Deposit modal and check KES formatting and phone validation
```

---

## §6 Testing Requirements

| Test Type | Coverage Target | Test IDs |
|-----------|----------------|----------|
| Unit tests | Wallet balance hook & KES formatting | FE-WLT-UNIT-001 |
| Integration tests | Ledger pagination (base64 cursor handling) | FE-WLT-INT-001 |
| Validation tests | Min/Max deposit & Safaricom Phone format | FE-PAY-VAL-001 |
| E2E tests | Deposit → Balance Refresh Flow | FE-WLT-E2E-001 |
| E2E tests | Withdrawal Request with KYC Check | FE-WLT-E2E-002 |

### §6.1 Specific Test Scenarios
- **Cursor Pagination**: Verify `next_cursor` correctly fetches the next batch of 20 items.
- **Phone Validation**:
    - Accept: `0712345678`, `0112345678`, `254712345678`, `+254712345678`.
    - Reject: Non-Safaricom prefixes or short/long numbers.
- **Rounding**: Ensure the 2% withdrawal fee rounds to 2 decimal places (e.g., 2.50).

---

## §7 Validation & Done Criteria

### §7.1 Code Quality Checklist
- [ ] Follows DHCS naming conventions.
- [ ] Monetary values use monospace font as per UDS §2.1.
- [ ] `apiClient` used for all calls with `Idempotency-Key` for POSTs.
- [ ] Error messages for "Insufficient Balance" or "KYC Needed" are clear.

### §7.2 Functional Verification (Mapping to MIC 10.4/10.5)
- [ ] Navbar balance updates after a simulated deposit (Satisfies Task 10.4).
- [ ] Ledger shows "Credit" in success green and "Debit" in danger red (Satisfies Task 10.4).
- [ ] User cannot initiate withdrawal if `kycStatus !== 'verified'` (Satisfies Task 10.5).

---

## §8 Handoff

### §8.1 Next Work Package
| WP-ID | Name | Why This Next |
|-------|------|---------------|
| WP-07 | Payment Module (Backend) | Actual M-Pesa integration to make the UI functional. |
| WP-08 | Pricing Service | Prerequisite for the Trading Interface. |

---

## §9 Risks & Blockers

| Risk | Probability | Impact | Mitigation | Owner |
|------|-------------|--------|-----------|-------|
| WP-07 Delay | High | Medium | Build UI with mock handlers for STK success/fail. | Executor |
| Safari mobile overflow | Medium | Low | Use `table-auto` with `overflow-x-auto` wrapper. | Executor |

---

## §10 Change Log

| Date | Change | By |
|------|--------|-----|
| 2026-08-11 | Created WP-19 Blueprint | Agent |
| 2026-08-11 | Revised scope, added E2E, §11, and env details | Agent |

---

## §11 Final Checklist (Before Closing This WP)
[ ] All prerequisites complete
[ ] All decisions provided
[ ] All deliverables produced at listed paths
[ ] All tests (Unit/Int/E2E) passing
[ ] Manual steps documented & verified
[ ] Owner sign-off obtained
[ ] Next WP identified
[ ] Handoff notes written

**END OF WORK PACKAGE WP-19**
