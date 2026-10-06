import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const TARGET_EMAIL = 'its.phestone@gmail.com';
const TARGET_PASSWORD = 'abachadA@21';
const EXPECTED_UUID = '87d63bfc-4488-4a39-8f20-eda46453ebe9';

const supabaseUrl = process.env.SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey = process.env.SUPABASE_ANON_KEY || '';
const dbUrl = process.env.DATABASE_URL || '';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const supabaseAnon = createClient(supabaseUrl, anonKey || serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('--- Step 1: WP-15 Supabase Auth Sync ---');
  console.log(`Target Email: ${TARGET_EMAIL}`);
  console.log(`Expected UUID: ${EXPECTED_UUID}`);

  try {
    console.log('\n🔍 Fetching user list from Supabase Auth admin endpoint...');
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();

    if (error) {
      console.error('❌ listUsers error:', JSON.stringify(error, null, 2));
      return;
    }

    console.log(`✓ Fetched ${data.users.length} users from Supabase Auth.`);
    const existingUser = data.users.find(u => u.email?.toLowerCase() === TARGET_EMAIL.toLowerCase());

    if (existingUser) {
      console.log(`✓ User '${TARGET_EMAIL}' already exists in Supabase Auth (ID: ${existingUser.id})`);
      console.log(`🔄 Updating password & confirming email for user ${existingUser.id}...`);

      const { data: updateData, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        {
          password: TARGET_PASSWORD,
          email_confirm: true,
          user_metadata: { display_name: 'SkiesPro Owner', role: 'super_admin' },
        }
      );

      if (updateErr) {
        console.error('❌ Failed to update user:', updateErr.message);
        return;
      }
      console.log('✅ Supabase Auth user updated successfully:', updateData.user.id);
    } else {
      console.log(`➕ User '${TARGET_EMAIL}' does not exist in Supabase Auth. Creating with ID '${EXPECTED_UUID}'...`);
      const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        id: EXPECTED_UUID,
        email: TARGET_EMAIL,
        password: TARGET_PASSWORD,
        email_confirm: true,
        user_metadata: { display_name: 'SkiesPro Owner', role: 'super_admin' },
      });

      if (createErr) {
        console.error('❌ Failed to create user:', createErr.message);
        return;
      }
      console.log('✅ Supabase Auth user created successfully:', createData.user.id);
    }

    // Postgres DB Sync for app_auth.users
    console.log('\n🔍 Syncing Postgres app_auth.users table...');
    const pool = new Pool({ connectionString: dbUrl });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const checkRes = await client.query('SELECT id FROM app_auth.users WHERE email = $1', [TARGET_EMAIL]);

      if (checkRes.rows.length > 0) {
        const currentId = checkRes.rows[0].id;
        if (currentId !== EXPECTED_UUID) {
          console.log(`🔄 Remapping Postgres user ID from ${currentId} to ${EXPECTED_UUID}...`);
          await client.query('UPDATE app_auth.user_roles SET user_id = $1 WHERE user_id = $2', [EXPECTED_UUID, currentId]);
          await client.query('UPDATE app_auth.users SET id = $1, status = \'active\', kyc_status = \'verified\' WHERE id = $2', [EXPECTED_UUID, currentId]);
        } else {
          console.log(`✓ app_auth.users already has expected ID ${EXPECTED_UUID}`);
        }
      } else {
        console.log(`➕ Inserting app_auth.users record with ID ${EXPECTED_UUID}...`);
        const bcrypt = require('bcrypt');
        const hash = await bcrypt.hash(TARGET_PASSWORD, 12);
        await client.query(
          `INSERT INTO app_auth.users (id, email, password_hash, display_name, status, kyc_status, mfa_enabled, referral_code)
           VALUES ($1, $2, $3, $4, 'active', 'verified', TRUE, 'SKIESPROOWNER')`,
          [EXPECTED_UUID, TARGET_EMAIL, hash, 'SkiesPro Owner']
        );
      }

      await client.query(
        `INSERT INTO app_auth.user_roles (user_id, role_id, granted_by)
         SELECT $1, id, $1 FROM app_auth.roles WHERE name = 'super_admin'
         ON CONFLICT (user_id, role_id) DO NOTHING`,
        [EXPECTED_UUID]
      );

      await client.query('COMMIT');
      console.log('✅ app_auth.users and user_roles successfully synced.');
    } catch (dbErr: any) {
      await client.query('ROLLBACK');
      console.error('❌ DB Sync Error:', dbErr.message);
    } finally {
      client.release();
      await pool.end();
    }

    // Verification step
    console.log('\n🔐 Verification: Testing signInWithPassword()...');
    const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
      email: TARGET_EMAIL,
      password: TARGET_PASSWORD,
    });

    if (authError) {
      console.error('❌ signInWithPassword failed:', authError.message);
      return;
    }

    console.log('\n====================================================');
    console.log('🎉 VERIFICATION SUCCESSFUL! GoTrue authentication passed.');
    console.log(`   User ID: ${authData.user.id}`);
    console.log(`   Email: ${authData.user.email}`);
    console.log(`   Access Token: ${authData.session.access_token.substring(0, 35)}...`);
    console.log(`   Expires At: ${new Date((authData.session.expires_at || 0) * 1000).toISOString()}`);
    console.log('====================================================\n');

  } catch (err: any) {
    console.error('Fatal execution error:', err);
  }
}

main();
