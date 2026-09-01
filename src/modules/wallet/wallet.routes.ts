import { Router, Request, Response } from 'express';
import { WalletController } from './controllers/walletController.js';
import { authenticate } from '../../shared/middleware/authMiddleware.js';
import { rateLimit } from '../../shared/middleware/rateLimit.js';

const router = Router();
const controller = new WalletController();

router.use(authenticate);

router.get('/balance', rateLimit('authenticated'), (req: Request, res: Response) =>
  controller.getBalance(req, res)
);

router.get('/ledger', rateLimit('authenticated'), (req: Request, res: Response) =>
  controller.getLedger(req, res)
);

export default router;
