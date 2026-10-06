import { Request, Response } from 'express';
import { AdminUserService } from '../services/AdminUserService.js';
import { AdminWalletService } from '../services/AdminWalletService.js';
import { AdminRiskService } from '../services/AdminRiskService.js';
import { AdminComplianceService } from '../services/AdminComplianceService.js';
import { AdminReportService } from '../services/AdminReportService.js';
import { AdminSupportService } from '../services/AdminSupportService.js';
import { AdminAuditService } from '../services/AdminAuditService.js';
import { AdminAuthenticatedRequest } from '../middleware/adminAuthMiddleware.js';

export class AdminController {
  private readonly users: AdminUserService;
  private readonly wallets: AdminWalletService;
  private readonly risk: AdminRiskService;
  private readonly compliance: AdminComplianceService;
  private readonly reports: AdminReportService;
  private readonly support: AdminSupportService;
  private readonly audit: AdminAuditService;

  constructor() {
    this.users = new AdminUserService();
    this.wallets = new AdminWalletService();
    this.risk = new AdminRiskService();
    this.compliance = new AdminComplianceService();
    this.reports = new AdminReportService();
    this.support = new AdminSupportService();
    this.audit = new AdminAuditService();
  }

  async listUsers(req: Request, res: Response): Promise<void> {
    const result = await this.users.listUsers({
      page: Number(req.query.page || 1),
      perPage: Number(req.query.per_page || 20),
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
    });
    res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
  }

  async getUserById(req: Request, res: Response): Promise<void> {
    const result = await this.users.getUserById(req.params.id);
    res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
  }

  async updateUserStatus(req: Request, res: Response): Promise<void> {
    const user = req as AdminAuthenticatedRequest;
    const result = await this.users.updateUserStatus(req.params.id, req.body, user.user.sub);
    res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
  }

  async getUserLedger(req: Request, res: Response): Promise<void> {
    const result = await this.users.getUserLedger(req.params.id, {
      page: Number(req.query.page || 1),
      perPage: Number(req.query.per_page || 20),
    });
    res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
  }

  async listPendingKyc(req: Request, res: Response): Promise<void> {
    const result = await this.compliance.listPendingKyc({
      page: Number(req.query.page || 1),
      perPage: Number(req.query.per_page || 20),
    });
    res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
  }

  async getKycById(req: Request, res: Response): Promise<void> {
    const result = await this.compliance.getKycById(req.params.id);
    res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
  }

  async reviewKyc(req: Request, res: Response): Promise<void> {
    const user = req as AdminAuthenticatedRequest;
    const result = await this.compliance.reviewKyc(
      req.params.id,
      req.body.action,
      req.body.note || '',
      user.user.sub
    );
    res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
  }

  async listPendingWithdrawals(req: Request, res: Response): Promise<void> {
    const result = await this.compliance.listPendingWithdrawals({
      page: Number(req.query.page || 1),
      perPage: Number(req.query.per_page || 20),
    });
    res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
  }

  async getWithdrawalById(req: Request, res: Response): Promise<void> {
    const result = await this.compliance.getWithdrawalById(req.params.id);
    res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
  }

  async approveWithdrawal(req: Request, res: Response): Promise<void> {
    const user = req as AdminAuthenticatedRequest;
    const result = await this.compliance.approveWithdrawal(
      req.params.id,
      user.user.sub,
      req.body.note || ''
    );
    res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
  }

  async rejectWithdrawal(req: Request, res: Response): Promise<void> {
    const user = req as AdminAuthenticatedRequest;
    const result = await this.compliance.rejectWithdrawal(
      req.params.id,
      user.user.sub,
      req.body.reason || ''
    );
    res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
  }

  async getRiskDashboard(req: Request, res: Response): Promise<void> {
    const result = await this.risk.getDashboard();
    res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
  }

  async getRiskExposure(req: Request, res: Response): Promise<void> {
    const result = await this.risk.getExposure();
    res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
  }

  async updateAssetConfig(req: Request, res: Response): Promise<void> {
    const user = req as AdminAuthenticatedRequest;
    const result = await this.risk.updateAssetConfig(req.params.symbol, req.body, user.user.sub);
    res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
  }

  async listSettings(req: Request, res: Response): Promise<void> {
    const result = await this.risk.listSettings();
    res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
  }

  async getSettingByKey(req: Request, res: Response): Promise<void> {
    const result = await this.risk.getSetting(req.params.key);
    res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
  }

  async updateSettings(req: Request, res: Response): Promise<void> {
    const user = req as AdminAuthenticatedRequest;
    const result = await this.risk.updateSettings(
      req.body.key,
      req.body.value,
      user.user.sub,
      req.body.reason || ''
    );
    res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
  }

  async getDailyRevenue(req: Request, res: Response): Promise<void> {
    const result = await this.reports.getDailyRevenue(
      req.query.date_from as string,
      req.query.date_to as string
    );
    res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
  }

  async getTradeVolume(req: Request, res: Response): Promise<void> {
    const result = await this.reports.getTradeVolume(
      req.query.date_from as string,
      req.query.date_to as string
    );
    res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
  }

  async getUserRegistrations(req: Request, res: Response): Promise<void> {
    const result = await this.reports.getUserRegistrations(
      req.query.date_from as string,
      req.query.date_to as string
    );
    res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
  }

  async getSettlementPerformance(req: Request, res: Response): Promise<void> {
    const result = await this.reports.getSettlementPerformance(
      req.query.date_from as string,
      req.query.date_to as string
    );
    res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
  }

  async getAuditLogs(req: Request, res: Response): Promise<void> {
    const result = await this.audit.listAuditLogs({
      actorId: typeof req.query.actor_id === 'string' ? req.query.actor_id : undefined,
      action: typeof req.query.action === 'string' ? req.query.action : undefined,
      affectedEntity:
        typeof req.query.affected_entity === 'string' ? req.query.affected_entity : undefined,
      dateFrom: typeof req.query.date_from === 'string' ? req.query.date_from : undefined,
      dateTo: typeof req.query.date_to === 'string' ? req.query.date_to : undefined,
      page: Number(req.query.page || 1),
      perPage: Number(req.query.per_page || 20),
    });
    res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
  }

  async listTickets(req: Request, res: Response): Promise<void> {
    const result = await this.support.listTickets({
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      priority: typeof req.query.priority === 'string' ? req.query.priority : undefined,
      page: Number(req.query.page || 1),
      perPage: Number(req.query.per_page || 20),
    });
    res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
  }

  async getTicketById(req: Request, res: Response): Promise<void> {
    const result = await this.support.getTicketById(req.params.id);
    res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
  }

  async updateTicket(req: Request, res: Response): Promise<void> {
    const user = req as AdminAuthenticatedRequest;
    const result = await this.support.updateTicket(req.params.id, req.body, user.user.sub);
    res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
  }

  async adjustWallet(req: Request, res: Response): Promise<void> {
    const idempotencyKey = req.get('Idempotency-Key');
    if (!idempotencyKey) {
      res.status(400).json({ error: 'Idempotency-Key header is required' });
      return;
    }

    const authReq = req as AdminAuthenticatedRequest;
    const result = await this.wallets.adjustWallet({
      actorId: authReq.user.sub,
      userId: req.body.user_id,
      amount: Number(req.body.amount),
      type: req.body.type,
      reason: req.body.reason || 'admin adjustment',
      idempotencyKey,
    });

    res
      .status(result.status === 'pending_second_approval' ? 202 : 200)
      .json({ data: result, meta: { request_id: req.correlationId } });
  }

  async approveAction(req: Request, res: Response): Promise<void> {
    const authReq = req as AdminAuthenticatedRequest;
    const result = await this.wallets.approveAction(req.params.id, authReq.user.sub);
    res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
  }

  async verifyAuditChain(req: Request, res: Response): Promise<void> {
    const result = await this.audit.verifyChain();
    res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
  }
}
