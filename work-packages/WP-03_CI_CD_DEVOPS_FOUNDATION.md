# WORK PACKAGE: WP-03_CI_CD_DEVOPS_FOUNDATION

## §1 Work Package Identity

| Field | Value |
|-------|-------|
| **WP-ID** | WP-03 |
| **Name** | CI/CD & DevOps Foundation |
| **Phase** | Phase 1: Foundation & Infrastructure (Tasks 1.3–1.8) |
| **Module** | Infrastructure / DevOps |
| **Critical Path** | Yes |
| **Estimated Effort** | L (Large) |
| **Executor** | DevOps Engineer / AI Agent |
| **Owner Review Required** | Yes |

---

## §2 Before You Start

### §2.1 Prerequisites (Must Be Complete)

| WP-ID | Name | Status |
|-------|------|--------|
| WP-01 | Project Scaffolding | ☐ Complete |
| WP-02 | Database Setup | ☐ Complete |

**Cannot start until ALL prerequisites are COMPLETE.**

### §2.2 Documents to Read

| Document | Sections | Why Needed |
|----------|----------|------------|
| docs/ProjectAnswers.md | ALL | Source of truth for all decisions. READ FIRST before asking owner. |
| docs/15_MASTER_IMPLEMENTATION_CHECKLIST.md | §4 Phase 1, Tasks 1.3–1.8 | Exact scope and acceptance criteria |
| docs/10_INFRASTRUCTURE_AND_DEVOPS_SPECIFICATION.md | §11 (CI/CD), §13 (Monitoring), §14 (Logging), §8 (Cache), §9 (Message Broker) | Technical details on pipeline, monitoring, logging, queue, cache |
| docs/09_SECURITY_ARCHITECTURE_AND_THREAT_MODEL.md | §6 (API Security), §6.2 (Security Headers), §6.3 (Rate Limiting), §6.5 (Input Sanitization), §6.7 (CORS), §8 (Infrastructure Security), §16 (Security Testing) | Security baseline requirements |
| docs/14_DEVELOPER_HANDBOOK_AND_CODING_STANDARDS.md | §5 (Backend Standards), §10 (Security Coding Standards) | Standards the executor must follow |
| docs/templates/WORK_PACKAGE_TEMPLATE.md | ALL | Document format and structure |

**Read these BEFORE writing code.**

### §2.3 Decisions Already Made

**READ `docs/ProjectAnswers.md` FIRST.** Extract all answered values into this table.

| Decision | Value | Source |
|----------|-------|--------|
| Git platform | GitHub | ProjectAnswers.md #7 |
| Node.js version | 20.x LTS | ProjectAnswers.md #2 |
| Backend framework | Express.js | ProjectAnswers.md #3 |
| Package manager | npm | ProjectAnswers.md #4 |
| Language | TypeScript | ProjectAnswers.md #5 |
| Testing framework | Jest | ProjectAnswers.md #6 |
| Use Docker | Yes | ProjectAnswers.md #8 |
| Health check path | /health | ProjectAnswers.md #9 |
| Database provider | Supabase | ProjectAnswers.md #10 |
| JWT expiration | 15 minutes | ProjectAnswers.md #15 |
| Refresh token expiry | 7 days | ProjectAnswers.md #16 |
| MFA method | TOTP (Google Authenticator) | ProjectAnswers.md #17 |
| Encryption | AES-256-GCM | ProjectAnswers.md #20 |
| Rate limiting | Redis-based with fallback | ProjectAnswers.md #21 |
| Access control | RBAC | ProjectAnswers.md #22 |

### §2.4 Decisions Pending (Ask Owner If Not in ProjectAnswers.md)

| Item | Value in ProjectAnswers.md | Why Needed | Blocker? |
|------|---------------------------|------------|----------|
| CI/CD platform | GitHub Actions (implied by GitHub) | Pipeline execution | No |
| Monitoring platform | [PENDING] | Metrics collection and dashboards | Yes |
| Log aggregation platform | [PENDING] | Centralized log storage and search | Yes |
| Message broker provider | [PENDING] | Queue implementation | Yes |
| Cache provider | [PENDING] | Redis implementation (owner to choose between Redis, ElastiCache, Upstash) | Yes |
| Container registry | [PENDING] | Docker image storage | Yes |
| Secrets manager | [PENDING] | Secret storage and rotation | Yes |

**RULE:** If ProjectAnswers.md shows `[PENDING]`, ask the owner. If the value is answered, use it. Never guess.

### §2.5 Secret Handling Rule

**NEVER hardcode secrets, API keys, passwords, or connection strings in code.**

- Read `.env.example` for variable NAMES only
- Use `process.env.VAR_NAME` in all code
- Document: "Owner must configure .env before running"
- Never ask owner for actual secret values

---

## §3 What You'll Build

### §3.1 Scope

Clear description of what's IN scope:

- [ ] **Task 1.3: CI/CD Pipeline** - GitHub Actions workflow for automated build, test, lint, SAST scan, container image build, and deployment to development environment
- [ ] **Task 1.4: Monitoring Setup** - Metrics collection (infrastructure, application, business, financial), health check endpoints, and operational dashboards
- [ ] **Task 1.5: Logging Setup** - Structured JSON logging with correlation IDs, secret scrubbing, and log aggregation configuration
- [ ] **Task 1.6: Message Queue Setup** - Message broker adapter pattern, retry configuration, dead-letter queue handling, and queue topology
- [ ] **Task 1.7: Cache Layer Setup** - Redis adapter pattern, eviction policy configuration, key conventions, and two-cluster architecture
- [ ] **Task 1.8: Security Baseline** - SAST/DAST scan configuration, CORS middleware, rate limiting middleware, helmet security headers, input sanitization, and dependency scanning

### §3.2 Out of Scope

Clear description of what's NOT included:

- [ ] Production deployment (handled in WP-11)
- [ ] Disaster recovery setup (handled in WP-11)
- [ ] Multi-region deployment (future enhancement)
- [ ] Advanced monitoring (ML-based anomaly detection - future)
- [ ] Message broker clustering (single node for MVP)

### §3.3 Deliverables

| Deliverable | Format | Location |
|-------------|--------|----------|
| GitHub Actions workflow | YAML file | `.github/workflows/ci.yml` |
| Monitoring configuration | TypeScript files | `src/shared/monitoring/` |
| Logging middleware | TypeScript file | `src/shared/middleware/logger.ts` |
| Correlation ID middleware | TypeScript file | `src/shared/middleware/correlation.ts` |
| Message queue adapter | TypeScript files | `src/infrastructure/message-queue/` |
| Cache adapter | TypeScript files | `src/infrastructure/cache/` |
| Security middleware | TypeScript files | `src/shared/middleware/security.ts` |
| Rate limiting middleware | TypeScript file | `src/shared/middleware/rateLimit.ts` |
| CORS configuration | TypeScript file | `src/config/cors.ts` |
| Security scan configuration | YAML files | `.github/` |
| Environment variable template | File | `.env.example` (updated) |
| Infrastructure documentation | Markdown | `docs/infrastructure/` |

---

## §4 Technical Specification

### §4.1 Architecture

**Module Pattern:**
- CI/CD: GitHub Actions → Build → Test → Scan → Deploy
- Monitoring: Metrics Collector → Metrics Store → Dashboards
- Logging: Logger Middleware → Structured JSON → Log Aggregation
- Message Queue: Publisher → Broker → Consumer (Adapter Pattern)
- Cache: Cache Client → Redis Cluster (Adapter Pattern)
- Security: Middleware Chain → Validation → Sanitization

**Cross-Cutting Concerns:**
- All components use environment variables for configuration
- All components follow adapter pattern for provider abstraction
- All components implement health check endpoints
- All components emit structured logs with correlation IDs

### §4.2 CI/CD Pipeline (Task 1.3)

**Branch Strategy (per IDS §11.1):**
- `feature/*` → Development env
- `develop` → Development + QA
- `staging` → Staging env
- `main` → Production (manual approval)
- `hotfix/*` → Production (expedited)

**Build Pipeline Stages (per IDS §11.2):**

| Stage | Steps | Tools |
|-------|-------|-------|
| 1. Lint & Format Check | ESLint, Prettier | ESLint, Prettier |
| 2. Unit Tests | Jest | Jest |
| 3. SAST Scan | Semgrep, CodeQL | Semgrep, CodeQL |
| 4. Dependency Scan | npm audit, Snyk | npm audit, Snyk |
| 5. Build Container Image | Docker build | Docker |
| 6. Container Image Scan | Trivy | Trivy |
| 7. Push to Registry | Docker push | Docker |
| 8. Integration Tests | Jest + TestContainers | Jest |
| 9. Deploy to Dev | kubectl or platform CLI | kubectl / platform CLI |
| 10. Smoke Tests | HTTP requests | curl / custom script |

**Stage Gates (per IDS §11.3):**

| Gate | Checks | Pass/Fail | Approver |
|------|--------|-----------|----------|
| PR to develop | Lint, unit tests, SAST, dependency scan | All pass | Any team member |
| Merge to staging | All develop checks + integration tests + container scan | All pass | Lead engineer |
| Deploy to staging | All staging branch checks + QA sign-off | All pass | QA lead |
| Deploy to production | All staging checks + load test results + change request | All pass + manual approval | Lead engineer + CTO |

**GitHub Actions Workflow Structure:**

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [feature/*, develop, staging, main]
  pull_request:
    branches: [develop, staging, main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - checkout
      - setup Node.js 20.x
      - install dependencies
      - run ESLint
      - run Prettier check

  test:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - checkout
      - setup Node.js 20.x
      - install dependencies
      - run Jest unit tests
      - upload coverage

  sast:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - checkout
      - run Semgrep
      - run CodeQL

  dependency-scan:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - checkout
      - setup Node.js 20.x
      - run npm audit
      - run Snyk

  build:
    runs-on: ubuntu-latest
    needs: [test, sast, dependency-scan]
    steps:
      - checkout
      - setup Docker
      - build Docker image
      - tag image

  scan:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - checkout
      - run Trivy scan
      - fail on critical CVEs

  push:
    runs-on: ubuntu-latest
    needs: scan
    steps:
      - login to registry
      - push image

  deploy-dev:
    runs-on: ubuntu-latest
    needs: push
    if: github.ref == 'refs/heads/develop'
    steps:
      - deploy to development
      - run smoke tests

  deploy-staging:
    runs-on: ubuntu-latest
    needs: push
    if: github.ref == 'refs/heads/staging'
    steps:
      - deploy to staging
      - run smoke tests
```

### §4.3 Monitoring Setup (Task 1.4)

**Metrics Categories (per IDS §13.1):**

| Category | Key Metrics | Collection Interval | Retention |
|----------|-------------|---------------------|-----------|
| Infrastructure | CPU, memory, disk I/O, network throughput, connection count | 15 seconds | 30 days |
| Application | Request rate, error rate (4xx, 5xx), latency (p50, p95, p99), throughput | Per request | 30 days |
| Business | Trades placed/min, trades settled/min, deposits, withdrawals, active users, new registrations | Per event | 7 years |
| Financial | Total exposure, daily P&L, platform revenue, payout ratio, queue depth, outbox depth | 1 minute | 7 years |
| Database | Connections, replication lag, query latency, cache hit ratio, deadlocks | 15 seconds | 30 days |
| Cache | Memory usage, hit rate, eviction rate, connected clients, latency | 15 seconds | 30 days |
| Broker | Queue depth, consumer lag, publish rate, delivery rate, dead-letter count | 15 seconds | 30 days |

**Health Check Endpoint (per IDS §13.3):**

```typescript
GET /health
Response:
{
  "status": "healthy" | "degraded" | "unhealthy",
  "version": "1.0.0",
  "uptime_seconds": 3600,
  "dependencies": {
    "postgresql": { "status": "healthy", "latency_ms": 2 },
    "redis_sessions": { "status": "healthy", "latency_ms": 1 },
    "redis_pricing": { "status": "healthy", "latency_ms": 1 },
    "message_broker": { "status": "healthy", "latency_ms": 3 }
  }
}
```

**Dashboards (per IDS §13.2):**

| Dashboard | Audience | Panels |
|-----------|----------|--------|
| Executive | CTO, CEO, Product | Revenue (daily/monthly), active users, trades volume, deposit/withdrawal volume, platform uptime, system availability (99.9% SLA) |
| Operations | DevOps, SRE | Infrastructure health (CPU, memory, disk across all nodes), deployment status, error rates, latency heatmap, queue depths, certificate expiry |
| Financial | Finance, Risk | Total exposure per asset, daily P&L, payout ratios, reconciliation status, pending withdrawals, ledger integrity |
| Trading | Risk Manager, Ops | Trades per second, settlement latency, price feed status, latency arbitrage detection, exposure breakdown |
| Security | Security Engineer, Compliance | Failed logins, MFA failures, rate limit violations, webhook signature failures, audit chain status, suspicious IP activity |

**Implementation Requirements:**
- Create `src/shared/monitoring/MetricsCollector.ts` - Metrics collection adapter
- Create `src/shared/monitoring/HealthChecker.ts` - Health check implementation
- Create `src/shared/monitoring/index.ts` - Export monitoring utilities
- Use adapter pattern for metrics backend (Prometheus, CloudWatch, Datadog - owner to choose)
- Emit metrics at appropriate intervals (15s for infra, per-request for app)
- Implement health check endpoint in Express app
- Create dashboard configuration files (JSON/YAML) for chosen monitoring platform

### §4.4 Logging Setup (Task 1.5)

**Logging Standards (per DHCS §5.7 and SATM §12):**

**Required Fields:**
- timestamp (ISO 8601)
- level (DEBUG, INFO, WARN, ERROR)
- correlation_id (UUID)
- module (string)
- message (string)
- context (object with additional fields)

**Secret Scrubbing Rules:**
- Never log: passwords, tokens, API keys, secrets, PII (email, phone, SSN), credit card numbers
- Scrub patterns: `password`, `token`, `secret`, `key`, `authorization`, `bearer`
- Use redaction: `[REDACTED]` or `******`

**Example Log Entry:**

```json
{
  "timestamp": "2026-08-01T12:00:00.000Z",
  "level": "INFO",
  "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
  "module": "trading",
  "message": "Trade placed",
  "context": {
    "userId": "user-123",
    "contractId": "contract-456",
    "stake": "100.00",
    "assetSymbol": "EUR/USD"
  }
}
```

**Implementation Requirements:**
- Create `src/shared/middleware/logger.ts` - Structured JSON logger
- Create `src/shared/middleware/correlation.ts` - Correlation ID middleware
- Implement secret scrubbing function (regex-based pattern matching)
- Configure log levels based on NODE_ENV (DEBUG for dev, INFO for prod)
- Support log aggregation platform adapter (owner to choose: Loki, CloudWatch Logs, ELK)
- Add correlation ID to all HTTP requests via middleware
- Add correlation ID to all async operations (pass through context)
- Create log aggregation configuration files for chosen platform

### §4.5 Message Queue Setup (Task 1.6)

**Queue Architecture (per IDS §9.1, §9.2, §9.3):**

| Queue Name | Content | Priority | Durability | Max Retries | Consumer |
|------------|---------|----------|------------|-------------|----------|
| `trade.expiry` | Contract expiry jobs | High | Durable (persistent) | 3 (then DLQ) | Settlement Worker |
| `outbox.relay` | Financial domain events | High | Durable (persistent) | 3 (then DLQ) | Outbox Relay |
| `notification.high` | Trade results, deposit confirmations | High | Durable | 3 (then suppress) | Notification Worker |
| `notification.low` | Marketing, promotions | Low | Transient | 1 | Notification Worker |
| `retry` | Failed jobs awaiting retry | Medium | Durable | — | Re-queued to source |
| `dead.letter` | Permanently failed jobs | Low | Durable | — | Manual reconciliation |

**Adapter Pattern:**

```typescript
// src/infrastructure/message-queue/IMessageQueue.ts
interface IMessageQueue {
  publish(queueName: string, message: any, options?: PublishOptions): Promise<void>;
  subscribe(queueName: string, handler: MessageHandler): Promise<void>;
  acknowledge(messageId: string): Promise<void>;
  retry(messageId: string): Promise<void>;
  deadLetter(messageId: string): Promise<void>;
}

// src/infrastructure/message-queue/RabbitMQAdapter.ts
class RabbitMQAdapter implements IMessageQueue {
  // RabbitMQ-specific implementation
}

// src/infrastructure/message-queue/RedisAdapter.ts
class RedisAdapter implements IMessageQueue {
  // Redis-specific implementation
}
```

**Retry Configuration (per IDS §9.2):**
- Initial delay: 1 second
- Exponential backoff: delay = previous_delay * 2
- Max retries: 3
- Max delay: 60 seconds
- Dead-letter after max retries

**Dead-Letter Queue Handling (per IDS §9.3):**
- All permanently failed messages routed to `dead.letter` queue
- Dead-letter queue monitored (alert if > 50 messages)
- Manual reconciliation process documented
- Dead-letter messages retained for 30 days

**Implementation Requirements:**
- Create `src/infrastructure/message-queue/IMessageQueue.ts` - Interface
- Create `src/infrastructure/message-queue/[Provider]Adapter.ts` - Provider-specific adapter (owner to choose: RabbitMQ, Redis Streams, AWS SQS)
- Create `src/infrastructure/message-queue/MessageQueueClient.ts` - Client wrapper
- Implement retry logic with exponential backoff
- Implement dead-letter queue routing
- Create queue topology initialization script
- Add queue depth monitoring metrics
- Create unit tests for retry and dead-letter logic

### §4.6 Cache Layer Setup (Task 1.7)

**Two-Cluster Architecture (per IDS §8.1):**

**Note:** ADR-003 (Cache Architecture) referenced in IDS §8.1 but not yet created. Executor should verify two-cluster architecture against IDS §8.1.

| Property | Cluster 1: Sessions & Rate Limiting | Cluster 2: Price Distribution |
|----------|-------------------------------------|------------------------------|
| Purpose | JWT revocation blacklist, rate limit counters, session metadata | Live price ticks, OHLC candles, asset exposure counters |
| Persistence | RDB snapshots every 5 minutes | None (ephemeral cache) |
| Eviction policy | `allkeys-lru` | `volatile-ttl` |
| High Availability | Replication with automatic failover. Target: < 10s failover | Replication with automatic failover. Target: < 10s failover |
| Memory | Baseline: 2 GB. Max: 4 GB | Baseline: 4 GB. Max: 8 GB |
| Network | Dedicated subnet. No public access | Dedicated subnet. No public access |
| Monitoring | Memory usage, hit rate, eviction rate, latency (p99 < 1ms) | Memory usage, hit rate, latency |

**Key Patterns & TTLs (per IDS §8.3):**

| Cluster | Key Pattern | TTL | Invalidation |
|---------|-------------|---------|--------------|
| Sessions | `session:{user_id}` | JWT expiry (15 min) | Deleted on logout. Updated on password change. |
| Sessions | `ratelimit:{ip}:{endpoint}` | 60 seconds | Hard expiry. |
| Sessions | `token:blacklist:{jti}` | Token TTL (max 15 min) | Auto-expire. |
| Pricing | `price:{symbol}:latest` | 2 seconds | Overwritten on each tick. |
| Pricing | `candle:{symbol}:{granularity}:{epoch}` | 120 seconds | Overwritten on each tick update. |
| Pricing | `exposure:{symbol}` | No TTL (in-memory) | Increment on trade open, decrement on settlement. |

**Adapter Pattern:**

```typescript
// src/infrastructure/cache/ICache.ts
interface ICache {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  incr(key: string): Promise<number>;
  expire(key: string, ttl: number): Promise<void>;
  keys(pattern: string): Promise<string[]>;
}

// src/infrastructure/cache/RedisAdapter.ts
class RedisAdapter implements ICache {
  // Redis-specific implementation
}
```

**Fail-Closed Behaviour (per SATM §4.6):**

**Note:** ADR-004 (Fail-Closed Behaviour) referenced in SATM §4.6 but not yet created. Executor should verify fail-closed behavior against SATM §4.6.

| Operation | Normal Behaviour | Redis Outage Behaviour |
|-----------|------------------|----------------------|
| Token revocation check | Query Redis blacklist | Fall back to signature-only validation. Revoked tokens valid for max 15 min. |
| New login | Write session to Redis + DB | DB-only. Rate limiting falls back to in-app conservative limits. |
| Rate limiting | Redis counter per IP/token | In-app fixed-rate limiter: 30 req/min (authenticated), 10 req/min (unauthenticated). |

**Implementation Requirements:**
- Create `src/infrastructure/cache/ICache.ts` - Interface
- Create `src/infrastructure/cache/RedisAdapter.ts` - Redis adapter
- Create `src/infrastructure/cache/CacheClient.ts` - Client wrapper with cluster selection
- Implement two-cluster client (sessions vs pricing)
- Implement eviction policy configuration
- Implement key pattern helpers
- Add cache hit/miss monitoring metrics
- Implement fail-closed fallback logic
- Create unit tests for cache operations and failover

### §4.7 Security Baseline (Task 1.8)

**Security Scan Configuration (per SATM §16):**

| Scan Type | Tool | Configuration | Fail Threshold |
|-----------|------|---------------|----------------|
| SAST (Static Application Security Testing) | Semgrep | Auto-detect languages, custom rules for financial code | Critical and High severity |
| SAST (Alternative) | CodeQL | JavaScript/TypeScript queries | Critical and High severity |
| DAST (Dynamic Application Security Testing) | OWASP ZAP | Active scan on staging environment | High and Medium severity |
| Dependency Scanning | Snyk | Monitor for vulnerabilities | Critical and High severity |
| Dependency Scanning (Alternative) | npm audit | Audit production dependencies | Critical severity |
| Container Scanning | Trivy | Scan Docker images for CVEs | Critical and High severity |

**CORS Configuration (per SATM §6.7):**

```typescript
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE
Access-Control-Allow-Headers: Authorization, Content-Type, Idempotency-Key, X-Request-ID
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 86400
```

**Rate Limiting Configuration (per SATM §6.3):**

| Scope | Limit | Window | Redis Fallback |
|-------|-------|--------|----------------|
| Unauthenticated (by IP) | 60 requests | 1 minute | In-app: 30 req/min |
| Authenticated (by token) | 300 requests | 1 minute | In-app: 150 req/min |
| Trading endpoints | 10 requests | 1 second | In-app: 5 req/sec |
| Login (by IP) | 5 attempts | 15 minutes | Database counter |
| Password reset (by email) | 3 attempts | 1 hour | Database counter |
| KYC upload | 5 files | 1 hour | In-app counter |

**Security Headers (per SATM §6.2):**

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing |
| `X-Frame-Options` | `DENY` | Prevents clickjacking |
| `X-XSS-Protection` | `0` | Disables legacy XSS filter |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' wss:;` | Mitigates XSS |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits referrer leakage |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Restricts API access |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Enforces HTTPS |

**Input Sanitization (per SATM §6.5):**

| Layer | Control |
|-------|---------|
| API Gateway | JSON Schema validation. Reject malformed payloads before routing. |
| Module boundary | Type checking, range validation, length limits. |
| Database | Parameterized queries only. No dynamic SQL. |
| Output | JSON serialisation. Content-Type enforced. No raw HTML rendering. |

**Implementation Requirements:**
- Create `.github/semgrep.yml` - SAST configuration
- Create `.github/codeql.yml` - CodeQL configuration
- Create `.github/snyk.yml` - Dependency scan configuration
- Create `.github/trivy.yml` - Container scan configuration
- Create `src/shared/middleware/cors.ts` - CORS middleware
- Create `src/shared/middleware/rateLimit.ts` - Rate limiting middleware
- Create `src/shared/middleware/security.ts` - Security headers middleware (Helmet)
- Create `src/shared/middleware/sanitization.ts` - Input sanitization middleware
- Implement secret scrubbing in logger
- Implement parameterized query helpers
- Add security middleware chain to Express app
- Create security scan GitHub Actions jobs
- Add OWASP ZAP DAST scan to staging deployment

---

## §5 Manual Steps for Owner

The executor will provide these. YOU must run them in your environment.

### §5.1 Platform Account Setup

**Choose and create accounts for the following (ask owner which platforms):**

1. **Monitoring Platform** (choose one):
   - Prometheus + Grafana (self-hosted)
   - Datadog (SaaS)
   - CloudWatch (AWS)
   - New Relic (SaaS)
   
2. **Log Aggregation Platform** (choose one):
   - Loki + Grafana (self-hosted)
   - CloudWatch Logs (AWS)
   - ELK Stack (self-hosted)
   - Loggly (SaaS)

3. **Message Broker** (choose one):
   - RabbitMQ (self-hosted)
   - AWS SQS (AWS)
   - Redis Streams (self-hosted)
   - Apache Kafka (self-hosted)

4. **Cache Provider** (choose one):
   - Redis (self-hosted)
   - ElastiCache (AWS)
   - Upstash (SaaS)

5. **Container Registry** (choose one):
   - Docker Hub
   - GitHub Container Registry
   - AWS ECR
   - Google GCR

6. **Secrets Manager** (choose one):
   - HashiCorp Vault
   - AWS Secrets Manager
   - Azure Key Vault
   - Google Secret Manager

### §5.2 Environment Configuration

```bash
# Add these to your .env file
# Monitoring Platform
MONITORING_PLATFORM=prometheus
MONITORING_URL=
MONITORING_API_KEY=

# Log Aggregation Platform
LOG_PLATFORM=loki
LOG_URL=
LOG_API_KEY=

# Message Broker
MESSAGE_BROKER=rabbitmq
RABBITMQ_URL=
RABBITMQ_USER=
RABBITMQ_PASSWORD=

# Cache Provider
CACHE_PROVIDER=redis
REDIS_SESSIONS_URL=
REDIS_PRICING_URL=

# Container Registry
CONTAINER_REGISTRY=ghcr.io
REGISTRY_USERNAME=
REGISTRY_PASSWORD=

# Secrets Manager
SECRETS_MANAGER=vault
VAULT_URL=
VAULT_TOKEN=
```

### §5.3 GitHub Secrets Configuration

```bash
# Add these secrets to GitHub repository settings
# Settings → Secrets and variables → Actions

GITHUB_TOKEN=auto-generated
DOCKER_REGISTRY_USERNAME=
DOCKER_REGISTRY_PASSWORD=
MONITORING_API_KEY=
LOG_API_KEY=
RABBITMQ_URL=
REDIS_SESSIONS_URL=
REDIS_PRICING_URL=
```

### §5.4 Verification Steps

```bash
# Run these commands to verify setup

# 1. Verify CI/CD pipeline
git push origin feature/test-ci
# Check GitHub Actions tab for green workflow

# 2. Verify monitoring
curl http://localhost:3000/health
# Should return JSON with dependency statuses

# 3. Verify logging
# Make a request and check log aggregation platform for structured JSON logs

# 4. Verify message queue
# Check queue topology is created
# Test publish/subscribe with sample message

# 5. Verify cache
# Test set/get operations on both clusters
# Check eviction policy works

# 6. Verify security scans
# Check GitHub Actions for SAST/DAST/dependency scan results
# Ensure no critical vulnerabilities
```

---

## §6 Testing Requirements

| Test Type | Coverage Target | Notes |
|-----------|----------------|-------|
| Unit tests | >80% | Test IDs to be defined in TSQS after infrastructure implementation. Coverage targets and scenarios below are authoritative. |
| Integration tests | Key flows | Test IDs to be defined in TSQS after infrastructure implementation. |
| API tests | All endpoints | Test IDs to be defined in TSQS after infrastructure implementation. |
| Security tests | OWASP relevant | Test IDs to be defined in TSQS after infrastructure implementation. |

**Specific Test Requirements:**

1. **CI/CD Pipeline Tests:**
   - Test lint failure blocks merge
   - Test test failure blocks merge
   - Test SAST failure blocks merge
   - Test container scan failure blocks merge
   - Test deployment to dev succeeds on develop branch

2. **Monitoring Tests:**
   - Test health endpoint returns correct structure
   - Test metrics are emitted at correct intervals
   - Test dependency health checks work
   - Test alert thresholds trigger correctly

3. **Logging Tests:**
   - Test logs are structured JSON
   - Test correlation ID is present in all logs
   - Test secrets are scrubbed from logs
   - Test log levels are correct per environment

4. **Message Queue Tests:**
   - Test publish/subscribe works
   - Test retry logic with exponential backoff
   - Test dead-letter routing after max retries
   - Test queue depth metrics are emitted

5. **Cache Tests:**
   - Test set/get operations work
   - Test TTL expiration works
   - Test eviction policy works
   - Test fail-closed fallback on Redis outage
   - Test two-cluster isolation

6. **Security Tests:**
   - Test CORS headers are correct
   - Test rate limiting enforces limits
   - Test security headers are present
   - Test input sanitization rejects malicious input
   - Test SAST scan detects vulnerabilities
   - Test dependency scan detects vulnerable packages

---

## §7 Validation & Done Criteria

### §7.1 Code Quality Checklist

- [ ] Follows DHCS naming conventions (§3)
- [ ] Controller is thin (§4.1)
- [ ] Service has single responsibility (§4.2)
- [ ] Repository has no business logic (§4.3)
- [ ] DTO validates all inputs (§4.4)
- [ ] Error handling complete (§4.6)
- [ ] Logging follows standards (§4.7)
- [ ] No secrets in code (§9)
- [ ] Tests cover financial edge cases (§7)
- [ ] Adapter pattern implemented for all external dependencies
- [ ] Health check endpoint implemented
- [ ] Correlation ID middleware implemented
- [ ] Secret scrubbing implemented
- [ ] Security middleware chain implemented

### §7.2 Functional Verification

- [ ] All acceptance criteria in §3.1 met
- [ ] All tests passing
- [ ] Security scan clear (no critical vulnerabilities)
- [ ] CI/CD pipeline green on test PR
- [ ] Monitoring dashboards accessible
- [ ] Logs visible in log aggregation platform
- [ ] Message queue operational
- [ ] Cache operational
- [ ] Health check endpoint returns correct data
- [ ] Rate limiting enforced
- [ ] CORS configured correctly
- [ ] Security headers present

### §7.3 Owner Sign-Off

| Check | Verified By | Date |
|-------|-------------|------|
| CI/CD pipeline works | [Owner name] | |
| Monitoring operational | [Owner name] | |
| Logging operational | [Owner name] | |
| Message queue operational | [Owner name] | |
| Cache operational | [Owner name] | |
| Security baseline met | [Owner name] | |
| Manual steps completed | [Owner name] | |

**Work package is NOT complete without owner sign-off.**

---

## §8 Handoff

### §8.1 Next Work Package

| WP-ID | Name | Why This Next |
|-------|------|---------------|
| WP-04 | Authentication & User Management | Depends on foundation infrastructure (CI/CD, monitoring, logging, security) |

### §8.2 Handoff Notes

- CI/CD pipeline is configured for development environment only. Production deployment will be configured in WP-11.
- Monitoring platform choice is pending owner decision. Adapter pattern allows easy switching.
- Message broker provider choice is pending owner decision. Adapter pattern allows easy switching.
- Cache provider is pending owner decision (Redis, ElastiCache, or Upstash). Two-cluster architecture per IDS §8.1.
- Security baseline is configured with SAST/DAST scans. Critical vulnerabilities will block merges.
- All middleware (CORS, rate limiting, security headers, correlation ID) is implemented and ready for use in WP-04.
- Health check endpoint is available at `/health` for all services.
- Logging is structured JSON with correlation IDs and secret scrubbing.

---

## §9 Risks & Blockers

| Risk | Probability | Impact | Mitigation | Owner |
|------|-------------|--------|------------|-------|
| Monitoring platform choice pending | High | Medium | Implement adapter pattern, start with Prometheus (self-hosted) as default | Owner |
| Message broker choice pending | High | Medium | Implement adapter pattern, start with RabbitMQ (self-hosted) as default | Owner |
| Cache provider choice pending | Low | Low | Owner to choose between Redis, ElastiCache, Upstash. Adapter pattern allows easy switching. | Owner |
| Secrets manager choice pending | Medium | High | Use environment variables for MVP, secrets manager for production | Owner |
| CI/CD platform limitations | Low | Medium | GitHub Actions is default per ProjectAnswers.md, no decision needed | None |
| Security scan false positives | Medium | Low | Configure scan rules to exclude known safe patterns | Executor |
| Rate limiting blocking legitimate traffic | Low | Medium | Implement conservative limits initially, adjust based on monitoring | Executor |

---

## §10 Change Log

| Date | Change | By |
|------|--------|-----|
| 2026-08-01 | Created | AI Agent |

---

## §11 Final Checklist (Before Closing This WP)

- [ ] All prerequisites complete (WP-01, WP-02)
- [ ] All decisions provided (pending decisions documented)
- [ ] All deliverables produced
- [ ] All tests passing
- [ ] Manual steps documented
- [ ] Owner sign-off obtained
- [ ] Next WP identified (WP-04)
- [ ] Handoff notes written
