# WORK PACKAGE: WP-09_WEBSOCKET_STREAMING

---

## §1 Work Package Identity

| Field | Value |
|-------|-------|
| **WP-ID** | WP-09 |
| **Name** | WebSocket Price Streaming |
| **Phase** | Phase 4: Pricing & Market Data |
| **Module** | Pricing / Realtime / Infrastructure |
| **Critical Path** | Yes |
| **Estimated Effort** | L (Fibonacci: 8) |
| **Executor** | AI Agent / Backend Dev |
| **Owner Review Required** | Yes |

---

## §2 Before You Start

### §2.1 Prerequisites (Must Be Complete)
| WP-ID | Name | Status |
|-------|------|--------|
| WP-08 | Pricing Service | ✅ Complete |
| WP-04 | Auth Module Backend | ✅ Complete (required for JWT handshake validation) |

### §2.2 Documents to Read
| Document | Sections | Why Needed |
|----------|----------|------------|
| docs/ProjectAnswers.md | C, G, H | Market hours, asset list, and KES/base info affecting streaming scope. |
| 07_API_DESIGN_SPECIFICATION.md | 17 (full) | The complete WebSocket API contract: connection, lifecycle, messages, channels, close codes. |
| 11_IMPLEMENTATION_SPECIFICATION.md | 7.5 | Pricing module blueprint (realtime distribution section). |
| 04_SOFTWARE_ARCHITECTURE.md | 5, 11, 15 (ADR-012) | Streaming architecture, shared infra (Redis, WS deployment), and Price Authority ADR-012. |
| 09_SECURITY_ARCHITECTURE_AND_THREAT_MODEL.md | 4.4, 6.3, 7, 11 | JWT validation, token revocation, rate limiting, and WebSocket threat model. |
| 12_TESTING_STRATEGY_AND_QA_SPECIFICATION.md | 4.10, 13 | Pricing module tests + performance/latency testing. |
| 14_DEVELOPER_HANDBOOK_AND_CODING_STANDARDS.md | 2, 3, 5, 13 | Naming conventions, structure, backend standards, logging, error handling. |
| docs/15_MASTER_IMPLEMENTATION_CHECKLIST.md | 4.6, 5.6, 11.2 | Acceptance criteria (latency <100ms) and dependency checks. |

### §2.3 Decisions Already Made
| Decision | Value | Source |
|----------|-------|--------|
| WebSocket endpoint | `wss://<host>/ws/v1` | ADS 17.1 |
| Auth mechanism | JWT access token in query param (`?token=...`) | ADS 17.1 |
| Heartbeat | Client ping every 30s; server pong; 60s timeout → close code 4001 | ADS 17.3 |
| Max message size | 64 KB | ADS 3, 17.6 |
| Reconnect policy (client) | 1s → 5s → 15s → 30s cap | ADS 17.5 |
| Channels | `price.{symbol}`, `trades`, `notifications`, `wallet` | ADS 17.7 |
| Realtime latency target | < 100ms | MIC 4.6 |
| Price authority | PostgreSQL `pricing.price_ticks` (never deliver Redis cache as authoritative) | ADR-012 |

### §2.4 Decisions Pending (Ask Owner If Not in ProjectAnswers.md)
| Item | Status | Why Needed | Blocker? |
|------|--------|------------|----------|
| Redis instance (for Pub/Sub fan‑out) | [PENDING] | Gateway subscribes to `ticks.{symbol}` / `ticks:all` channels published by WP-08. InMemory `CacheAdapter` has no real Pub/Sub. | Yes |


**NOTE on the cache layer:** WP-08 publishes via `CacheClient.publish(cluster, channel, message)`. The default `InMemoryAdapter` does not implement real Pub/Sub; a Redis-backed adapter exposing a `subscribe` method is required for WP-09. Do not invent in-memory fan‑out as a production substitute.

### §2.5 Secret Handling Rule
**NEVER hardcode secrets in code.** Reuse the existing `TokenService` (instantiated from `process.env.JWT_PUBLIC_KEY` etc.) — do NOT re-implement key loading. Follow DHCS section 5.

---

## §3 What You'll Build

### §3.1 Scope (MIC Task 4.6)
- [ ] **WebSocket Gateway Server**: Standalone listener at `/ws/v1?token=JWT`, sharing the same HTTP origin as the main API server (Render deploys one port).
- [ ] **JWT Handshake Middleware**: Validate the token via `TokenService.validateAccessToken()` + `isTokenRevoked(jti)`; reject connections with code 1008 (policy violation) without exposing internals.
- [ ] **Connection Manager**: Track every live socket (userId, subscriptions, lastSeen); handle close/error; ping/pong watchdog that terminates at 60s inactivity with code 4001.
- [ ] **Subscription Manager**: Process client `subscribe` / `unsubscribe` JSON messages for channels `price.{symbol}`, `trades`, `notifications`, `wallet`; respond `subscribed` / `unsubscribed` (ADS 17.4, 17.6).
- [ ] **Redis Subscriber**: Subscribe to `ticks:{symbol}` and `ticks:all` (as published by WP-08 PriceDistributionService) and forward to matching live clients as a "price" message with ADS format (symbol, price, bid, ask, tick_time).
- [ ] **Reconnect Client Resilience**: Publish a small typed `WebSocketClient` helper (JS/TS) at `frontend/src/shared/ws/` with the 1s/5s/15s/30s backoff and channel re-subscribe-on-reconnect (ADS 17.5).
- [ ] **Message Envelope & Validation**: All inbound non-ping messages must be JSON, objects; messages >64KB get dropped + logged.
- [ ] **Error Stream**: Send `{ type: "error", code, message, request_id }` for invalid subscription requests (ADS `error` format).
- [ ] **Tests**: Unit, integration, and a latency/load baseline verifying <100ms end-to-end publisher → subscriber → client.

### §3.2 Out of Scope
- [ ] Trading Engine / POST trading flows — WP-10.
- [ ] `trades`, `notifications`, `wallet` streaming channels UNSCOPED for WP-09, but the channel-routing infrastructure must accept them and return a clean "not-yet-available" error.
- [ ] MQTT / STOMP alternatives, cross-process clustering (unless Render limits demand it).

### §3.3 Deliverables
| Deliverable | Format | Location |
|-------------|--------|----------|
| WebSocket Gateway server | TypeScript | `src/modules/pricing/websocket/priceGateway.ts` |
| Connection manager | TypeScript | `src/modules/pricing/websocket/connectionManager.ts` |
| Subscription manager | TypeScript | `src/modules/pricing/websocket/subscriptionManager.ts` |
| JWT handshake middleware | TypeScript | `src/modules/pricing/websocket/authMiddleware.ts` |
| Redis Pub/Sub subscriber | TypeScript | `src/modules/pricing/websocket/redisSubscriber.ts` |
| Socket bootstrap (attach to main server) | TypeScript | `src/infrastructure/websocket/wsServer.ts` |
| Client-side WS helper | TypeScript | `frontend/src/shared/ws/websocketClient.ts` |
| Cache subscribe capability (impl + adapter interface edit) | TypeScript | `src/infrastructure/cache/*` (add `subscribe()` to `ICache` + `CacheClient` + per-adapter) |
| Unit tests | Jest | `tests/pricing/websocket/` (auth, subscribe, heartbeat, close codes) |
| Integration tests | Jest + SuperTest | `tests/pricing/websocket/gateway.integration.test.ts` |
| Performance test script | Node | `tests/pricing/websocket/load.latency.test.ts` |

---

## §4 Technical Specification

### §4.1 Architecture
- **Single process**: attach `ws` WebSocketServer to the existing `http`/Express server. **Executor MUST refactor `src/index.ts`** to export `http.createServer(app)` (instead of calling `app.listen(PORT)` directly), then call `wsServer.attach(server, { path: '/ws/v1' })` and `server.listen(PORT)`. This satisfies the single-port deployment requirement of the Render infrastructure.
- **Redis**: `PriceDistributionService` publishes asynchronously; `RedisSubscriber` is the consumer. Requires adding `subscribe(channel, cb)` to the `ICache` interface and a real Redis adapter implementation (also add it to `CacheClient` with cluster `'pricing'`). `InMemoryAdapter` can implement subscribe (single-process) for tests.
- **Message flow**: tick → validation/storage (WP-08) → `cacheClient.publish('pricing', 'ticks:{symbol}', …)` → RedisSubscriber → `SubscriptionManager` routes by `price.{symbol}` or `price.all` → `ConnectionManager.send(userId|connections)` → client.
- **Concurrency**: per-connection outbound queue with batching (hold oldest, drop newest on overflow >256 messages); use `ws` `binaryType`/`utf8` only.
- **Rate limits**: inbound `subscribe` messages max 10/min/connection (configurable via `WS_INBOUND_RATE_LIMIT_PER_MIN`); over-limit → error then close 4001 after 3 violations.
- **Fail-open policy**: if Redis/Gateway fails, do NOT silently block REST pricing; WS clients get `error` (code `WS_001`) and re-connect. Never write price to WS when disconnected.

### §4.2 Database
None new — no DB migration. `readonly` reads go to Redis cache (price) or PostgreSQL `pricing.price_ticks` if Redis is down.

### §4.3 API / WS Contract (ADS 17)
| Action | Direction | Payload | Response |
|--------|-----------|---------|----------|
| Connect | Client → GW | `wss://…/ws/v1?token=JWT` URL | `{ type: "connected", client_id }` |
| Subscribe | Client → GW | `{ type: "subscribe", channels: [ { channel: "price", symbol: "EUR/USD" } ] }` | `{ type: "subscribed", channels: [...] }` |
| Unsubscribe | Client → GW | `{ type: "unsubscribe", channels: [...] }` | `{ type: "unsubscribed", channels: [...] }` |
| Ping/pong | C→GW / GW→C | `{ type: "ping" }` / `{ type: "pong", timestamp }` | — |
| Price tick | GW → client | `{ type: "price", symbol, price, bid, ask, tick_time }` | — |
| Error | GW → client | `{ type: "error", code, message, request_id }` | — |
| Close | GW → client | code 4001 (timeout), 1008 (policy violation) | — |

Message size: 64 KB max. Unknown channel → `WS_001`.

### §4.4 UI Screens (if frontend)

No standalone UI screens in this WP. The only frontend deliverable is the typed client helper `frontend/src/shared/ws/websocketClient.ts` (reconnect backoff per ADS 17.5), consumed by future UI WPs (Trading UI WP-18, wallet realtime hooks). Prices rendered from WS must follow UDS §2 monospace/formatting conventions.

### §4.5 Security Requirements (SATM 4.4, 6.3, 7, 11)
| Requirement | Implementation | Reference |
|-------------|---------------|-----------|
| Auth on connect | JWT verify via TokenService; reject revoked `jti` | ADS 17.1; TokenService.isTokenRevoked; SATM 4.4 |
| Message validation | All inbound via JSON schema equivalent (size + type + channels verified at the widget boundary) | DHCS 5.4 |
| DoS protection | Inbound rate limit, max connections/user, max channels/subscription (default 8) | SATM 6.3 |
| No secrets leakage | Never echo JWT, session id, refresh token on WS; error messages are generic with codes only | SATM 7 |

---

## §5 Manual Steps for Owner

### §5.1 Environment Configuration
Add to root `.env` (names only — ask owner for values):
```bash
# WebSocket
WS_PATH=/ws/v1
WS_MAX_CONNECTIONS_PER_USER=5
WS_MAX_SUBSCRIPTIONS_PER_CONNECTION=8
WS_INBOUND_RATE_LIMIT_PER_MIN=10

# Redis must be configured for Pub/Sub fan-out (WP-08 emits via CacheClient 'pricing' cluster)
REDIS_URL=
```

### §5.2 Verification Steps
```bash
# 1. Start the whole system (API + price feed)
npm run dev
npm run start:price-feed

# 2. Verify the REST API is healthy, then confirm the WS upgrade path is live:
curl http://localhost:3000/health

# 3. Run a wscat smoke test (note: ws:// for local dev, wss:// for staging/production):
npx wscat -c "ws://localhost:3000/ws/v1?token=$(echo 'paste-your-jwt')"
# Then send:
#   {"type":"subscribe","channels":[{"channel":"price","symbol":"EUR/USD"}]}
# Expect: {"type":"subscribed",...} then flowing {"type":"price",...} objects while the price-feed runs.
```

### §5.3 Verification Steps (Automated)
```bash
npm test tests/pricing/websocket/
npm run typecheck
npm run lint
```

---

## §6 Testing Requirements

| Test Type | Coverage Target | Test IDs (TSQS §4.10, §5, §6.9, §13) |
|-----------|----------------|----------|
| Unit tests | >80% | `PRC-UNIT-009..023` — auth accept/reject, revoked jti, subscribe routing, unknown channel, ping/pong watchdog, inactive killer 60s (code 4001). Extends the existing `PRC-UNIT-001..008` catalog. |
| Integration | Key flows | `API-PRC-009..012` — Redis publish → WS broadcast to N clients; subscribe/unsubscribe fan-out; multi-user isolation. Extends `API-PRC-001..008`. |
| Latency/load | <100ms (p95 <50ms per TSQS) | `PERF-LD-004` — WebSocket streaming: 1000 concurrent connections, tick every 200ms, p95 tick delivery <50ms. |

Reference TSQS §4.10 (Pricing unit tests), §5 (Integration testing), §6.9 (Pricing API tests), §13 (Performance/load tests).

---

## §7 Validation & Done Criteria

### §7.1 Code Quality Checklist
- [ ] Naming conventions (DHCS 2) and structure (DHCS 3) followed; no `any` on message payloads (typed interfaces).
- [ ] Controller / service / repository boundaries respected.
- [ ] Structured JSON log with `correlationId` and no secrets (DHCS 5.7).
- [ ] No SELECT *; no DB write in WS path (read-only reads from cache).
- [ ] Errors use standard WS error codes (`WS_001`); stack NEVER sent.

### §7.2 Functional Verification (MIC 4.6)
- [ ] Connecting with invalid/expired JWT → 1008 close (policy violation) per §3.1 (or explicit error frame).
- [ ] Subscribing to `price.EUR/USD` → receives only EUR/USD ticks.
- [ ] Subscribing to `price.all` → receives all symbol ticks.
- [ ] Ticks convert 1:1 from WP-08 Redis channel to ADS "price" message (price, bid, ask, tick_time).
- [ ] Latency measured (publisher → gateway → client) < 100ms with ≤100 connected clients sustained.
- [ ] Ping/pong keeps sockets alive beyond 60s; closed sockets reaped.

### §7.3 Owner Sign-Off
| Check | Verified By | Date |
|-------|-------------|------|
| Realtime prices visible on 2+ browsers simultaneously | Owner | |
| Closed / JWT-expired sockets dropped correctly | Owner | |
| Performance <100ms sustained | Owner | |

---

## §8 Handoff

### §8.1 Next Work Package
| WP-ID | Name | Why |
|-------|------|-----|
| WP-10 | Trading Engine (Backend) | Requires live price stream (this WP) + wallet locks (WP-06) to place/settle trades |

### §8.2 Handoff Notes
- Preserve `price.{symbol}` envelope format — Trading Engine + Trading UI (WP-18) will consume it.
- `trades` / `notifications` channels reserved in gateway routing but deliberately return `WS_001` "invalid channel" until their WPs land.

---

## §9 Risks & Blockers

| Risk | Probability | Impact | Mitigation | Owner |
|------|-------------|--------|-----------|-------|
| No real Redis in dev => no Pub/Sub | Medium | High | Provide Redis adapter (docker-compose) + documented fallback to live-file Redis for local; tests use real instance in CI | Executor |
| 64KB vs tick frequency | Low | Medium | Client-side coalescing (zoomed batch) optional; keep 1 message/tick | Executor |
| REST server + WS same port | Medium | Medium | Single `http.createServer` attach; health check ignores WS path | Executor |
| Deployment platform limits | Medium | Low | Render has WebSocket support on same port; document restart/resub pattern | Owner |
| Standard WebSocket codes interpretation | Low | Low | Use standard RFC 6455 close codes (1008 for policy violation) and document clearly in ADS §17 for client integration | Executor |

---

## §10 Change Log

| Date | Change | By |
|------|--------|-----|
| 2026-08-24 | Initial blueprint from template + ADS 17 + MIC 4.6 | Agent |
| 2026-08-24 | Revision per review: corrected TSQS/SATM/DHCS/ADR-012 cross-refs, formalized un-specced WS codes in §2.4, aligned test IDs to TSQS catalog, clarified `src/index.ts` http-server refactor in §4.1 | Agent |
| 2026-08-24 | Critical revision per review: removed non-standard close code 4003 (replaced with standard RFC 6455 code 1008), removed error codes WS_030/WS_900 (use only WS_001), updated test IDs to PRICING-WS- prefix, added risk for standard WebSocket codes | Agent |
| 2026-08-24 | Second review revision: corrected TSQS §6.9 reference to include §5 (Integration Testing), fixed wscat protocol for local dev (ws://), corrected close code inconsistency in §7.2 (4001→1008), reverted test IDs to existing PRC catalog per QA requirements, removed non-TSQS PERF-LD-009/010 references | Agent |

---

## §11 Final Checklist
- [x] Prerequisites listed (WP-08, WP-04 for JWT) — all complete.
- [x] All decisions extracted (Pending: REDIS_URL).
- [ ] Actual ADS contract used (path `/ws/v1`, 30s/60s heartbeat + 4001, price format).
- [ ] Latency target <100ms in scope plus tests.
- [ ] No DB migration required — noted explicitly.
- [ ] Client helper deliverable identified (frontend).
- [ ] Next WP (WP-10) identified.
- [x] Cross-references corrected (TSQS §4.10/§5/§6.9/§13, SATM §4.4/§6.3/§7/§11, DHCS §2/§3, ADR-012 in SAD §15).
- [x] Test IDs aligned to existing PRC catalog (PRC-UNIT-, API-PRC-, PERF-LD-).
- [x] `src/index.ts` http-server refactor explicitly specified in §4.1.
- [x] Critical code revisions completed: removed non-standard close code 4003 (replaced with RFC 6455 code 1008), removed error codes WS_030/WS_900 (use only WS_001), added risk for standard WebSocket codes, reverted test IDs to existing PRC catalog, removed non-TSQS PERF-LD-009/010 references.

---

**Note**: This is a *blueprint*. After owner approval the executor creates Code at the listed paths, runs tests (Section 6), executes manual verification (Section 5), and marks Section 7.3 sign-off before closing.

**END OF WORK PACKAGE WP-09**