import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const STRAY_EMAIL = 'itsphestone@gmail.com';
const STRAY_UUID = '57754967-d0f9-467a-9874-1b4f8cd043f7';

const OFFICIAL_EMAIL = 'its.phestone@gmail.com';
const OFFICIAL_UUID = '87d63bfc-4488-4a39-8f20-eda46453ebe9';
const OFFICIAL_PASSWORD = 'abachadA@21';

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

const pool = new Pool({ connectionString: dbUrl });

async function runCleanupAndUpdate() {
  console.log('--- WP-15: Cleanup Stray Account & Update Official Super Admin Profile ---\n');

  try {
    // 1. Delete Stray Account
    console.log(`1️⃣ Deleting Stray Account (${STRAY_EMAIL} / ${STRAY_UUID})...`);

    // Delete from Supabase Auth via Admin SDK if present
    try {
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
      const strayUser = listData?.users.find(u => u.email?.toLowerCase() === STRAY_EMAIL.toLowerCase() || u.id === STRAY_UUID);
      if (strayUser) {
        await supabaseAdmin.auth.admin.deleteUser(strayUser.id);
        console.log(`✓ Deleted stray user '${strayUser.id}' from Supabase Auth via Admin API.`);
      } else {
        console.log(`✓ Stray user '${STRAY_EMAIL}' not found in Supabase Auth.`);
      }
    } catch (err: any) {
      console.warn(`⚠️ Warning checking/deleting stray user in Supabase Auth:`, err.message);
    }

    // Delete stray record from Postgres database in dependency order
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Break self-referencing FKs and child relationships
      await client.query('UPDATE app_auth.users SET referred_by_id = NULL WHERE referred_by_id = $1 OR id = $1', [STRAY_UUID]);
      await client.query('DELETE FROM wallet.ledger_entries WHERE wallet_id IN (SELECT id FROM wallet.wallets WHERE user_id = $1)', [STRAY_UUID]);
      await client.query('DELETE FROM wallet.wallet_version_log WHERE wallet_id IN (SELECT id FROM wallet.wallets WHERE user_id = $1)', [STRAY_UUID]);
      await client.query('DELETE FROM wallet.demo_wallet_reset_events WHERE user_id = $1', [STRAY_UUID]);
      await client.query('DELETE FROM wallet.wallets WHERE user_id = $1', [STRAY_UUID]);
      await client.query('DELETE FROM payments.deposits WHERE user_id = $1', [STRAY_UUID]);
      await client.query('DELETE FROM payments.withdrawals WHERE user_id = $1', [STRAY_UUID]);
      await client.query('DELETE FROM trading.binary_contracts WHERE user_id = $1', [STRAY_UUID]);
      await client.query('DELETE FROM compliance.kyc_documents WHERE user_id = $1', [STRAY_UUID]);
      await client.query('DELETE FROM app_auth.user_roles WHERE user_id = $1 OR granted_by = $1', [STRAY_UUID]);
      await client.query('DELETE FROM app_auth.sessions WHERE user_id = $1', [STRAY_UUID]);
      await client.query('DELETE FROM app_auth.password_history WHERE user_id = $1', [STRAY_UUID]);
      await client.query('DELETE FROM app_auth.password_reset_tokens WHERE user_id = $1', [STRAY_UUID]);
      await client.query('DELETE FROM app_auth.mfa_tokens WHERE user_id = $1', [STRAY_UUID]);
      await client.query('DELETE FROM auth.identities WHERE user_id = $1', [STRAY_UUID]);
      await client.query('DELETE FROM auth.users WHERE id = $1 OR email = $2', [STRAY_UUID, STRAY_EMAIL]);
      await client.query('DELETE FROM app_auth.users WHERE id = $1 OR email = $2', [STRAY_UUID, STRAY_EMAIL]);

      await client.query('COMMIT');
      console.log(`✅ Stray account '${STRAY_EMAIL}' purged completely from Postgres tables.`);
    } catch (dbErr: any) {
      await client.query('ROLLBACK');
      console.error('❌ Postgres Stray Account Cleanup Error:', dbErr.message);
    }

    // 2. Update Official Super Admin Account in app_auth.users
    console.log(`\n2️⃣ Updating Official Super Admin Account (${OFFICIAL_EMAIL} / ${OFFICIAL_UUID})...`);
    try {
      await client.query('BEGIN');

      const updateRes = await client.query(
        `UPDATE app_auth.users
         SET display_name = $1,
             phone = $2,
             is_verified = TRUE,
             is_active = TRUE,
             kyc_status = 'verified',
             status = 'active',
             updated_at = NOW()
         WHERE id = $3 OR email = $4
         RETURNING id, email, display_name, phone, is_verified, is_active, kyc_status, status, updated_at`,
        ['Phesty Ryan', '708671172', OFFICIAL_UUID, OFFICIAL_EMAIL]
      );

      // Ensure super_admin role exists in app_auth.user_roles
      await client.query(
        `INSERT INTO app_auth.user_roles (user_id, role_id, granted_by)
         SELECT $1, id, $1 FROM app_auth.roles WHERE name = 'super_admin'
         ON CONFLICT (user_id, role_id) DO NOTHING`,
        [OFFICIAL_UUID]
      );

      await client.query('COMMIT');
      console.log(`✅ app_auth.users profile updated for '${OFFICIAL_EMAIL}'.`);
      console.log('\nUpdated app_auth.users Record:');
      console.table(updateRes.rows[0]);
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('❌ Error updating app_auth.users profile:', err.message);
    } finally {
      client.release();
    }

    // 3. Sync Supabase Auth user metadata
    console.log(`\n3️⃣ Syncing Supabase Auth Metadata for '${OFFICIAL_UUID}'...`);
    const { data: updateAuthData, error: updateAuthErr } = await supabaseAdmin.auth.admin.updateUserById(
      OFFICIAL_UUID,
      {
        user_metadata: {
          display_name: 'Phesty Ryan',
          phone: '708671172',
          role: 'super_admin',
        },
      }
    );

    if (updateAuthErr) {
      console.error('❌ Failed to update Supabase Auth metadata:', updateAuthErr.message);
    } else {
      console.log('✅ Supabase Auth user_metadata updated successfully:', updateAuthData.user.id);
    }

    // 4. Verification: Test login via signInWithPassword
    console.log(`\n4️⃣ Verification: Testing signInWithPassword for '${OFFICIAL_EMAIL}'...`);
    const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
      email: OFFICIAL_EMAIL,
      password: OFFICIAL_PASSWORD,
    });

    if (authError) {
      console.error('❌ Authentication Verification Failed:', authError.message);
    } else {
      console.log('\n====================================================');
      console.log('🎉 VERIFICATION SUCCESSFUL! GoTrue authentication passed.');
      console.log(`   User ID: ${authData.user.id}`);
      console.log(`   Email: ${authData.user.email}`);
      console.log(`   Display Name: ${authData.user.user_metadata.display_name}`);
      console.log(`   Phone: ${authData.user.user_metadata.phone}`);
      console.log(`   Access Token: ${authData.session.access_token.substring(0, 35)}...`);
      console.log(`   Expires At: ${new Date((authData.session.expires_at || 0) * 1000).toISOString()}`);
      console.log('====================================================\n');
    }

  } catch (err: any) {
    console.error('Fatal Error:', err);
  } finally {
    await pool.end();
  }
}

runCleanupAndUpdate();
