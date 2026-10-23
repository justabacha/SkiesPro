import crypto from 'crypto';
import { PoolClient } from 'pg';
import { BaseRepository } from '../../../shared/repositories/baseRepository.js';

const assignedRoleJoin = `
  LEFT JOIN LATERAL (
    SELECT UPPER(r.name) AS role
    FROM app_auth.user_roles ur
    JOIN app_auth.roles r ON r.id = ur.role_id
    WHERE ur.user_id = u.id
      AND ur.revoked_at IS NULL
    ORDER BY CASE LOWER(r.name)
      WHEN 'super_admin' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'compliance' THEN 3
      WHEN 'risk_manager' THEN 4
      WHEN 'risk' THEN 4
      WHEN 'finance' THEN 5
      WHEN 'support' THEN 6
      ELSE 100
    END, LOWER(r.name)
    LIMIT 1
  ) assigned_role ON TRUE
`;

const kycUsersForStatus = `
  SELECT user_id
  FROM (
    SELECT
      user_id,
      CASE
        WHEN BOOL_OR(status = 'pending') THEN 'pending'
        WHEN BOOL_OR(status = 'rejected') THEN 'rejected'
        WHEN BOOL_AND(status = 'approved') THEN 'approved'
        ELSE MAX(status)
      END AS application_status
    FROM compliance.kyc_documents
    GROUP BY user_id
  ) grouped_users
  WHERE $1 = 'all'
     OR application_status = $1
`;

const kycAggregatedSelect = `
  SELECT
    u.id::text AS id,
    u.id AS user_id,
    u.email AS user_email,
    u.display_name AS user_display_name,
    u.kyc_status AS user_kyc_status,
    STRING_AGG(DISTINCT kd.document_type, ', ' ORDER BY kd.document_type) AS doc_type,
    CASE
      WHEN BOOL_OR(kd.status = 'pending') THEN 'pending'
      WHEN BOOL_OR(kd.status = 'rejected') THEN 'rejected'
      WHEN BOOL_AND(kd.status = 'approved') THEN 'approved'
      ELSE MAX(kd.status)
    END AS status,
    MAX(kd.created_at) AS created_at,
    MAX(kd.created_at) AS submitted_at,
    (ARRAY_AGG(kd.file_storage_path ORDER BY kd.created_at DESC)
      FILTER (WHERE kd.document_type IN ('national_id', 'passport', 'drivers_license')))[1] AS id_front_url,
    (ARRAY_AGG(kd.file_storage_path ORDER BY kd.created_at DESC)
      FILTER (WHERE kd.document_type = 'proof_of_address'))[1] AS proof_of_address_url,
    (ARRAY_AGG(kd.file_storage_path ORDER BY kd.created_at DESC)
      FILTER (WHERE kd.document_type = 'selfie'))[1] AS selfie_url
  FROM app_auth.users u
  JOIN compliance.kyc_documents kd ON kd.user_id = u.id
`;

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
    role?: string;
    page: number;
    perPage: number;
  }): Promise<{ rows: any[]; total: number }> {
    const limit = Math.min(filters.perPage || 20, 100);
    const offset = ((filters.page || 1) - 1) * limit;
    const conditions: string[] = ['u.deleted_at IS NULL'];
    const params: any[] = [];

    if (filters.status) {
      params.push(filters.status);
      conditions.push(`u.status = $${params.length}`);
    }

    if (filters.search) {
      params.push(`%${filters.search}%`);
      conditions.push(
        `(u.email ILIKE $${params.length} OR u.display_name ILIKE $${params.length})`
      );
    }

    if (filters.role) {
      params.push(filters.role.toUpperCase());
      if (filters.role.toLowerCase() === 'trader') {
        conditions.push(`COALESCE(assigned_role.role, 'TRADER') = $${params.length}`);
      } else {
        conditions.push(`assigned_role.role = $${params.length}`);
      }
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await this.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM app_auth.users u
       ${assignedRoleJoin}
       ${whereClause}`,
      params
    );

    const rowsResult = await this.query<any>(
      `SELECT u.*, COALESCE(assigned_role.role, 'TRADER') AS role
       FROM app_auth.users u
       ${assignedRoleJoin}
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    return {
      rows: rowsResult.rows,
      total: countResult.rows[0]?.count || 0,
    };
  }

  async getUserById(id: string): Promise<any | null> {
    const result = await this.query<any>(
      `SELECT
         u.*,
         COALESCE(assigned_role.role, 'TRADER') AS role,
         wallet_stats.real_balance,
         wallet_stats.available_balance,
         wallet_stats.demo_balance,
         trade_stats.total_trades,
         trade_stats.winning_trades
       FROM app_auth.users u
       ${assignedRoleJoin}
       LEFT JOIN LATERAL (
         SELECT
           MAX(balance) FILTER (WHERE account_type = 'real') AS real_balance,
           MAX(available_balance) FILTER (WHERE account_type = 'real') AS available_balance,
           MAX(balance) FILTER (WHERE account_type = 'demo') AS demo_balance
         FROM wallet.wallets
         WHERE user_id = u.id
       ) wallet_stats ON TRUE
       LEFT JOIN LATERAL (
         SELECT
           COUNT(*)::int AS total_trades,
           COUNT(*) FILTER (WHERE status = 'won')::int AS winning_trades
         FROM trading.binary_contracts
         WHERE user_id = u.id
       ) trade_stats ON TRUE
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [id]
    );
    const row = result.rows[0];
    if (!row) return null;

    const tradesResult = await this.query<any>(
      `SELECT
         id,
         asset_symbol AS asset_pair,
         contract_type AS direction,
         stake AS amount,
         potential_payout AS payout,
         status AS result,
         status,
         created_at
       FROM trading.binary_contracts
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 5`,
      [id]
    );

    const { real_balance, available_balance, demo_balance, winning_trades, ...user } = row;
    const realBalance = Number(real_balance ?? 0);
    const availableBalance = Number(available_balance ?? 0);
    const demoBalance = Number(demo_balance ?? 0);
    const totalTrades = Number(row.total_trades ?? 0);
    const winningTrades = Number(winning_trades ?? 0);

    return {
      ...user,
      wallet_balance_kes: realBalance,
      demo_balance_kes: demoBalance,
      total_trades: totalTrades,
      win_rate_pct: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : null,
      recent_trades: tradesResult.rows,
      wallet: {
        real_balance: realBalance,
        available_balance: availableBalance,
        demo_balance: demoBalance,
      },
    };
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
      `SELECT COUNT(*)::int AS count
       FROM wallet.ledger_entries le
       JOIN wallet.wallets w ON w.id = le.wallet_id
       WHERE w.user_id = $1`,
      [userId]
    );

    const rowsResult = await this.query<any>(
      `SELECT
         le.id,
         w.user_id,
         le.wallet_id,
         CASE WHEN le.entry_type = 'debit' THEN -le.amount ELSE le.amount END AS amount,
         le.entry_type AS type,
         le.reference_type,
         le.description,
         le.balance_after,
         w.currency,
         le.created_at
       FROM wallet.ledger_entries le
       JOIN wallet.wallets w ON w.id = le.wallet_id
       WHERE w.user_id = $1
       ORDER BY le.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return {
      rows: rowsResult.rows,
      total: totalResult.rows[0]?.count || 0,
    };
  }

  async listPendingKyc(
    page: number,
    perPage: number,
    status = 'pending'
  ): Promise<{ rows: any[]; total: number }> {
    const limit = Math.min(perPage || 20, 100);
    const offset = ((page || 1) - 1) * limit;

    const totalResult = await this.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM (${kycUsersForStatus}) kyc_users`,
      [status]
    );

    const rowsResult = await this.query<any>(
      `WITH matching_users AS (${kycUsersForStatus})
       ${kycAggregatedSelect}
       JOIN matching_users mu ON mu.user_id = u.id
       GROUP BY u.id, u.email, u.display_name, u.kyc_status
       ORDER BY MAX(kd.created_at) DESC
       LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    );

    return {
      rows: rowsResult.rows,
      total: totalResult.rows[0]?.count || 0,
    };
  }

  async getKycById(id: string): Promise<any | null> {
    const result = await this.query<any>(
      `${kycAggregatedSelect}
       WHERE u.id = $1
          OR EXISTS (
            SELECT 1 FROM compliance.kyc_documents requested_document
            WHERE requested_document.id = $1 AND requested_document.user_id = u.id
          )
       GROUP BY u.id, u.email, u.display_name, u.kyc_status`,
      [id]
    );
    return result.rows[0] || null;
  }

  async reviewKyc(id: string, action: string, note: string, reviewedBy: string): Promise<any> {
    const result = await this.query<any>(
      `WITH target_user AS (
         SELECT u.id
         FROM app_auth.users u
         WHERE u.id = $4
            OR EXISTS (
              SELECT 1 FROM compliance.kyc_documents requested_document
              WHERE requested_document.id = $4 AND requested_document.user_id = u.id
            )
         LIMIT 1
       ),
       updated_documents AS (
         UPDATE compliance.kyc_documents kd
         SET status = $1, review_note = $2, reviewed_by = $3, reviewed_at = NOW()
         WHERE kd.user_id IN (SELECT id FROM target_user)
           AND kd.status = 'pending'
         RETURNING kd.*
       ),
       updated_user AS (
         UPDATE app_auth.users u
         SET kyc_status = CASE WHEN $1 = 'approved' THEN 'verified' ELSE 'rejected' END,
             updated_at = NOW()
         WHERE u.id IN (SELECT user_id FROM updated_documents)
         RETURNING u.id
       )
       SELECT updated_documents.*
       FROM updated_documents
       JOIN updated_user ON updated_user.id = updated_documents.user_id`,
      [action === 'approved' ? 'approved' : 'rejected', note, reviewedBy, id]
    );

    return result.rows[0] || null;
  }

  async listWithdrawals(
    page: number,
    perPage: number,
    status = 'pending'
  ): Promise<{ rows: any[]; total: number }> {
    const limit = Math.min(perPage || 20, 100);
    const offset = ((page || 1) - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];

    if (status === 'needs_review' || status === 'needs_manual_review') {
      conditions.push(`o.needs_manual_review = true`);
    } else if (status && status !== 'all') {
      params.push(status);
      conditions.push(`w.status = $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await this.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM payments.withdrawals w
       LEFT JOIN LATERAL (
         SELECT needs_manual_review
         FROM payments.b2c_outbox
         WHERE withdrawal_id = w.id
         ORDER BY created_at DESC
         LIMIT 1
       ) o ON true
       ${whereClause}`,
      params
    );

    const rowsResult = await this.query<any>(
      `SELECT
         w.*,
         u.email AS user_email,
         u.display_name AS user_display_name,
         u.phone AS phone_number,
         o.needs_manual_review,
         o.manual_review_reason,
         o.retry_count
       FROM payments.withdrawals w
       LEFT JOIN app_auth.users u ON w.user_id = u.id
       LEFT JOIN LATERAL (
         SELECT needs_manual_review, manual_review_reason, retry_count
         FROM payments.b2c_outbox
         WHERE withdrawal_id = w.id
         ORDER BY created_at DESC
         LIMIT 1
       ) o ON true
       ${whereClause}
       ORDER BY w.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    return {
      rows: rowsResult.rows,
      total: countResult.rows[0]?.count || 0,
    };
  }

  async listPendingWithdrawals(
    page: number,
    perPage: number
  ): Promise<{ rows: any[]; total: number }> {
    return this.listWithdrawals(page, perPage, 'pending');
  }

  async getWithdrawalById(id: string): Promise<any | null> {
    const result = await this.query<any>(
      `SELECT
         w.*,
         u.email AS user_email,
         u.display_name AS user_display_name,
         u.phone AS phone_number,
         o.needs_manual_review,
         o.manual_review_reason,
         o.retry_count
       FROM payments.withdrawals w
       LEFT JOIN app_auth.users u ON w.user_id = u.id
       LEFT JOIN LATERAL (
         SELECT needs_manual_review, manual_review_reason, retry_count
         FROM payments.b2c_outbox
         WHERE withdrawal_id = w.id
         ORDER BY created_at DESC
         LIMIT 1
       ) o ON true
       WHERE w.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async getWithdrawalByIdForUpdate(id: string): Promise<any | null> {
    const result = await this.query<any>(
      `SELECT * FROM payments.withdrawals WHERE id = $1 FOR UPDATE`,
      [id]
    );
    return result.rows[0] || null;
  }

  async getUserPhone(userId: string): Promise<string | null> {
    const result = await this.query<{ phone: string | null }>(
      `SELECT phone FROM app_auth.users WHERE id = $1`,
      [userId]
    );
    return result.rows[0]?.phone || null;
  }

  async insertB2COutboxRow(
    withdrawalId: string,
    originatorConversationId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    await this.query(
      `INSERT INTO payments.b2c_outbox (
         withdrawal_id, originator_conversation_id, status, next_attempt_at, payload, created_at, updated_at
       ) VALUES ($1, $2, 'pending', NOW(), $3::jsonb, NOW(), NOW())`,
      [withdrawalId, originatorConversationId, JSON.stringify(payload)]
    );
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
        COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0)::int AS total_open_positions,
        COALESCE(SUM(CASE WHEN status = 'active' THEN potential_payout ELSE 0 END), 0)::float AS total_payout_exposure_kes,
        COALESCE((COUNT(CASE WHEN status = 'won' THEN 1 END)::float / NULLIF(COUNT(CASE WHEN status IN ('won', 'lost') THEN 1 END), 0)) * 100, 0)::float AS platform_win_loss_ratio,
        COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN stake ELSE 0 END), 0)::float AS daily_volume_kes,
        COALESCE(COUNT(DISTINCT CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN user_id END), 0)::int AS active_traders_24h,
        0::int AS high_risk_flagged_users,
        COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0)::int AS open_contracts,
        COALESCE(SUM(CASE WHEN status IN ('won', 'lost', 'draw') THEN 1 ELSE 0 END), 0)::int AS settled_contracts,
        COALESCE(SUM(CASE WHEN status = 'active' THEN stake ELSE 0 END), 0)::float AS total_exposure
      FROM trading.binary_contracts
    `);
    return (
      result.rows[0] || {
        total_open_positions: 0,
        total_payout_exposure_kes: 0,
        platform_win_loss_ratio: 0,
        daily_volume_kes: 0,
        active_traders_24h: 0,
        high_risk_flagged_users: 0,
        open_contracts: 0,
        settled_contracts: 0,
        total_exposure: 0,
      }
    );
  }

  async getRiskExposure(): Promise<any[]> {
    const result = await this.query<any>(`
      SELECT
        ac.asset_symbol AS symbol,
        COALESCE(a.name, ac.asset_symbol) AS display_name,
        CASE WHEN ac.payout_rate <= 1 THEN ac.payout_rate * 100 ELSE ac.payout_rate END::float AS payout_rate,
        ac.min_stake::float AS min_stake,
        ac.max_stake_per_trade::float AS max_stake,
        ac.is_active,
        COALESCE(SUM(CASE WHEN c.contract_type = 'higher' AND c.status = 'active' THEN c.stake ELSE 0 END), 0)::float AS open_call_volume,
        COALESCE(SUM(CASE WHEN c.contract_type = 'lower' AND c.status = 'active' THEN c.stake ELSE 0 END), 0)::float AS open_put_volume,
        COALESCE(SUM(CASE WHEN c.status = 'active' THEN c.stake ELSE 0 END), 0)::float AS net_exposure,
        COALESCE(SUM(CASE WHEN c.status = 'active' THEN c.stake ELSE 0 END), 0)::float AS exposure
      FROM trading.asset_config ac
      LEFT JOIN trading.assets a ON ac.asset_symbol = a.symbol
      LEFT JOIN trading.binary_contracts c ON ac.asset_symbol = c.asset_symbol AND c.status = 'active'
      GROUP BY ac.asset_symbol, a.name, ac.payout_rate, ac.min_stake, ac.max_stake_per_trade, ac.is_active
      ORDER BY exposure DESC, ac.asset_symbol ASC
    `);
    return result.rows;
  }

  async updateAssetConfig(
    symbol: string,
    payload: Record<string, any>,
    updatedBy: string
  ): Promise<any> {
    let payoutRate = payload.payout_rate ?? payload.payout_ratio ?? null;
    if (payoutRate !== null && payoutRate > 1) {
      payoutRate = payoutRate / 100;
    }

    const result = await this.query<any>(
      `UPDATE trading.asset_config
       SET payout_rate = COALESCE($1, payout_rate),
           min_stake = COALESCE($2, min_stake),
           max_stake_per_trade = COALESCE($3, max_stake_per_trade),
           is_active = COALESCE($4, is_active),
           updated_by = $5
       WHERE asset_symbol = $6
       RETURNING *`,
      [
        payoutRate,
        payload.min_stake ?? null,
        payload.max_stake ?? payload.max_stake_per_trade ?? null,
        payload.is_active !== undefined && payload.is_active !== null ? payload.is_active : null,
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
      `SELECT COALESCE(SUM(stake), 0) AS volume, DATE(created_at) AS day
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
      conditions.push(`t.status = $${params.length}`);
    }

    if (filters.priority) {
      params.push(filters.priority);
      conditions.push(`t.priority = $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await this.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM admin.support_tickets t ${whereClause}`,
      params
    );

    const rowsResult = await this.query<any>(
      `SELECT t.*, u.email AS user_email, u.display_name AS user_name
       FROM admin.support_tickets t
       LEFT JOIN app_auth.users u ON t.user_id = u.id
       ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    return {
      rows: rowsResult.rows,
      total: countResult.rows[0]?.count || 0,
    };
  }

  async getSupportTicketById(id: string): Promise<any | null> {
    const result = await this.query<any>(
      `SELECT t.*, u.email AS user_email, u.display_name AS user_name
       FROM admin.support_tickets t
       LEFT JOIN app_auth.users u ON t.user_id = u.id
       WHERE t.id = $1`,
      [id]
    );
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
       SET approved_by = $1, approved_at = NOW(), status = 'approved'
       WHERE id = $2 AND status = 'pending'
       RETURNING *`,
      [approvedBy, actionId]
    );

    return result.rows[0] || null;
  }

  async getAdminActionForUpdate(id: string): Promise<any | null> {
    const result = await this.query<any>(
      `SELECT * FROM admin.admin_actions WHERE id = $1 FOR UPDATE`,
      [id]
    );
    return result.rows[0] || null;
  }

  async rejectAdminAction(id: string, adminId: string, reason: string): Promise<any> {
    const result = await this.query<any>(
      `UPDATE admin.admin_actions
       SET status = 'rejected',
           rejected_by = $1,
           rejection_reason = $2,
           rejected_at = NOW()
       WHERE id = $3 AND status = 'pending'
       RETURNING *`,
      [adminId, reason, id]
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

  async getPendingAdminActions(): Promise<any[]> {
    const result = await this.query<any>(
      `SELECT a.id,
              a.action_type,
              a.admin_id as actor_id,
              u.email as actor_email,
              'user' as target_entity,
              a.target_user_id as target_id,
              a.details,
              COALESCE(NULLIF(a.details->>'amount', '')::numeric / 130.0, 0) as amount_usd,
              a.status,
              a.created_at
       FROM admin.admin_actions a
       LEFT JOIN app_auth.users u ON a.admin_id = u.id
       WHERE a.requires_approval = true AND a.status = 'pending' AND a.approved_at IS NULL AND a.rejected_at IS NULL
       ORDER BY a.created_at DESC`
    );
    return result.rows;
  }
}
