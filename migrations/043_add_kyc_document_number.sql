-- Keep the document number supplied with each newly uploaded KYC document.
-- Nullable to preserve compatibility with documents created before this field existed.
ALTER TABLE compliance.kyc_documents
  ADD COLUMN IF NOT EXISTS document_number VARCHAR(100);
