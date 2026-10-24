import { Request, Response } from 'express';
import { logger } from '../../../shared/middleware/logger.js';
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

  private async respondToAdminAction<T>(
    req: Request,
    res: Response,
    action: string,
    operation: () => Promise<T>,
    status: number | ((result: T) => number) = 200
  ): Promise<void> {
    try {
      const result = await operation();
      const responseStatus = typeof status === 'function' ? status(result) : status;
      res.status(responseStatus).json({ data: result, meta: { request_id: req.correlationId } });
    } catch (error) {
      logger.error(`${action} failed`, {
        error: error instanceof Error ? error.message : String(error),
        request_id: req.correlationId,
      });
      res.status(500).json({ error: 'Internal server error', code: 'ADMIN_ACTION_FAILED' });
    }
  }

  async listUsers(req: Request, res: Response): Promise<void> {
    return this.respondToAdminAction(req, res, 'Admin user list', () =>
      this.users.listUsers({
        page: Number(req.query.page || 1),
        perPage: Number(req.query.per_page || 20),
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        role: typeof req.query.role === 'string' ? req.query.role : undefined,
      })
    );
  }

  async getUserById(req: Request, res: Response): Promise<void> {
    return this.respondToAdminAction(req, res, 'Admin user lookup', () =>
      this.users.getUserById(req.params.id)
    );
  }

  async updateUserStatus(req: Request, res: Response): Promise<void> {
    const user = req as AdminAuthenticatedRequest;
    return this.respondToAdminAction(req, res, 'Admin user status update', () =>
      this.users.updateUserStatus(req.params.id, req.body, user.user.sub)
    );
  }

  async getUserLedger(req: Request, res: Response): Promise<void> {
    return this.respondToAdminAction(req, res, 'Admin user ledger fetch', () =>
      this.users.getUserLedger(req.params.id, {
        page: Number(req.query.page || 1),
        perPage: Number(req.query.per_page || 20),
      })
    );
  }

  async listPendingKyc(req: Request, res: Response): Promise<void> {
    return this.respondToAdminAction(req, res, 'Admin KYC list', () =>
      this.compliance.listPendingKyc({
        page: Number(req.query.page || 1),
        perPage: Number(req.query.per_page || 20),
        status: typeof req.query.status === 'string' ? req.query.status : 'pending',
      })
    );
  }

  async getKycById(req: Request, res: Response): Promise<void> {
    return this.respondToAdminAction(req, res, 'Admin KYC lookup', () =>
      this.compliance.getKycById(req.params.id)
    );
  }

  async reviewKyc(req: Request, res: Response): Promise<void> {
    const user = req as AdminAuthenticatedRequest;
    return this.respondToAdminAction(req, res, 'Admin KYC review', () =>
      this.compliance.reviewKyc(req.params.id, req.body.action, req.body.note || '', user.user.sub)
    );
  }

  async listWithdrawals(req: Request, res: Response): Promise<void> {
    return this.respondToAdminAction(req, res, 'Admin withdrawal list', () =>
      this.compliance.listWithdrawals({
        page: Number(req.query.page || 1),
        perPage: Number(req.query.per_page || 20),
        status: typeof req.query.status === 'string' ? req.query.status : 'pending',
      })
    );
  }

  async listPendingWithdrawals(req: Request, res: Response): Promise<void> {
    return this.respondToAdminAction(req, res, 'Admin pending withdrawal list', () =>
      this.compliance.listPendingWithdrawals({
        page: Number(req.query.page || 1),
        perPage: Number(req.query.per_page || 20),
      })
    );
  }

  async getWithdrawalById(req: Request, res: Response): Promise<void> {
    return this.respondToAdminAction(req, res, 'Admin withdrawal lookup', () =>
      this.compliance.getWithdrawalById(req.params.id)
    );
  }

  async approveWithdrawal(req: Request, res: Response): Promise<void> {
    const user = req as AdminAuthenticatedRequest;
    return this.respondToAdminAction(req, res, 'Admin withdrawal approval', () =>
      this.compliance.approveWithdrawal(req.params.id, user.user.sub, req.body.note || '')
    );
  }

  async rejectWithdrawal(req: Request, res: Response): Promise<void> {
    const user = req as AdminAuthenticatedRequest;
    return this.respondToAdminAction(req, res, 'Admin withdrawal rejection', () =>
      this.compliance.rejectWithdrawal(req.params.id, user.user.sub, req.body.reason || '')
    );
  }

  async listPendingActions(req: Request, res: Response): Promise<void> {
    return this.respondToAdminAction(req, res, 'Admin pending actions list', () =>
      this.wallets.listPendingActions()
    );
  }

  async updateAssetConfig(req: Request, res: Response): Promise<void> {
    const user = req as AdminAuthenticatedRequest;
    return this.respondToAdminAction(req, res, 'Admin asset configuration update', () =>
      this.risk.updateAssetConfig(req.params.symbol, req.body, user.user.sub)
    );
  }

  async adjustWallet(req: Request, res: Response): Promise<void> {
    const idempotencyKey = req.get('Idempotency-Key');
    if (!idempotencyKey) {
      res.status(400).json({ error: 'Idempotency-Key header is required' });
      return;
    }
    const authReq = req as AdminAuthenticatedRequest;
    return this.respondToAdminAction(
      req,
      res,
      'Admin wallet adjustment',
      () =>
        this.wallets.adjustWallet({
          actorId: authReq.user.sub,
          userId: req.body.user_id,
          amount: Number(req.body.amount),
          type: req.body.type,
          reason: req.body.reason || 'admin adjustment',
          idempotencyKey,
        }),
      (result) => result.status === 'pending_second_approval' ? 202 : 200
    );
  }

  async approveAction(req: Request, res: Response): Promise<void> {
    const authReq = req as AdminAuthenticatedRequest;
    return this.respondToAdminAction(req, res, 'Admin action approval', () =>
      this.wallets.approveAction(req.params.id, authReq.user.sub)
    );
  }

  async retryWithdrawal(req: Request, res: Response): Promise<void> {
    const user = req as AdminAuthenticatedRequest;
    try {
      const result = await this.compliance.retryWithdrawal(req.params.id, user.user.sub);
      res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
    } catch (error: any) {
      const isConflict =
        error.message.includes('Cannot retry') ||
        error.message.includes('limit') ||
        error.message.includes('Insufficient');
      res.status(isConflict ? 409 : 400).json({ error: error.message });
    }
  }

  async forceCompleteWithdrawal(req: Request, res: Response): Promise<void> {
    const user = req as AdminAuthenticatedRequest;
    try {
      const result = await this.compliance.forceCompleteWithdrawal(
        req.params.id,
        user.user.sub,
        req.body.mpesaReceipt,
        req.body.note
      );
      res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
    } catch (error: any) {
      const isConflict =
        error.message.includes('Cannot force-complete') || error.message.includes('outbox');
      res.status(isConflict ? 409 : 400).json({ error: error.message });
    }
  }

  async forceRefundWithdrawal(req: Request, res: Response): Promise<void> {
    const user = req as AdminAuthenticatedRequest;
    try {
      const result = await this.compliance.forceRefundWithdrawal(
        req.params.id,
        user.user.sub,
        req.body.reason
      );
      res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
    } catch (error: any) {
      const isConflict =
        error.message.includes('Cannot force-refund') || error.message.includes('outbox');
      res.status(isConflict ? 409 : 400).json({ error: error.message });
    }
  }

  async getRiskDashboard(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.risk.getDashboard();
      res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
    } catch (error: any) {
      logger.error('Risk dashboard fetch failed', { error: error.message, code: error.code });
      res.status(500).json({ error: 'Internal server error', code: 'RISK_FETCH_FAILED' });
    }
  }

  async getRiskExposure(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.risk.getExposure();
      res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
    } catch (error: any) {
      logger.error('Risk exposure fetch failed', { error: error.message, code: error.code });
      res.status(500).json({ error: 'Internal server error', code: 'RISK_FETCH_FAILED' });
    }
  }

  async listSettings(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.risk.listSettings();
      res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
    } catch (error) {
      logger.error('Platform settings list failed', {
        error: error instanceof Error ? error.message : String(error),
        request_id: req.correlationId,
      });
      res.status(500).json({ error: 'Internal server error', code: 'SETTINGS_ACTION_FAILED' });
    }
  }

  async getSettingByKey(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.risk.getSetting(req.params.key);
      res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
    } catch (error) {
      logger.error('Platform setting fetch failed', {
        error: error instanceof Error ? error.message : String(error),
        request_id: req.correlationId,
      });
      res.status(500).json({ error: 'Internal server error', code: 'SETTINGS_ACTION_FAILED' });
    }
  }

  async updateSettings(req: Request, res: Response): Promise<void> {
    const user = req as AdminAuthenticatedRequest;
    try {
      const settings = Array.isArray(req.body) ? req.body : [req.body];
      const reason = Array.isArray(req.body)
        ? 'Admin platform setting update'
        : req.body.reason || 'Admin platform setting update';
      const result = await this.risk.updateSettingsBatch(settings, user.user.sub, reason);
      res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
    } catch (error) {
      logger.error('Platform settings update failed', {
        error: error instanceof Error ? error.message : String(error),
        request_id: req.correlationId,
      });
      res.status(500).json({ error: 'Internal server error', code: 'SETTINGS_ACTION_FAILED' });
    }
  }

  async getDailyRevenue(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.reports.getDailyRevenue(
        req.query.date_from as string,
        req.query.date_to as string
      );
      res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
    } catch (error) {
      logger.error('Daily revenue report fetch failed', {
        error: error instanceof Error ? error.message : String(error),
        request_id: req.correlationId,
      });
      res.status(500).json({ error: 'Internal server error', code: 'REPORT_FETCH_FAILED' });
    }
  }

  async getTradeVolume(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.reports.getTradeVolume(
        req.query.date_from as string,
        req.query.date_to as string
      );
      res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
    } catch (error) {
      logger.error('Trade volume report fetch failed', {
        error: error instanceof Error ? error.message : String(error),
        request_id: req.correlationId,
      });
      res.status(500).json({ error: 'Internal server error', code: 'REPORT_FETCH_FAILED' });
    }
  }

  async getUserRegistrations(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.reports.getUserRegistrations(
        req.query.date_from as string,
        req.query.date_to as string
      );
      res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
    } catch (error) {
      logger.error('User registrations report fetch failed', {
        error: error instanceof Error ? error.message : String(error),
        request_id: req.correlationId,
      });
      res.status(500).json({ error: 'Internal server error', code: 'REPORT_FETCH_FAILED' });
    }
  }

  async getSettlementPerformance(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.reports.getSettlementPerformance(
        req.query.date_from as string,
        req.query.date_to as string
      );
      res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
    } catch (error) {
      logger.error('Settlement performance report fetch failed', {
        error: error instanceof Error ? error.message : String(error),
        request_id: req.correlationId,
      });
      res.status(500).json({ error: 'Internal server error', code: 'REPORT_FETCH_FAILED' });
    }
  }

  async getAuditLogs(req: Request, res: Response): Promise<void> {
    try {
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
    } catch (error) {
      logger.error('Audit log fetch failed', {
        error: error instanceof Error ? error.message : String(error),
        request_id: req.correlationId,
      });
      res.status(500).json({ error: 'Internal server error', code: 'AUDIT_ACTION_FAILED' });
    }
  }

  async listTickets(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.support.listTickets({
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        priority: typeof req.query.priority === 'string' ? req.query.priority : undefined,
        page: Number(req.query.page || 1),
        perPage: Number(req.query.per_page || 20),
      });
      res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
    } catch (error) {
      logger.error('Support ticket list failed', {
        error: error instanceof Error ? error.message : String(error),
        request_id: req.correlationId,
      });
      res.status(500).json({ error: 'Internal server error', code: 'TICKET_ACTION_FAILED' });
    }
  }

  async getTicketById(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.support.getTicketById(req.params.id);
      res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
    } catch (error) {
      logger.error('Support ticket lookup failed', {
        error: error instanceof Error ? error.message : String(error),
        request_id: req.correlationId,
      });
      res.status(500).json({ error: 'Internal server error', code: 'TICKET_ACTION_FAILED' });
    }
  }

  async updateTicket(req: Request, res: Response): Promise<void> {
    try {
      const user = req as AdminAuthenticatedRequest;
      const result = await this.support.updateTicket(req.params.id, req.body, user.user.sub);
      res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
    } catch (error) {
      logger.error('Support ticket update failed', {
        error: error instanceof Error ? error.message : String(error),
        request_id: req.correlationId,
      });
      res.status(500).json({ error: 'Internal server error', code: 'TICKET_ACTION_FAILED' });
    }
  }

  async rejectAction(req: Request, res: Response): Promise<void> {
    const authReq = req as AdminAuthenticatedRequest;
    try {
      const id = req.params.id;
      const adminId = authReq.user?.sub || (authReq.user as any)?.id;
      const { reason, totp_code } = req.body || {};
      const headerTotp = req.header('X-Admin-MFA-Token');
      const providedTotp = totp_code || headerTotp;

      if (!reason || typeof reason !== 'string' || reason.trim() === '') {
        res.status(400).json({ error: 'reason is required', code: 'VALIDATION_ERROR' });
        return;
      }

      if (!providedTotp) {
        res.status(400).json({ error: 'TOTP code is required', code: 'INVALID_TOTP' });
        return;
      }

      const result = await this.wallets.rejectAction(id, adminId, reason, providedTotp);
      res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
    } catch (error: any) {
      const msg = error.message || '';

      if (
        msg.includes('Invalid or missing TOTP') ||
        msg.includes('Invalid TOTP') ||
        msg.includes('Invalid MFA') ||
        msg.includes('TOTP code is required')
      ) {
        res.status(400).json({ error: msg, code: 'INVALID_TOTP' });
        return;
      }

      if (msg.includes('reason is required')) {
        res.status(400).json({ error: msg, code: 'VALIDATION_ERROR' });
        return;
      }

      if (msg.includes('not found') || msg.includes('Cannot reject')) {
        res.status(409).json({ error: msg, code: 'CONFLICT' });
        return;
      }

      res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    }
  }

  async verifyAuditChain(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.audit.verifyChain();
      res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
    } catch (error) {
      logger.error('Audit chain verification failed', {
        error: error instanceof Error ? error.message : String(error),
        request_id: req.correlationId,
      });
      res.status(500).json({ error: 'Internal server error', code: 'AUDIT_ACTION_FAILED' });
    }
  }
}
