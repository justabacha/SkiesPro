const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  const sqlPath = path.join(__dirname, '../migrations/032_cleanup_binary_contracts.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Running migration 032 manually...');
  try {
    await pool.query(sql);
    console.log('Migration 032 successful.');
  } catch (error) {
    console.error('Migration 032 failed:', error);
  } finally {
    await pool.end();
  }
}

run();
