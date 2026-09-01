import { pgPool } from '../../../config/database.js';

export interface ContractEvent {
  id?: number;
  contractId: string;
  eventType: string;
  details: any;
  createdAt?: Date;
}

export class ContractEventRepository {
  async create(event: ContractEvent): Promise<ContractEvent> {
    const query = `
      INSERT INTO trading.contract_events (contract_id, event_type, details)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const values = [event.contractId, event.eventType, event.details];
    const { rows } = await pgPool.query(query, values);
    return rows[0];
  }

  async findByContractId(contractId: string): Promise<ContractEvent[]> {
    const query =
      'SELECT * FROM trading.contract_events WHERE contract_id = $1 ORDER BY created_at ASC';
    const { rows } = await pgPool.query(query, [contractId]);
    return rows;
  }
}
