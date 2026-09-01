import { Router } from 'express';
import { ContractController } from './controllers/contractController.js';
import { AssetController } from './controllers/assetController.js';
import { authenticate as authenticateToken } from '../../shared/middleware/authMiddleware.js';
import {
  requireIdempotencyKey,
  authorizeTrader,
  tradingRateLimit,
} from './middleware/tradingMiddleware.js';

const router = Router();
const contractController = new ContractController();
const assetController = new AssetController();

// Asset routes
router.get('/assets', authenticateToken, (req, res) => assetController.listAssets(req, res));
router.get('/assets/:symbol', authenticateToken, (req, res) => assetController.getAssetDetail(req, res));

// Contract routes
router.post(
  '/contracts',
  authenticateToken,
  tradingRateLimit,
  authorizeTrader,
  requireIdempotencyKey,
  (req, res) => contractController.placeTrade(req, res)
);
router.get('/contracts', authenticateToken, (req, res) => contractController.getHistory(req, res));
router.get('/contracts/active', authenticateToken, (req, res) => contractController.getActive(req, res));
router.get('/contracts/:id', authenticateToken, (req, res) => contractController.getById(req, res));

export default router;
