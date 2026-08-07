import { pgPool } from '../../../config/database';

export interface MfaRow {
  id: string;
  user_id: string;
  secret_encrypted: string;
  is_enabled: boolean;
  backup_codes: string[];
  verified_at: Date | null;
  enabled_at: Date | null;
  disabled_at: Date | null;
  created_at: Date;
}

export class MfaRepository {
  async findByUserId(userId: string): Promise<MfaRow | null> {
    const result = await pgPool.query(
      'SELECT * FROM app_auth.mfa_tokens WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  }

  async upsert(userId: string, secretEncrypted: string, backupCodes: string[]): Promise<void> {
    await pgPool.query(
      `INSERT INTO app_auth.mfa_tokens (user_id, secret_encrypted, backup_codes, is_enabled)
       VALUES ($1, $2, $3, FALSE)
       ON CONFLICT (user_id) DO UPDATE SET
       secret_encrypted = $2, backup_codes = $3, is_enabled = FALSE`,
      [userId, secretEncrypted, backupCodes]
    );
  }

  async verify(userId: string): Promise<void> {
    await pgPool.query(
      "UPDATE app_auth.mfa_tokens SET is_enabled = TRUE, verified_at = NOW(), enabled_at = NOW() WHERE user_id = $1",
      [userId]
    );
  }
}
