# WP-20 Phase 9 Audit Report: Admin Shell Components (`AdminLayout`, `AdminHeader`, `AdminSidebar`)

## 1. Executive Summary

- **Top Gap #1 (Global Quick Search Input Unwired)**: The global search bar in [AdminHeader.tsx](file:///C:/SkiesPro/frontend/src/components/admin/AdminHeader.tsx#L48) (`Quick search users, tickets, transactions...`) is a static visual placeholder without state, event handlers, or search API integration.
- **Top Gap #2 (Static MFA Status Indicator)**: The MFA badge in [AdminHeader.tsx](file:///C:/SkiesPro/frontend/src/components/admin/AdminHeader.tsx#L59) statically displays `"MFA Active"` with a green `ShieldCheck` icon for all logged-in admin accounts. It does not dynamically reflect the active vs expired state of the admin's TOTP step-up session.
- **Top Gap #3 (Mobile Drawer Click-to-Close Navigation)**: On mobile viewports (<1024px), navigating to a route by clicking a link in [AdminSidebar.tsx](file:///C:/SkiesPro/frontend/src/components/admin/AdminSidebar.tsx) does not automatically close the mobile drawer overlay (`mobileSidebarOpen` state in [AdminLayout.tsx](file:///C:/SkiesPro/frontend/src/pages/admin/AdminLayout.tsx#L8)). The user must manually tap the backdrop overlay to dismiss the drawer after selecting a page.

---

## 2. Component Structure (A)

1. **Main Layout File**: [AdminLayout.tsx](file:///C:/SkiesPro/frontend/src/pages/admin/AdminLayout.tsx)
2. **Shell Components**:
   - [AdminHeader.tsx](file:///C:/SkiesPro/frontend/src/components/admin/AdminHeader.tsx) (109 lines)
   - [AdminSidebar.tsx](file:///C:/SkiesPro/frontend/src/components/admin/AdminSidebar.tsx) (169 lines)
3. **Layout Architecture**:
   - Outer container: `h-screen w-screen overflow-hidden flex flex-row bg-[#0F1117]`.
   - Sidebar placement: Fixed desktop sidebar (`hidden lg:flex flex-shrink-0 h-full`) and fixed z-index mobile drawer overlay (`fixed inset-0 z-50 lg:hidden flex`).
   - Main content column: `flex-1 flex flex-col h-full min-w-0 overflow-hidden`.
   - Scrollable content body: `<main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6">` hosting child page routes via React Router `<Outlet />`.

---

## 3. Navigation & Role Visibility (B)

4. **Role-Based Sidebar Filtering**:
   - Implemented dynamically in [AdminSidebar.tsx](file:///C:/SkiesPro/frontend/src/components/admin/AdminSidebar.tsx#L97):
     ```typescript
     const { user } = useAuth();
     const userRoles = new Set(user?.roles || (user?.role ? [user.role] : ['trader']));

     const visibleItems = SIDEBAR_NAV_ITEMS.filter((item) =>
       item.roles.some((role) => userRoles.has(role))
     );
     ```
5. **Role Security**:
   - When a `support` role logs in, all unauthorized links (`User Directory`, `KYC Verification`, `Finance & Wallets`, `4-Eyes Approvals`, `Audit Trail`, `Risk & Exposure`, `Reports & Analytics`, `Platform Settings`) are completely hidden from the sidebar DOM.
   - Combined with `AdminProtectedRoute` in [adminRoutes.tsx](file:///C:/SkiesPro/frontend/src/routes/adminRoutes.tsx), unauthorized navigation is enforced at both UI navigation and route levels.
6. **Active Link Highlighting**:
   - Uses React Router `<NavLink>` render prop `({ isActive })`, applying active styles (`bg-blue-600/15 text-blue-400 border-blue-500/30`) when active and hover styles when inactive.

---

## 4. Header & Profile Flow (C)

7. **Header Controls**:
   - Mobile menu hamburger toggle button (`Menu` icon).
   - Dynamic Breadcrumb path segments parsed from `location.pathname`.
   - Global Quick Search bar (hidden on mobile).
   - MFA Status Indicator (`ShieldCheck` badge).
   - Active Profile Avatar + Role Badge (with role-specific color mapping `super_admin` = purple, `admin` = blue, `finance` = emerald, `compliance` = amber, `risk_manager` = rose, `support` = cyan).
   - Logout button (`LogOut` icon).
8. **User Profile Display**:
   - Renders `user?.displayName` or `user?.email` with the role badge directly in the header bar.
9. **Logout Flow**:
   - Triggered by clicking the `LogOut` button:
     ```typescript
     onClick={() => {
       logout();
       navigate('/login');
     }}
     ```
   - Clears auth tokens/session via `logout()` and redirects to `/login`.
10. **Mobile Menu Toggle**:
    - Handled via `onToggleSidebar` callback prop on `AdminHeader`, setting `mobileSidebarOpen = true` in `AdminLayout`.

---

## 5. Responsiveness (D)

11. **Mobile Adaptability (375px Viewport)**:
    - Sidebar transitions to a slide-over mobile drawer with dark backdrop blur overlay on screens `<1024px` (`lg:` breakpoint).
    - Header quick search bar is hidden on mobile (`hidden md:block`).
    - Breadcrumb text and MFA badge text collapse gracefully on small screens (`hidden sm:flex`, `hidden sm:inline`).
12. **Scroll & Overflow**:
    - No horizontal scroll issues detected. All flex children enforce `min-w-0` to prevent flex items from forcing overflow. Body content scrolls independently inside `<main className="flex-1 overflow-y-auto">`.

---

## 6. Impact Map

| File Path | Description of Changes Needed |
| :--- | :--- |
| `frontend/src/components/admin/AdminHeader.tsx` | Wire quick search input to search handler / modal; add prop/state for dynamic MFA step-up status |
| `frontend/src/components/admin/AdminSidebar.tsx` | Add `onNavigate` / `onClose` callback prop to close mobile drawer on link click |
| `frontend/src/pages/admin/AdminLayout.tsx` | Pass `onClose` handler to mobile `AdminSidebar` instance |

---

## 7. Recommended Fix Scope

1. **Mobile Drawer Auto-Close**: Pass an `onNavigate={() => setMobileSidebarOpen(false)}` handler to the mobile `AdminSidebar` instance in `AdminLayout.tsx` so clicking a navigation link closes the drawer automatically.
2. **Global Quick Search Wiring**: Add an `onSearch` / quick search modal or redirect handler to the search input in `AdminHeader.tsx` so searching for a user ID or transaction redirects to the respective management page.
3. **Dynamic MFA Badge**: Wire `AdminHeader.tsx` to reflect active MFA step-up token presence/expiry rather than a static badge.

Read-Only Audit Completed
