import { Request, Response } from 'express';
import { B2CCallbackService } from '../services/b2cCallbackService.js';
import { logger } from '../../../shared/middleware/logger.js';

export class B2CCallbackController {
  private b2cCallbackService: B2CCallbackService;

  constructor() {
    this.b2cCallbackService = new B2CCallbackService();
  }

  async handleResultCallback(req: Request, res: Response): Promise<void> {
    const token = req.query.token;
    if (token !== process.env.MPESA_CALLBACK_TOKEN) {
      logger.warn('Unauthorized B2C result callback attempt', {
        ip: req.ip,
        tokenProvided: !!token,
      });
      res.status(401).send('Unauthorized');
      return;
    }

    try {
      await this.b2cCallbackService.handleResultCallback(req.body);
      res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    } catch (error: any) {
      logger.error('B2C result callback processing failed', { error: error.message });
      res.status(500).json({ ResultCode: 1, ResultDesc: 'Internal error' });
    }
  }

  async handleTimeoutCallback(req: Request, res: Response): Promise<void> {
    const token = req.query.token;
    if (token !== process.env.MPESA_CALLBACK_TOKEN) {
      logger.warn('Unauthorized B2C timeout callback attempt', {
        ip: req.ip,
        tokenProvided: !!token,
      });
      res.status(401).send('Unauthorized');
      return;
    }

    try {
      await this.b2cCallbackService.handleTimeoutCallback(req.body);
      res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    } catch (error: any) {
      logger.error('B2C timeout callback processing failed', { error: error.message });
      res.status(500).json({ ResultCode: 1, ResultDesc: 'Internal error' });
    }
  }
}
