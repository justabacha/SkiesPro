# Wave 2 — KYC Backend (Slice 1)

## Implementation

- Added `POST /api/v1/users/kyc/documents`, protected by the existing `authenticate` and authenticated rate-limit middleware.
- Added Multer memory storage with a 5 MB limit and JPEG/PNG MIME allow-list. The controller also checks JPEG/PNG file signatures so MIME headers alone cannot pass arbitrary content.
- The service hashes the bytes with SHA-256, uploads to the private `kyc-documents` Supabase bucket, inserts `user_id`, `document_type`, `document_number`, `file_storage_path`, `file_hash`, and `pending` status, and updates `app_auth.users.kyc_status` to `pending` in a single database transaction. If database persistence fails after storage upload, it rolls back and attempts to remove the uploaded object.
- Added `uploadKycDocument`, `deleteKycDocument`, and one-hour `createKycDocumentSignedUrl` operations to `SupabaseStorageClient`. Upload returns only the storage object path, never a public URL. Object names include a timestamp, UUID, and sanitized original name; overwrites are disabled.
- Added `migrations/043_add_kyc_document_number.sql`. The existing `compliance.kyc_documents` schema already requires `file_hash` but has no `document_number`; the new nullable column preserves older rows while supporting this payload. Applied migration 043 to the database selected explicitly from `TEST_DATABASE_URL` (not `DATABASE_URL`).
- The Admin KYC viewer consumes `id_front_url`, `proof_of_address_url`, and `selfie_url` as image sources. Admin list and detail controller responses now replace relative `kyc-documents` paths with private signed URLs expiring after one hour. Existing absolute URLs are left intact. No Admin UI files were changed.
- Added `tests/user/kyc.test.ts` for successful persistence and `kyc_status` update, oversize rejection, non-image rejection, and mismatched MIME/content rejection. Storage is mocked in integration tests; actual Supabase bucket upload was not exercised by tests.

## Verification

- Migration 043 applied to `TEST_DATABASE_URL`: **passed**.
- Focused integration tests: **4/4 passed**.
- Backend typecheck (`npm run typecheck`): **passed**.
- Required full backend test runs: pending.

## Files

Created:
- `migrations/043_add_kyc_document_number.sql`
- `src/modules/user/repositories/KycRepository.ts`
- `tests/user/kyc.test.ts`
- `reports/TraderUI/11-kyc-backend.md`

Modified:
- `src/shared/storage/supabaseStorage.ts`
- `src/modules/user/user.routes.ts`
- `src/modules/user/controllers/UserController.ts`
- `src/modules/user/services/UserService.ts`
- `src/modules/admin/controllers/AdminController.ts` (signed URL transformation only)

No frontend files, Admin UI files, or Trading Engine logic were modified.
