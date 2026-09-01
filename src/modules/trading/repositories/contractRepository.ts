import { PoolClient } from 'pg';
import { pgPool } from '../../../config/database.js';

export interface BinaryContract {
  id?: string;
  userId: string;
  assetSymbol: string;
  stake: string;
  contractType: 'higher' | 'lower';
  strikePrice: string;
  expiryPrice?: string;
  payoutRate: string;
  potentialPayout: string;
  purchaseTime: Date;
  expiryTime: Date;
  status: 'draft' | 'active' | 'settling' | 'won' | 'lost' | 'draw' | 'cancelled' | 'archived';
  lockTxId?: string;
  payoutTxId?: string;
}

export class ContractRepository {
  private client?: PoolClient;

  constructor(client?: PoolClient) {
    this.client = client;
  }

  private async query(text: string, params?: any[]) {
    if (this.client) {
      return this.client.query(text, params);
    }
    return pgPool.query(text, params);
  }

  async create(contract: BinaryContract): Promise<BinaryContract> {
    const query = `
      INSERT INTO trading.binary_contracts (
        user_id, asset_symbol, stake, contract_type, strike_price,
        payout_rate, potential_payout, purchase_time, expiry_time, status, lock_tx_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const values = [
      contract.userId,
      contract.assetSymbol,
      contract.stake,
      contract.contractType,
      contract.strikePrice,
      contract.payoutRate,
      contract.potentialPayout,
      contract.purchaseTime,
      contract.expiryTime,
      contract.status,
      contract.lockTxId,
    ];
    const { rows } = await this.query(query, values);
    return this.mapToCamelCase(rows[0]);
  }

  async findById(id: string): Promise<BinaryContract | null> {
    const { rows } = await this.query('SELECT * FROM trading.binary_contracts WHERE id = $1', [id]);
    return rows[0] ? this.mapToCamelCase(rows[0]) : null;
  }

  async getActiveExposure(symbol: string): Promise<string> {
    const query = `
      SELECT SUM(stake) as total_exposure
      FROM trading.binary_contracts
      WHERE asset_symbol = $1 AND status = 'active'
    `;
    const { rows } = await this.query(query, [symbol]);
    return rows[0].total_exposure || '0';
  }

  async listByUser(
    userId: string,
    filters: { status?: string; assetSymbol?: string; limit?: number; cursor?: string }
  ): Promise<BinaryContract[]> {
    let query = 'SELECT * FROM trading.binary_contracts WHERE user_id = $1';
    const values: any[] = [userId];
    let idx = 2;

    if (filters.status) {
      query += ` AND status = $${idx++}`;
      values.push(filters.status);
    }
    if (filters.assetSymbol) {
      query += ` AND asset_symbol = $${idx++}`;
      values.push(filters.assetSymbol);
    }
    if (filters.cursor) {
      query += ` AND purchase_time < $${idx++}`;
      values.push(filters.cursor);
    }

    query += ` ORDER BY purchase_time DESC LIMIT $${idx++}`;
    values.push(filters.limit || 20);

    const { rows } = await this.query(query, values);
    return rows.map(this.mapToCamelCase);
  }

  async getActiveByUser(userId: string): Promise<BinaryContract[]> {
    const query = `
      SELECT * FROM trading.binary_contracts
      WHERE user_id = $1 AND status = 'active'
      ORDER BY purchase_time DESC
    `;
    const { rows } = await this.query(query, [userId]);
    return rows.map(this.mapToCamelCase);
  }

  async updateStatus(id: string, status: string, expiryPrice?: string): Promise<boolean> {
    const query = `
      UPDATE trading.binary_contracts
      SET status = $1, expiry_price = COALESCE($2, expiry_price)
      WHERE id = $3
    `;
    const result = await this.query(query, [status, expiryPrice, id]);
    return (result.rowCount ?? 0) > 0;
  }

  async updateStatusCAS(id: string, expectedStatus: string, newStatus: string): Promise<boolean> {
    const query = `
      UPDATE trading.binary_contracts
      SET status = $1
      WHERE id = $2 AND status = $3
    `;
    const result = await this.query(query, [newStatus, id, expectedStatus]);
    return (result.rowCount ?? 0) > 0;
  }

  private mapToCamelCase(row: any): BinaryContract {
    return {
      id: row.id,
      userId: row.user_id,
      assetSymbol: row.asset_symbol,
      stake: row.stake, // Keep as string for precision
      contractType: row.contract_type,
      strikePrice: row.strike_price, // Keep as string for precision
      expiryPrice: row.expiry_price, // Keep as string for precision
      payoutRate: row.payout_rate, // Keep as string for precision
      potentialPayout: row.potential_payout, // Keep as string for precision
      purchaseTime: row.purchase_time,
      expiryTime: row.expiry_time,
      status: row.status,
      lockTxId: row.lock_tx_id,
      payoutTxId: row.payout_tx_id,
    };
  }
}
