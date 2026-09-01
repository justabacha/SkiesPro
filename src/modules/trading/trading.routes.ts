import { Router } from 'express';
import { ContractController } from './controllers/contractController.js';
import { AssetController } from './controllers/assetController.js';
import { authenticate as authenticateToken } from '../../shared/middleware/authMiddleware.js';
import { requireIdempotencyKey, authorizeTrader, tradingRateLimit } from './middleware/tradingMiddleware.js';

const router = Router();
const contractController = new ContractController();
const assetController = new AssetController();

// Asset routes
router.get('/assets', authenticateToken, assetController.listAssets);
router.get('/assets/:symbol', authenticateToken, assetController.getAssetDetail);

// Contract routes
router.post(
  '/contracts',
  authenticateToken,
  tradingRateLimit,
  authorizeTrader,
  requireIdempotencyKey,
  contractController.placeTrade
);
router.get('/contracts', authenticateToken, contractController.getHistory);
router.get('/contracts/active', authenticateToken, contractController.getActive);
router.get('/contracts/:id', authenticateToken, contractController.getById);

export default router;
