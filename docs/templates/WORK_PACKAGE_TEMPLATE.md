# WORK PACKAGE TEMPLATE v1.0

## Use This Template For
Every executable task handed to a developer, AI agent, or contractor. Copy this file, rename it, fill in the sections.

---

## §1 Work Package Identity

| Field | Value |
|-------|-------|
| **WP-ID** | WP-XX (e.g., WP-01, WP-02) |
| **Name** | Short descriptive name |
| **Phase** | Document 15 Phase X |
| **Module** | Auth / Wallet / Payment / Trading / etc. |
| **Critical Path** | Yes / No |
| **Estimated Effort** | S / M / L / XL (or Fibonacci: 1, 2, 3, 5, 8, 13) |
| **Executor** | AI Agent / Backend Dev / Frontend Dev / DevOps / You |
| **Owner Review Required** | Yes / No |

---

## §2 Before You Start

### §2.1 Prerequisites (Must Be Complete)
| WP-ID | Name | Status |
|-------|------|--------|
| WP-XX | [Name] | ☐ Complete / 🔄 In Progress / ⏸ Blocked |

**Cannot start until ALL prerequisites are COMPLETE.**

### §2.2 Documents to Read
| Document | Sections | Why Needed |
|----------|----------|------------|
| docs/ProjectAnswers.md | ALL | Source of truth for all decisions. READ FIRST before asking owner. |
| 11_IMPLEMENTATION_SPECIFICATION.md | §X | Module blueprint |
| 06_DATABASE_DESIGN_SPECIFICATION.md | §X | Schema, tables, constraints |
| 07_API_DESIGN_SPECIFICATION.md | §X | Endpoints, DTOs, responses |
| 08_UI_UX_DESIGN_SPECIFICATION.md | §X | Screens, flows, components |
| 09_SECURITY_ARCHITECTURE_AND_THREAT_MODEL.md | §X | Security rules, threats |
| 12_TESTING_STRATEGY_AND_QA_SPECIFICATION.md | §X | Tests to write |
| 14_DEVELOPER_HANDBOOK_AND_CODING_STANDARDS.md | §X | Code style, patterns |
| Other | §X | [Specify] |

**Read these BEFORE writing code.**

### §2.3 Decisions Already Made

**READ `docs/ProjectAnswers.md` FIRST.** Extract all answered values into this table.

| Decision | Value | Source |
|----------|-------|--------|
| [e.g., Business name] | [Value from ProjectAnswers.md] | ProjectAnswers.md §A |
| [e.g., Node.js version] | [Value from ProjectAnswers.md] | ProjectAnswers.md §3 |

### §2.4 Decisions Pending (Ask Owner If Not in ProjectAnswers.md)

| Item | Value in ProjectAnswers.md | Why Needed | Blocker? |
|------|---------------------------|------------|----------|
| [e.g., Domain name] | [PENDING] or [value] | SSL, emails | Yes / No |

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

- [ ] Feature A
- [ ] Feature B
- [ ] Feature C

### §3.2 Out of Scope
Clear description of what's NOT included:

- [ ] Feature D (handled in WP-XX)
- [ ] Feature E (future phase)

### §3.3 Deliverables
| Deliverable | Format | Location |
|-------------|--------|----------|
| [e.g., Source code] | Files | `src/modules/auth/` |
| [e.g., Database migration] | SQL file | `migrations/001_auth.sql` |
| [e.g., API documentation] | Markdown | `docs/api/auth.md` |
| [e.g., Tests] | Test files | `src/modules/auth/tests/` |

---

## §4 Technical Specification

### §4.1 Architecture
- Module pattern: [Controller → Service → Repository]
- Events: [List domain events]
- Workers: [List workers if any]
- Cross-cutting concerns: [Security, logging, etc.]

### §4.2 Database
| Table | Purpose | Key Columns | Constraints |
|-------|---------|-------------|-------------|
| `table_name` | What it stores | `id`, `created_at` | PK, unique, FK |

Reference DDS §X for full schema.

### §4.3 API Endpoints
| Method | Path | Request DTO | Response | Auth | Rate Limit |
|--------|------|-------------|----------|------|------------|
| POST | /api/v1/... | `CreateXDto` | `XResponseDto` | JWT | 100/min |

Reference ADS §X for full spec.

### §4.4 UI Screens (if frontend)
| Screen | Route | Components | API Calls |
|--------|-------|------------|-----------|
| Login | /login | `LoginForm`, `MfaInput` | POST /auth/login |

Reference UDS §X for full spec.

### §4.5 Security Requirements
| Requirement | Implementation | Reference |
|-------------|---------------|-----------|
| Input validation | DTO + validator | SATM §X |
| SQL injection prevention | Parameterized queries | SATM §X, DHCS §4.3 |
| XSS prevention | Output encoding | SATM §X, DHCS §5.4 |
| Rate limiting | Middleware | SATM §X |

---

## §5 Manual Steps for Owner

The executor will provide these. YOU must run them in your environment.

### §5.1 Database Setup
```sql
-- Run this in Supabase SQL Editor
-- [Executor fills this in]
§5.2 Environment Configuration
bash
# Add these to your .env file
# [Executor fills this in]
§5.3 Third-Party Setup
markdown
1. Go to [service] and create account
2. Generate API key
3. Paste key in .env as `SERVICE_API_KEY`
§5.4 Verification Steps
bash
# Run these commands to verify setup
# [Executor fills this in]
§6 Testing Requirements
Table
Test Type	Coverage Target	Test IDs (from TSQS)
Unit tests	>80%	[e.g., AUTH-UNIT-001 to 010]
Integration tests	Key flows	[e.g., AUTH-INT-001 to 005]
API tests	All endpoints	[e.g., AUTH-API-001 to 020]
Security tests	OWASP relevant	[e.g., AUTH-SEC-001 to 010]
Reference TSQS §X for full test catalog.
§7 Validation & Done Criteria
§7.1 Code Quality Checklist
[ ] Follows DHCS naming conventions (§3)
[ ] Controller is thin (§4.1)
[ ] Service has single responsibility (§4.2)
[ ] Repository has no business logic (§4.3)
[ ] DTO validates all inputs (§4.4)
[ ] Error handling complete (§4.6)
[ ] Logging follows standards (§4.7)
[ ] No secrets in code (§9)
[ ] Tests cover financial edge cases (§7)
§7.2 Functional Verification
[ ] All acceptance criteria in §3.1 met
[ ] All tests passing
[ ] Security scan clear
[ ] Performance baseline met (if applicable)
§7.3 Owner Sign-Off
Table
Check	Verified By	Date
Feature works as described	[Owner name]	
Manual steps completed	[Owner name]	
Deployed to staging	[Owner name]	
Work package is NOT complete without owner sign-off.
§8 Handoff
§8.1 Next Work Package
Table
WP-ID	Name	Why This Next
WP-XX	[Name]	[This module depends on current module]
§8.2 Handoff Notes
[Any context the next executor needs]
§9 Risks & Blockers
Table
Risk	Probability	Impact	Mitigation	Owner
[e.g., Payment gateway delay]	Medium	High	Use sandbox mode first	You
[e.g., Schema change needed]	Low	Medium	Migration rollback plan	Executor
§10 Change Log
Table
Date	Change	By
YYYY-MM-DD	Created	[Name]
YYYY-MM-DD	Updated scope	[Name]
§11 Final Checklist (Before Closing This WP)
[ ] All prerequisites complete
[ ] All decisions provided
[ ] All deliverables produced
[ ] All tests passing
[ ] Manual steps documented
[ ] Owner sign-off obtained
[ ] Next WP identified
[ ] Handoff notes written
plain

---

**This template gives you:**

1. **§2.4 "Decisions Pending"** — The AI asks for business name, Supabase URL, etc. before coding
2. **§5 "Manual Steps for Owner"** — The AI tells YOU what SQL to run, what env vars to set
3. **§7.3 "Owner Sign-Off"** — Nothing marks complete without your verification
4. **§8 "Handoff"** — Next WP is identified, no guessing what comes next
5. **§2.1 "Prerequisites"** — Can't start until previous WPs are done

---

**Now here's what I propose:**

**Step A:** You review this template. Tell me what to add/remove.

**Step B:** I generate **WP-01 (Project Scaffolding)** as a full example using this template.

**Step C:** You hand WP-01 to an AI agent and see if it:
- Asks for the right things upfront
- Tells you what manual steps to do
- Produces something you can verify

**Step D:** We iterate the template based on what broke.

**Step E:** Generate WP-02 through WP-04 (Auth, Wallet, Payment).

Then you're rolling. Each WP is a contract. Each executor knows exactly what to do and what they need from you.

**Ready for Step A review, or you want me to just generate WP-01 now and we'll fix the template as we go?** 😈