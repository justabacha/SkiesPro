import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || '',
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

async function seedPhaseAData(): Promise<void> {
  const client = await pool.connect();
  const targetUserId = '2b9a1249-629a-4ddc-a101-38d9ef8a7cd5';
  const targetUserEmail = 'ryan41rays@gmail.com';

  try {
    await client.query('BEGIN');

    // 1. Reset KYC Status in app_auth.users
    console.log(`Setting kyc_status = 'unverified' for user ${targetUserEmail} (${targetUserId})...`);
    await client.query(
      `UPDATE app_auth.users SET kyc_status = 'unverified', updated_at = NOW() WHERE id = $1`,
      [targetUserId]
    );

    // 2. Delete existing kyc_documents for target user
    console.log(`Deleting existing KYC documents for user ${targetUserId}...`);
    await client.query(
      `DELETE FROM compliance.kyc_documents WHERE user_id = $1`,
      [targetUserId]
    );

    // 3. Re-insert 3 mock pending documents
    console.log(`Re-inserting 3 mock pending KYC documents...`);
    const mockDocs = [
      {
        type: 'national_id',
        url: 'https://placehold.co/600x400/0f172a/38bdf8?text=ID+Front+Jace+Norman',
        hash: 'hash_id_front',
      },
      {
        type: 'proof_of_address',
        url: 'https://placehold.co/600x400/0f172a/38bdf8?text=Proof+of+Address',
        hash: 'hash_poa',
      },
      {
        type: 'selfie',
        url: 'https://placehold.co/600x400/0f172a/38bdf8?text=Selfie+Jace+Norman',
        hash: 'hash_selfie',
      },
    ];

    for (const doc of mockDocs) {
      await client.query(
        `INSERT INTO compliance.kyc_documents (
          id, user_id, document_type, file_storage_path, file_hash, status, created_at
        ) VALUES (gen_random_uuid(), $1, $2, $3, $4, 'pending', NOW())`,
        [targetUserId, doc.type, doc.url, doc.hash]
      );
    }

    // 4. Find super_admin or admin ID for action_admin
    const adminResult = await client.query(
      `SELECT u.id FROM app_auth.users u
       JOIN app_auth.user_roles ur ON ur.user_id = u.id
       JOIN app_auth.roles r ON r.id = ur.role_id
       WHERE LOWER(r.name) IN ('super_admin', 'admin') AND ur.revoked_at IS NULL
       LIMIT 1`
    );

    let adminId = adminResult.rows[0]?.id;
    if (!adminId) {
      const fallbackUser = await client.query(`SELECT id FROM app_auth.users LIMIT 1`);
      adminId = fallbackUser.rows[0]?.id;
    }

    console.log(`Seeding 4-Eyes pending action using admin_id: ${adminId}...`);

    // 5. Insert mock action into admin.admin_actions
    await client.query(
      `INSERT INTO admin.admin_actions (
        id, admin_id, action_type, target_user_id, details, requires_approval, approved_by, approved_at, created_at
      ) VALUES (
        gen_random_uuid(), $1, 'manual_wallet_adjustment', $2, $3::jsonb, true, NULL, NULL, NOW()
      )`,
      [
        adminId,
        targetUserId,
        JSON.stringify({ amount: 100000, reason: 'Test adjustment for 4-eyes approval' }),
      ]
    );

    await client.query('COMMIT');
    console.log('✓ Phase A test data seeded successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('✗ Seeding failed:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seedPhaseAData();
