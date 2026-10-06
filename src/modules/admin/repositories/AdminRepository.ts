import crypto from 'crypto';
import { PoolClient } from 'pg';
import { BaseRepository } from '../../../shared/repositories/baseRepository.js';

export interface UserStatusUpdateInput {
  status: 'active' | 'suspended' | 'closed';
  reason: string;
}

export class AdminRepository extends BaseRepository {
  constructor(client?: PoolClient) {
    super(client);
  }

  async listUsers(filters: {
    status?: string;
    search?: string;
    page: number;
    perPage: number;
  }): Promise<{ rows: any[]; total: number }> {
    const limit = Math.min(filters.perPage || 20, 100);
    const offset = ((filters.page || 1) - 1) * limit;
    const conditions: string[] = ['deleted_at IS NULL'];
    const params: any[] = [];

    if (filters.status) {
      params.push(filters.status);
      conditions.push(`status = $${params.length}`);
    }

    if (filters.search) {
      params.push(`%${filters.search}%`);
      conditions.push(`(email ILIKE $${params.length} OR display_name ILIKE $${params.length})`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await this.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM app_auth.users ${whereClause}`,
      params
    );

    const rowsResult = await this.query<any>(
      `SELECT * FROM app_auth.users ${whereClause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    return {
      rows: rowsResult.rows,
      total: countResult.rows[0]?.count || 0,
    };
  }

  async getUserById(id: string): Promise<any | null> {
    const result = await this.query<any>(
      'SELECT * FROM app_auth.users WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    return result.rows[0] || null;
  }

  async updateUserStatus(
    userId: string,
    payload: UserStatusUpdateInput,
    actorId: string
  ): Promise<any> {
    const result = await this.query<any>(
      `UPDATE app_auth.users
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [payload.status, userId]
    );

    if (result.rows[0]) {
      await this.createAuditLog({
        actorId,
        action: 'user_status_update',
        affectedEntity: 'user',
        entityId: userId,
        details: { status: payload.status, reason: payload.reason },
      });
    }

    return result.rows[0] || null;
  }

  async getUserLedger(
    userId: string,
    page: number,
    perPage: number
  ): Promise<{ rows: any[]; total: number }> {
    const limit = Math.min(perPage || 20, 100);
    const offset = ((page || 1) - 1) * limit;

    const totalResult = await this.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM wallet.ledger_entries WHERE user_id = $1`,
      [userId]
    );

    const rowsResult = await this.query<any>(
      `SELECT * FROM wallet.ledger_entries WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return {
      rows: rowsResult.rows,
      total: totalResult.rows[0]?.count || 0,
    };
  }

  async listPendingKyc(page: number, perPage: number): Promise<{ rows: any[]; total: number }> {
    const limit = Math.min(perPage || 20, 100);
    const offset = ((page || 1) - 1) * limit;

    const totalResult = await this.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM compliance.kyc_documents WHERE status IN ('pending','review_required')`
    );

    const rowsResult = await this.query<any>(
      `SELECT * FROM compliance.kyc_documents WHERE status IN ('pending','review_required') ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return {
      rows: rowsResult.rows,
      total: totalResult.rows[0]?.count || 0,
    };
  }

  async getKycById(id: string): Promise<any | null> {
    const result = await this.query<any>('SELECT * FROM compliance.kyc_documents WHERE id = $1', [
      id,
    ]);
    return result.rows[0] || null;
  }

  async reviewKyc(id: string, action: string, note: string, reviewedBy: string): Promise<any> {
    const result = await this.query<any>(
      `UPDATE compliance.kyc_documents
       SET status = $1, review_note = $2, reviewed_by = $3, reviewed_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [action === 'approved' ? 'approved' : 'rejected', note, reviewedBy, id]
    );

    return result.rows[0] || null;
  }

  async listPendingWithdrawals(
    page: number,
    perPage: number
  ): Promise<{ rows: any[]; total: number }> {
    const limit = Math.min(perPage || 20, 100);
    const offset = ((page || 1) - 1) * limit;

    const totalResult = await this.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM payments.withdrawals WHERE status = 'pending'`
    );

    const rowsResult = await this.query<any>(
      `SELECT * FROM payments.withdrawals WHERE status = 'pending' ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return {
      rows: rowsResult.rows,
      total: totalResult.rows[0]?.count || 0,
    };
  }

  async getWithdrawalById(id: string): Promise<any | null> {
    const result = await this.query<any>('SELECT * FROM payments.withdrawals WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async updateWithdrawalStatus(
    id: string,
    status: string,
    note: string,
    reviewedBy: string
  ): Promise<any> {
    const result = await this.query<any>(
      `UPDATE payments.withdrawals
       SET status = $1,
           review_note = $2,
           reviewed_by = $3
       WHERE id = $4
       RETURNING *`,
      [status, note, reviewedBy, id]
    );

    return result.rows[0] || null;
  }

  async getRiskDashboard(): Promise<any> {
    const result = await this.query<any>(`
      SELECT
        COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS open_contracts,
        COALESCE(SUM(CASE WHEN status IN ('won', 'lost', 'draw') THEN 1 ELSE 0 END), 0) AS settled_contracts,
        COALESCE(SUM(CASE WHEN status = 'active' THEN stake_amount ELSE 0 END), 0) AS total_exposure
      FROM trading.binary_contracts
    `);
    return result.rows[0] || { open_contracts: 0, settled_contracts: 0, total_exposure: 0 };
  }

  async getRiskExposure(): Promise<any[]> {
    const result = await this.query<any>(`
      SELECT asset_symbol AS symbol, SUM(stake_amount) AS exposure
      FROM trading.binary_contracts
      WHERE status = 'active'
      GROUP BY asset_symbol
      ORDER BY exposure DESC
    `);
    return result.rows;
  }

  async updateAssetConfig(
    symbol: string,
    payload: Record<string, any>,
    updatedBy: string
  ): Promise<any> {
    const result = await this.query<any>(
      `UPDATE trading.asset_config
       SET payout_rate = COALESCE($1, payout_rate),
           min_stake = COALESCE($2, min_stake),
           max_stake_per_trade = COALESCE($3, max_stake_per_trade),
           updated_by = $4,
           updated_at = NOW()
       WHERE asset_symbol = $5
       RETURNING *`,
      [
        payload.payout_rate ?? payload.payout_ratio ?? null,
        payload.min_stake ?? null,
        payload.max_stake ?? payload.max_stake_per_trade ?? null,
        updatedBy,
        symbol,
      ]
    );

    return result.rows[0] || null;
  }

  async listSettings(): Promise<any[]> {
    const result = await this.query<any>('SELECT * FROM config.platform_settings ORDER BY key ASC');
    return result.rows;
  }

  async getSetting(key: string): Promise<any | null> {
    const result = await this.query<any>('SELECT * FROM config.platform_settings WHERE key = $1', [
      key,
    ]);
    return result.rows[0] || null;
  }

  async setSetting(key: string, value: string, updatedBy: string, reason: string): Promise<any> {
    const result = await this.query<any>(
      `INSERT INTO config.platform_settings (key, value, updated_by, reason, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, reason = EXCLUDED.reason, updated_at = NOW()
       RETURNING *`,
      [key, value, updatedBy, reason]
    );

    return result.rows[0] || null;
  }

  async getReports(
    dateFrom?: string,
    dateTo?: string
  ): Promise<{
    dailyRevenue: any[];
    tradeVolume: any[];
    userRegistrations: any[];
    settlementPerformance: any[];
  }> {
    const revenueResult = await this.query<any>(
      `SELECT COALESCE(SUM(amount), 0) AS revenue, DATE(created_at) AS day
       FROM payments.deposits
       WHERE created_at >= COALESCE($1::timestamptz, NOW() - INTERVAL '30 days')
         AND created_at <= COALESCE($2::timestamptz, NOW())
       GROUP BY DATE(created_at)
       ORDER BY day DESC`,
      [dateFrom || null, dateTo || null]
    );

    const tradeResult = await this.query<any>(
      `SELECT COALESCE(SUM(stake_amount), 0) AS volume, DATE(created_at) AS day
       FROM trading.binary_contracts
       WHERE created_at >= COALESCE($1::timestamptz, NOW() - INTERVAL '30 days')
         AND created_at <= COALESCE($2::timestamptz, NOW())
       GROUP BY DATE(created_at)
       ORDER BY day DESC`,
      [dateFrom || null, dateTo || null]
    );

    const registrationsResult = await this.query<any>(
      `SELECT COUNT(*)::int AS users, DATE(created_at) AS day
       FROM app_auth.users
       WHERE created_at >= COALESCE($1::timestamptz, NOW() - INTERVAL '30 days')
         AND created_at <= COALESCE($2::timestamptz, NOW())
       GROUP BY DATE(created_at)
       ORDER BY day DESC`,
      [dateFrom || null, dateTo || null]
    );

    const settlementResult = await this.query<any>(
      `SELECT COUNT(*)::int AS total_settlements, DATE(created_at) AS day
       FROM trading.binary_contracts
       WHERE status IN ('won', 'lost', 'draw')
         AND created_at >= COALESCE($1::timestamptz, NOW() - INTERVAL '30 days')
         AND created_at <= COALESCE($2::timestamptz, NOW())
       GROUP BY DATE(created_at)
       ORDER BY day DESC`,
      [dateFrom || null, dateTo || null]
    );

    return {
      dailyRevenue: revenueResult.rows,
      tradeVolume: tradeResult.rows,
      userRegistrations: registrationsResult.rows,
      settlementPerformance: settlementResult.rows,
    };
  }

  async getAuditLogs(filters: {
    actorId?: string;
    action?: string;
    affectedEntity?: string;
    dateFrom?: string;
    dateTo?: string;
    page: number;
    perPage: number;
  }): Promise<{ rows: any[]; total: number }> {
    const limit = Math.min(filters.perPage || 20, 100);
    const offset = ((filters.page || 1) - 1) * limit;
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.actorId) {
      params.push(filters.actorId);
      conditions.push(`actor_id = $${params.length}`);
    }

    if (filters.action) {
      params.push(filters.action);
      conditions.push(`action = $${params.length}`);
    }

    if (filters.affectedEntity) {
      params.push(filters.affectedEntity);
      conditions.push(`affected_entity = $${params.length}`);
    }

    if (filters.dateFrom) {
      params.push(filters.dateFrom);
      conditions.push(`created_at >= $${params.length}::timestamptz`);
    }

    if (filters.dateTo) {
      params.push(filters.dateTo);
      conditions.push(`created_at <= $${params.length}::timestamptz`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await this.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM admin.audit_logs ${whereClause}`,
      params
    );

    const rowsResult = await this.query<any>(
      `SELECT * FROM admin.audit_logs ${whereClause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    return {
      rows: rowsResult.rows,
      total: countResult.rows[0]?.count || 0,
    };
  }

  async createAuditLog(input: {
    actorId: string | null;
    action: string;
    affectedEntity: string;
    entityId?: string | null;
    details: Record<string, any>;
    ipAddress?: string | null;
    userAgent?: string | null;
    previousHash?: string;
    createdAt?: string;
  }): Promise<any> {
    const previousResult = await this.query<{ previous_entry_hash: string; entry_hash: string }>(
      `SELECT previous_entry_hash, entry_hash FROM admin.audit_logs ORDER BY id DESC LIMIT 1`
    );
    const previousHash = input.previousHash || previousResult.rows[0]?.entry_hash || 'genesis';
    const createdAt = input.createdAt || new Date().toISOString();
    const detailsObj =
      typeof input.details === 'string' ? JSON.parse(input.details) : input.details || {};

    const entryHash = this.buildEntryHash({
      previousHash,
      actorId: input.actorId || 'system',
      action: input.action,
      affectedEntity: input.affectedEntity,
      details: detailsObj,
      createdAt,
    });

    const insertResult = await this.query<any>(
      `INSERT INTO admin.audit_logs (
         entry_hash,
         previous_entry_hash,
         actor_id,
         action,
         affected_entity,
         entity_id,
         details,
         ip_address,
         user_agent,
         created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz) RETURNING *`,
      [
        entryHash,
        previousHash,
        input.actorId,
        input.action,
        input.affectedEntity,
        input.entityId || null,
        JSON.stringify(detailsObj),
        input.ipAddress || null,
        input.userAgent || null,
        createdAt,
      ]
    );

    return insertResult.rows[0];
  }

  buildEntryHash(input: {
    previousHash: string;
    actorId: string;
    action: string;
    affectedEntity: string;
    details: Record<string, any>;
    createdAt: string;
  }): string {
    return this.computeEntryHash(input);
  }

  computeEntryHash(input: {
    previousHash: string;
    actorId: string;
    action: string;
    affectedEntity: string;
    details: Record<string, any>;
    createdAt: string;
  }): string {
    const payload = `${input.previousHash}${input.actorId}${input.action}${input.affectedEntity}${JSON.stringify(input.details)}${input.createdAt}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  async listSupportTickets(filters: {
    status?: string;
    priority?: string;
    page: number;
    perPage: number;
  }): Promise<{ rows: any[]; total: number }> {
    const limit = Math.min(filters.perPage || 20, 100);
    const offset = ((filters.page || 1) - 1) * limit;
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.status) {
      params.push(filters.status);
      conditions.push(`status = $${params.length}`);
    }

    if (filters.priority) {
      params.push(filters.priority);
      conditions.push(`priority = $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await this.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM admin.support_tickets ${whereClause}`,
      params
    );

    const rowsResult = await this.query<any>(
      `SELECT * FROM admin.support_tickets ${whereClause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    return {
      rows: rowsResult.rows,
      total: countResult.rows[0]?.count || 0,
    };
  }

  async getSupportTicketById(id: string): Promise<any | null> {
    const result = await this.query<any>('SELECT * FROM admin.support_tickets WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async updateSupportTicket(
    id: string,
    payload: {
      status: string;
      response?: string;
      assigned_to?: string | null;
    }
  ): Promise<any> {
    const result = await this.query<any>(
      `UPDATE admin.support_tickets
       SET status = $1,
           response = COALESCE($2, response),
           assigned_to = COALESCE($3, assigned_to),
           resolved_at = CASE WHEN $1 IN ('resolved','closed') THEN NOW() ELSE resolved_at END
       WHERE id = $4
       RETURNING *`,
      [payload.status, payload.response || null, payload.assigned_to || null, id]
    );

    return result.rows[0] || null;
  }

  async createAdminAction(action: {
    adminId: string;
    actionType: string;
    targetUserId?: string | null;
    details: Record<string, any>;
    requiresApproval?: boolean;
  }): Promise<any> {
    const result = await this.query<any>(
      `INSERT INTO admin.admin_actions (admin_id, action_type, target_user_id, details, requires_approval, approved_by, approved_at, created_at)
       VALUES ($1, $2, $3, $4, $5, NULL, NULL, NOW()) RETURNING *`,
      [
        action.adminId,
        action.actionType,
        action.targetUserId || null,
        JSON.stringify(action.details),
        action.requiresApproval ?? true,
      ]
    );

    return result.rows[0] || null;
  }

  async approveAdminAction(actionId: string, approvedBy: string): Promise<any> {
    const result = await this.query<any>(
      `UPDATE admin.admin_actions
       SET approved_by = $1, approved_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [approvedBy, actionId]
    );

    return result.rows[0] || null;
  }

  async createSystemJob(
    jobType: string,
    status: string,
    result?: Record<string, any>,
    errorMessage?: string
  ): Promise<any> {
    const resultQuery = await this.query<any>(
      `INSERT INTO admin.system_jobs (job_type, status, started_at, completed_at, result, error_message, created_at)
       VALUES ($1, $2, NOW(), NOW(), $3, $4, NOW()) RETURNING *`,
      [jobType, status, JSON.stringify(result || {}), errorMessage || null]
    );

    return resultQuery.rows[0];
  }

  async getSystemJobState(jobType: string): Promise<any | null> {
    const result = await this.query<any>(
      `SELECT * FROM admin.system_jobs WHERE job_type = $1 ORDER BY created_at DESC LIMIT 1`,
      [jobType]
    );

    return result.rows[0] || null;
  }
}
