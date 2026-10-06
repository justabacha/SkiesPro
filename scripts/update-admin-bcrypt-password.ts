import bcrypt from 'bcrypt';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const TARGET_EMAIL = 'its.phestone@gmail.com';
const TARGET_PASSWORD = 'abachadA@21';
const OFFICIAL_UUID = '87d63bfc-4488-4a39-8f20-eda46453ebe9';
const RENDER_API_LOGIN_URL = 'https://skiespro-api-njuw.onrender.com/api/v1/auth/login';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log('--- Updating Bcrypt Password Hash for Official Owner Account ---');
  console.log(`Target Email: ${TARGET_EMAIL}`);

  try {
    // 1. Generate fresh bcrypt hash
    console.log('🔑 Generating fresh bcrypt hash (cost factor 12)...');
    const newHash = await bcrypt.hash(TARGET_PASSWORD, 12);
    console.log(`✓ Generated Hash: ${newHash}`);

    // Verify hash locally
    const isLocalMatch = await bcrypt.compare(TARGET_PASSWORD, newHash);
    console.log(`✓ Local Bcrypt Compare Verification: ${isLocalMatch ? 'MATCH (PASS)' : 'FAIL'}`);

    // 2. Update app_auth.users in Postgres database
    console.log('\n🔄 Updating app_auth.users table...');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const updateRes = await client.query(
        `UPDATE app_auth.users
         SET password_hash = $1,
             updated_at = NOW()
         WHERE id = $2 OR email IN ('its.phestone@gmail.com', 'itsphestone@gmail.com')
         RETURNING id, email, display_name, status, is_verified, is_active, updated_at`,
        [newHash, OFFICIAL_UUID]
      );

      await client.query('COMMIT');
      console.log('✅ Postgres app_auth.users updated successfully:');
      console.table(updateRes.rows[0]);
    } catch (dbErr: any) {
      await client.query('ROLLBACK');
      console.error('❌ Database update error:', dbErr.message);
      process.exit(1);
    } finally {
      client.release();
    }

    // 3. Test API login endpoint on Render
    console.log(`\n🌐 Testing Login via Render API Endpoint: ${RENDER_API_LOGIN_URL}...`);
    const payload = {
      email: TARGET_EMAIL,
      password: TARGET_PASSWORD,
    };

    const response = await fetch(RENDER_API_LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log(`\n====================================================`);
    console.log(`API Response Status: ${response.status} ${response.statusText}`);

    const resText = await response.text();
    try {
      const json = JSON.parse(resText);
      console.log('API Response Body:');
      console.log(JSON.stringify(json, null, 2));

      if (response.status === 200 || response.status === 201) {
        console.log('\n🎉 RENDER API LOGIN SUCCESSFUL!');
      } else {
        console.error('\n❌ API Login Failed with status:', response.status);
      }
    } catch {
      console.log('API Raw Response Text:', resText);
    }
    console.log(`====================================================\n`);

  } catch (err: any) {
    console.error('Fatal execution error:', err.message || err);
  } finally {
    await pool.end();
  }
}

main();
