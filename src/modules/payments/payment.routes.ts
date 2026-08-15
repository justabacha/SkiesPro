import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { PaymentController } from './controllers/paymentController';
import { authenticate } from '../../shared/middleware/authMiddleware';
import { rateLimit } from '../../shared/middleware/rateLimit';

const router = Router();
const controller = new PaymentController();

// Public Callback Route
router.post(
  '/deposit/callback',
  (req: Request, res: Response) => controller.handleMpesaCallback(req, res)
);

// Protected Routes
router.use(authenticate);

router.post(
  '/deposit/initiate',
  rateLimit('authenticated'),
  [
    body('amount').isNumeric().isLength({ min: 1 }),
    body('gateway_id').isInt(),
    body('currency').isString().isLength({ min: 3, max: 3 }),
  ],
  (req: Request, res: Response) => controller.initiateDeposit(req, res)
);

router.get(
  '/deposit/:id/status',
  rateLimit('authenticated'),
  (req: Request, res: Response) => controller.getDepositStatus(req, res)
);

router.post(
  '/deposit/:id/sync',
  rateLimit('authenticated'),
  (req: Request, res: Response) => controller.syncDepositStatus(req, res)
);

router.post(
  '/withdraw/request',
  rateLimit('authenticated'),
  [
    body('amount').isNumeric().isLength({ min: 1 }),
    body('gateway_id').isInt(),
    body('currency').isString().isLength({ min: 3, max: 3 }),
    body('phone').isString().isLength({ min: 10 }),
  ],
  (req: Request, res: Response) => controller.requestWithdrawal(req, res)
);

export default router;
