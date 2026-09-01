import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { pgPool } from '../../config/database.js';

export class BaseRepository {
  protected pool: Pool = pgPool;
  protected client?: PoolClient;

  constructor(client?: PoolClient) {
    this.client = client;
  }

  protected async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    if (this.client) {
      return this.client.query<T>(text, params);
    }
    return this.pool.query<T>(text, params);
  }
}
