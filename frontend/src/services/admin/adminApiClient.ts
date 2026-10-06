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
  status: 'active' | 'suspended' | 'banned';
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
  win_rate_pct?: number;
  recent_trades?: Array<{
    id: string;
    symbol: string;
    amount: number;
    direction: 'call' | 'put';
    status: 'won' | 'lost' | 'pending';
    created_at: string;
  }>;
}

export interface UserLedgerEntry {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  currency: string;
  balance_after: number;
  description: string;
  reference_id?: string;
  created_at: string;
}

export interface KycApplication {
  id: string;
  user_id: string;
  user_email: string;
  user_display_name: string;
  doc_type: string;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
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
  user_email: string;
  user_display_name: string;
  amount_kes: number;
  amount_usd: number;
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
  hash: string;
  previous_hash: string;
  created_at: string;
}

export interface RiskMetrics {
  total_open_positions: number;
  total_payout_exposure_kes: number;
  platform_win_loss_ratio: number;
  daily_volume_kes: number;
  active_traders_24h: number;
  high_risk_flagged_users: number;
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
  messages: Array<{
    sender: 'user' | 'agent' | 'system';
    sender_name: string;
    message: string;
    created_at: string;
  }>;
  assigned_agent?: string;
  created_at: string;
  updated_at: string;
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
    const res = await apiClient.get<ApiResponse<{ users: UserSummary[]; pagination?: Record<string, unknown> }>>(
      `/api/v1/admin/users${query}`
    );
    return res.data;
  }

  async getUserById(id: string) {
    const res = await apiClient.get<ApiResponse<{ user: UserDetail }>>(`/api/v1/admin/users/${id}`);
    return res.data.user;
  }

  async updateUserStatus(id: string, payload: { status: string; reason: string; totp_code?: string }) {
    const headers: Record<string, string> = {};
    if (payload.totp_code) {
      headers['X-Admin-MFA-Token'] = payload.totp_code;
    }
    const res = await apiClient.put<ApiResponse<{ success: boolean; user: UserSummary }>>(
      `/api/v1/admin/users/${id}/status`,
      payload,
      { headers }
    );
    return res.data;
  }

  async getUserLedger(id: string, totp_code?: string) {
    const headers: Record<string, string> = {};
    if (totp_code) {
      headers['X-Admin-MFA-Token'] = totp_code;
    }
    const res = await apiClient.get<ApiResponse<{ ledger: UserLedgerEntry[] }>>(
      `/api/v1/admin/users/${id}/ledger`,
      { headers }
    );
    return res.data.ledger || [];
  }

  // --- KYC ---
  async getPendingKyc(totp_code?: string) {
    const headers: Record<string, string> = {};
    if (totp_code) headers['X-Admin-MFA-Token'] = totp_code;
    const res = await apiClient.get<ApiResponse<{ pending: KycApplication[] }>>(
      `/api/v1/admin/kyc/pending`,
      { headers }
    );
    return res.data.pending || [];
  }

  async getKycById(id: string, totp_code?: string) {
    const headers: Record<string, string> = {};
    if (totp_code) headers['X-Admin-MFA-Token'] = totp_code;
    const res = await apiClient.get<ApiResponse<{ application: KycApplication }>>(
      `/api/v1/admin/kyc/${id}`,
      { headers }
    );
    return res.data.application;
  }

  async reviewKyc(id: string, payload: { status: 'approved' | 'rejected'; review_notes: string; totp_code?: string }) {
    const headers: Record<string, string> = {};
    if (payload.totp_code) headers['X-Admin-MFA-Token'] = payload.totp_code;
    const res = await apiClient.put<ApiResponse<{ success: boolean }>>(
      `/api/v1/admin/kyc/${id}/review`,
      payload,
      { headers }
    );
    return res.data;
  }

  // --- Finance & Withdrawals ---
  async getPendingWithdrawals(totp_code?: string) {
    const headers: Record<string, string> = {};
    if (totp_code) headers['X-Admin-MFA-Token'] = totp_code;
    const res = await apiClient.get<ApiResponse<{ withdrawals: WithdrawalRequest[] }>>(
      `/api/v1/admin/withdrawals/pending`,
      { headers }
    );
    return res.data.withdrawals || [];
  }

  async getWithdrawalById(id: string, totp_code?: string) {
    const headers: Record<string, string> = {};
    if (totp_code) headers['X-Admin-MFA-Token'] = totp_code;
    const res = await apiClient.get<ApiResponse<{ withdrawal: WithdrawalRequest }>>(
      `/api/v1/admin/withdrawals/${id}`,
      { headers }
    );
    return res.data.withdrawal;
  }

  async approveWithdrawal(id: string, payload: { totp_code?: string }) {
    const headers: Record<string, string> = {};
    if (payload.totp_code) headers['X-Admin-MFA-Token'] = payload.totp_code;
    const res = await apiClient.put<ApiResponse<{ success: boolean; tx_hash?: string }>>(
      `/api/v1/admin/withdrawals/${id}/approve`,
      payload,
      { headers }
    );
    return res.data;
  }

  async rejectWithdrawal(id: string, payload: { reason: string; totp_code?: string }) {
    const headers: Record<string, string> = {};
    if (payload.totp_code) headers['X-Admin-MFA-Token'] = payload.totp_code;
    const res = await apiClient.put<ApiResponse<{ success: boolean }>>(
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

    const res = await apiClient.post<ApiResponse<{ success: boolean; pending_four_eyes?: boolean; action_id?: string }>>(
      `/api/v1/admin/wallets/adjust`,
      payload,
      { headers }
    );
    return res.data;
  }

  async approveAction(id: string, payload: { totp_code?: string }) {
    const headers: Record<string, string> = {};
    if (payload.totp_code) headers['X-Admin-MFA-Token'] = payload.totp_code;
    const res = await apiClient.put<ApiResponse<{ success: boolean; action?: PendingAction }>>(
      `/api/v1/admin/actions/${id}/approve`,
      payload,
      { headers }
    );
    return res.data;
  }

  // --- Risk & Asset Config ---
  async getRiskDashboard(totp_code?: string) {
    const headers: Record<string, string> = {};
    if (totp_code) headers['X-Admin-MFA-Token'] = totp_code;
    const res = await apiClient.get<ApiResponse<{ risk_metrics: RiskMetrics }>>(
      `/api/v1/admin/risk/dashboard`,
      { headers }
    );
    return res.data.risk_metrics;
  }

  async getRiskExposure(totp_code?: string) {
    const headers: Record<string, string> = {};
    if (totp_code) headers['X-Admin-MFA-Token'] = totp_code;
    const res = await apiClient.get<ApiResponse<{ exposure: SymbolExposure[] }>>(
      `/api/v1/admin/risk/exposure`,
      { headers }
    );
    return res.data.exposure || [];
  }

  async updateAssetConfig(symbol: string, payload: Partial<AssetConfig> & { totp_code?: string }) {
    const headers: Record<string, string> = {};
    if (payload.totp_code) headers['X-Admin-MFA-Token'] = payload.totp_code;
    const res = await apiClient.put<ApiResponse<{ success: boolean; config: AssetConfig }>>(
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
    const res = await apiClient.get<ApiResponse<{ logs: AuditLogItem[]; total: number }>>(
      `/api/v1/admin/audit-logs${query}`,
      { headers }
    );
    return res.data;
  }

  async verifyAuditChain(totp_code?: string) {
    const headers: Record<string, string> = {};
    if (totp_code) headers['X-Admin-MFA-Token'] = totp_code;
    const res = await apiClient.get<ApiResponse<{ valid: boolean; broken_at_id?: string; total_verified?: number }>>(
      `/api/v1/admin/audit-chain/verify`,
      { headers }
    );
    return res.data;
  }

  // --- Support ---
  async getTickets(params: { status?: string; priority?: string; page?: number; limit?: number }, totp_code?: string) {
    const headers: Record<string, string> = {};
    if (totp_code) headers['X-Admin-MFA-Token'] = totp_code;
    const query = this.formatQuery(params);
    const res = await apiClient.get<ApiResponse<{ tickets: SupportTicket[] }>>(
      `/api/v1/admin/support/tickets${query}`,
      { headers }
    );
    return res.data.tickets || [];
  }

  async getTicketById(id: string, totp_code?: string) {
    const headers: Record<string, string> = {};
    if (totp_code) headers['X-Admin-MFA-Token'] = totp_code;
    const res = await apiClient.get<ApiResponse<{ ticket: SupportTicket }>>(
      `/api/v1/admin/support/tickets/${id}`,
      { headers }
    );
    return res.data.ticket;
  }

  async updateTicket(
    id: string,
    payload: { status?: string; priority?: string; response_message?: string; agent_notes?: string; totp_code?: string }
  ) {
    const headers: Record<string, string> = {};
    if (payload.totp_code) headers['X-Admin-MFA-Token'] = payload.totp_code;
    const res = await apiClient.put<ApiResponse<{ success: boolean; ticket: SupportTicket }>>(
      `/api/v1/admin/support/tickets/${id}`,
      payload,
      { headers }
    );
    return res.data;
  }

  // --- Reports & Analytics ---
  async getDailyRevenue(totp_code?: string) {
    const headers: Record<string, string> = {};
    if (totp_code) headers['X-Admin-MFA-Token'] = totp_code;
    const res = await apiClient.get<ApiResponse<{ daily_revenue: RevenueDataPoint[] }>>(
      `/api/v1/admin/reports/daily-revenue`,
      { headers }
    );
    return res.data.daily_revenue || [];
  }

  async getTradeVolume(totp_code?: string) {
    const headers: Record<string, string> = {};
    if (totp_code) headers['X-Admin-MFA-Token'] = totp_code;
    const res = await apiClient.get<ApiResponse<{ trade_volume: VolumeDataPoint[] }>>(
      `/api/v1/admin/reports/trade-volume`,
      { headers }
    );
    return res.data.trade_volume || [];
  }

  async getUserRegistrations(totp_code?: string) {
    const headers: Record<string, string> = {};
    if (totp_code) headers['X-Admin-MFA-Token'] = totp_code;
    const res = await apiClient.get<ApiResponse<{ registrations: RegistrationDataPoint[] }>>(
      `/api/v1/admin/reports/user-registrations`,
      { headers }
    );
    return res.data.registrations || [];
  }

  async getSettlementPerformance(totp_code?: string) {
    const headers: Record<string, string> = {};
    if (totp_code) headers['X-Admin-MFA-Token'] = totp_code;
    const res = await apiClient.get<ApiResponse<{ settlement_metrics: SettlementPerformancePoint[] }>>(
      `/api/v1/admin/reports/settlement-performance`,
      { headers }
    );
    return res.data.settlement_metrics || [];
  }

  // --- Platform Settings ---
  async getSettings(totp_code?: string) {
    const headers: Record<string, string> = {};
    if (totp_code) headers['X-Admin-MFA-Token'] = totp_code;
    const res = await apiClient.get<ApiResponse<{ settings: PlatformSetting[] }>>(
      `/api/v1/admin/settings`,
      { headers }
    );
    return res.data.settings || [];
  }

  async updateSettings(settings: Record<string, unknown>, totp_code?: string) {
    const headers: Record<string, string> = {};
    if (totp_code) headers['X-Admin-MFA-Token'] = totp_code;
    const res = await apiClient.put<ApiResponse<{ success: boolean; settings?: PlatformSetting[] }>>(
      `/api/v1/admin/settings`,
      { settings },
      { headers }
    );
    return res.data;
  }
}

export const adminApiClient = new AdminApiClient();
