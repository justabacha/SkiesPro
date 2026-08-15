import { PoolClient } from 'pg';
import { BaseRepository } from '../../../shared/repositories/baseRepository';
import { Decimal } from 'decimal.js';

export interface WalletRow {
  id: string;
  user_id: string;
  balance: string;
  locked_balance: string;
  available_balance: string;
  currency: string;
  version: number;
  created_at: Date;
  updated_at: Date;
}

export class WalletRepository extends BaseRepository {
  constructor(client?: PoolClient) {
    super(client);
  }

  async findByUserId(userId: string): Promise<WalletRow | null> {
    const result = await this.query<WalletRow>(
      'SELECT * FROM wallet.wallets WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  }

  async findByUserIdForUpdate(userId: string): Promise<WalletRow | null> {
    const result = await this.query<WalletRow>(
      'SELECT * FROM wallet.wallets WHERE user_id = $1 FOR UPDATE',
      [userId]
    );
    return result.rows[0] || null;
  }

  async create(userId: string, currency: string): Promise<WalletRow> {
    const result = await this.query<WalletRow>(
      `INSERT INTO wallet.wallets (user_id, currency)
       VALUES ($1, $2)
       RETURNING *`,
      [userId, currency]
    );
    return result.rows[0];
  }

  async updateBalance(
    walletId: string,
    newBalance: Decimal,
    newLockedBalance: Decimal,
    version: number
  ): Promise<WalletRow> {
    const result = await this.query<WalletRow>(
      `UPDATE wallet.wallets
       SET balance = $1,
           locked_balance = $2,
           version = version + 1
       WHERE id = $3 AND version = $4
       RETURNING *`,
      [newBalance.toString(), newLockedBalance.toString(), walletId, version]
    );

    if (result.rowCount === 0) {
      throw new Error('Wallet update failed: version mismatch or wallet not found');
    }

    return result.rows[0];
  }
}
