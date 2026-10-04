import { PoolClient } from 'pg';
import { BaseRepository } from '../../../shared/repositories/baseRepository.js';
import { Decimal } from 'decimal.js';

export interface WalletRow {
  id: string;
  user_id: string;
  account_type: AccountType;
  balance: string;
  locked_balance: string;
  available_balance: string;
  currency: string;
  version: number;
  created_at: Date;
  updated_at: Date;
}

export type AccountType = 'real' | 'demo';

export class WalletRepository extends BaseRepository {
  constructor(client?: PoolClient) {
    super(client);
  }

  async findByUserId(userId: string, accountType: AccountType): Promise<WalletRow | null> {
    const result = await this.query<WalletRow>(
      'SELECT * FROM wallet.wallets WHERE user_id = $1 AND account_type = $2',
      [userId, accountType]
    );
    return result.rows[0] || null;
  }

  async findByUserIdForUpdate(userId: string, accountType: AccountType): Promise<WalletRow | null> {
    const result = await this.query<WalletRow>(
      'SELECT * FROM wallet.wallets WHERE user_id = $1 AND account_type = $2 FOR UPDATE',
      [userId, accountType]
    );
    return result.rows[0] || null;
  }

  async create(userId: string, currency: string, accountType: AccountType): Promise<WalletRow> {
    const result = await this.query<WalletRow>(
      `INSERT INTO wallet.wallets (user_id, currency, account_type)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, currency, accountType]
    );
    return result.rows[0];
  }

  async createIfAbsent(
    userId: string,
    currency: string,
    accountType: AccountType
  ): Promise<WalletRow | null> {
    const result = await this.query<WalletRow>(
      `INSERT INTO wallet.wallets (user_id, currency, account_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, account_type) DO NOTHING
       RETURNING *`,
      [userId, currency, accountType]
    );
    return result.rows[0] || null;
  }

  async updateBalance(
    userId: string,
    accountType: AccountType,
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
       WHERE id = $3 AND user_id = $4 AND account_type = $5 AND version = $6
       RETURNING *`,
      [newBalance.toString(), newLockedBalance.toString(), walletId, userId, accountType, version]
    );

    if (result.rowCount === 0) {
      throw new Error('Wallet update failed: version mismatch or wallet not found');
    }

    return result.rows[0];
  }
}
