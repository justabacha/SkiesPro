# WP-20 Phase 8 Audit Report: Platform Settings (`/admin/settings`)

## 1. Executive Summary

- **Top Gap #1 (CRITICAL: Missing Audit Logging)**: Neither [AdminRiskService.ts](file:///C:/SkiesPro/src/modules/admin/services/AdminRiskService.ts#L30) nor [AdminRepository.ts](file:///C:/SkiesPro/src/modules/admin/repositories/AdminRepository.ts#L596) creates an entry in `admin.audit_logs` when platform settings are updated. Any administrator can alter global limits, fee percentages, payout ratios, or operational parameters without producing an immutable audit record.
- **Top Gap #2 (Missing Controller & Frontend Error Handling)**: [AdminController.updateSettings](file:///C:/SkiesPro/src/modules/admin/controllers/AdminController.ts#L207) lacks a `try/catch` block. Furthermore, `handleMfaConfirm` in [PlatformSettingsPage.tsx](file:///C:/SkiesPro/frontend/src/pages/admin/PlatformSettingsPage.tsx#L35) does not catch errors thrown by `adminApiClient.updateSettings`. If an API error or invalid TOTP occurs during save, the rejection is unhandled and no error message is displayed to the admin.
- **Top Gap #3 (Unvalidated Generic Inputs & Uncategorized UI)**: Every platform setting is rendered as a plain `<input type="text">` without type/range validation (e.g. allowing negative deposit limits or out-of-bounds payout ratios) and without categorization tabs (General, Trading, Fees, Security). Additionally, updating settings via `adminApiClient.updateSettings` fires separate sequential `PUT` requests for every key in a `for...of` loop rather than a batch update.

---

## 2. Page & Route Map (A)

1. **Frontend Route**: Defined in [adminRoutes.tsx](file:///C:/SkiesPro/frontend/src/routes/adminRoutes.tsx#L109):
   - Path: `/admin/settings`
   - Access Control: Protected via `AdminProtectedRoute` with `allowedRoles={['admin', 'super_admin']}`. Roles `finance`, `compliance`, `risk_manager`, and `support` are blocked.
2. **Page Component Path**: [PlatformSettingsPage.tsx](file:///C:/SkiesPro/frontend/src/pages/admin/PlatformSettingsPage.tsx)
3. **UI Categorization**: Flat list of all settings. No sub-navigation tabs or category groupings (e.g. General, Trading, Fees, Security, Feature Flags).

---

## 3. Data Wiring & Persistence (B)

4. **Live API Endpoint**:
   - `GET /api/v1/admin/settings` (fetches list of `PlatformSetting[]`).
   - `PUT /api/v1/admin/settings` (updates setting key/value).
5. **Hardcoded / Mock Data**: None in API responses, but `adminApiClient.updateSettings` hardcodes reason string `'Admin platform setting update'` for key-value batch loops.
6. **Persistence & SQL Check**:
   - Handled by `AdminRepository.setSetting` in [AdminRepository.ts](file:///C:/SkiesPro/src/modules/admin/repositories/AdminRepository.ts#L596):
     ```sql
     INSERT INTO config.platform_settings (key, value, updated_by, reason, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (key)
     DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, reason = EXCLUDED.reason, updated_at = NOW()
     RETURNING *
     ```
   - Uses `UPSERT` (`ON CONFLICT (key) DO UPDATE`).
7. **Storage Structure**: Individual rows in `config.platform_settings` table (`key VARCHAR(100) PRIMARY KEY`, `value JSONB`).

---

## 4. Security & Audit Logging (C)

8. **Audit Logging Status**: **MISSING (CRITICAL GAP)**. Updating platform settings in `AdminRiskService.updateSettings` does NOT invoke `AdminAuditService.createEntry(...)`.
9. **MFA Step-Up**:
   - Required in Frontend: [PlatformSettingsPage.tsx](file:///C:/SkiesPro/frontend/src/pages/admin/PlatformSettingsPage.tsx#L135) prompts `MfaStepUpModal` before saving.
   - Required in Backend: `admin.routes.ts` applies `requireAdminMFA` middleware to `PUT /settings`.
10. **4-Eyes Approval**: **Not required.** Modifying global platform settings takes effect immediately upon single admin MFA confirmation without a 2nd super_admin approval step.
11. **Controller Error Handling**:
    - `listSettings`, `getSettingByKey`, and `updateSettings` in [AdminController.ts](file:///C:/SkiesPro/src/modules/admin/controllers/AdminController.ts#L197) lack `try/catch` blocks.

---

## 5. UI/UX & Validation (D)

12. **Shared Components**: Uses `MfaStepUpModal`. Does NOT use `SaveButton` with loading indicator or `FilterTabs`.
13. **Loading & Error States**:
    - Card body lacks a skeleton loader during `fetchSettings()` loading.
    - If `fetchSettings()` fails, a rose alert banner is rendered.
    - Save errors in `handleMfaConfirm` are unhandled (no `try/catch`).
14. **Validation**:
    - **Frontend**: Zero validation. Allows invalid strings or out-of-bounds numbers in text inputs.
    - **Backend**: Route validation only checks `body('key').notEmpty(), body('value').notEmpty()`. No numeric range or bounds checks.
15. **Success Feedback**: Shows a temporary green banner (`"Platform settings updated successfully."`) for 3 seconds after save.

---

## 6. Impact Map

| File Path | Description of Changes Needed |
| :--- | :--- |
| `src/modules/admin/services/AdminRiskService.ts` | Inject `AdminAuditService` and record audit log on setting updates |
| `src/modules/admin/controllers/AdminController.ts` | Add `try/catch` error handling to `listSettings`, `getSettingByKey`, and `updateSettings` |
| `frontend/src/pages/admin/PlatformSettingsPage.tsx` | Add `try/catch` in `handleMfaConfirm`, add category tabs/groupings, and add input validation |
| `frontend/src/services/admin/adminApiClient.ts` | Support batch update or single request payload handling |

---

## 7. Recommended Fix Scope

1. **Audit Logging**: Call `AdminAuditService.createEntry` in `AdminRiskService.updateSettings` so all configuration changes are recorded in `admin.audit_logs`.
2. **Controller & Frontend Error Handling**: Wrap backend setting controller methods in `try/catch` blocks and add `try/catch` in `handleMfaConfirm` in `PlatformSettingsPage.tsx`.
3. **UI Categorization & Input Validation**: Organize settings by category (e.g. General, Trading, Fees, Security, Feature Flags) and validate numeric ranges/types before saving.

Read-Only Audit Completed
