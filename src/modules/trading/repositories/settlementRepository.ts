import { PoolClient } from 'pg';
import { BaseRepository } from '../../../shared/repositories/baseRepository.js';

export class SettlementRepository extends BaseRepository {
  constructor(client?: PoolClient) {
    super(client);
  }

  /**
   * Records a settlement event in the audit trail.
   */
  async recordSettlementEvent(
    contractId: string,
    outcome: string,
    settlementPrice: string,
    details: any
  ): Promise<void> {
    const query = `
      INSERT INTO trading.contract_events (contract_id, event_type, details)
      VALUES ($1, $2, $3)
    `;
    await this.query(query, [
      contractId,
      'settled',
      JSON.stringify({
        outcome,
        settlementPrice,
        settlementTime: new Date(),
        ...details
      }),
    ]);
  }

  /**
   * Records a cancellation event in the audit trail.
   */
  async recordCancellationEvent(contractId: string, reason: string): Promise<void> {
    const query = `
      INSERT INTO trading.contract_events (contract_id, event_type, details)
      VALUES ($1, $2, $3)
    `;
    await this.query(query, [
      contractId,
      'cancelled',
      JSON.stringify({
        reason,
        cancelledAt: new Date(),
      }),
    ]);
  }
}
