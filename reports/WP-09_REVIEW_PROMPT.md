# REVIEW WORK PACKAGE: WP-09_WEBSOCKET_STREAMING

## Your Task

Review `work-packages/WP-09_WEBSOCKET_STREAMING.md` for completeness, accuracy, and executability. This blueprint will be handed to an executor agent — it must be flawless.

## Source Documents (Read These)

1. `docs/templates/WORK_PACKAGE_TEMPLATE.md` — Verify format compliance
2. `docs/15_MASTER_IMPLEMENTATION_CHECKLIST.md` — Verify scope coverage (Task 4.6, §5.6 Pricing Module, §11.2 dependency graph, §7 quality gates)
3. `docs/07_API_DESIGN_SPECIFICATION.md` — §17 (full WebSocket API: Connection, Lifecycle, Heartbeats, Subscriptions, Reconnect Policy, Message Formats, Available Channels). **This is the PRIMARY contract for this WP.**
4. `docs/11_IMPLEMENTATION_SPECIFICATION.md` — §7.5 (Pricing module blueprint)
5. `docs/04_SOFTWARE_ARCHITECTURE.md` — §5, §11, ADR-012 (Price Authority)
6. `docs/09_SECURITY_ARCHITECTURE_AND_THREAT_MODEL.md` — §9 and JWT/WebSocket threat rules
7. `docs/12_TESTING_STRATEGY_AND_QA_SPECIFICATION.md` — §4.7 (pricing tests), §13 (performance/latency). Verify the `PRICING-WS-*` test-ID style matches TSQS conventions
8. `docs/14_DEVELOPER_HANDBOOK_AND_CODING_STANDARDS.md` — §3 (naming), §5.4 (validation), §5.7 (logging)
9. `docs/08_UI_UX_DESIGN_SPECIFICATION.md` — §2 (monospace/formatting referenced in WP §4.4)
10. `docs/ProjectAnswers.md` — §C, §G, §H (decisions used in WP §2.3)
11. `work-packages/WP-08_PRICING_SERVICE.md` + `reports/WP-08_EXECUTION_REPORT.md` — verify the handoff claim and the actual Redis channels published (`ticks:{symbol}` / `ticks:all`)

## CRITICAL NEW RULE: Verify Referenced Documents AND Code Assets Exist

Check the project tree before validating references.

**Documents:** Any path WP-09 references that does not exist → flag as **MISSING DEPENDENCY**.

**Code assets the WP claims exist for reuse — verify all of these:**
- `src/modules/auth/services/tokenService.ts` — exposes `validateAccessToken()` and `isTokenRevoked(jti)`? (WP §3.1 depends on them)
- `src/modules/pricing/services/priceDistributionService.ts` — publishes to `ticks:{symbol}` / `ticks:all` via `cacheClient.publish(...)`?
- `src/infrastructure/cache/CacheClient.ts`, `ICache.ts`, `InMemoryAdapter.ts` — currently LACK a `subscribe()` method? (WP requires adding it)
- `src/index.ts` — Express `app.listen` setup where the WP wants to attach the `ws` server?
- `frontend/src/shared/` — exists for the client-helper deliverable?
- `package.json` — do `npm test`, `npm run typecheck`, `npm run lint`, `npm run start:price-feed` scripts exist?
- `src/infrastructure/healthController.ts` — does `GET /health` exist (WP §5.2 calls it)?

## What You Must Check

### 1. Format Compliance
- All required sections per WORK_PACKAGE_TEMPLATE.md (§1–§11) present
- `§` prefix used consistently on every section/subsection
- Numbering complete — §4.4 (UI Screens) exists even if "N/A"

### 2. Scope Completeness
- MIC Task 4.6 (WebSocket streaming, latency <100ms) fully covered
- All of ADS §17 addressed (connect, lifecycle, heartbeat, subscriptions, reconnect, message formats, channels)
- Nothing from the WP-08 handoff left hanging

### 3. Technical Accuracy (validate against ADS §17, not from memory)
- Close codes: **4001** timeout matches ADS §17.3. **Is 4003 (unauthorized) actually specified anywhere in ADS/SATM? If not, flag as an invented code** the WP used without a spec reference.
- Heartbeat: client ping 30s, server 60s timeout — matches?
- 64KB message cap — matches ADS §21 (limits)?
- Reconnect schedule 1s→5s→15s→30s — matches ADS §17.5 table exactly?
- Channel names `price.{symbol}`, `trades`, `notifications`, `wallet` — match ADS §17.7?
- Inbound JSON shapes (subscribe/unsubscribe/ping) — match ADS §17.4/17.6 literally?
- Server→client "price" envelope (`type`, `symbol`, `price`, `bid`, `ask`, `tick_time`) — matches ADS §17.6 exactly?
- WP §2.4 flags "InMemoryCacheAdapter has no real Pub/Sub" — is this an implementation dependency or spec decision that should be listed as a blocker?

### 4. Existing Subsections & Cross-References
- Each referenced spec section (e.g., "SATM §9", "TSQS §4.7") actually exists in the referenced document
- Any reference to a doc not in the project tree → MISSING DEPENDENCY

### 5. Deliverables Verification
- Every deliverable is a concrete file path (no "vague" directories)
- Paths consistent with the existing WP-08 pricing-module structure
- Each scope bullet in §3.1 maps to a deliverable or test
- Missing deliverables that would block the executor → flag

### 6. Testing Requirements
- Coverage target stated (>80%)
- Specific scenarios enumerated (auth accept/reject, subscribe routing, fan-out, 60s close, 64KB rejection, latency)
- Test IDs (`PRICING-WS-UNIT-001..`, `PRICING-WS-INT-`, `PRICING-WS-PERF-`) — matches TSQS naming conventions?
- <100ms latency gate appears in BOTH §3.1 and §6

### 7. Manual Steps & Environment
- §5.1 env var NAMES only, no hardcoded values — correct
- §5.2 commands actually runnable — `curl http://localhost:3000/health` endpoint exists? wscat syntax correct?
- §5.3 npm scripts exist in package.json and are runnable

### 8. Risks & Blockers
- Every risk row has probability / impact / mitigation / owner
- PENDING decision (`REDIS_URL`) appears in both §2.4 and §9
- Any discovered missing documents listed as risks
- Any code asset missing → listed as risk

## Output

Produce a review report with:

1. **PASS/FAIL per section** — each check (1–8) listed as PASS or FAIL
2. **Issues Found** — gaps, inaccuracies, missing items
3. **Recommendations** — specific fixes
4. **Missing Dependencies** — documents/code referenced but not found
5. **Overall Verdict** — **APPROVED** or **NEEDS REVISION**

If NEEDS REVISION, list exactly what must be changed.

Do not modify the WP — only report findings.

---

## Pre-Verified Facts (for cross-checking the reviewer's findings)

| Asset | Status | Verified |
|-------|--------|----------|
| `work-packages/WP-09_WEBSOCKET_STREAMING.md` | ✅ Exists (262 lines, §1–§11) | 2026-08-24 |
| `docs/07_API_DESIGN_SPECIFICATION.md` §17 | ✅ Starts at line 1927 | 2026-08-24 |
| `src/modules/pricing/services/priceDistributionService.ts` | ✅ Publishes `ticks:{symbol}`/`ticks:all` via `cacheClient.publish()` | 2026-08-24 |
| `src/modules/auth/services/tokenService.ts` | ✅ Has `validateAccessToken()` + `isTokenRevoked(jti)` | 2026-08-24 |
| `src/infrastructure/cache/` | ✅ Has `CacheClient.ts`, `ICache.ts`, `InMemoryAdapter.ts` — `publish()` exists, **`subscribe()` MISSING** | 2026-08-24 |
| `src/index.ts` | ✅ Express `app.listen(PORT)` — no http-server abstraction yet | 2026-08-24 |
| `package.json` scripts | ✅ `test`, `typecheck`, `lint`, `start:price-feed` exist | 2026-08-24 |
| `src/infrastructure/healthController.ts` | ✅ Exists (health endpoint) | 2026-08-24 |

**⚠️ Pre-flagged concern for the reviewer:** Close codes **4003** (unauthorized), **`WS_030`**, and **`WS_900`** appear in WP-09 but are **NOT specified in ADS §17** (only 4001 is). The reviewer should decide: is this an invented value needing a project decision, or acceptable extension? (Recommend: add to Decisions Pending in §2.4.)

---

*Generated 2026-08-24 — review prompt for WP-09 per `docs/templates/Review_Template`. Hand to a reviewing agent; do not modify the WP.*