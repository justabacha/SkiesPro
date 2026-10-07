import { apiClient } from '@/shared/services/apiClient';

export interface ApiResponse<T> {
  data: T;
  meta?: {
    request_id?: string;
    page?: number;
    per_page?: number;
    total?: number;
    total_pages?: number;
  };
}

export interface UserSummary {
  id: string;
  email: string;
  display_name: string;
  role: string;
  status: 'active' | 'suspended' | 'banned' | 'closed';
  kyc_level?: string;
  kyc_status?: string;
  created_at: string;
  last_login_at?: string;
}

export interface UserDetail extends UserSummary {
  phone?: string;
  wallet_balance_kes?: number;
  wallet_balance_usd?: number;
  demo_balance_kes?: number;
  total_trades?: number;
  win_rate_pct?: number | null;
  wallet?: {
    real_balance: number;
    available_balance: number;
    demo_balance: number;
  };
  recent_trades?: Array<{
    id: string;
    asset_pair?: string;
    symbol?: string;
    amount: number | string;
    payout?: number | string;
    direction: string;
    result?: string;
    status: string;
    created_at: string;
  }>;
}

export interface UserLedgerEntry {
  id: string;
  user_id: string;
  type: string;
  amount: number | string;
  currency: string;
  balance_after: number | string;
  description?: string | null;
  reference_type?: string;
  reference_id?: string;
  created_at: string;
}

export interface KycApplication {
  id: string;
  user_id: string;
  user_email?: string;
  user_display_name?: string;
  doc_type: string;
  status: 'pending' | 'approved' | 'rejected' | 'review_required';
  submitted_at: string;
  created_at?: string;
  doc_number?: string;
  id_front_url?: string;
  id_back_url?: string;
  selfie_url?: string;
  proof_of_address_url?: string;
  review_notes?: string;
}

export interface WithdrawalRequest {
  id: string;
  user_id: string;
  user_email?: string;
  user_display_name?: string;
  amount_kes: number;
  amount?: number | string;
  net_amount?: number | string;
  amount_usd?: number;
  phone_number: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'failed';
  created_at: string;
  tx_hash?: string;
  rejection_reason?: string;
}

export interface PendingAction {
  id: string;
  action_type: string;
  actor_id: string;
  actor_email?: string;
  target_entity: string;
  target_id: string;
  details: Record<string, unknown>;
  amount_usd?: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface AuditLogItem {
  id: string;
  actor_id: string;
  actor_email?: string;
  action: string;
  target_entity: string;
  target_id?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  hash?: string;
  entry_hash?: string;
  previous_hash?: string;
  previous_entry_hash?: string;
  created_at: string;
}

export interface RiskMetrics {
  total_open_positions: number;
  total_payout_exposure_kes: number;
  platform_win_loss_ratio: number;
  daily_volume_kes: number;
  active_traders_24h: number;
  high_risk_flagged_users: number;
  open_contracts?: number;
  settled_contracts?: number;
  total_exposure?: number;
}

export interface SymbolExposure {
  symbol: string;
  display_name: string;
  open_call_volume: number;
  open_put_volume: number;
  net_exposure: number;
  max_exposure: number;
  payout_rate: number;
  is_active: boolean;
  min_stake: number;
  max_stake: number;
  exposure?: number;
}

export interface AssetConfig {
  symbol: string;
  display_name?: string;
  payout_rate: number;
  min_stake: number;
  max_stake: number;
  is_active: boolean;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  user_email: string;
  subject: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  messages?: Array<{
    sender: 'user' | 'agent' | 'system';
    sender_name: string;
    message: string;
    created_at: string;
  }>;
  assigned_agent?: string;
  created_at: string;
  updated_at?: string;
}

export interface RevenueDataPoint {
  date: string;
  revenue_kes: number;
  revenue_usd: number;
  gross_profit: number;
}

export interface VolumeDataPoint {
  date: string;
  volume_kes: number;
  trade_count: number;
}

export interface RegistrationDataPoint {
  date: string;
  count: number;
}

export interface SettlementPerformancePoint {
  timestamp: string;
  avg_latency_ms: number;
  processed_count: number;
  error_count: number;
}

export interface PlatformSetting {
  key: string;
  value: unknown;
  description?: string;
  category?: string;
  updated_at?: string;
  updated_by?: string;
}

class AdminApiClient {
  private formatQuery(params: Record<string, string | number | boolean | undefined>): string {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
  }

  // --- Users ---
  async getUsers(params: { search?: string; status?: string; role?: string; page?: number; limit?: number }) {
    const query = this.formatQuery(params);
    const res = await apiClient.get<ApiResponse<{ rows: UserSummary[]; total: number } | UserSummary[]>>(
      `/api/v1/admin/users${query}`
    );
    const data = res.data;
    if (Array.isArray(data)) {
      return { rows: data, total: data.length };
    }
    if (data && typeof data === 'object' && Array.isArray((data as any).rows)) {
      return { rows: (data as any).rows, total: (data as any).total ?? (data as any).rows.length };
    }
    return { rows: [], total: 0 };
  }

  async getUserById(id: string): Promise<UserDetail> {
    const res = await apiClient.get<ApiResponse<UserDetail | { user: UserDetail }>>(`/api/v1/admin/users/${id}`);
    const d = res.data;
    if (d && typeof d === 'object' && 'user' in d && (d as any).user) {
      return (d as any).user as UserDetail;
    }
    return d as UserDetail;
  }

  async updateUserStatus(id: string, payload: { status: string; reason: string; totp_code?: string }) {
    const headers: Record<string, string> = {};
    if (payload.totp_code) {
      headers['X-Admin-MFA-Token'] = payload.totp_code;
    }
    const res = await apiClient.put<ApiResponse<UserSummary>>(
      `/api/v1/admin/users/${id}/status`,
      payload,
      { headers }
    );
    return res.data;
  }

  async getUserLedger(id: string, totp_code?: string): Promise<UserLedgerEntry[]> {
    const headers: Record<string, string> = {};
    if (totp_code) {
      headers['X-Admin-MFA-Token'] = totp_code;
    }
    const res = await apiClient.get<ApiResponse<{ rows: UserLedgerEntry[]; total: number } | UserLedgerEntry[]>>(
      `/api/v1/admin/users/${id}/ledger`,
      { headers }
    );
    const data = res.data;
    if (Array.isArray(data)) {
      return data;
    }
    if (data && typeof data === 'object' && Array.isArray((data as any).rows)) {
      return (data as any).rows;
    }
    if (Array.isArray(res)) {
      return res as unknown as UserLedgerEntry[];
    }
    return [];
  }

  // --- KYC ---
  async getPendingKyc(totp_code?: string) {
    const headers: Record<string, string> = {};
    if (totp_code) headers['X-Admin-MFA-Token'] = totp_code;
    const res = await apiClient.get<ApiResponse<{ rows: KycApplication[]; total: number }>>(
      `/api/v1/admin/kyc/pending`,
      { headers }
    );
    return res.data?.rows || [];
  }

  async getKycById(id: string, totp_code?: string) {
    const headers: Record<string, string> = {};
    if (totp_code) headers['X-Admin-MFA-Token'] = totp_code;
    const res = await apiClient.get<ApiResponse<KycApplication>>(
      `/api/v1/admin/kyc/${id}`,
      { headers }
    );
    return res.data;
  }

  async reviewKyc(id: string, payload: { status: 'approved' | 'rejected'; review_notes: string; totp_code?: string }) {
    const headers: Record<string, string> = {};
    if (payload.totp_code) headers['X-Admin-MFA-Token'] = payload.totp_code;
    const res = await apiClient.put<ApiResponse<unknown>>(
      `/api/v1/admin/kyc/${id}/review`,
      { action: payload.status, note: payload.review_notes },
      { headers }
    );
    return res.data;
  }

  // --- Finance & Withdrawals ---
  async getPendingWithdrawals(totp_code?: string) {
    const headers: Record<string, string> = {};
    if (totp_code) headers['X-Admin-MFA-Token'] = totp_code;
    const res = await apiClient.get<ApiResponse<{ rows: WithdrawalRequest[]; total: number }>>(
      `/api/v1/admin/withdrawals/pending`,
      { headers }
    );
    return res.data?.rows || [];
  }

  async getWithdrawalById(id: string, totp_code?: string) {
    const headers: Record<string, string> = {};
    if (totp_code) headers['X-Admin-MFA-Token'] = totp_code;
    const res = await apiClient.get<ApiResponse<WithdrawalRequest>>(
      `/api/v1/admin/withdrawals/${id}`,
      { headers }
    );
    return res.data;
  }

  async approveWithdrawal(id: string, payload: { totp_code?: string }) {
    const headers: Record<string, string> = {};
    if (payload.totp_code) headers['X-Admin-MFA-Token'] = payload.totp_code;
    const res = await apiClient.put<ApiResponse<unknown>>(
      `/api/v1/admin/withdrawals/${id}/approve`,
      payload,
      { headers }
    );
    return res.data;
  }

  async rejectWithdrawal(id: string, payload: { reason: string; totp_code?: string }) {
    const headers: Record<string, string> = {};
    if (payload.totp_code) headers['X-Admin-MFA-Token'] = payload.totp_code;
    const res = await apiClient.put<ApiResponse<unknown>>(
      `/api/v1/admin/withdrawals/${id}/reject`,
      payload,
      { headers }
    );
    return res.data;
  }

  async adjustWallet(payload: {
    user_id: string;
    amount: number;
    currency: string;
    direction: 'credit' | 'debit';
    reason: string;
    idempotency_key?: string;
    totp_code?: string;
  }) {
    const headers: Record<string, string> = {};
    if (payload.totp_code) headers['X-Admin-MFA-Token'] = payload.totp_code;
    if (payload.idempotency_key) headers['Idempotency-Key'] = payload.idempotency_key;

    const res = await apiClient.post<ApiResponse<{ status: string; actionId?: string; amount?: number; type?: string; userId?: string }>>(
      `/api/v1/admin/wallets/adjust`,
      {
        user_id: payload.user_id,
        amount: payload.amount,
        type: payload.direction,
        reason: payload.reason,
      },
      { headers }
    );
    return res.data;
  }

  async approveAction(id: string, payload: { totp_code?: string }) {
    const headers: Record<string, string> = {};
    if (payload.totp_code) headers['X-Admin-MFA-Token'] = payload.totp_code;
    const res = await apiClient.put<ApiResponse<unknown>>(
      `/api/v1/admin/actions/${id}/approve`,
      payload,
      { headers }
    );
    return res.data;
  }

  // --- Risk & Asset Config ---
  async getRiskDashboard(totp_code?: string): Promise<RiskMetrics> {
    const headers: Record<string, string> = {};
    if (totp_code) headers['X-Admin-MFA-Token'] = totp_code;
    const res = await apiClient.get<ApiResponse<{ open_contracts?: number; settled_contracts?: number; total_exposure?: number }>>(
      `/api/v1/admin/risk/dashboard`,
      { headers }
    );
    const d = res.data || {};
    const openPositions = Number(d.open_contracts || 0);
    const totalExposure = Number(d.total_exposure || 0);
    return {
      total_open_positions: openPositions,
      total_payout_exposure_kes: totalExposure,
      platform_win_loss_ratio: 0.5,
      daily_volume_kes: totalExposure,
      active_traders_24h: 0,
      high_risk_flagged_users: 0,
      open_contracts: openPositions,
      settled_contracts: Number(d.settled_contracts || 0),
      total_exposure: totalExposure,
    };
  }

  async getRiskExposure(totp_code?: string): Promise<SymbolExposure[]> {
    const headers: Record<string, string> = {};
    if (totp_code) headers['X-Admin-MFA-Token'] = totp_code;
    const res = await apiClient.get<ApiResponse<Array<{ symbol: string; exposure?: number; display_name?: string; payout_rate?: number; open_call_volume?: number; open_put_volume?: number; net_exposure?: number; min_stake?: number; max_stake?: number; is_active?: boolean }>>>(
      `/api/v1/admin/risk/exposure`,
      { headers }
    );
    const list = Array.isArray(res.data) ? res.data : [];
    return list.map((item) => ({
      symbol: item.symbol,
      display_name: item.display_name || item.symbol,
      open_call_volume: item.open_call_volume ?? 0,
      open_put_volume: item.open_put_volume ?? 0,
      net_exposure: item.net_exposure ?? Number(item.exposure || 0),
      max_exposure: Number(item.exposure || 0),
      payout_rate: item.payout_rate ?? 80,
      is_active: item.is_active ?? true,
      min_stake: item.min_stake ?? 10,
      max_stake: item.max_stake ?? 1000,
      exposure: Number(item.exposure || 0),
    }));
  }

  async updateAssetConfig(symbol: string, payload: Partial<AssetConfig> & { totp_code?: string }) {
    const headers: Record<string, string> = {};
    if (payload.totp_code) headers['X-Admin-MFA-Token'] = payload.totp_code;
    const res = await apiClient.put<ApiResponse<AssetConfig>>(
      `/api/v1/admin/risk/asset-config/${symbol}`,
      payload,
      { headers }
    );
    return res.data;
  }

  // --- Audit Logs ---
  async getAuditLogs(params: { actor_id?: string; action?: string; limit?: number; offset?: number }, totp_code?: string) {
    const headers: Record<string, string> = {};
    if (totp_code) headers['X-Admin-MFA-Token'] = totp_code;
    const query = this.formatQuery(params);
    const res = await apiClient.get<ApiResponse<{ rows: AuditLogItem[]; total: number }>>(
      `/api/v1/admin/audit-logs${query}`,
      { headers }
    );
    return res.data || { rows: [], total: 0 };
  }

  async verifyAuditChain(totp_code?: string) {
    const headers: Record<string, string> = {};
    if (totp_code) headers['X-Admin-MFA-Token'] = totp_code;
    const res = await apiClient.get<ApiResponse<{ valid: boolean; checked: number; mismatches: string[] }>>(
      `/api/v1/admin/audit-chain/verify`,
      { headers }
    );
    const d = res.data || {};
    return {
      valid: Boolean(d.valid),
      total_verified: Number(d.checked || 0),
      broken_at_id: d.mismatches && d.mismatches.length > 0 ? d.mismatches[0] : undefined,
      checked: Number(d.checked || 0),
      mismatches: d.mismatches || [],
    };
  }

  // --- Support ---
  async getTickets(params: { status?: string; priority?: string; page?: number; limit?: number }, totp_code?: string) {
    const headers: Record<string, string> = {};
    if (totp_code) headers['X-Admin-MFA-Token'] = totp_code;
    const query = this.formatQuery(params);
    const res = await apiClient.get<ApiResponse<{ rows: SupportTicket[]; total: number }>>(
      `/api/v1/admin/support/tickets${query}`,
      { headers }
    );
    return res.data?.rows || [];
  }

  async getTicketById(id: string, totp_code?: string) {
    const headers: Record<string, string> = {};
    if (totp_code) headers['X-Admin-MFA-Token'] = totp_code;
    const res = await apiClient.get<ApiResponse<SupportTicket>>(
      `/api/v1/admin/support/tickets/${id}`,
      { headers }
    );
    return res.data;
  }

  async updateTicket(
    id: string,
    payload: { status?: string; priority?: string; response_message?: string; agent_notes?: string; totp_code?: string }
  ) {
    const headers: Record<string, string> = {};
    if (payload.totp_code) headers['X-Admin-MFA-Token'] = payload.totp_code;
    const bodyPayload: Record<string, unknown> = {};
    if (payload.status) bodyPayload.status = payload.status;
    if (payload.response_message) bodyPayload.response = payload.response_message;

    const res = await apiClient.put<ApiResponse<SupportTicket>>(
      `/api/v1/admin/support/tickets/${id}`,
      bodyPayload,
      { headers }
    );
    return res.data;
  }

  // --- Reports & Analytics ---
  async getDailyRevenue(totp_code?: string): Promise<RevenueDataPoint[]> {
    const headers: Record<string, string> = {};
    if (totp_code) headers['X-Admin-MFA-Token'] = totp_code;
    const res = await apiClient.get<ApiResponse<{ revenue: Array<{ revenue: number | string; day: string }> }>>(
      `/api/v1/admin/reports/daily-revenue`,
      { headers }
    );
    const list = res.data?.revenue || [];
    return list.map((item) => {
      const rev = Number(item.revenue || 0);
      return {
        date: String(item.day || ''),
        revenue_kes: rev,
        revenue_usd: Math.round(rev / 130),
        gross_profit: rev,
      };
    });
  }

  async getTradeVolume(totp_code?: string): Promise<VolumeDataPoint[]> {
    const headers: Record<string, string> = {};
    if (totp_code) headers['X-Admin-MFA-Token'] = totp_code;
    const res = await apiClient.get<ApiResponse<{ volume: Array<{ volume: number | string; day: string; count?: number }> }>>(
      `/api/v1/admin/reports/trade-volume`,
      { headers }
    );
    const list = res.data?.volume || [];
    return list.map((item) => ({
      date: String(item.day || ''),
      volume_kes: Number(item.volume || 0),
      trade_count: Number(item.count || 0),
    }));
  }

  async getUserRegistrations(totp_code?: string): Promise<RegistrationDataPoint[]> {
    const headers: Record<string, string> = {};
    if (totp_code) headers['X-Admin-MFA-Token'] = totp_code;
    const res = await apiClient.get<ApiResponse<{ registrations: Array<{ users: number; day: string }> }>>(
      `/api/v1/admin/reports/user-registrations`,
      { headers }
    );
    const list = res.data?.registrations || [];
    return list.map((item) => ({
      date: String(item.day || ''),
      count: Number(item.users || 0),
    }));
  }

  async getSettlementPerformance(totp_code?: string): Promise<SettlementPerformancePoint[]> {
    const headers: Record<string, string> = {};
    if (totp_code) headers['X-Admin-MFA-Token'] = totp_code;
    const res = await apiClient.get<ApiResponse<{ settlement: Array<{ total_settlements: number; day: string }> }>>(
      `/api/v1/admin/reports/settlement-performance`,
      { headers }
    );
    const list = res.data?.settlement || [];
    return list.map((item) => ({
      timestamp: String(item.day || ''),
      processed_count: Number(item.total_settlements || 0),
      avg_latency_ms: 120,
      error_count: 0,
    }));
  }

  // --- Platform Settings ---
  async getSettings(totp_code?: string): Promise<PlatformSetting[]> {
    const headers: Record<string, string> = {};
    if (totp_code) headers['X-Admin-MFA-Token'] = totp_code;
    const res = await apiClient.get<ApiResponse<PlatformSetting[]>>(
      `/api/v1/admin/settings`,
      { headers }
    );
    return Array.isArray(res.data) ? res.data : [];
  }

  async updateSettings(
    payload: { key: string; value: unknown; reason?: string } | Record<string, unknown>,
    totp_code?: string
  ) {
    const headers: Record<string, string> = {};
    if (totp_code) headers['X-Admin-MFA-Token'] = totp_code;

    if (typeof payload === 'object' && payload !== null && 'key' in payload) {
      const p = payload as { key: string; value: unknown; reason?: string };
      const res = await apiClient.put<ApiResponse<PlatformSetting>>(
        `/api/v1/admin/settings`,
        { key: p.key, value: p.value, reason: p.reason || 'Admin platform setting update' },
        { headers }
      );
      return res.data;
    }

    const entries = Object.entries(payload as Record<string, unknown>);
    let lastRes: unknown = null;
    for (const [key, value] of entries) {
      const res = await apiClient.put<ApiResponse<PlatformSetting>>(
        `/api/v1/admin/settings`,
        { key, value, reason: 'Admin platform setting update' },
        { headers }
      );
      lastRes = res.data;
    }
    return lastRes;
  }
}

export const adminApiClient = new AdminApiClient();
