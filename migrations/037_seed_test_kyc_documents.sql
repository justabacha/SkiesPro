DO $$
DECLARE
  test_user_id UUID := '2b9a1249-629a-4ddc-a101-38d9ef8a7cd5';
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM app_auth.users
    WHERE id = test_user_id
      AND LOWER(email) = LOWER('ryan41rays@gmail.com')
  ) THEN
    RAISE EXCEPTION 'Expected KYC test user ryan41rays@gmail.com (%) was not found', test_user_id;
  END IF;

  INSERT INTO compliance.kyc_documents (
    id,
    user_id,
    document_type,
    file_storage_path,
    file_hash,
    status,
    created_at
  )
  SELECT
    gen_random_uuid(),
    test_user_id,
    seed.document_type,
    seed.file_storage_path,
    seed.file_hash,
    'pending',
    NOW()
  FROM (
    VALUES
      (
        'national_id',
        'https://placehold.co/600x400/0f172a/38bdf8?text=ID+Front+Jace+Norman',
        'hash_id_front'
      ),
      (
        'proof_of_address',
        'https://placehold.co/600x400/0f172a/38bdf8?text=Proof+of+Address',
        'hash_poa'
      ),
      (
        'selfie',
        'https://placehold.co/600x400/0f172a/38bdf8?text=Selfie+Jace+Norman',
        'hash_selfie'
      )
  ) AS seed(document_type, file_storage_path, file_hash)
  WHERE NOT EXISTS (
    SELECT 1
    FROM compliance.kyc_documents existing
    WHERE existing.user_id = test_user_id
      AND existing.document_type = seed.document_type
      AND existing.status = 'pending'
  );
END $$;
