import { pgPool } from '../src/config/database.js';
import dotenv from 'dotenv';

dotenv.config();

async function debug() {
  const ref = 'ws_CO_010920262331442712345678';

  try {
    console.log('Searching for reference:', ref);
    const res = await pgPool.query('SELECT id, status, gateway_reference, user_id FROM payments.deposits WHERE gateway_reference = $1', [ref]);

    if (res.rows.length === 0) {
      console.log('NOT FOUND IN DB. Existing references:');
      const partial = await pgPool.query('SELECT gateway_reference FROM payments.deposits ORDER BY created_at DESC LIMIT 5');
      console.table(partial.rows);
    } else {
      console.log('FOUND:', res.rows[0]);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

debug();
