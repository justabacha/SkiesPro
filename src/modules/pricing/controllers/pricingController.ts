import { Request, Response } from 'express';
import { PricingService } from '../services/pricingService.js';
import { MarketStatusService } from '../services/MarketStatusService.js';
import { PriceValidationService } from '../services/priceValidationService.js';
import { logger } from '../../../shared/middleware/logger.js';

export class PricingController {
  private pricingService: PricingService;

  constructor() {
    const validationService = new PriceValidationService();
    const marketStatusService = new MarketStatusService(validationService);
    this.pricingService = new PricingService(marketStatusService);
  }

  async getAssets(_req: Request, res: Response): Promise<void> {
    try {
      const assets = await this.pricingService.getActiveAssets();
      res.status(200).json({ data: assets });
    } catch (error: any) {
      logger.error('Error fetching assets', { error: error.message });
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async getPrice(req: Request, res: Response): Promise<void> {
    try {
      const price = await this.pricingService.getLatestPrice(req.params.symbol);
      res.status(200).json({ data: price });
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  }

  async getCandles(req: Request, res: Response): Promise<void> {
    try {
      const query = {
        symbol: req.params.symbol,
        granularity: req.query.granularity ? parseInt(req.query.granularity as string) : undefined,
        from: req.query.from as string,
        to: req.query.to as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      };
      const candles = await this.pricingService.getCandles(query);
      res.status(200).json({ data: candles });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async getStatus(_req: Request, res: Response): Promise<void> {
    try {
      const assets = await this.pricingService.getActiveAssets();
      const symbols = assets.map((a) => a.symbol);
      const statuses = await Promise.all(
        symbols.map((s) => this.pricingService.getMarketStatus(s))
      );
      res.status(200).json({ data: statuses });
    } catch (error: any) {
      logger.error('Error fetching market statuses', { error: error.message });
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}
