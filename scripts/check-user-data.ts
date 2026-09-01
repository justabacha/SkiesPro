import { pgPool } from '../src/config/database';
import dotenv from 'dotenv';

dotenv.config();

async function checkData() {
  const userId = '7a1ae5af-a5b5-4042-b67f-58390c05032f';

  try {
    console.log('--- USER WALLET ---');
    const walletRes = await pgPool.query('SELECT * FROM wallet.wallets WHERE user_id = $1', [userId]);
    console.table(walletRes.rows);

    console.log('\n--- LEDGER ENTRIES (Last 10) ---');
    const ledgerRes = await pgPool.query(
      'SELECT entry_type, amount, balance_after, reference_type, description, created_at FROM wallet.ledger_entries WHERE wallet_id = (SELECT id FROM wallet.wallets WHERE user_id = $1) ORDER BY created_at DESC LIMIT 10',
      [userId]
    );
    console.table(ledgerRes.rows);

    console.log('\n--- TRADES STATUS ---');
    const tradesRes = await pgPool.query(
      'SELECT id, status, stake, strike_price, expiry_time FROM trading.binary_contracts WHERE user_id = $1 ORDER BY purchase_time DESC',
      [userId]
    );
    console.table(tradesRes.rows);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkData();
