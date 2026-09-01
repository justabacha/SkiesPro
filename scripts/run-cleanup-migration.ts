import { pgPool } from '../src/config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const sqlPath = path.join(__dirname, '../migrations/032_cleanup_binary_contracts.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Running migration 032...');
  try {
    await pgPool.query(sql);
    console.log('Migration 032 successful.');
  } catch (error) {
    console.error('Migration 032 failed:', error);
  } finally {
    await pgPool.end();
  }
}

run();
