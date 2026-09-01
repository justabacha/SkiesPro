import { Request, Response } from 'express';
import { TradingService } from '../services/tradingService.js';
import { PricingService } from '../../pricing/services/pricingService.js';
import { MarketStatusService } from '../../pricing/services/MarketStatusService.js';
import { PriceValidationService } from '../../pricing/services/priceValidationService.js';
import { BinaryContract } from '../repositories/contractRepository.js';
import { TradeResponse } from '../dto/trading.dto.js';

const validationService = new PriceValidationService();
const marketStatusService = new MarketStatusService(validationService);
const pricingService = new PricingService(marketStatusService);
const tradingService = new TradingService(pricingService);

export class ContractController {
  private mapToResponse(contract: BinaryContract): TradeResponse {
    return {
      id: contract.id!,
      user_id: contract.userId,
      asset_symbol: contract.assetSymbol,
      stake: contract.stake,
      contract_type: contract.contractType,
      strike_price: contract.strikePrice,
      expiry_price: contract.expiryPrice,
      payout_rate: contract.payoutRate,
      potential_payout: contract.potentialPayout,
      purchase_time: contract.purchaseTime.toISOString(),
      expiry_time: contract.expiryTime.toISOString(),
      status: contract.status,
    };
  }

  async placeTrade(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;

      // Map snake_case API request to camelCase Service request
      const placeTradeRequest = {
        assetSymbol: req.body.asset_symbol,
        contractType: req.body.contract_type,
        stake: req.body.stake,
        expirySeconds: req.body.expiry_seconds,
      };

      const contract = await tradingService.placeTrade(userId, placeTradeRequest);

      return res.status(201).json({
        status: 'success',
        data: this.mapToResponse(contract),
      });
    } catch (error: any) {
      const errorMessage = error.message || 'An unknown error occurred';
      console.error('Trade placement failed:', errorMessage);

      // Map validation errors to 422
      const validationErrors = [
        'Insufficient available balance',
        'Maximum platform exposure reached',
        'Market price is stale',
        'below minimum',
        'above maximum',
        'is currently closed',
        'self-excluded',
        'account is not active',
      ];

      const isValidationError = validationErrors.some((msg) => errorMessage.includes(msg));

      return res.status(isValidationError ? 422 : 400).json({
        status: 'error',
        message: errorMessage,
      });
    }
  }

  async getHistory(req: Request, res: Response) {
    try {
      const userId = (req as any).user.sub;

      // Map snake_case filters to camelCase
      const filters = {
        status: req.query.status as string,
        assetSymbol: req.query.asset_symbol as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        cursor: req.query.cursor as string,
      };

      const trades = await tradingService.getTradeHistory(userId, filters);

      return res.json({
        status: 'success',
        data: trades.map((t) => this.mapToResponse(t)),
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
        data: trades.map((t) => this.mapToResponse(t)),
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
        data: this.mapToResponse(trade),
      });
    } catch (error: any) {
      return res.status(404).json({
        status: 'error',
        message: error.message,
      });
    }
  }
}
