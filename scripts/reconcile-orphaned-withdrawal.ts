import dotenv from 'dotenv';
import { Pool } from 'pg';
import { Decimal } from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || '',
});

async function reconcile() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const wdId = '235d9ef4-8cde-42c9-be63-9accc9ac09d0';
    const wdRes = await client.query('SELECT * FROM payments.withdrawals WHERE id = $1', [wdId]);
    if (wdRes.rows.length === 0) {
      console.log('Orphaned withdrawal not found.');
      return;
    }
    const wd = wdRes.rows[0];
    const amount = new Decimal(wd.amount);
    const userId = wd.user_id;

    const walletRes = await client.query('SELECT * FROM wallet.wallets WHERE user_id = $1 AND account_type = $2 FOR UPDATE', [userId, 'real']);
    if (walletRes.rows.length === 0) {
      console.log('Wallet not found');
      return;
    }
    const wallet = walletRes.rows[0];
    const balanceBefore = new Decimal(wallet.balance);
    const lockedBefore = new Decimal(wallet.locked_balance);

    if (lockedBefore.greaterThanOrEqualTo(amount)) {
      const balanceAfter = balanceBefore.minus(amount);
      const lockedAfter = lockedBefore.minus(amount);
      const transactionId = uuidv4();

      await client.query(
        'UPDATE wallet.wallets SET balance = $1, locked_balance = $2, version = version + 1 WHERE id = $3',
        [balanceAfter.toString(), lockedAfter.toString(), wallet.id]
      );

      const ledCheck = await client.query('SELECT 1 FROM wallet.ledger_entries WHERE reference_id = $1 AND reference_type = $2', [wdId, 'withdrawal']);
      if (ledCheck.rows.length === 0) {
        await client.query(
          `INSERT INTO wallet.ledger_entries (
             transaction_id, wallet_id, entry_type, amount, balance_before, balance_after, reference_type, reference_id, description, created_at
           ) VALUES ($1, $2, 'debit', $3, $4, $5, 'withdrawal', $6, $7, NOW())`,
          [transactionId, wallet.id, amount.toString(), balanceBefore.toString(), balanceAfter.toString(), wdId, `Reconciled withdrawal payout approved: KES ${amount.toString()}`]
        );
      }
      console.log('✓ Orphaned withdrawal reconciled successfully.');
    } else {
      console.log('Wallet already reconciled or locked balance insufficient.');
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Reconciliation failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

reconcile();
