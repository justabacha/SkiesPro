import { PoolClient } from 'pg';
import { BaseRepository } from '../../../shared/repositories/baseRepository.js';
import { RegisterDto } from '../dto/register.dto.js';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  phone: string | null;
  referral_code: string;
  referred_by_id: string | null;
  kyc_status: string;
  avatar_url: string | null;
  self_excluded_until: Date | null;
  mfa_enabled: boolean;
  mfa_type: string | null;
  last_login_at: Date | null;
  failed_login_attempts: number;
  locked_until: Date | null;
  status: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export class UserRepository extends BaseRepository {
  constructor(client?: PoolClient) {
    super(client);
  }

  async findByEmail(email: string): Promise<UserRow | null> {
    const result = await this.query<UserRow>(
      'SELECT * FROM app_auth.users WHERE email = $1 AND deleted_at IS NULL',
      [email]
    );
    return result.rows[0] || null;
  }

  async findByPhone(phone: string): Promise<UserRow | null> {
    const result = await this.query<UserRow>(
      'SELECT * FROM app_auth.users WHERE phone = $1 AND deleted_at IS NULL',
      [phone]
    );
    return result.rows[0] || null;
  }

  async findById(id: string): Promise<UserRow | null> {
    const result = await this.query<UserRow>(
      'SELECT * FROM app_auth.users WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    return result.rows[0] || null;
  }

  async create(
    data: RegisterDto & { password_hash: string; referral_code: string }
  ): Promise<UserRow> {
    const result = await this.query<UserRow>(
      `INSERT INTO app_auth.users (
        email, password_hash, display_name, phone, referral_code, status, kyc_status
      ) VALUES ($1, $2, $3, $4, $5, 'active', 'unverified')
      RETURNING *`,
      [data.email, data.password_hash, data.display_name, data.phone || null, data.referral_code]
    );
    return result.rows[0];
  }

  async updateLoginAttempts(id: string, attempts: number, lockedUntil: Date | null): Promise<void> {
    await this.query(
      'UPDATE app_auth.users SET failed_login_attempts = $1, locked_until = $2, updated_at = NOW() WHERE id = $3',
      [attempts, lockedUntil, id]
    );
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.query(
      'UPDATE app_auth.users SET last_login_at = NOW(), failed_login_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = $1',
      [id]
    );
  }

  async updateMfaStatus(id: string, enabled: boolean, type: string | null): Promise<void> {
    await this.query(
      'UPDATE app_auth.users SET mfa_enabled = $1, mfa_type = $2, updated_at = NOW() WHERE id = $3',
      [enabled, type, id]
    );
  }

  async getRoles(userId: string): Promise<string[]> {
    const result = await this.query(
      `SELECT r.name
       FROM app_auth.roles r
       JOIN app_auth.user_roles ur ON r.id = ur.role_id
       WHERE ur.user_id = $1`,
      [userId]
    );
    return result.rows.map((row) => row.name);
  }

  async assignRole(userId: string, roleName: string): Promise<void> {
    await this.query(
      `INSERT INTO app_auth.user_roles (user_id, role_id, granted_by)
       SELECT $1, id, $1 FROM app_auth.roles WHERE name = $2`,
      [userId, roleName]
    );
  }

  async getPasswordHistory(userId: string): Promise<string[]> {
    const result = await this.query(
      'SELECT password_hash FROM app_auth.password_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5',
      [userId]
    );
    return result.rows.map((row) => row.password_hash);
  }

  async addToPasswordHistory(userId: string, passwordHash: string): Promise<void> {
    await this.query(
      'INSERT INTO app_auth.password_history (user_id, password_hash) VALUES ($1, $2)',
      [userId, passwordHash]
    );
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.query(
      'UPDATE app_auth.users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, userId]
    );
  }

  async verifyEmail(userId: string): Promise<void> {
    await this.query(
      "UPDATE app_auth.users SET status = 'active', updated_at = NOW() WHERE id = $1",
      [userId]
    );
  }

  async updateProfile(
    userId: string,
    data: { display_name?: string; phone?: string }
  ): Promise<UserRow> {
    const fields = [];
    const values = [];
    let idx = 1;

    if (data.display_name !== undefined) {
      fields.push(`display_name = $${idx++}`);
      values.push(data.display_name);
    }
    if (data.phone !== undefined) {
      fields.push(`phone = $${idx++}`);
      values.push(data.phone);
    }

    if (fields.length === 0) {
      const user = await this.findById(userId);
      if (!user) throw new Error('User not found');
      return user;
    }

    values.push(userId);
    const result = await this.query(
      `UPDATE app_auth.users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  async updateAvatar(userId: string, avatarUrl: string): Promise<UserRow> {
    const result = await this.query(
      'UPDATE app_auth.users SET avatar_url = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [avatarUrl, userId]
    );
    return result.rows[0];
  }

  async getProfile(userId: string): Promise<UserRow | null> {
    return this.findById(userId);
  }

  async getKycStatus(userId: string): Promise<string | null> {
    const result = await this.query('SELECT kyc_status FROM app_auth.users WHERE id = $1', [
      userId,
    ]);
    return result.rows[0]?.kyc_status || null;
  }

  async initiateKyc(userId: string): Promise<UserRow> {
    const result = await this.query(
      "UPDATE app_auth.users SET kyc_status = 'pending', updated_at = NOW() WHERE id = $1 AND kyc_status IN ('unverified', 'rejected') RETURNING *",
      [userId]
    );
    if (result.rowCount === 0) {
      throw new Error('KYC initiation failed: Invalid current status');
    }
    return result.rows[0];
  }
}
