import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || '',
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

async function updateKycImages(): Promise<void> {
  const client = await pool.connect();
  const targetUserId = '2b9a1249-629a-4ddc-a101-38d9ef8a7cd5';

  try {
    await client.query('BEGIN');

    console.log(`Updating KYC document URLs for user ${targetUserId}...`);

    // Update national_id
    await client.query(
      `UPDATE compliance.kyc_documents
       SET file_storage_path = $1
       WHERE user_id = $2 AND document_type = 'national_id'`,
      ['https://picsum.photos/600/400', targetUserId]
    );

    // Update selfie
    await client.query(
      `UPDATE compliance.kyc_documents
       SET file_storage_path = $1
       WHERE user_id = $2 AND document_type = 'selfie'`,
      ['https://picsum.photos/600/401', targetUserId]
    );

    // Update proof_of_address
    await client.query(
      `UPDATE compliance.kyc_documents
       SET file_storage_path = $1
       WHERE user_id = $2 AND document_type = 'proof_of_address'`,
      ['https://invalid-url-that-will-fail.com/image.jpg', targetUserId]
    );

    await client.query('COMMIT');
    console.log('✓ KYC document image URLs updated successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('✗ Update failed:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

updateKycImages();
