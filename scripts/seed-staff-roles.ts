import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const DEFAULT_STAFF_PASSWORD = 'SkiesStaff2026!';
const RENDER_LOGIN_URL = 'https://skiespro-api-njuw.onrender.com/api/v1/auth/login';

interface StaffDef {
  role: string;
  email: string;
  displayName: string;
  phone: string;
}

const STAFF_ACCOUNTS: StaffDef[] = [
  {
    role: 'admin',
    email: 'admin@skiespro.internal',
    displayName: 'SkiesPro Admin',
    phone: '+254700000001',
  },
  {
    role: 'support',
    email: 'support@skiespro.internal',
    displayName: 'SkiesPro Support',
    phone: '+254700000002',
  },
  {
    role: 'finance',
    email: 'finance@skiespro.internal',
    displayName: 'SkiesPro Finance',
    phone: '+254700000003',
  },
  {
    role: 'risk_manager',
    email: 'risk@skiespro.internal',
    displayName: 'SkiesPro Risk Manager',
    phone: '+254700000004',
  },
  {
    role: 'compliance',
    email: 'compliance@skiespro.internal',
    displayName: 'SkiesPro Compliance',
    phone: '+254700000005',
  },
];

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

interface SummaryResult {
  email: string;
  role: string;
  uuid: string;
  dbSynced: boolean;
  loginStatus: string;
}

async function seedStaffRoles() {
  console.log('--- Step 2: WP-15 Seed Staff & Operational Roles ---\n');

  const summaryResults: SummaryResult[] = [];
  const client = await pool.connect();

  try {
    // 1. Fetch existing users from Supabase Auth
    console.log('🔍 Fetching existing users from Supabase Auth...');
    const { data: authUsersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.error('❌ Error listing Supabase Auth users:', listError.message);
      process.exit(1);
    }

    const existingAuthUsers = authUsersData.users;
    console.log(`✓ Found ${existingAuthUsers.length} total users in Supabase Auth.\n`);

    // Pre-generate password hash for staff accounts
    console.log('🔑 Generating bcrypt password hash (cost factor 12)...');
    const passwordHash = await bcrypt.hash(DEFAULT_STAFF_PASSWORD, 12);

    for (const staff of STAFF_ACCOUNTS) {
      console.log(`\n----------------------------------------------------`);
      console.log(`👤 Processing Staff Account: ${staff.email} (${staff.role})`);

      let uuid = '';

      // a. Supabase Auth sync
      const existingUser = existingAuthUsers.find(
        u => u.email?.toLowerCase() === staff.email.toLowerCase()
      );

      if (existingUser) {
        uuid = existingUser.id;
        console.log(`  ✓ Existing Supabase Auth user found (ID: ${uuid})`);
        console.log(`  🔄 Updating password & user_metadata for ${staff.email}...`);

        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(uuid, {
          password: DEFAULT_STAFF_PASSWORD,
          email_confirm: true,
          user_metadata: {
            display_name: staff.displayName,
            phone: staff.phone,
            role: staff.role,
          },
        });

        if (updateError) {
          console.error(`  ❌ Supabase Auth Update Error:`, updateError.message);
        } else {
          console.log(`  ✅ Supabase Auth user updated successfully.`);
        }
      } else {
        console.log(`  ➕ Creating user in Supabase Auth...`);
        const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: staff.email,
          password: DEFAULT_STAFF_PASSWORD,
          email_confirm: true,
          user_metadata: {
            display_name: staff.displayName,
            phone: staff.phone,
            role: staff.role,
          },
        });

        if (createError || !createData.user) {
          console.error(`  ❌ Supabase Auth Create Error:`, createError?.message);
          continue;
        }

        uuid = createData.user.id;
        console.log(`  ✅ Created Supabase Auth user (ID: ${uuid})`);
      }

      // b. Postgres DB sync in app_auth.users and app_auth.user_roles
      let dbSynced = false;
      try {
        await client.query('BEGIN');

        // Check if user exists by email or id in app_auth.users
        const userCheck = await client.query(
          'SELECT id FROM app_auth.users WHERE id = $1 OR email = $2',
          [uuid, staff.email]
        );

        if (userCheck.rows.length > 0) {
          await client.query(
            `UPDATE app_auth.users
             SET email = $1,
                 password_hash = $2,
                 display_name = $3,
                 phone = $4,
                 is_verified = TRUE,
                 is_active = TRUE,
                 kyc_status = 'verified',
                 status = 'active',
                 updated_at = NOW()
             WHERE id = $5 OR email = $1`,
            [staff.email, passwordHash, staff.displayName, staff.phone, uuid]
          );
        } else {
          await client.query(
            `INSERT INTO app_auth.users (
               id, email, password_hash, display_name, phone, referral_code,
               is_verified, is_active, kyc_status, status, created_at, updated_at
             ) VALUES (
               $1, $2, $3, $4, $5, $6,
               TRUE, TRUE, 'verified', 'active', NOW(), NOW()
             )`,
            [uuid, staff.email, passwordHash, staff.displayName, staff.phone, `STAFF_${staff.role.toUpperCase()}`]
          );
        }

        // Get Role ID
        const roleRes = await client.query(
          'SELECT id FROM app_auth.roles WHERE name = $1 LIMIT 1',
          [staff.role]
        );

        if (!roleRes.rows[0]) {
          throw new Error(`Role '${staff.role}' not found in app_auth.roles`);
        }

        const roleId = roleRes.rows[0].id;

        // Ensure user_roles linking
        await client.query(
          `INSERT INTO app_auth.user_roles (user_id, role_id, granted_by)
           VALUES ($1, $2, '00000000-0000-0000-0000-000000000000')
           ON CONFLICT (user_id, role_id) DO NOTHING`,
          [uuid, roleId]
        );

        await client.query('COMMIT');
        dbSynced = true;
        console.log(`  ✅ app_auth.users and app_auth.user_roles synced in Postgres.`);
      } catch (dbErr: any) {
        await client.query('ROLLBACK');
        console.error(`  ❌ Postgres Sync Error:`, dbErr.message);
      }

      // c. Verification via Render API login endpoint
      console.log(`  🌐 Verifying API Login on Render (${staff.email})...`);
      let loginStatus = 'FAILED';

      try {
        const loginRes = await fetch(RENDER_LOGIN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: staff.email,
            password: DEFAULT_STAFF_PASSWORD,
          }),
        });

        if (loginRes.status === 200 || loginRes.status === 201) {
          const body: any = await loginRes.json();
          const returnedRole = body?.data?.user?.role || 'unknown';
          loginStatus = `200 OK (Role: ${returnedRole})`;
          console.log(`  🎉 Verification PASS: 200 OK | Returned Role: ${returnedRole}`);
        } else {
          const errText = await loginRes.text();
          loginStatus = `HTTP ${loginRes.status} Error`;
          console.error(`  ❌ Verification FAIL: HTTP ${loginRes.status} - ${errText}`);
        }
      } catch (fetchErr: any) {
        loginStatus = `Fetch Error (${fetchErr.message})`;
        console.error(`  ❌ Verification Fetch Error:`, fetchErr.message);
      }

      summaryResults.push({
        email: staff.email,
        role: staff.role,
        uuid,
        dbSynced,
        loginStatus,
      });
    }

    // 4. Print Summary Table
    console.log('\n========================================================================================');
    console.log('📊 WP-15 STAFF SEEDING & VERIFICATION SUMMARY TABLE');
    console.log('========================================================================================');
    console.table(
      summaryResults.map(r => ({
        'Email': r.email,
        'Assigned Role': r.role,
        'UUID': r.uuid,
        'DB Synced': r.dbSynced ? '✅ YES' : '❌ NO',
        'Render API Login Status': r.loginStatus,
      }))
    );
    console.log('========================================================================================\n');

  } catch (err: any) {
    console.error('Fatal execution error:', err.message || err);
  } finally {
    client.release();
    await pool.end();
  }
}

seedStaffRoles();
