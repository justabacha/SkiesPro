import { pgPool } from '../../../config/database.js';

export interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string; // From migration 002
  ip_address: string | null;
  user_agent: string | null;
  expires_at: Date;
  created_at: Date;
  // Critical columns from migration 019
  access_token_jti: string | null;
  refresh_token_hash: string | null;
  refresh_token_expires_at: Date | null;
  device_info: any | null;
  is_revoked: boolean;
  revoked_at: Date | null;
}

export class SessionRepository {
  async create(data: {
    user_id: string;
    token_hash: string;
    ip_address: string | null;
    user_agent: string | null;
    expires_at: Date;
    access_token_jti: string;
    refresh_token_hash: string;
    refresh_token_expires_at: Date;
  }): Promise<SessionRow> {
    const result = await pgPool.query(
      `INSERT INTO app_auth.sessions (
        user_id, token_hash, ip_address, user_agent, expires_at,
        access_token_jti, refresh_token_hash, refresh_token_expires_at, is_revoked
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE)
      RETURNING *`,
      [
        data.user_id,
        data.token_hash,
        data.ip_address,
        data.user_agent,
        data.expires_at,
        data.access_token_jti,
        data.refresh_token_hash,
        data.refresh_token_expires_at,
      ]
    );
    return result.rows[0];
  }

  async findByRefreshToken(hash: string): Promise<SessionRow | null> {
    const result = await pgPool.query(
      'SELECT * FROM app_auth.sessions WHERE refresh_token_hash = $1 AND is_revoked = FALSE AND refresh_token_expires_at > NOW()',
      [hash]
    );
    return result.rows[0] || null;
  }

  async findByJti(jti: string): Promise<SessionRow | null> {
    const result = await pgPool.query(
      'SELECT * FROM app_auth.sessions WHERE access_token_jti = $1',
      [jti]
    );
    return result.rows[0] || null;
  }

  async revoke(id: string): Promise<void> {
    await pgPool.query(
      'UPDATE app_auth.sessions SET is_revoked = TRUE, revoked_at = NOW() WHERE id = $1',
      [id]
    );
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await pgPool.query(
      'UPDATE app_auth.sessions SET is_revoked = TRUE, revoked_at = NOW() WHERE user_id = $1 AND is_revoked = FALSE',
      [userId]
    );
  }
}
