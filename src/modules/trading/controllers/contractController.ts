import { Request, Response } from 'express';
import { TradingService } from '../services/tradingService.js';
import { PricingService } from '../../pricing/services/pricingService.js';
import { MarketStatusService } from '../../pricing/services/MarketStatusService.js';
import { PriceValidationService } from '../../pricing/services/priceValidationService.js';

const validationService = new PriceValidationService();
const marketStatusService = new MarketStatusService(validationService);
const pricingService = new PricingService(marketStatusService);
const tradingService = new TradingService(pricingService);

export class ContractController {
  async placeTrade(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const requestTimestamp = parseInt(req.headers['x-request-timestamp'] as string) || Date.now();

      const contract = await tradingService.placeTrade(userId, req.body, requestTimestamp);

      return res.status(201).json({
        status: 'success',
        data: contract,
      });
    } catch (error: any) {
      console.error('Trade placement failed:', error.message);

      // Map validation errors to 422
      const validationErrors = [
        'Insufficient available balance',
        'Maximum platform exposure reached',
        'Request latency too high',
        'below minimum',
        'above maximum',
        'is currently closed',
        'self-excluded',
        'account is not active'
      ];

      const isValidationError = validationErrors.some(msg => error.message.includes(msg));

      return res.status(isValidationError ? 422 : 400).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async getHistory(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const trades = await tradingService.getTradeHistory(userId, req.query);

      return res.json({
        status: 'success',
        data: trades,
      });
    } catch (error: any) {
      return res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async getActive(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const trades = await tradingService.getActiveTrades(userId);

      return res.json({
        status: 'success',
        data: trades,
      });
    } catch (error: any) {
      return res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;
      const { id } = req.params;
      const trade = await tradingService.getTradeById(id, userId);

      return res.json({
        status: 'success',
        data: trade,
      });
    } catch (error: any) {
      return res.status(404).json({
        status: 'error',
        message: error.message,
      });
    }
  }
}
