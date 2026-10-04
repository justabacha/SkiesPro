import { Request, Response } from 'express';
import { DemoWalletService } from '../../wallet/services/demoWalletService.js';
import { LedgerRepository } from '../../wallet/repositories/ledgerRepository.js';
import { DemoTradingService } from '../../trading/services/demoTradingService.js';
import { PlaceTradeRequest } from '../../trading/dto/trading.dto.js';
import { demoPriceFeedService } from '../../pricing/services/DemoPriceFeedService.js';

const demoWalletService = new DemoWalletService();
const demoTradingService = new DemoTradingService(demoPriceFeedService);
const ledgerRepository = new LedgerRepository();

function getUserId(req: Request): string {
  const userId = (req as Request & { user?: { sub?: string } }).user?.sub;
  if (!userId) throw new Error('Authenticated user ID is missing');
  return userId;
}

function isPlaceTradeRequest(value: unknown): value is PlaceTradeRequest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const request = value as Record<string, unknown>;
  return (
    typeof request.assetSymbol === 'string' &&
    (request.contractType === 'higher' || request.contractType === 'lower') &&
    typeof request.stake === 'string' &&
    Number.isInteger(request.expirySeconds) &&
    (request.strikePrice === undefined ||
      (typeof request.strikePrice === 'number' &&
        Number.isFinite(request.strikePrice) &&
        request.strikePrice > 0))
  );
}

function sendError(res: Response, error: unknown): void {
  const err = error as Error & { code?: string };
  if (err.code === 'DEMO_TRADES_OPEN') {
    res.status(409).json({ code: err.code, message: err.message });
    return;
  }
  if (err.code === 'DEMO_RESET_RATE_LIMITED') {
    res.status(429).json({ code: err.code, message: err.message });
    return;
  }
  if (err.message.includes('Idempotency-Key')) {
    res.status(409).json({ code: 'IDEMPOTENCY_KEY_CONFLICT', message: err.message });
    return;
  }
  if (
    err.message.includes('DEMO_INITIAL_BALANCE_KES') ||
    err.message.includes('DEMO_ENABLED') ||
    /^[0-9A-Z]{5}$/.test(err.code || '') ||
    ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'].includes(err.code || '')
  ) {
    res.status(503).json({ code: 'DEMO_UNAVAILABLE', message: 'Demo mode is unavailable' });
    return;
  }
  res.status(400).json({ message: err.message || 'Demo request failed' });
}

export class DemoController {
  getWallet = async (req: Request, res: Response): Promise<void> => {
    try {
      const wallet = await demoWalletService.getBalance(getUserId(req));
      res.status(200).json({
        data: {
          balance: wallet.balance,
          locked_balance: wallet.locked_balance,
          available_balance: wallet.available_balance,
          currency: wallet.currency,
        },
      });
    } catch (error) {
      sendError(res, error);
    }
  };

  resetWallet = async (req: Request, res: Response): Promise<void> => {
    try {
      const idempotencyKey = req.header('Idempotency-Key');
      if (!idempotencyKey) {
        res.status(400).json({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
        return;
      }
      const result = await demoWalletService.reset(getUserId(req), idempotencyKey);
      res.status(200).json({ data: result });
    } catch (error) {
      sendError(res, error);
    }
  };

  getLedger = async (req: Request, res: Response): Promise<void> => {
    try {
      const wallet = await demoWalletService.getBalance(getUserId(req));
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        res.status(400).json({ message: 'limit must be an integer from 1 to 100' });
        return;
      }
      const entries = await ledgerRepository.findByWalletId(
        wallet.id,
        limit,
        typeof req.query.cursor === 'string' ? req.query.cursor : undefined
      );
      res.status(200).json({
        data: entries,
        meta: {
          next_cursor: entries.length
            ? entries[entries.length - 1].created_at.toISOString()
            : undefined,
          has_more: entries.length === limit,
          request_id: req.correlationId,
        },
      });
    } catch (error) {
      sendError(res, error);
    }
  };

  placeTrade = async (req: Request, res: Response): Promise<void> => {
    try {
      const request: unknown = req.body;
      if (!isPlaceTradeRequest(request)) {
        res.status(400).json({ message: 'Invalid demo contract request' });
        return;
      }
      const idempotencyKey = req.header('Idempotency-Key');
      if (!idempotencyKey) {
        res.status(400).json({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
        return;
      }
      const contract = await demoTradingService.placeDemoTrade(
        getUserId(req),
        request,
        idempotencyKey
      );
      res.status(201).json({ data: contract });
    } catch (error) {
      sendError(res, error);
    }
  };

  getActiveContracts = async (req: Request, res: Response): Promise<void> => {
    try {
      res.status(200).json({ data: await demoTradingService.getActiveTrades(getUserId(req)) });
    } catch (error) {
      sendError(res, error);
    }
  };

  getHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const trades = await demoTradingService.getTradeHistory(getUserId(req), {
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        assetSymbol:
          typeof req.query.assetSymbol === 'string'
            ? req.query.assetSymbol
            : typeof req.query.asset_symbol === 'string'
              ? req.query.asset_symbol
              : undefined,
        limit,
        cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
      });
      res.status(200).json({ data: trades });
    } catch (error) {
      sendError(res, error);
    }
  };

  getQuote = async (req: Request, res: Response): Promise<void> => {
    try {
      const symbol = typeof req.query.symbol === 'string' ? req.query.symbol : '';
      if (!symbol) {
        res.status(400).json({ message: 'symbol is required' });
        return;
      }
      const quote = await demoPriceFeedService.getQuote(symbol);
      if (!quote) {
        res.status(503).json({ code: 'DEMO_MARKET_DATA_UNAVAILABLE' });
        return;
      }
      res.status(200).json({ data: quote });
    } catch (error) {
      sendError(res, error);
    }
  };
}
