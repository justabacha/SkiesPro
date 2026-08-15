import { Request, Response } from 'express';
import { PaymentService } from '../services/paymentService';
import { logger } from '../../../shared/middleware/logger';

export class PaymentController {
  private paymentService: PaymentService;

  constructor() {
    this.paymentService = new PaymentService();
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
    } catch (error) {
      logger.error('Deposit initiation failed', { error: (error as Error).message });
      res.status(400).json({ error: (error as Error).message });
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
    } catch (error) {
      logger.error('Withdrawal request failed', { error: (error as Error).message });
      res.status(400).json({ error: (error as Error).message });
    }
  }
}
