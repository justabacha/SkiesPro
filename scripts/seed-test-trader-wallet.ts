import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';
import pg from 'pg';
import dotenv from 'dotenv';
import { execSync } from 'child_process';

dotenv.config();

const { Pool } = pg;

const TARGET_EMAIL = 'just1abacha@gmail.com';
const TARGET_PASSWORD = 'SkiesPro@2026';
const TARGET_PHONE = '+254714248659';
const TARGET_DISPLAY_NAME = 'Abacha Trade Test';
const REAL_WALLET_BALANCE = 20000.00;
const DEMO_WALLET_BALANCE = 10000.00;
const RENDER_LOGIN_URL = 'https://skiespro-api-njuw.onrender.com/api/v1/auth/login';

const supabaseUrl = process.env.SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const dbUrl = process.env.DATABASE_URL || '';

if (!supabaseUrl || !serviceRoleKey || !dbUrl) {
  console.error('❌ Missing environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or DATABASE_URL).');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const pool = new Pool({ connectionString: dbUrl });

async function main() {
  console.log('--- Revised Step 4: Provision Dedicated Real-Trade Test Account & Fund Real Wallet ---');
  console.log(`Target Email: ${TARGET_EMAIL}`);
  console.log(`Target Display Name: ${TARGET_DISPLAY_NAME}`);
  console.log(`Real Wallet Initial Balance: KES ${REAL_WALLET_BALANCE.toLocaleString()}`);
  console.log(`Demo Wallet Initial Balance: KES ${DEMO_WALLET_BALANCE.toLocaleString()}\n`);

  const client = await pool.connect();
  let userUuid = '';

  try {
    // 1. Supabase Auth Sync
    console.log('🔍 [1/4] Checking/Creating user in Supabase Auth...');
    const { data: authUsersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.error('❌ Error fetching Supabase Auth users:', listError.message);
      process.exit(1);
    }

    const existingAuthUser = authUsersData.users.find(
      u => u.email?.toLowerCase() === TARGET_EMAIL.toLowerCase()
    );

    if (existingAuthUser) {
      userUuid = existingAuthUser.id;
      console.log(`  ✓ User '${TARGET_EMAIL}' found in Supabase Auth (UUID: ${userUuid})`);
      console.log('  🔄 Updating password & email_confirm flag in Supabase Auth...');

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userUuid, {
        password: TARGET_PASSWORD,
        email_confirm: true,
        user_metadata: {
          display_name: TARGET_DISPLAY_NAME,
          phone: TARGET_PHONE,
          role: 'trader',
        },
      });

      if (updateError) {
        console.error('  ❌ Failed to update Supabase Auth user:', updateError.message);
        process.exit(1);
      }
      console.log('  ✅ Supabase Auth user successfully updated.');
    } else {
      console.log(`  ➕ Creating user '${TARGET_EMAIL}' in Supabase Auth...`);
      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: TARGET_EMAIL,
        password: TARGET_PASSWORD,
        email_confirm: true,
        user_metadata: {
          display_name: TARGET_DISPLAY_NAME,
          phone: TARGET_PHONE,
          role: 'trader',
        },
      });

      if (createError || !createData.user) {
        console.error('  ❌ Failed to create Supabase Auth user:', createError?.message);
        process.exit(1);
      }

      userUuid = createData.user.id;
      console.log(`  ✅ Supabase Auth user created (UUID: ${userUuid})`);
    }

    // 2. Postgres DB Sync (app_auth.users & app_auth.user_roles)
    console.log('\n🔍 [2/4] Syncing user profile & roles in Postgres (app_auth.users & user_roles)...');
    await client.query('BEGIN');

    const passwordHash = await bcrypt.hash(TARGET_PASSWORD, 12);

    const userCheck = await client.query(
      'SELECT id FROM app_auth.users WHERE id = $1 OR LOWER(email) = LOWER($2)',
      [userUuid, TARGET_EMAIL]
    );

    if (userCheck.rows.length > 0) {
      await client.query(
        `UPDATE app_auth.users
         SET id = $1,
             email = $2,
             password_hash = $3,
             display_name = $4,
             phone = $5,
             is_verified = TRUE,
             is_active = TRUE,
             kyc_status = 'verified',
             status = 'active',
             updated_at = NOW()
         WHERE id = $1 OR LOWER(email) = LOWER($2)`,
        [userUuid, TARGET_EMAIL, passwordHash, TARGET_DISPLAY_NAME, TARGET_PHONE]
      );
      console.log('  ✅ app_auth.users profile updated.');
    } else {
      await client.query(
        `INSERT INTO app_auth.users (
           id, email, password_hash, display_name, phone, referral_code,
           is_verified, is_active, kyc_status, status, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, 'ABACHATRADETEST',
           TRUE, TRUE, 'verified', 'active', NOW(), NOW()
         )`,
        [userUuid, TARGET_EMAIL, passwordHash, TARGET_DISPLAY_NAME, TARGET_PHONE]
      );
      console.log('  ✅ app_auth.users profile created.');
    }

    // Role Assignment
    const roleRes = await client.query(
      "SELECT id FROM app_auth.roles WHERE name = 'trader' LIMIT 1"
    );

    if (roleRes.rows[0]) {
      const roleId = roleRes.rows[0].id;
      await client.query(
        `INSERT INTO app_auth.user_roles (user_id, role_id, granted_by)
         VALUES ($1, $2, '00000000-0000-0000-0000-000000000000')
         ON CONFLICT (user_id, role_id) DO NOTHING`,
        [userUuid, roleId]
      );
      console.log('  ✅ Assigned trader role in app_auth.user_roles.');
    } else {
      console.warn('  ⚠️ Role "trader" not found in app_auth.roles, skipping user_roles insertion.');
    }

    // 3. Wallet Provisioning (wallet.wallets & ledger_entries)
    console.log('\n🔍 [3/4] Provisioning and funding REAL and DEMO wallets in wallet.wallets...');

    // Real Wallet Upsert
    const realWalletRes = await client.query(
      `INSERT INTO wallet.wallets (user_id, balance, locked_balance, currency, status, account_type)
       VALUES ($1, $2, 0.0000, 'KES', 'active', 'real')
       ON CONFLICT (user_id, account_type) DO UPDATE
       SET balance = $2, locked_balance = 0.0000, status = 'active', updated_at = NOW()
       RETURNING id, balance, account_type`,
      [userUuid, REAL_WALLET_BALANCE]
    );
    const realWallet = realWalletRes.rows[0];
    console.log(`  ✅ REAL Wallet provisioned: ID = ${realWallet.id}, Balance = KES ${parseFloat(realWallet.balance).toLocaleString()}`);

    // Insert Ledger Entry for Real Wallet
    await client.query(
      `INSERT INTO wallet.ledger_entries (
         transaction_id, wallet_id, entry_type, amount, balance_after, reference_type, description
       ) VALUES (
         gen_random_uuid(), $1, 'credit', $2, $2, 'admin_adjustment', 'Initial test trader real wallet credit'
       )`,
      [realWallet.id, REAL_WALLET_BALANCE]
    );

    // Demo Wallet Upsert
    const demoWalletRes = await client.query(
      `INSERT INTO wallet.wallets (user_id, balance, locked_balance, currency, status, account_type)
       VALUES ($1, $2, 0.0000, 'KES', 'active', 'demo')
       ON CONFLICT (user_id, account_type) DO UPDATE
       SET balance = $2, locked_balance = 0.0000, status = 'active', updated_at = NOW()
       RETURNING id, balance, account_type`,
      [userUuid, DEMO_WALLET_BALANCE]
    );
    const demoWallet = demoWalletRes.rows[0];
    console.log(`  ✅ DEMO Wallet provisioned: ID = ${demoWallet.id}, Balance = KES ${parseFloat(demoWallet.balance).toLocaleString()}`);

    // Insert Ledger Entry for Demo Wallet
    await client.query(
      `INSERT INTO wallet.ledger_entries (
         transaction_id, wallet_id, entry_type, amount, balance_after, reference_type, description
       ) VALUES (
         gen_random_uuid(), $1, 'credit', $2, $2, 'demo_funding', 'Initial test trader demo wallet credit'
       )`,
      [demoWallet.id, DEMO_WALLET_BALANCE]
    );

    await client.query('COMMIT');

    // 4. Verification & Render API Login Check
    console.log('\n🔍 [4/4] Performing API Login Verification & Database Queries...');

    let apiLoginStatus = 'FAILED';
    try {
      const loginResponse = await fetch(RENDER_LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: TARGET_EMAIL,
          password: TARGET_PASSWORD,
        }),
      });

      if (loginResponse.status === 200 || loginResponse.status === 201) {
        const body: any = await loginResponse.json();
        apiLoginStatus = `200 OK (User ID: ${body?.data?.user?.id || userUuid})`;
        console.log(`  🎉 Render API Login Verified: HTTP 200 OK`);
      } else {
        const errText = await loginResponse.text();
        apiLoginStatus = `HTTP ${loginResponse.status} - ${errText}`;
        console.error(`  ❌ Render API Login Failed: HTTP ${loginResponse.status} - ${errText}`);
      }
    } catch (fetchErr: any) {
      apiLoginStatus = `Fetch Error: ${fetchErr.message}`;
      console.error(`  ❌ Render API Login Fetch Error:`, fetchErr.message);
    }

    // Query wallet.wallets directly to confirm balances
    const walletCheckRes = await client.query(
      'SELECT id, account_type, balance, locked_balance, currency, status FROM wallet.wallets WHERE user_id = $1 ORDER BY account_type DESC',
      [userUuid]
    );

    console.log('\n========================================================================================');
    console.log('📊 TEST TRADER ACCOUNT PROVISIONING SUMMARY');
    console.log('========================================================================================');
    console.log(`Account UUID      : ${userUuid}`);
    console.log(`Email             : ${TARGET_EMAIL}`);
    console.log(`Display Name      : ${TARGET_DISPLAY_NAME}`);
    console.log(`Phone             : ${TARGET_PHONE}`);
    console.log(`Status / KYC      : active / verified`);
    console.log(`Render API Login  : ${apiLoginStatus}`);
    console.log('----------------------------------------------------------------------------------------');
    console.table(
      walletCheckRes.rows.map(w => ({
        'Wallet ID': w.id,
        'Account Type': w.account_type,
        'Balance': `KES ${parseFloat(w.balance).toLocaleString()}`,
        'Locked Balance': `KES ${parseFloat(w.locked_balance).toLocaleString()}`,
        'Currency': w.currency,
        'Status': w.status,
      }))
    );
    console.log('========================================================================================\n');

  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('❌ Fatal error during provisioning:', err.message || err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().then(() => {
  console.log('📸 Updating database snapshot report (reports/DATABASE_INSPECTION_SNAPSHOT.md)...');
  try {
    execSync('cmd /c npx ts-node scripts/inspect-database.ts', { stdio: 'inherit' });
    console.log('✅ Final Database Snapshot captured successfully.');
  } catch (inspectErr: any) {
    console.error('⚠️ Could not run inspect-database.ts:', inspectErr.message);
  }
});
