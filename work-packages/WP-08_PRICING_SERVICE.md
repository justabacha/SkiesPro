# WORK PACKAGE: WP-08_PRICING_SERVICE

---

## §1 Work Package Identity

| Field | Value |
|-------|-------|
| **WP-ID** | WP-08 |
| **Name** | Pricing Service |
| **Phase** | Phase 4: Pricing & Market Data |
| **Module** | Pricing / Market Data |
| **Critical Path** | Yes |
| **Estimated Effort** | L (Fibonacci: 8) |
| **Executor** | AI Agent / Backend Dev |
| **Owner Review Required** | Yes |

---

## §2 Before You Start

### §2.1 Prerequisites (Must Be Complete)
| WP-ID | Name | Status |
|-------|------|--------|
| WP-01 | Project Scaffolding | ✅ Complete |
| WP-02 | Database Setup | ✅ Complete |
| WP-03 | CI/CD & DevOps Foundation | ✅ Complete |

### §2.2 Documents to Read
| Document | Sections | Why Needed |
|----------|----------|------------|
| docs/ProjectAnswers.md | §H, #37, #38, #40, #41 | Source of truth for provider, validation rules, and market hours. |
| 11_IMPLEMENTATION_SPECIFICATION.md | §7.5 | Pricing Module blueprint and standalone process requirements. |
| 06_DATABASE_DESIGN_SPECIFICATION.md | §5.16, §5.17, §5.18 | Schema for price_ticks, candles, and market_hours. |
| 07_API_DESIGN_SPECIFICATION.md | §12 | Endpoints for pricing and assets. |
| 04_SOFTWARE_ARCHITECTURE.md | ADR-012 | Price Authority decision (PostgreSQL as source of truth for settlement). |
| 14_DEVELOPER_HANDBOOK_AND_CODING_STANDARDS.md | §5 | Backend coding standards. |

### §2.3 Decisions Already Made

**READ `docs/ProjectAnswers.md` FIRST.**

| Decision | Value | Source |
|----------|-------|--------|
| Price feed provider | **Binance** | ProjectAnswers.md §H1 |
| Price validation | **Within 5% of previous tick** | ProjectAnswers.md #37 |
| Stale price threshold | **30 seconds** | ProjectAnswers.md #38 |
| Default instruments | **EUR/USD, GBP/USD, USD/JPY, Gold, Oil** | ProjectAnswers.md #40 |
| Market hours | **Forex: 00:00-23:59 UTC Mon-Fri, Crypto: 24/7** | ProjectAnswers.md #41 |

### §2.4 Decisions Pending (Ask Owner If Not in ProjectAnswers.md)

| Item | Status | Why Needed | Blocker? |
|------|--------|------------|----------|
| Binance API Key | [PENDING] | Access to private streams (if needed, otherwise use public) | No |
| Fallback provider | [PENDING] | Redundancy for market data | No |

### §2.5 Secret Handling Rule

**NEVER hardcode secrets, API keys, passwords, or connection strings in code.**

- Use `process.env.BINANCE_API_KEY` for the provider key.
- Read `.env.example` for variable names.
- Owner must configure `.env` before running.

---

## §3 What You'll Build

### §3.1 Scope
- [ ] **Price Feed Ingestion Service (Task 4.1)**: Standalone process that connects to Binance WebSocket, normalizes ticks, and distributes them.
- [ ] **Price Validation (Task 4.2)**: Implementation of the 5% deviation check and stale price flagging.
- [ ] **Price Storage (Task 4.3)**: Persistence of every valid tick into the `pricing.price_ticks` table (Authoritative source for settlement).
- [ ] **Price Distribution (Task 4.4)**: Caching the latest price in Redis for sub-millisecond retrieval and publishing to Redis Pub/Sub.
- [ ] **OHLC Service (Task 4.5)**: Aggregation of ticks into 1-minute, 5-minute, etc., candles stored in `pricing.candles`.
- [ ] **Market Status Service**: Management of trading hours and session status per asset.
- [ ] **Pricing APIs**: Endpoints to query current prices, candles, and asset status.

### §3.2 Out of Scope
- [ ] WebSocket streaming to frontend clients (handled in WP-09).
- [ ] Trading Engine integration (handled in WP-10).

### §3.3 Deliverables
| Deliverable | Format | Location |
|-------------|--------|----------|
| Ingestion Service | TypeScript | `src/modules/pricing/services/PriceFeedIngestionService.ts` |
| OHLC Service | TypeScript | `src/modules/pricing/services/OHLCService.ts` |
| Validation Service | TypeScript | `src/modules/pricing/services/PriceValidationService.ts` |
| Market Status Service | TypeScript | `src/modules/pricing/services/MarketStatusService.ts` |
| Tick Repository | TypeScript | `src/modules/pricing/repositories/TickRepository.ts` |
| Candle Repository | TypeScript | `src/modules/pricing/repositories/CandleRepository.ts` |
| Asset/Price Controllers | TypeScript | `src/modules/pricing/controllers/` |
| Pricing Routes | TypeScript | `src/modules/pricing/pricing.routes.ts` |
| Price Feed Daemon | TypeScript | `src/modules/pricing/bin/price-feed.ts` |

---

## §4 Technical Specification

### §4.1 Architecture
- **Standalone Process**: The Price Feed Ingestion runs as a separate process from the main API server (per SAD §5.4).
- **Pattern**: Controller → Service → Repository.
- **Cache**: Redis for "latest price" cache (Pricing cluster).
- **Pub/Sub**: Redis for broadcasting ticks to WebSocket gateways.

### §4.2 Database
| Table | Purpose | Key Columns | Constraints |
|-------|---------|-------------|-------------|
| `pricing.price_ticks` | Authoritative tick store | `id`, `symbol`, `price`, `tick_time` | PK, FK(symbol), Index(symbol, tick_time DESC) |
| `pricing.candles` | OHLC data for charts | `id`, `symbol`, `granularity`, `open_time` | PK, UNIQUE(symbol, granularity, open_time) |
| `pricing.market_hours` | Market session config | `asset_symbol`, `opens_at`, `closes_at` | PK(asset_symbol), FK(asset_symbol) |

Reference DDS §5.16–5.18.

### §4.3 API Endpoints
| Method | Path | DTO | Response | Auth | Rate Limit |
|--------|------|-----|----------|------|------------|
| GET | `/api/v1/pricing/assets` | - | `AssetListResponse` | JWT | 60/min |
| GET | `/api/v1/pricing/assets/{symbol}/price` | - | `PriceResponse` | JWT | 60/min |
| GET | `/api/v1/pricing/assets/{symbol}/candles` | `CandleRequestDto` | `CandleResponse` | JWT | 60/min |
| GET | `/api/v1/pricing/status` | - | `MarketStatusResponse` | JWT | 60/min |

Reference ADS §12.

### §4.5 Security Requirements
| Requirement | Implementation | Reference |
|-------------|---------------|-----------|
| Feed Isolation | Run as separate OS process | SATM §8 |
| Price Integrity | Multi-step validation (5% rule) | ProjectAnswers #37 |
| Least Privilege | `app_pricing` DB user has only INSERT on ticks | DDS §12.3 |
| Settlement Source | Use `price_ticks` table, never Redis cache | ADR-012 |

---

## §5 Manual Steps for Owner

### §5.1 Environment Configuration
Add these to your root `.env`:
```bash
# Price Feed
BINANCE_API_KEY=
STALE_PRICE_THRESHOLD_SEC=30
PRICE_VALIDATION_THRESHOLD_PCT=0.05
```

### §5.2 Verification Steps
```bash
# Start the price feed daemon
npm run start:price-feed

# Verify ticks are entering the DB
psql -d skiespro -c "SELECT * FROM pricing.price_ticks ORDER BY created_at DESC LIMIT 5;"

# Check API response
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/v1/pricing/assets/EURUSD/price
```

---

## §6 Testing Requirements

| Test Type | Coverage Target | Scenarios |
|-----------|----------------|-----------|
| Unit tests | >80% | Validation logic (5% rule), OHLC aggregation, stale price detection. |
| Integration tests | Key flows | Feed ingestion → DB persistence → Redis cache update. |
| Performance tests | Latency | End-to-end latency (provider to Redis) < 100ms. |

---

## §7 Validation & Done Criteria

### §7.1 Code Quality Checklist
- [ ] Standalone daemon `price-feed.ts` handles auto-reconnect to Binance.
- [ ] No `SELECT *` used in repositories.
- [ ] High-frequency ticks are batched or handled without blocking the event loop.
- [ ] Logging follows standards (no secrets, structured JSON).

### §7.2 Functional Verification
- [ ] Every tick from Binance is written to `pricing.price_ticks`.
- [ ] 1-minute candles are generated accurately.
- [ ] Market closed hours are respected (trading blocked if market closed).

---

## §8 Handoff

### §8.1 Next Work Package
| WP-ID | Name | Why This Next |
|-------|------|---------------|
| WP-09 | WebSocket Streaming | Uses the Redis Pub/Sub ticks from this WP to stream to clients. |
| WP-10 | Trading Engine | Uses the price authority established here for settlements. |

---

## §9 Risks & Blockers

| Risk | Probability | Impact | Mitigation | Owner |
|------|-------------|--------|-----------|-------|
| Provider downtime | Medium | High | Implement fallback to Forex API (ProjectAnswers §H3). | Executor |
| Write bottleneck | Medium | Medium | Use monthly partitioning on ticks table (DDS §5.16). | Executor |

---

## §10 Change Log
| Date | Change | By |
|------|--------|-----|
| 2026-08-15 | Initial Blueprint | AI Agent |

---

## §11 Final Checklist
- [ ] All prerequisites complete (WP-01, 02, 03)
- [ ] All decisions extracted from ProjectAnswers.md
- [ ] Actual schema names used (`pricing.price_ticks`)
- [ ] Standalone process requirement included
- [ ] Price Authority rule (ADR-012) enforced
