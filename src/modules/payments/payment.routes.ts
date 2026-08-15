import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { PaymentController } from './controllers/paymentController';
import { authenticate } from '../../shared/middleware/authMiddleware';
import { rateLimit } from '../../shared/middleware/rateLimit';

const router = Router();
const controller = new PaymentController();

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
