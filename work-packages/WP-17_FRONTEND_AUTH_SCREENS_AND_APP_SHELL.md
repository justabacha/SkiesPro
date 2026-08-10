# WORK PACKAGE: WP-17_FRONTEND_AUTH_SCREENS_AND_APP_SHELL

---

## §1 Work Package Identity

| Field | Value |
|-------|-------|
| **WP-ID** | WP-17 |
| **Name** | Frontend Auth Screens and App Shell |
| **Phase** | Phase 10 (Frontend Implementation) |
| **Module** | Frontend / Auth |
| **Critical Path** | Yes |
| **Estimated Effort** | L (Fibonacci: 8) |
| **Executor** | AI Agent / Frontend Dev |
| **Owner Review Required** | Yes |

---

## §2 Before You Start

### §2.1 Prerequisites (Must Be Complete)
| WP-ID | Name | Status |
|-------|------|--------|
| WP-01.1 | Frontend Scaffolding | ✅ Complete |
| WP-16 | Frontend Design System | ✅ Complete |

**Cannot start until ALL prerequisites are COMPLETE.**

### §2.2 Documents to Read
| Document | Sections | Why Needed |
|----------|----------|------------|
| docs/ProjectAnswers.md | ALL | Source of truth for brand, routing, and business logic. |
| docs/11_IMPLEMENTATION_SPECIFICATION.md | §7.1, §8 | Auth module implementation patterns. |
| docs/07_API_DESIGN_SPECIFICATION.md | §7, §8 | Auth and User API endpoints and DTO shapes. |
| docs/08_UI_UX_DESIGN_SPECIFICATION.md | §4, §5, §11, §13 | Navigation, Auth screens, Notifications, and Components. |
| docs/09_SECURITY_ARCHITECTURE_AND_THREAT_MODEL.md | §4 | Auth security and token storage constraints. |
| docs/14_DEVELOPER_HANDBOOK_AND_CODING_STANDARDS.md | §3.2, §6 | Frontend structure and React coding standards. |
| reports/WP-16_FIXES_EXECUTION_REPORT.md | All | Verified state of design system components and `@/` aliases. |

**FALLBACK RULE**: If `docs/08_UI_UX_DESIGN_SPECIFICATION.md` or `docs/11_IMPLEMENTATION_SPECIFICATION.md` are missing from the project tree, fall back strictly to `docs/ProjectAnswers.md` and `work-packages/WP-16_FRONTEND_DESIGN_SYSTEM.md`.

### §2.3 Decisions Already Made

**READ `docs/ProjectAnswers.md` FIRST.**

| Decision | Value | Source |
|----------|-------|--------|
| Primary Color | #2563EB (Tailwind blue-600) | ProjectAnswers.md #28 |
| Font Family | Inter (Sans), JetBrains Mono (Mono) | ProjectAnswers.md #26, UDS §2.1 |
| Dark Mode BG | #0F1117 | ProjectAnswers.md #31 |
| Dark Mode Strategy | `class` mode in Tailwind | WP-16 |
| Port | 5173 | WP-01.1 |
| Path Alias | `@/` points to `frontend/src/` | WP-01.1 |
| Responsive Target | 320px to 430px (Small phone) | WP-16 |

### §2.4 Decisions Pending (Ask Owner If Not in ProjectAnswers.md)

| Item | Value in ProjectAnswers.md | Why Needed | Blocker? |
|------|---------------------------|------------|----------|
| Primary Domain | [PENDING] | Links in reset/verify emails | No |

### §2.5 Secret Handling Rule

**NEVER hardcode secrets, API keys, passwords, or connection strings in code.**

- Use `import.meta.env.VITE_API_URL` for the backend URL.
- Reference `.env.example` for variable names.

---

## §3 What You'll Build

### §3.1 Scope
Clear description of what's IN scope:

- [ ] **React Router Setup**: Implement browser routing with public (auth) and protected (app shell) route guards.
- [ ] **Auth Pages**:
    - Login (Email/Password + MFA challenge state)
    - Registration (with phone and referral code support)
    - MFA/OTP Verification screen
    - Forgot Password (request link)
    - Reset Password (confirm new password)
    - Email Verification Notice/Landing
- [ ] **App Shell Layout**:
    - `AppLayout` wrapper component
    - Top Navbar with user profile dropdown, balance display, and theme toggle
    - Collapsible Sidebar for desktop navigation
    - Bottom Tab Bar for mobile navigation
- [ ] **Form Logic**:
    - Zod schemas for all auth forms matching ADS §7 validation rules.
    - Integration with `react-hook-form`.
    - Connection to existing `Button`, `Input`, `FormGroup`, `PhoneInput`, `PasswordInput` components from WP-16.

### §3.2 Out of Scope
Clear description of what's NOT included:

- [ ] Trading Chart implementation (WP-18)
- [ ] Wallet transaction list API integration (WP-19)
- [ ] Backend API development (already done in Phase 2)

### §3.3 Deliverables
| Deliverable | Format | Location |
|-------------|--------|----------|
| Route Configuration | File | `frontend/src/router/index.tsx` |
| Auth Pages | Files | `frontend/src/pages/auth/*.tsx` |
| App Shell Components | Files | `frontend/src/shared/components/layout/*.tsx` |
| Validation Schemas | Files | `frontend/src/shared/utils/validation/*.ts` |
| Auth Hooks | Files | `frontend/src/shared/hooks/useAuth.ts` |

---

## §4 Technical Specification

### §4.1 Architecture
- **Framework Packages**: `react-router-dom`, `react-hook-form`, `@hookform/resolvers`, `zod`.
- **Routing**: `react-router-dom` v6.
- **Form Management**: `react-hook-form`.
- **Validation**: `zod`.
- **Icons**: `lucide-react`.
- **Layouts**: Mobile-first grid/flex with zero horizontal overflow.

### §4.2 Database
None (Frontend only).

### §4.3 API Endpoints
Connect UI components to these endpoints defined in ADS §7:
| Method | Path | Request DTO | Use Case |
|--------|------|-------------|----------|
| POST | `/api/v1/auth/register` | `RegisterDto` | Registration form |
| POST | `/api/v1/auth/login` | `LoginDto` | Login form |
| POST | `/api/v1/auth/mfa/verify` | `MfaVerifyDto` | OTP screen |
| POST | `/api/v1/auth/forgot-password` | `ForgotPasswordDto` | Forgot password form |
| POST | `/api/v1/auth/reset-password` | `ResetPasswordDto` | Reset password form |

**NOTE**: Auth forms must implement clean async state handling (loading, success, error toast/alerts) using `VITE_API_URL`. Include fallback mock handling for local UI development if the backend API is unreachable.

### §4.4 UI Screens
| Screen | Route | Components | API Calls |
|--------|-------|------------|-----------|
| Login | `/login` | `LoginForm`, `MfaInput` | `/api/v1/auth/login` |
| Register | `/register` | `RegisterForm`, `PhoneInput` | `/api/v1/auth/register` |
| App Shell | `/*` | `Navbar`, `Sidebar`, `MobileNav` | `/api/v1/users/profile` |

Reference UDS §5 for screen specs.

### §4.5 Security Requirements
| Requirement | Implementation | Reference |
|-------------|---------------|-----------|
| Token Storage | Access token in memory, Refresh token in HTTP-only cookie | SATM §4.2, ADS §2.2 |
| XSS Prevention | Standard React escaping, sanitize dynamic HTML | DHCS §6.4 |
| Protected Routes | Auth guard component checking `isAuthenticated` state | SATM §5 |

---

## §5 Manual Steps for Owner

### §5.1 Environment Configuration
```bash
# Ensure frontend/.env contains the backend URL
VITE_API_URL=http://localhost:3000
```

### §5.2 Verification Steps
```bash
cd frontend
npm install
npm run dev
# 1. Navigate to /register and test validation
# 2. Navigate to /login and verify layout responsiveness
# 3. Toggle dark mode in the Navbar and verify state persistence
```

---

## §6 Testing Requirements

| Test Type | Coverage Target | Test IDs |
|-----------|----------------|----------|
| Component Rendering | All new screens | FE-AUTH-UI-001 |
| Form Validation | Zod schema edge cases | FE-AUTH-VAL-001 |
| Responsive Check | No overflow at 320px | FE-AUTH-RESP-001 |

---

## §7 Validation & Done Criteria

### §7.1 Code Quality Checklist
- [ ] Follows DHCS naming conventions (PascalCase components, `@/` aliases)
- [ ] Use existing atomic components from `src/shared/components`
- [ ] No hardcoded strings for errors (use constants or i18n placeholders if available)
- [ ] Zod schemas match backend DTO constraints strictly (ADS §7)

### §7.2 Functional Verification
- [ ] Mobile navigation (Bottom Tabs) appears on screens < 1024px.
- [ ] Sidebar appears on screens >= 1024px.
- [ ] Auth forms show inline validation errors.
- [ ] Theme toggle syncs with `localStorage` and `ThemeContext`.

---

## §8 Handoff

### §8.1 Next Work Package
| WP-ID | Name | Why This Next |
|-------|------|---------------|
| WP-18 | Trading Interface | Requires App Shell and Auth to be functional. |

---

## §9 Risks & Blockers

| Risk | Probability | Impact | Mitigation | Owner |
|------|-------------|--------|-----------|-------|
| Path Alias failure | Low | Medium | Verify `tsconfig.json` and `vite.config.ts` match. | Executor |
| Zod/DTO mismatch | Medium | Medium | Cross-reference ADS §7 before writing schemas. | Executor |

---

## §10 Change Log

| Date | Change | By |
|------|--------|-----|
| 2026-08-10 | Created WP-17 Blueprint | Agent |

---

**END OF WORK PACKAGE WP-17**
