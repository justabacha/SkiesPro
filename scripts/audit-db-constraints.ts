import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('=== 1. COLUMNS OF pricing.candles ===');
    const candlesCols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'pricing' AND table_name = 'candles'
      ORDER BY ordinal_position;
    `);
    console.log('candles Columns:', JSON.stringify(candlesCols.rows, null, 2));

    console.log('\n=== 2. UNIQUE INDEXES ON pricing.candles ===');
    const candleIndexes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'pricing' AND tablename = 'candles';
    `);
    console.log('candles Indexes:', JSON.stringify(candleIndexes.rows, null, 2));

  } catch (err) {
    console.error('Error auditing constraints:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
