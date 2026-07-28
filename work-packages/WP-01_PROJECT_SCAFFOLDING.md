# WORK PACKAGE: WP-01_PROJECT_SCAFFOLDING

---

## §1 Work Package Identity

| Field | Value |
|-------|-------|
| **WP-ID** | WP-01 |
| **Name** | Project Scaffolding |
| **Phase** | Document 15 Phase 1 |
| **Module** | Infrastructure |
| **Critical Path** | Yes |
| **Estimated Effort** | S |
| **Executor** | AI Agent / Backend Dev / DevOps |
| **Owner Review Required** | Yes |

---

## §2 Before You Start

### §2.1 Prerequisites (Must Be Complete)
| WP-ID | Name | Status |
|-------|------|--------|
| None | This is the first work package | N/A |

**Cannot start until ALL prerequisites are COMPLETE.**

### §2.2 Documents to Read
| Document | Sections | Why Needed |
|----------|----------|------------|
| docs/ProjectAnswers.md | ALL | Source of truth for all decisions. READ FIRST before asking owner. |
| 14_DEVELOPER_HANDBOOK_AND_CODING_STANDARDS.md | §2 (Project Structure & Organization) | Folder structure conventions |
| 10_INFRASTRUCTURE_AND_DEVOPS_SPECIFICATION.md | §5 (CI/CD Pipeline), §6 (Deployment Strategy) | CI/CD and deployment patterns |
| 15_MASTER_IMPLEMENTATION_CHECKLIST.md | §4 (Phase-Based Checklist), Task 1.1 | Phase 1 task details |
| 11_IMPLEMENTATION_SPECIFICATION.md | §2 (Project Structure) | Backend and frontend structure |
| 12_TESTING_STRATEGY_AND_QA_SPECIFICATION.md | §4 (Unit Testing) | Test setup requirements |

**Read these BEFORE writing code.**

### §2.3 Decisions Already Made

**READ `docs/ProjectAnswers.md` FIRST.** Extract all answered values into this table.

| Decision | Value | Source |
|----------|-------|--------|
| Business name | SKIESPRO | ProjectAnswers.md #1 |
| Project codename | skiespro | ProjectAnswers.md #A1 |
| Git platform | GitHub | ProjectAnswers.md #7 |
| Node.js version | 20.x LTS | ProjectAnswers.md #2 |
| Package manager | npm | ProjectAnswers.md #4 |
| Language | TypeScript | ProjectAnswers.md #5 |
| Backend framework | Express.js | ProjectAnswers.md #3 |
| Testing framework | Jest | ProjectAnswers.md #6 |
| Docker | Yes | ProjectAnswers.md #8 |
| Health check path | /health | ProjectAnswers.md #9 |
| Frontend framework | React | ProjectAnswers.md #25 |
| Font family | Inter | ProjectAnswers.md #26 |
| Primary color | #2563EB | ProjectAnswers.md #28 |
| Project owner name | AMOS FX | ProjectAnswers.md #A2 |
| Project owner email | austines.bot@gmail.com | ProjectAnswers.md #A3 |
| Tech lead name + email | RYAN RAY, EMAIL: ryan141rays@gmail.com | ProjectAnswers.md #A5 |
| DevOps contact | ryan141rays@gmail.com | ProjectAnswers.md #G1 |
| Support contact | skiespro.ltd@gmail.com | ProjectAnswers.md #G2 |

### §2.4 Decisions Pending (Ask Owner If Not in ProjectAnswers.md)

| Item | Value in ProjectAnswers.md | Why Needed | Blocker? |
|------|---------------------------|------------|----------|
| Primary domain | [PENDING] #B1 | SSL, emails, API endpoints | No for WP-01 |
| Logo | [PENDING] #B4 | Branding | No for WP-01 |
| M-Pesa Business Account | [PENDING] #C1 | Payments | No for WP-01 |
| Email sender address | [PENDING] #F2 | Email configuration | No for WP-01 |

**RULE:** If ProjectAnswers.md shows `[PENDING]`, ask the owner. If the value is answered, use it. Never guess.

**None of these block WP-01. Proceed without them.**

---

## §3 What You'll Build

### §3.1 Scope
Clear description of what's IN scope:

- [ ] Project folder structure per DHCS §2 (backend, frontend, shared, config, infrastructure)
- [ ] Git repository initialization with .gitignore
- [ ] Base configuration files (package.json, tsconfig.json, .eslintrc, .prettierrc)
- [ ] Docker setup (Dockerfile, docker-compose.yml if Docker = Yes)
- [ ] Environment variable template (.env.example)
- [ ] Basic logging setup (structured JSON logger with correlation ID middleware)
- [ ] Health check endpoints (/health, /ready)
- [ ] CI/CD pipeline skeleton (GitHub Actions or equivalent per Git platform choice)

### §3.2 Out of Scope
Clear description of what's NOT included:

- [ ] Database tables (handled in WP-02_DATABASE_SETUP)
- [ ] Auth logic (handled in WP-03_USER_REGISTRATION)
- [ ] Any business logic (handled in subsequent WPs)

### §3.3 Deliverables
| Deliverable | Format | Location |
|-------------|--------|----------|
| Source code folder structure | Directories | `src/`, `src/modules/`, `src/shared/`, `src/config/`, `src/infrastructure/` |
| Configuration files | JSON/TS/YAML | Root directory (package.json, tsconfig.json, .eslintrc, .prettierrc) |
| Docker files | Dockerfile, docker-compose.yml | `docker/` or root directory |
| CI configuration | YAML | `.github/workflows/` or `.gitlab-ci.yml` or equivalent |
| Environment template | .env.example | Root directory |
| README | Markdown | `README.md` |
| .gitignore | Text | Root directory |

---

## §4 Technical Specification

### §4.1 Architecture
- Module pattern: Modular monolith with clear separation (backend modules, shared utilities, infrastructure)
- Events: None in this WP (event infrastructure added later)
- Workers: None in this WP (worker infrastructure added later)
- Cross-cutting concerns: Logging middleware, correlation ID propagation, health check endpoints

### §4.2 Database
None in this WP. Database setup is WP-02.

### §4.3 API Endpoints
| Method | Path | Request | Response | Auth | Rate Limit |
|--------|------|---------|----------|------|------------|
| GET | /health | None | `{ status: "ok", timestamp: "ISO-8601" }` | None | None |
| GET | /ready | None | `{ status: "ready", checks: {} }` | None | None |

Reference ADS §X for full spec (health check standards).

### §4.4 UI Screens
None in this WP (frontend scaffolding in later WPs).

### §4.5 Security Requirements
| Requirement | Implementation | Reference |
|-------------|---------------|-----------|
| No secrets in code | Environment variables only | SATM §X, DHCS §9 |
| .gitignore for sensitive files | Exclude .env, node_modules, logs | SATM §X |
| Health check rate limiting | Optional but recommended | SATM §X |

---

## §5 Manual Steps for Owner

The executor will provide these. YOU must run them in your environment.

### §5.1 Repository Setup

**Git platform = GitHub (from ProjectAnswers.md #7):**
```bash
# Create a new repository on GitHub
# Name: skiespro (from ProjectAnswers.md #A1)
# Initialize with README: No (we'll create our own)
# .gitignore: Node (we'll customize)

# Clone the repository locally
git clone https://github.com/[YOUR_USERNAME]/skiespro.git
cd skiespro
```

### §5.2 Environment Configuration

**Add these to your .env file (create from .env.example):**
```bash
# Copy the example file
cp .env.example .env

# Edit .env with your values (if any for this WP)
# For WP-01, most values are placeholders for future WPs
```

### §5.3 Dependency Installation

**Package manager = npm (from ProjectAnswers.md #4):**
```bash
npm install
```

### §5.4 Docker Setup (Docker = Yes from ProjectAnswers.md #8)

```bash
# Build the Docker image
docker build -t skiespro:latest .

# Run with docker-compose (if docker-compose.yml provided)
docker-compose up -d

# Verify container is running
docker ps
```

### §5.5 Verification Steps

```bash
# Run the development server
npm run dev

# Test health endpoint
curl http://localhost:3000/health
# Expected: {"status":"ok","timestamp":"2026-07-24T..."}
```

```bash
# Test ready endpoint
curl http://localhost:3000/ready
# Expected: {"status":"ready","checks":{}}
```

```bash
# Run linting
npm run lint

# Expected: No errors
```

```bash
# Run tests
npm test

# Expected: Health endpoint tests pass
```

```bash
# Verify CI pipeline triggers
# Push to main branch
git add .
git commit -m "WP-01: Project scaffolding"
git push origin main

# Check GitHub Actions tab
# Expected: Pipeline runs and passes
```

---

## §6 Testing Requirements

| Test Type | Coverage Target | Test IDs (from TSQS) |
|-----------|----------------|----------------------|
| Unit tests | >80% for health check code | INFRA-UNIT-001 to 005 |
| Integration tests | Health endpoint connectivity | INFRA-INT-001 to 002 |
| API tests | /health and /ready endpoints | INFRA-API-001 to 002 |
| Security tests | No secrets in code, .gitignore validation | INFRA-SEC-001 to 002 |

Reference TSQS §4 for full test catalog.

---

## §7 Validation & Done Criteria

### §7.1 Code Quality Checklist
- [ ] Follows DHCS naming conventions (§3)
- [ ] Folder structure matches DHCS §2 exactly
- [ ] Logging follows standards (DHCS §5.7) - structured JSON, correlation IDs
- [ ] No secrets in code (DHCS §9)
- [ ] .gitignore excludes sensitive files
- [ ] Health endpoints return correct format
- [ ] CI/CD pipeline runs without error
- [ ] Linting passes

### §7.2 Functional Verification
- [ ] All acceptance criteria in §3.1 met
- [ ] All tests passing (unit, integration, API)
- [ ] Health endpoint returns 200 with correct response
- [ ] Ready endpoint returns 200 with correct response
- [ ] CI pipeline triggers on push and passes
- [ ] Linting passes with no errors
- [ ] Docker build succeeds (if Docker = Yes)

### §7.3 Owner Sign-Off
| Check | Verified By | Date |
|-------|-------------|------|
| Feature works as described | [Owner name] | |
| Manual steps completed | [Owner name] | |
| Health endpoints verified | [Owner name] | |
| CI pipeline verified | [Owner name] | |

**Work package is NOT complete without owner sign-off.**

---

## §8 Handoff

### §8.1 Next Work Package
| WP-ID | Name | Why This Next |
|-------|------|---------------|
| WP-02 | Database Setup | Database setup requires project scaffolding to be complete (folder structure, config files, CI/CD) |

### §8.2 Handoff Notes
- Project structure is now in place per DHCS §2
- CI/CD pipeline is operational and can be extended for future WPs
- Health endpoints provide baseline for monitoring (IDS §13)
- Logging infrastructure is ready for correlation ID propagation across modules
- Environment variable template (.env.example) is ready for database credentials in WP-02

---

## §9 Risks & Blockers

| Risk | Probability | Impact | Mitigation | Owner |
|------|-------------|--------|-----------|-------|
| Git platform CI/CD configuration complexity | Low | Medium | Use proven templates from platform documentation | Executor |
| Package manager compatibility issues | Low | Low | Use Node.js version specified in §2.4 | Executor |
| Docker build failures (if Docker = Yes) | Low | Medium | Use official base images, test locally first | Executor |
| Port conflicts for health check | Low | Low | Use configurable port via .env | Executor |

---

## §10 Change Log

| Date | Change | By |
|------|--------|-----|
| 2026-07-24 | Created | [Executor name] |

---

## §11 Final Checklist (Before Closing This WP)

- [ ] All prerequisites complete (N/A for first WP)
- [ ] All decisions provided (Project name, Git platform, Node.js version, Docker preference, package manager)
- [ ] All deliverables produced (folder structure, config files, CI/CD, .env.example, README)
- [ ] All tests passing (unit, integration, API)
- [ ] Manual steps documented (repository setup, dependency installation, verification)
- [ ] Owner sign-off obtained
- [ ] Next WP identified (WP-02_DATABASE_SETUP)
- [ ] Handoff notes written

---

**END OF WORK PACKAGE WP-01**
