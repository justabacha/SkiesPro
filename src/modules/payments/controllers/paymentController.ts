import { Request, Response } from 'express';
import { PaymentService } from '../services/paymentService';
import { PaymentRepository } from '../repositories/paymentRepository';
import { logger } from '../../../shared/middleware/logger';

export class PaymentController {
  private paymentService: PaymentService;
  private paymentRepo: PaymentRepository;

  constructor() {
    this.paymentService = new PaymentService();
    this.paymentRepo = new PaymentRepository();
  }

  async initiateDeposit(req: Request, res: Response): Promise<void> {
    const idempotencyKey = req.get('Idempotency-Key');
    if (!idempotencyKey) {
      res.status(400).json({ error: 'Idempotency-Key header is required' });
      return;
    }

    try {
      const userId = (req as any).user.sub;
      const result = await this.paymentService.initiateDeposit(userId, req.body, idempotencyKey);
      res.status(201).json({ data: result, meta: { request_id: req.correlationId } });
    } catch (error: any) {
      logger.error('Deposit initiation failed', { error: error.message });

      const errorResponse: any = { error: error.message };
      if (process.env.NODE_ENV !== 'production' && error.rawResponse) {
        errorResponse.darajaPayload = error.rawResponse;
      }

      res.status(400).json(errorResponse);
    }
  }

  async requestWithdrawal(req: Request, res: Response): Promise<void> {
    const idempotencyKey = req.get('Idempotency-Key');
    if (!idempotencyKey) {
      res.status(400).json({ error: 'Idempotency-Key header is required' });
      return;
    }

    try {
      const userId = (req as any).user.sub;
      const result = await this.paymentService.requestWithdrawal(userId, req.body, idempotencyKey);
      res.status(201).json({ data: result, meta: { request_id: req.correlationId } });
    } catch (error: any) {
      logger.error('Withdrawal request failed', { error: error.message });
      res.status(400).json({ error: error.message });
    }
  }

  async handleMpesaCallback(req: Request, res: Response): Promise<void> {
    // Basic Security: Verify secret token in query params
    const token = req.query.token;
    if (token !== process.env.MPESA_CALLBACK_TOKEN) {
      logger.warn('Unauthorized M-Pesa callback attempt', {
        ip: req.ip,
        tokenProvided: !!token
      });
      res.status(401).send('Unauthorized');
      return;
    }

    // AC Logging: Use logWebhook for audit trail
    try {
      await this.paymentRepo.logWebhook(1, req.headers, req.body, true);
    } catch (logError: any) {
      logger.error('Failed to log M-Pesa webhook', { error: logError.message });
    }

    try {
      await this.paymentService.handleMpesaCallback(req.body);
      res.status(200).send('OK');
    } catch (error: any) {
      logger.error('M-Pesa callback processing failed', { error: error.message });
      res.status(500).send('Error');
    }
  }

  async getDepositStatus(req: Request, res: Response): Promise<void> {
    try {
      const deposit = await this.paymentService.getDepositStatus(req.params.id);
      res.status(200).json({ data: deposit, meta: { request_id: req.correlationId } });
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  }

  async syncDepositStatus(req: Request, res: Response): Promise<void> {
    try {
      const deposit = await this.paymentService.syncDepositStatus(req.params.id);
      res.status(200).json({ data: deposit, meta: { request_id: req.correlationId } });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}
