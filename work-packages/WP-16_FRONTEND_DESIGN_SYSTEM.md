# Work Package: WP-16 Frontend Design System

## §1 Work Package Identity

| Field | Value |
|-------|-------|
| **WP-ID** | WP-16 |
| **Name** | Frontend Design System |
| **Phase** | Phase 10 (Frontend Implementation) |
| **Module** | Frontend / Shared |
| **Critical Path** | Yes (blocks all frontend screens) |
| **Estimated Effort** | L |
| **Executor** | Frontend Developer / AI Agent |
| **Owner Review Required** | Yes |

---

## §2 Before You Start

### §2.1 Prerequisites (Must Be Complete)
| WP-ID | Name | Status |
|-------|------|--------|
| WP-01 | Project Scaffolding | ✅ Complete |
| WP-04 | Auth Module Backend | ✅ Complete |
| WP-05 | User Profile & KYC | ✅ Complete |

### §2.2 Documents to Read
| Document | Sections | Why Needed |
|----------|----------|------------|
| docs/ProjectAnswers.md | Branding section | Source of truth for colors (#2563EB), font (Inter), and tone. |
| docs/08_UI_UX_DESIGN_SPECIFICATION.md | ALL | Design system foundations, component library, theming. |
| docs/14_DEVELOPER_HANDBOOK_AND_CODING_STANDARDS.md | §6 | Frontend coding standards and structure. |
| docs/15_MASTER_IMPLEMENTATION_CHECKLIST.md | Phase 10, Task 10.1 | Scope and acceptance criteria. |

### §2.3 Decisions Already Made
| Decision | Value | Source |
|----------|-------|--------|
| Frontend Framework | React 18+ | ProjectAnswers.md #25 |
| Language | TypeScript | ProjectAnswers.md #5 |
| Styling | Tailwind CSS | WP-01 Scaffolding |
| Font Family | Inter (Sans), JetBrains Mono (Financials) | ProjectAnswers.md #26, UDS §2.1 |
| Primary Color | #2563EB | ProjectAnswers.md #28 |
| Secondary Color | #1D4ED8 | ProjectAnswers.md #29 |
| Accent Color | #DBEAFE | ProjectAnswers.md #30 |
| Dark Mode BG | #0F1117 | ProjectAnswers.md #31 |
| Dark Mode Text | #F3F4F6 | ProjectAnswers.md #32 |
| Dark Mode Strategy | `class` (Tailwind) | DHCS §6 |

### §2.4 Decisions Pending
None for MVP.

---

## §3 What You'll Build

### §3.1 Scope (STRIPPED MVP)
Implementation of the core design system and atomic components:

- [ ] **Design Tokens**: Configure `tailwind.config.js` with brand colors, typography scale, spacing system, and shadow levels per **UDS §2**.
- [ ] **Base Components** (Atomic):
    - **Button**: variants (primary, secondary, danger, ghost), states (hover, loading, disabled).
    - **Input**: variants (text, password, email, number), states (error, focus, disabled).
    - **Label**: standard accessible labels.
    - **Avatar**: display from URL, fallback to initials, sizes (sm, md, lg).
    - **Card**: standard container with padding and elevation.
    - **Modal/Dialog**: overlay with close logic and accessibility (focus trapping).
    - **Toast/Alert**: semantic variants (success, error, warning, info) with auto-dismiss.
    - **Spinner/Loader**: centralized loading indicator.
    - **Badge**: status pills (active, pending, verified, rejected).
- [ ] **Form Components** (Molecular):
    - **FormGroup**: combined Label + Input + Error Message.
    - **PasswordInput**: input with visibility toggle.
    - **PhoneInput**: prefix hint (+254) and E.164 validation feedback.
- [ ] **Layout Components**:
    - **Container**: responsive max-width wrapper.
    - **Stack/Grid**: layout helpers for spacing.
- [ ] **Theme System**:
    - Light/Dark mode toggle logic using React Context.
    - Persistence to `localStorage`.
- [ ] **Responsive Base**:
    - Mobile-first approach with breakpoints from **UDS §2.7**.
    - Touch-friendly tap targets (min 44px).
- [ ] **Demo Page**: A internal `/design-system` route showing all components for verification.

### §3.2 Out of Scope (MVP)
- Complex trading charts (WP-18).
- Advanced data tables with sorting (WP-20).
- Complex physics-based animations (CSS transitions only).
- Multi-language support (i18n) beyond hardcoded English.

### §3.3 Deliverables
| Deliverable | Old Location | New Location |
|-------------|--------------|--------------|
| Tailwind Configuration | `tailwind.config.js` | `frontend/tailwind.config.js` |
| Global CSS | `src/styles/globals.css` | `frontend/src/styles/globals.css` |
| Theme Context | `src/shared/context/ThemeContext.tsx` | `frontend/src/shared/context/ThemeContext.tsx` |
| Base Components | `src/shared/components/` | `frontend/src/shared/components/` |
| Demo Page | `src/modules/dashboard/pages/DesignSystem.tsx` | `frontend/src/pages/DesignSystem.tsx` |

---

## §4 Technical Specification

### §4.1 Architecture
- **Framework**: React 18 with Vite build tool.
- **Port**: Frontend runs independently on port 5173, proxies `/api` to backend.
- **Styling**: Tailwind CSS for utility-first styling. Use `clsx` or `tailwind-merge` for dynamic class management.
- **Icons**: Use `lucide-react` for lightweight icons.

### §4.2 Component Patterns
- **ForwardRefs**: All base inputs and buttons must use `React.forwardRef` to support form libraries.
- **Prop Types**: Strictly typed interfaces for all components.

### §4.3 Theming
- Implement a `ThemeProvider` that manages a `theme` state (`light` | `dark`).
- Add/remove the `.dark` class to the `html` or `body` element.
- Use Tailwind's `dark:` variant for component styling.

### §4.4 Accessibility
- Components must follow WAI-ARIA guidelines.
- Buttons must have `type="button"` by default.
- Modals must implement focus trapping and `Esc` to close.

---

## §5 Manual Steps for Owner
- None for MVP.

---

## §6 Testing Requirements

| Test Type | Coverage Target |
|-----------|-----------------|
| Unit tests | Test toggle logic in ThemeContext |
| Visual | Verify all variants on the Demo Page across breakpoints |
| Accessibility | Run `axe-core` on the Demo Page components |

---

## §7 Validation & Done Criteria

### §7.1 Code Quality Checklist
- [ ] Tailwind config matches **UDS §2** exactly.
- [ ] No hardcoded color hex values in TSX (use Tailwind classes).
- [ ] All components are mobile-responsive.
- [ ] Dark mode toggle works without page refresh.

### §7.2 Functional Verification
- [ ] Open `/design-system` → verify all variants of Button/Input.
- [ ] Switch to Dark Mode → verify background changes to `#0F1117` and text to `#F3F4F6`.
- [ ] Open Modal → verify it centers on mobile and desktop.

---

## §8 Handoff

### §8.1 Next Work Package
| WP-ID | Name | Why This Next |
|-------|------|---------------|
| WP-17 | Frontend Auth Screens | Requires Button, Input, and Alert components to build login/register. |

---

## §9 Risks & Blockers
| Risk | Probability | Impact | Mitigation | Owner |
|------|-------------|--------|------------|-------|
| Tailwind hydration flash | Medium | Low | Set theme class in a blocking script in `index.html`. | Executor |
| Accessibility compliance gaps | Low | Medium | Use `aria-*` attributes and test with keyboard only. | Executor |
