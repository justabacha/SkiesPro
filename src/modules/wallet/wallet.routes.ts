import { Router, Request, Response } from 'express';
import { WalletController } from './controllers/walletController';
import { authenticate } from '../../shared/middleware/authMiddleware';
import { rateLimit } from '../../shared/middleware/rateLimit';

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
