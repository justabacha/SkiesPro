import { PoolClient } from 'pg';
import { BaseRepository } from '../../../shared/repositories/baseRepository';

export interface OutboxRow {
  id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: any;
  published: boolean;
  published_at: Date | null;
  retry_count: number;
  last_error: string | null;
  created_at: Date;
}

export class OutboxRepository extends BaseRepository {
  constructor(client?: PoolClient) {
    super(client);
  }

  async create(data: Pick<OutboxRow, 'event_type' | 'aggregate_type' | 'aggregate_id' | 'payload'>): Promise<OutboxRow> {
    const result = await this.query<OutboxRow>(
      `INSERT INTO events.event_outbox (
        event_type, aggregate_type, aggregate_id, payload
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [data.event_type, data.aggregate_type, data.aggregate_id, JSON.stringify(data.payload)]
    );
    return result.rows[0];
  }
}
