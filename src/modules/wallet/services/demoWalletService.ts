import { Decimal } from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';
import { pgPool } from '../../../config/database.js';
import { LedgerService } from './ledgerService.js';
import { WalletRepository, WalletRow } from '../repositories/walletRepository.js';
import { WalletService } from './walletService.js';

export interface DemoWalletResetResult {
  balance: string;
  locked_balance: string;
  available_balance: string;
  currency: string;
}

export class DemoWalletService {
  private get initialBalance(): Decimal {
    const rawInitialBalance = process.env.DEMO_INITIAL_BALANCE_KES;
    if (!rawInitialBalance || !Number.isFinite(Number(rawInitialBalance))) {
      throw new Error('DEMO_INITIAL_BALANCE_KES must be configured before enabling demo wallets');
    }
    const initialBalance = new Decimal(rawInitialBalance);
    if (!initialBalance.isFinite() || initialBalance.lte(0)) {
      throw new Error('DEMO_INITIAL_BALANCE_KES must be greater than zero');
    }
    return initialBalance;
  }

  async getBalance(userId: string): Promise<WalletRow> {
    await this.ensureWallet(userId);
    return new WalletService().getBalance(userId, 'demo');
  }

  async reset(userId: string, idempotencyKey: string): Promise<DemoWalletResetResult> {
    if (!idempotencyKey || idempotencyKey.length > 255) {
      throw new Error('A valid Idempotency-Key is required');
    }

    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(21021, hashtext($1))', [userId]);

      const previous = await client.query<{ response_payload: DemoWalletResetResult }>(
        `SELECT response_payload
           FROM wallet.demo_wallet_reset_events
          WHERE user_id = $1 AND idempotency_key = $2`,
        [userId, idempotencyKey]
      );
      if (previous.rows[0]) {
        await client.query('COMMIT');
        return previous.rows[0].response_payload;
      }

      const walletRepository = new WalletRepository(client);
      const wallet = await walletRepository.findByUserIdForUpdate(userId, 'demo');
      if (!wallet) throw new Error('Demo wallet not found');

      const openContracts = await client.query(
        `SELECT 1
           FROM trading.binary_contracts
          WHERE user_id = $1
            AND account_type = 'demo'
            AND status IN ('active', 'settling')
          LIMIT 1`,
        [userId]
      );
      if (openContracts.rowCount) {
        const error = new Error('Demo balance cannot be reset while trades are open');
        Object.assign(error, { code: 'DEMO_TRADES_OPEN' });
        throw error;
      }

      if (new Decimal(wallet.locked_balance).gt(0)) {
        throw new Error('Demo wallet has locked funds without an open contract');
      }

      const quotaResult = await client.query<{ reset_count: string }>(
        `SELECT COUNT(*)::text AS reset_count
           FROM wallet.demo_wallet_reset_events
          WHERE user_id = $1
            AND created_at > NOW() - INTERVAL '60 minutes'`,
        [userId]
      );
      if (Number(quotaResult.rows[0]?.reset_count || 0) >= 5) {
        const error = new Error('Demo reset limit reached');
        Object.assign(error, { code: 'DEMO_RESET_RATE_LIMITED' });
        throw error;
      }

      const balanceBefore = new Decimal(wallet.balance);
      const difference = this.initialBalance.minus(balanceBefore);
      let updatedWallet = wallet;
      if (!difference.isZero()) {
        updatedWallet = await walletRepository.updateBalance(
          userId,
          'demo',
          wallet.id,
          this.initialBalance,
          new Decimal(0),
          wallet.version
        );
        await new LedgerService(client).recordEntry({
          transactionId: uuidv4(),
          walletId: wallet.id,
          entryType: difference.gt(0) ? 'credit' : 'debit',
          amount: difference.abs(),
          balanceBefore,
          balanceAfter: this.initialBalance,
          referenceType: 'demo_reset',
          referenceId: undefined,
          description: 'Demo wallet reset to initial virtual balance',
        });
      }

      const response: DemoWalletResetResult = {
        balance: updatedWallet.balance,
        locked_balance: updatedWallet.locked_balance,
        available_balance: updatedWallet.available_balance,
        currency: updatedWallet.currency,
      };
      await client.query(
        `INSERT INTO wallet.demo_wallet_reset_events
           (user_id, idempotency_key, response_payload)
         VALUES ($1, $2, $3::jsonb)`,
        [userId, idempotencyKey, JSON.stringify(response)]
      );
      await client.query('COMMIT');
      return response;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async ensureWallet(userId: string): Promise<WalletRow> {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const walletRepository = new WalletRepository(client);
      const created = await walletRepository.createIfAbsent(userId, 'KES', 'demo');
      if (created) {
        await new WalletService(client).credit(
          userId,
          'demo',
          this.initialBalance,
          'demo_funding',
          undefined,
          'Initial virtual demo balance'
        );
      }
      const wallet = await walletRepository.findByUserIdForUpdate(userId, 'demo');
      if (!wallet) throw new Error('Demo wallet creation failed');
      await client.query('COMMIT');
      return wallet;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
