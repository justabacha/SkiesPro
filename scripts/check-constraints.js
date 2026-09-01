const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  const query = `
    SELECT conname, pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'trading' AND conrelid = 'trading.binary_contracts'::regclass;
  `;

  console.log('Checking constraints for trading.binary_contracts...');
  try {
    const { rows } = await pool.query(query);
    console.log(JSON.stringify(rows, null, 2));
  } catch (error) {
    console.error('Failed to check constraints:', error);
  } finally {
    await pool.end();
  }
}

run();
