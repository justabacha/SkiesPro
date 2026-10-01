# WORK PACKAGE: WP-18_FRONTEND_TRADING_INTERFACE

---

## §1 Work Package Identity

| Field | Value |
|-------|-------|
| **WP-ID** | WP-18 |
| **Name** | Frontend Trading Interface |
| **Phase** | Phase 10: Frontend Implementation (Task 10.3) |
| **Module** | Trading / Frontend |
| **Critical Path** | Yes |
| **Estimated Effort** | XL (13) |
| **Executor** | Frontend Dev / AI Agent |
| **Owner Review Required** | Yes |

---

## §2 Before You Start

### §2.1 Prerequisites (Must Be Complete)
| WP-ID | Name | Status |
|-------|------|--------|
| WP-04 | Auth Module Backend | ✅ Complete |
| WP-06 | Wallet Module Backend | ✅ Complete |
| WP-08 | Pricing Service Backend | ✅ Complete |
| WP-09 | WebSocket Streaming Backend | ✅ Complete |
| WP-10 | Trading Engine Backend | ✅ Complete |
| WP-11 | Settlement Worker Backend | ✅ Complete |
| WP-16 | Frontend Design System | ✅ Complete |
| WP-17 | Frontend Auth Screens & App Shell | ✅ Complete |
| WP-19 | Frontend Wallet & Payment UI | ✅ Complete |

**Cannot start until ALL prerequisites are COMPLETE.**

### §2.2 Documents to Read
| Document | Sections | Why Needed |
|----------|----------|------------|
| docs/ProjectAnswers.md | ALL | Source of truth for business and trading decisions. |
| 07_API_DESIGN_SPECIFICATION.md | §11, §13 | Endpoints for trading (`/api/v1/trading/*`), price feeds, and WebSocket envelopes. |
| 08_UI_UX_DESIGN_SPECIFICATION.md | §7 | Trading interface layout, chart styling, position cards, and color tokens. |
| 09_SECURITY_ARCHITECTURE_AND_THREAT_MODEL.md | §6 | JWT client storage, CSRF, rate limit error handling. |
| 11_IMPLEMENTATION_SPECIFICATION.md | §7.6 | Trading placement logic, contract lifecycle, and WebSocket event structures. |
| 12_TESTING_STRATEGY_AND_QA_SPECIFICATION.md | §12 | Frontend component testing guidelines, E2E test requirements. |
| 14_DEVELOPER_HANDBOOK_AND_CODING_STANDARDS.md | §6 | Frontend React/TypeScript standards, module structure, and state management rules. |
| 15_MASTER_IMPLEMENTATION_CHECKLIST.md | Phase 10 (Task 10.3) | Requirements for Phase 10 trading interface completion. |

**Read these BEFORE writing code.**

### §2.3 Decisions Already Made

**READ `docs/ProjectAnswers.md` FIRST.** Extract all answered values into this table.

| Decision | Value | Source |
|----------|-------|--------|
| Payout ratio | 60% default (0.60) | ProjectAnswers.md §33 |
| Default instruments | EUR/USD, GBP/USD, USD/JPY, Gold, Oil | ProjectAnswers.md §40 |
| Minimum trade stake | 100 KES ($1.00 USD equivalent) | ProjectAnswers.md §D1 |
| Maximum trade stake | 50,000 KES ($500.00 USD equivalent) | ProjectAnswers.md §D2 |
| Trade duration options | 60s (1 min), 300s (5 min), 900s (15 min) | ProjectAnswers.md §D3 |
| Primary dark mode background | `#0F1117` | ProjectAnswers.md §31 |
| Font family | Inter | ProjectAnswers.md §26 |

### §2.4 Decisions Pending (Ask Owner If Not in ProjectAnswers.md)

| Item | Value in ProjectAnswers.md | Why Needed | Blocker? |
|------|---------------------------|------------|----------|
| Primary Domain Name | `[PENDING]` | Production API/WS base URL | No (using standard relative/env path `/api/v1` and `/ws/v1`) |

### §2.5 Secret Handling Rule

**NEVER hardcode secrets, API keys, passwords, or connection strings in code.**

- Read `.env.example` for variable NAMES only (`VITE_API_URL`, `VITE_WS_URL`).
- Use `import.meta.env.VITE_VAR_NAME` in all frontend code.
- Document: "Owner must configure `.env` before running".
- Never ask owner for actual secret values.

---

## §3 What You'll Build

### §3.1 Scope
Clear description of what's IN scope:

- [ ] **Trading Main Layout & App Page (`TradingPage.tsx`)**: Responsive, multi-panel trading terminal view adhering to dark theme (`#0F1117`).
- [ ] **Real-Time Tick Chart (`TradingChart.tsx`)**: Canvas or SVG line chart rendering live price ticks streamed via WebSockets for the selected instrument, featuring active strike price baseline, current spot cursor, and live win/loss status styling.
- [ ] **Asset / Symbol Selector (`AssetSelector.tsx`)**: Dropdown to select active instruments (EUR/USD, GBP/USD, USD/JPY, Gold, Oil) with live price updates and market open/closed status indicator.
- [ ] **Order Placement Form (`OrderForm.tsx`)**:
  - Higher / Lower direction buttons (Call/Put).
  - Stake input with min/max validation (100 KES / $1.00 min to 50,000 KES / $500.00 max).
  - Duration dropdown selector (60s, 300s, 900s).
  - Payout & prospective win calculator (e.g. Stake $10.00 + 60% Payout = Return $16.00).
  - Submit order button with loading state, rate limit handling, and balance verification.
- [ ] **Trade Confirmation Panel (`ContractConfirmationModal.tsx`)**: Modal/slide-over confirming Asset, Contract Type, Stake, Expiry, Payout, and Strike Price before submission.
- [ ] **Active Positions Tracker (`OpenPositions.tsx`)**: Live list of open binary contracts (`active` status) showing strike price, current spot price, live win/loss status indicator, and expiry countdown timer.
- [ ] **Trade History Panel (`TradeHistory.tsx`)**: Paginated list of settled contracts (`won`, `lost`, `draw`, `cancelled`) with outcome badges, payout details, and timestamp filter.
- [ ] **Latency Indicator (`LatencyIndicator.tsx`)**: Real-time status indicator displaying network ping/latency (<100ms green, 100-300ms yellow, >300ms red, or disconnected).
- [ ] **WebSocket & REST Client Services (`tradingService.ts`, `websocketService.ts`, `useTrading.ts`, `usePriceStream.ts`)**: Typed API methods for contract creation and historical queries; automatic reconnection and subscription manager for real-time tick feeds (`price.{symbol}`).

### §3.2 Out of Scope
Clear description of what's NOT included:

- [ ] Admin risk monitoring & override interface (handled in WP-14 / Phase 9 Admin Panel).
- [ ] Multi-indicator technical charting canvas / drawing tools (reserved for platform v1.1).
- [ ] Backend trade execution or settlement engine (already complete in WP-10 & WP-11).

### §3.3 Deliverables
| Deliverable | Format | Location |
|-------------|--------|----------|
| Trading Main Page | React Component | `frontend/src/pages/trading/TradingPage.tsx` |
| Trading Chart Component | React Component | `frontend/src/modules/trading/components/TradingChart.tsx` |
| Order Placement Form | React Component | `frontend/src/modules/trading/components/OrderForm.tsx` |
| Active Positions Component | React Component | `frontend/src/modules/trading/components/OpenPositions.tsx` |
| Trade History Component | React Component | `frontend/src/modules/trading/components/TradeHistory.tsx` |
| Asset Selector Component | React Component | `frontend/src/modules/trading/components/AssetSelector.tsx` |
| Trade Confirmation Panel | React Component | `frontend/src/modules/trading/components/ContractConfirmationModal.tsx` |
| Latency Indicator Component | React Component | `frontend/src/modules/trading/components/LatencyIndicator.tsx` |
| Trading Custom Hooks | TypeScript Modules | `frontend/src/modules/trading/hooks/useTrading.ts`, `usePriceStream.ts` |
| Trading API & WS Services | TypeScript Modules | `frontend/src/modules/trading/services/tradingService.ts`, `websocketService.ts` |
| Types & Interfaces | TypeScript File | `frontend/src/modules/trading/types/trading.types.ts` |
| Component & Integration Tests | Test Files | `frontend/src/modules/trading/__tests__/*.test.tsx` |

---

## §4 Technical Specification

### §4.1 Architecture & Codebase Integration
- **Separation of Concerns**: Frontend is completely isolated inside `frontend/` (Vite + React + TypeScript), consuming backend services via REST and WebSocket.
- **Shared Utilities Integration**:
  - Use `frontend/src/shared/services/apiClient.ts` (from WP-17) for all REST API calls (`/api/v1/trading/*`).
  - Leverage `frontend/src/shared/ws/websocketClient.ts` (from WP-09) for auto-reconnecting WebSocket connection management to `/ws/v1`.
- **Module Pattern**: Feature-based module architecture under `frontend/src/modules/trading/`.
- **Component Hierarchy**:
  `TradingPage` (`frontend/src/pages/trading/TradingPage.tsx`) → `AssetSelector`, `TradingChart`, `OrderForm`, `OpenPositions`, `TradeHistory`, `ContractConfirmationModal`, `LatencyIndicator`.
- **State Management**: Custom React hooks (`useTrading.ts` and `usePriceStream.ts`) under `frontend/src/modules/trading/hooks/`.
- **Real-Time Data Flow**: `websocketService` / `usePriceStream` connects to WS gateway → sends subscription payload `{"type":"subscribe","channels":[{"channel":"price","symbol":"EUR/USD"}]}` → feeds tick stream into `TradingChart` and open contract evaluation engine. (`npm run feed:price` mock tick generator is strictly for local testing; production uses live stream).

### §4.2 Database
None (Frontend module). Consumes database entities via REST API:
- `trading.binary_contracts`: `id`, `user_id`, `asset_symbol`, `contract_type`, `stake_amount`, `payout_rate`, `strike_price`, `expiry_time`, `status`, `settlement_price`.
- `trading.assets`: `symbol`, `name`, `is_active`, `payout_rate`.

### §4.3 API Endpoints
| Method | Path | Request DTO / Headers | Response | Auth | Rate Limit |
|--------|------|-----------------------|----------|------|------------|
| GET | `/api/v1/trading/assets` | None | `Asset[]` | Bearer JWT | 100/min |
| GET | `/api/v1/trading/assets/:symbol` | None | `Asset` | Bearer JWT | 100/min |
| POST | `/api/v1/trading/contracts` | `CreateTradeDto` + `Idempotency-Key: UUID` | `BinaryContract` | Bearer JWT | 30/min |
| GET | `/api/v1/trading/contracts` | `status`, `page`, `limit` | `PaginatedContracts` | Bearer JWT | 60/min |
| GET | `/api/v1/trading/contracts/active` | None | `BinaryContract[]` | Bearer JWT | 60/min |
| GET | `/api/v1/trading/contracts/:id` | None | `BinaryContract` | Bearer JWT | 60/min |
| WSS | `/ws/v1` | `{"type":"subscribe","channels":[{"channel":"price","symbol":"EUR/USD"}]}` | Live tick stream | Bearer JWT | N/A |

### §4.4 UI Screens
| Screen | Route | Components | API / WS Calls |
|--------|-------|------------|----------------|
| Trading Terminal | `/trading` | `TradingChart`, `OrderForm`, `AssetSelector`, `OpenPositions`, `TradeHistory`, `ContractConfirmationModal`, `LatencyIndicator` | GET `/trading/assets`, GET `/trading/assets/:symbol`, POST `/trading/contracts`, GET `/trading/contracts`, GET `/trading/contracts/active`, WSS `/ws/v1` |

### §4.5 Security Requirements
| Requirement | Implementation | Reference |
|-------------|---------------|-----------|
| Authentication | Bearer JWT passed in API `Authorization` header & WS auth handshake. | SATM §4, ADS §8 |
| Input Validation | Client-side stake, symbol, and duration validation prior to POST payload submission. | SATM §6, DHCS §6.4 |
| Idempotency Protection | Generate unique UUID v4 `Idempotency-Key` header for every trade creation request (`POST /api/v1/trading/contracts`). | SATM §7, ADS §11.3, DHCS §1.2 |
| Anti-Double-Click / Re-entry | Disable "Higher" / "Lower" buttons during API request inflight state. | SATM §7 |
| XSS Prevention | React JSX automatic string escaping for symbol & price renders. | SATM §10 |

---

## §5 Manual Steps for Owner

### §5.1 Database Setup
No new database setup required for frontend WP-18. Ensure migrations `001` through `032` are applied on backend PostgreSQL.

### §5.2 Environment Configuration
```bash
# Add / verify in frontend/.env
VITE_API_URL=http://localhost:3000/api/v1
VITE_WS_URL=ws://localhost:3000/ws/v1
```

### §5.3 Third-Party Setup
None required. Uses internal price stream and trading backend.

### §5.4 Verification Steps
```bash
# 1. Run frontend dev server
cd frontend
npm run dev

# 2. Run frontend test suite
npm run test

# 3. Verify page accessible at http://localhost:5173/trading
```

---

## §6 Testing Requirements

| Test Type | Coverage Target | Test IDs (from TSQS) |
|-----------|-----------------|----------------------|
| Unit / Screen Tests | >80% | `UI-TRADE-001` to `UI-TRADE-010` (Asset selector, stake input, payout calculation, direction buttons, market closed state, countdown timer, settlement animation, latency indicator) |
| Integration Tests | Key UI flows | `UI-TRADE-001` to `UI-TRADE-010`, `API-TRD-005` (Order placement flow → active position update → balance debit) |
| Component Tests | 100% components | `UI-TRADE-001` to `UI-TRADE-010` (`TradingChart`, `OrderForm`, `OpenPositions`, `TradeHistory`, `ContractConfirmationModal`, `LatencyIndicator` rendering) |

---

## §7 Validation & Done Criteria

### §7.1 Code Quality Checklist
- [ ] Follows DHCS React/TypeScript naming conventions (§3, §6).
- [ ] Components are structured, reusable, and single-responsibility (§4).
- [ ] No direct API logic inside JSX components; delegated to service modules.
- [ ] DTO & Form inputs validated on client before API dispatch.
- [ ] Graceful error handling for offline/reconnecting WebSocket states.
- [ ] Dark theme design tokens applied (`#0F1117`, Inter font, green `#10B981`, red `#EF4444`).
- [ ] No secret or sensitive keys hardcoded in frontend bundle.

### §7.2 Functional Verification
- [ ] Live price chart streams real-time ticks for selected symbol using standard JSON envelope (`type: "subscribe"`).
- [ ] User can switch assets and see updated live price stream.
- [ ] Order form calculates payout correctly (e.g. $10 stake → $16 payout).
- [ ] Order placement creates trade contract via POST `/api/v1/trading/contracts` with `Idempotency-Key` header.
- [ ] Balance updates automatically upon trade placement debit and win payout credit.
- [ ] Open positions show live timer countdown and active win/loss status via `GET /api/v1/trading/contracts/active`.
- [ ] Settled contracts automatically move from Open Positions to Trade History.

### §7.3 Owner Sign-Off
| Check | Verified By | Date |
|-------|-------------|------|
| Feature works as described | [Owner name] | |
| Manual steps completed | [Owner name] | |
| Deployed to staging | [Owner name] | |

---

## §8 Handoff

### §8.1 Next Work Package
| WP-ID | Name | Why This Next |
|-------|------|---------------|
| Phase 7 (WP-12) | Notification System | Enables automated email/SMS alerts on trade wins, losses, and wallet updates. |
| Phase 9 (WP-14) | Admin Dashboard | Allows administrators to monitor all user trades, set platform risk parameters, and manage payouts. |

### §8.2 Handoff Notes
`TradingPage` requires user login (wrapped with `ProtectedRoute`). Ensure backend (`npm run dev`) and WebSocket service are running when testing real-time price tick streaming.

---

## §9 Risks & Blockers

| Risk | Probability | Impact | Mitigation | Owner |
|------|-------------|--------|------------|-------|
| WebSocket disconnection / network drops | Medium | Medium | Auto-reconnect exponential backoff logic in `websocketService`. | Frontend Dev |
| High-frequency tick updates triggering excessive React re-renders | Medium | Medium | Throttle/debounce chart redraws using requestAnimationFrame or React refs. | Frontend Dev |
| WebSocket subscription payload schema mismatch | Medium | High | Strictly follow WP-09 envelope format: `{"type":"subscribe","channels":[{"channel":"price","symbol":"..."}]}`. | Frontend Dev |
| Duplicate order placement on retry / double-click | Low | High | Generate client-side UUID v4 `Idempotency-Key` header and disable buttons inflight. | Frontend Dev |

---

## §10 Change Log

| Date | Change | By |
|------|--------|----|
| 2026-10-01 | Created WP-18 Blueprint for Frontend Trading Interface | Lead Architect / AI Agent |
| 2026-10-02 | Review revision fixes: WS subscribe envelope, active/asset query endpoints, Idempotency-Key header, custom hooks deliverables, codebase architecture alignment (`frontend/src/shared/`), and official TSQS UI-TRADE-001..010 Test IDs. | Lead Architect / AI Agent |

---

## §11 Final Checklist (Before Closing This WP)
- [ ] All prerequisites complete
- [ ] All decisions provided
- [ ] All deliverables produced
- [ ] All tests passing
- [ ] Manual steps documented
- [ ] Owner sign-off obtained
- [ ] Next WP identified
- [ ] Handoff notes written
