import { pgPool } from '../src/config/database.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkData() {
  const userId = '7a1ae5af-a5b5-4042-b67f-58390c05032f';
  const ref = 'ws_CO_010920262331442712345678';

  try {
    console.log('--- DEPOSIT RECORD ---');
    const depRes = await pgPool.query('SELECT * FROM payments.deposits WHERE gateway_reference = $1', [ref]);
    console.table(depRes.rows);

    console.log('\n--- USER WALLET ---');
    const walletRes = await pgPool.query('SELECT * FROM wallet.wallets WHERE user_id = $1', [userId]);
    console.table(walletRes.rows);

    console.log('\n--- LEDGER ENTRIES (Last 5) ---');
    const ledgerRes = await pgPool.query(
      'SELECT entry_type, amount, balance_after, reference_type, description, created_at FROM wallet.ledger_entries WHERE wallet_id = (SELECT id FROM wallet.wallets WHERE user_id = $1) ORDER BY created_at DESC LIMIT 5',
      [userId]
    );
    console.table(ledgerRes.rows);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkData();
