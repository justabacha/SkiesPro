# Wave 1 — Settings Backend APIs Implementation (Slice 1)

## Part 1: Pre-Execution Verification Answers

1. **Sessions Schema**:
   `app_auth.sessions` schema in `002_auth_schema_tables.sql` & `019_add_critical_columns.sql` includes `ip_address INET`, `user_agent TEXT`, `created_at TIMESTAMPTZ`, `expires_at TIMESTAMPTZ`, `access_token_jti VARCHAR(64)`, `device_info JSONB`, `is_revoked BOOLEAN`, and `revoked_at TIMESTAMPTZ`. Added migration `042_add_settings_columns.sql` to ensure `last_seen_at TIMESTAMPTZ DEFAULT NOW()` and `deactivated_at TIMESTAMPTZ` exist on `app_auth.sessions` and `app_auth.users`.

2. **Email Infrastructure**:
   Reused `events.event_outbox` / `OutboxRepository` transactional outbox infrastructure (`src/modules/auth/repositories/outboxRepository.ts`). Emits `EmailChangeInitiated` events to `events.event_outbox` containing verification JWT tokens for new-email verification and old-email security alerts.

3. **MFA Re-verify**:
   Confirmed `MfaService` and `MfaRepository` verify TOTP codes outside login flow using `mfaService.verifyToken(code, secret)` or password re-authentication (`bcrypt.compare`). Added `disable(userId)` and `updateBackupCodes(userId, backupCodes)` methods to `MfaRepository`.

4. **Password Validator**:
   Exact password policy validator defined at `src/modules/auth/auth.routes.ts` Lines 21-24:
   ```ts
   body('password')
     .isLength({ min: 8 })
     .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
   ```
   Requires: Minimum 8 characters, at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character (`@$!%*?&`).

5. **Profile DTO**:
   Updated `ProfileResponseDto` (`src/modules/user/dto/ProfileResponseDto.ts`) to include `mfa_enabled: boolean` and `phone: string | null`.

---

## Part 2: Backend Implementation Summary

Built 7 new authenticated settings API endpoints across `src/modules/user/` and `src/modules/auth/`:

1. **Password Management**:
   - `PUT /api/v1/users/password` (authenticated)
   - Validates current password via `bcrypt.compare`, validates new password policy, updates `password_hash`, logs to `password_history`, and revokes all other sessions (`revokeOtherSessions`).

2. **MFA Management**:
   - `POST /api/v1/auth/mfa/disable` (authenticated)
     - Validates via 6-digit TOTP code or password re-authentication, sets `mfa_enabled = FALSE`, and disables MFA in `app_auth.mfa_tokens`.
   - `POST /api/v1/auth/mfa/backup-codes/regenerate` (authenticated)
     - Validates via TOTP code or password, generates new backup codes, replaces existing codes in `app_auth.mfa_tokens`, and returns `{ backup_codes: string[] }`.

3. **Email Change (Double Opt-In)**:
   - `POST /api/v1/users/email-change/initiate` (authenticated)
     - Validates password and new email uniqueness. Generates a signed 15-minute verification JWT and emits `EmailChangeInitiated` event to `events.event_outbox`.
   - `POST /api/v1/users/email-change/verify` (authenticated)
     - Verifies token claims, updates `app_auth.users.email = new_email`, and revokes other sessions.

4. **Session Management**:
   - `GET /api/v1/users/sessions` (authenticated)
     - Returns active sessions from `app_auth.sessions` (`id`, `user_agent`, `ip_address`, `last_seen_at`, `created_at`, `is_current`).
   - `DELETE /api/v1/users/sessions/:id` (authenticated)
     - Revokes specific session (`is_revoked = TRUE, revoked_at = NOW()`). Rejects revoking current active session via DELETE (requires `/logout`).

5. **Account Deactivation (Soft)**:
   - `POST /api/v1/users/deactivate` (authenticated)
     - Re-authenticates via password, updates `app_auth.users.status = 'closed'`, and revokes all sessions (`revokeAllSessions`).

---

## Part 3: Test Suite & Typecheck Verification

- **Backend Typecheck**: Executed `npm run typecheck` — **0 errors**.
- **Settings Integration Tests**: `tests/user/settings.test.ts` — **10/10 tests passed**.
- **Consecutive Full Backend Suite Runs** (`npm test`):
  - **Run 1**: `62 passed, 62 total` test suites; `405 passed, 405 total` tests (361.355 s).
  - **Run 2**: `62 passed, 62 total` test suites; `405 passed, 405 total` tests (337.953 s).

---

## Scope Confirmations
- Zero frontend files modified (`frontend/*` untouched).
- Zero admin files modified (`src/modules/admin/*` untouched).
- Trading and settlement logic untouched.

---

## Follow-up: Handoff Corrections

### T1 — Migration Handoff
- **Database Target Isolation**: Confirmed migration `042_add_settings_columns.sql` was executed ONLY against `TEST_DATABASE_URL` for integration test execution and automated suite validation. The Production database was NOT modified.
- **SQL Migration Dump for Manual Production Execution**:
  ```sql
  -- Migration 042: Add settings columns and support deactivated status
  -- 1. Add last_seen_at to app_auth.sessions
  ALTER TABLE app_auth.sessions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();

  -- 2. Add deactivated_at and update status constraint on app_auth.users
  ALTER TABLE app_auth.users DROP CONSTRAINT IF EXISTS app_auth_users_status_check;
  ALTER TABLE app_auth.users ADD CONSTRAINT app_auth_users_status_check CHECK (status IN ('active','suspended','closed','deactivated'));
  ALTER TABLE app_auth.users ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
  ```

### T2 — Route Path Verification
Confirmed route mounting in `src/infrastructure/routes.ts`:
```ts
router.use('/api/v1/auth', authRoutes);
router.use('/api/v1/users', userRoutes);
```

**Exact Absolute Endpoint URL List for Frontend (Slice 2)**:
- `PUT /api/v1/users/password` (Password Change)
- `POST /api/v1/users/email-change/initiate` (Email Change Step 1)
- `POST /api/v1/users/email-change/verify` (Email Change Step 2)
- `GET /api/v1/users/sessions` (Active Sessions List)
- `DELETE /api/v1/users/sessions/:id` (Revoke Specific Session)
- `POST /api/v1/users/deactivate` (Soft Account Deactivation)
- `POST /api/v1/auth/mfa/disable` (Disable MFA)
- `POST /api/v1/auth/mfa/backup-codes/regenerate` (Regenerate Backup Codes)

### T3 — Profile DTO Verification
Quoted from `src/modules/user/dto/ProfileResponseDto.ts`:
```ts
export interface ProfileResponseDto {
  id: string;
  email: string;
  display_name: string;
  phone: string | null;
  avatar_url: string | null;
  kyc_status: string;
  created_at: string;
  mfa_enabled: boolean;
}
```
