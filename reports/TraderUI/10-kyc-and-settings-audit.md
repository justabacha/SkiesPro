# KYC & Platform Settings Audit

## 1. The Admin Setting (Toggle & API)

- **Setting Key**: `'kyc.required_for_trading'` (stored in `config.platform_settings` table as string `'false'` or `'true'`). Additionally, `'kyc.required_for_withdrawal'` defaults to `'true'`.
- **Backend Fetching & Caching**: The backend uses `SettingsService` (`src/shared/services/settingsService.ts`), which queries `config.platform_settings` and caches values in memory for 5000ms (`CACHE_TTL_MS`).
- **Public API Contract**: Exposed to unauthenticated and authenticated clients via `GET /api/v1/config/public` (handled by `ConfigController.getPublicConfig` in `src/modules/config/config.controller.ts`). Response shape:
  ```json
  {
    "data": {
      "kyc": {
        "required_for_trading": false,
        "required_for_withdrawal": true
      }
    }
  }
  ```
- **Frontend Hook Integration**: The `usePublicConfig` hook (`frontend/src/shared/hooks/usePublicConfig.ts`) parses this response into `config.kycRequiredForTrading` and `config.kycRequiredForWithdrawal`.

---

## 2. Backend Trading Enforcement

- **File & Location**: `src/modules/trading/services/tradingService.ts` Lines 50-59.
- **Enforcement Code**:
  ```ts
  // 1. User Status Check
  const user = await this.userRepo.findById(userId);
  if (!user || user.status !== 'active') {
    throw new Error('User account is not active or suspended');
  }
  const kycRequired = await this.settingsService.getSetting('kyc.required_for_trading', false);
  if (kycRequired && user.kyc_status !== 'verified') {
    throw new Error('KYC verification required for trading');
  }
  ```
- **Behavior**: When the admin toggle `kyc.required_for_trading` is set to `true`, `TradingService.placeTrade` enforces that `user.kyc_status === 'verified'`, throwing `422 Unprocessable Entity ("KYC verification required for trading")` for unverified users.

---

## 3. KYC Document Storage & Schema

- **Database Table**: `compliance.kyc_documents` (`migrations/007_compliance_schema_tables.sql`):
  - `id`: UUID (Primary Key)
  - `user_id`: UUID (Foreign Key -> `app_auth.users(id)`)
  - `document_type`: VARCHAR(30) (`passport`, `national_id`, `drivers_license`, `proof_of_address`, `selfie`)
  - `file_storage_path`: VARCHAR(500) (Supabase Storage URL or path)
  - `file_hash`: VARCHAR(64) (SHA-256 hash)
  - `status`: VARCHAR(20) (`pending`, `approved`, `rejected`, `expired`)
  - `reviewed_by`: UUID
  - `review_note`: TEXT
  - `reviewed_at`: TIMESTAMPTZ
  - `created_at`: TIMESTAMPTZ
- **Storage Strategy**: `SupabaseStorageClient` (`src/shared/storage/supabaseStorage.ts`) currently manages the `'avatars'` bucket. A corresponding `'kyc-documents'` bucket upload method can be added to store document images securely.
- **Admin Review Compatibility**: `AdminRepository` queries (`listPendingKyc` and `getKycById`) expect `compliance.kyc_documents` rows linked to `app_auth.users`, displaying document type, status, and storage URL.

---

## 4. Frontend Integration Points

- **OrderForm Integration** (`frontend/src/modules/trading/components/OrderForm.tsx`):
  - Line 76: `const requiresTradingKyc = config.kycRequiredForTrading && user?.kycStatus !== 'verified';`
  - Line 156: `isDisabled = requiresTradingKyc || ...`
  - Line 201: Renders warning banner when `requiresTradingKyc` is true: `"KYC verification is required to place trades."`
- **Wallet Page Integration** (`frontend/src/pages/wallet/WalletPage.tsx`):
  - Line 125: Enforces `config.kycRequiredForWithdrawal && user?.kycStatus !== 'verified'` on withdrawal form.
- **Placeholder Page**: `frontend/src/router/index.tsx` line 38 currently mounts `<Placeholder title="KYC Verification" />` for path `kyc`. It will be replaced by a full `KycPage.tsx` component.

---

## 5. Feasibility & Implementation Sequence (Advisory)

1. **Backend Slice**:
   - Create `POST /api/v1/users/kyc/documents` endpoint with multipart image upload (JPEG/PNG, max 5MB).
   - Upload file to Supabase Storage, insert record into `compliance.kyc_documents`, and transition user `kyc_status` to `'pending'`.
2. **Frontend Slice**:
   - Replace placeholder `/kyc` route with a rich `KycPage.tsx` component.
   - Display current KYC status badge (`unverified`, `pending`, `verified`, `rejected`), document type selector, drag-and-drop file uploader, and submission status.

---

## 6. Constraints Honored

- Read-Only constraint strictly honored: Zero code files modified.
- Admin files untouched.
- Saved to `reports/TraderUI/10-kyc-and-settings-audit.md`.
