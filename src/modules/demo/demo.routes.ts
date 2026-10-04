import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../shared/middleware/authMiddleware.js';
import { rateLimit } from '../../shared/middleware/rateLimit.js';
import { tradingRateLimit } from '../trading/middleware/tradingMiddleware.js';
import { DemoController } from './controllers/demoController.js';

const router = Router();
const controller = new DemoController();

const requireDemoEnabled = (_req: Request, res: Response, next: NextFunction): void => {
  const initialBalance = Number(process.env.DEMO_INITIAL_BALANCE_KES);
  if (
    process.env.DEMO_ENABLED !== 'true' ||
    !Number.isFinite(initialBalance) ||
    initialBalance <= 0
  ) {
    res.status(404).json({ code: 'DEMO_UNAVAILABLE' });
    return;
  }
  next();
};

router.use(authenticate, requireDemoEnabled);
router.get('/wallet', rateLimit('authenticated'), controller.getWallet);
router.post('/wallet/reset', controller.resetWallet);
router.get('/wallet/ledger', rateLimit('authenticated'), controller.getLedger);
router.post('/trading/contracts', tradingRateLimit, controller.placeTrade);
router.get('/trading/contracts/active', rateLimit('authenticated'), controller.getActiveContracts);
router.get('/trading/contracts', rateLimit('authenticated'), controller.getHistory);
router.get('/pricing/quote', rateLimit('authenticated'), controller.getQuote);

export default router;
