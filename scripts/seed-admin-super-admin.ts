import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || '',
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

async function seedSuperAdmin(): Promise<void> {
  const email = process.env.SUPER_ADMIN_EMAIL || 'its.phestone@gmail.com';
  const password = process.env.SUPER_ADMIN_PASSWORD || 'ChangeMe!123';
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const roles = ['support', 'finance', 'risk_manager', 'compliance', 'admin', 'super_admin'];

    for (const role of roles) {
      await client.query(
        `INSERT INTO app_auth.roles (name, description)
         VALUES ($1, $2)
         ON CONFLICT (name) DO NOTHING`,
        [role, `${role} administrative access`]
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const existingUser = await client.query(
      `SELECT id FROM app_auth.users WHERE email = $1 AND deleted_at IS NULL`,
      [email]
    );

    let userId: string;

    if (existingUser.rows[0]) {
      userId = existingUser.rows[0].id;
      await client.query(
        `UPDATE app_auth.users
         SET password_hash = $1,
             display_name = COALESCE(display_name, 'SkiesPro Owner'),
             status = 'active',
             kyc_status = 'verified',
             mfa_enabled = TRUE,
             updated_at = NOW()
         WHERE id = $2`,
        [passwordHash, userId]
      );
    } else {
      const created = await client.query(
        `INSERT INTO app_auth.users (
          email,
          password_hash,
          display_name,
          status,
          kyc_status,
          mfa_enabled,
          referral_code
        ) VALUES ($1, $2, $3, 'active', 'verified', TRUE, $4)
        RETURNING id`,
        [email, passwordHash, 'SkiesPro Owner', 'SKIESPROOWNER']
      );
      userId = created.rows[0].id;
    }

    const roleResult = await client.query(
      `SELECT id FROM app_auth.roles WHERE name = 'super_admin' LIMIT 1`
    );
    if (roleResult.rows[0]) {
      await client.query(
        `INSERT INTO app_auth.user_roles (user_id, role_id)
         SELECT $1, id FROM app_auth.roles WHERE name = 'super_admin'
         ON CONFLICT (user_id, role_id) DO NOTHING`,
        [userId]
      );
    }

    await client.query('COMMIT');
    console.log(`Super admin seeded for ${email}. Use SUPER_ADMIN_PASSWORD to authenticate.`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to seed super admin:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

void seedSuperAdmin();
