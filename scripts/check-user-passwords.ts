import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkUsers() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT u.id, u.email, u.password_hash, u.status, u.is_verified, u.is_active, u.kyc_status, u.mfa_enabled,
             ARRAY_AGG(r.name) as roles
      FROM app_auth.users u
      LEFT JOIN app_auth.user_roles ur ON ur.user_id = u.id
      LEFT JOIN app_auth.roles r ON r.id = ur.role_id
      WHERE u.deleted_at IS NULL
      GROUP BY u.id, u.email, u.password_hash, u.status, u.is_verified, u.is_active, u.kyc_status, u.mfa_enabled
      ORDER BY u.created_at DESC
    `);

    console.log('--- DB USERS ---');
    console.table(res.rows.map(r => ({
      email: r.email,
      roles: r.roles.filter(Boolean).join(', '),
      mfa_enabled: r.mfa_enabled,
      status: r.status,
      is_verified: r.is_verified,
      hash_start: r.password_hash ? r.password_hash.substring(0, 15) : 'NONE',
    })));

    const phestoneUser = res.rows.find(r => r.email.includes('phestone'));
    if (phestoneUser) {
      console.log('Phestone user:', phestoneUser.email);
      console.log('Testing passwords for phestone:');
      console.log('abachadA@21:', await bcrypt.compare('abachadA@21', phestoneUser.password_hash));
      console.log('ChangeMe!123:', await bcrypt.compare('ChangeMe!123', phestoneUser.password_hash));
      console.log('SkiesPro@2026:', await bcrypt.compare('SkiesPro@2026', phestoneUser.password_hash));
    }
  } finally {
    client.release();
    await pool.end();
  }
}

checkUsers();
