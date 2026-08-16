import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { PaymentController } from './controllers/paymentController';
import { authenticate } from '../../shared/middleware/authMiddleware';
import { rateLimit } from '../../shared/middleware/rateLimit';

const router = Router();
const controller = new PaymentController();

// Public Callback Routes (Exempt from JWT)
router.post('/deposit/callback', (req: Request, res: Response) =>
  controller.handleMpesaCallback(req, res)
);

router.post('/mpesa/callback', (req: Request, res: Response) =>
  controller.handleMpesaCallback(req, res)
);

// Protected Routes (Require JWT)
router.use(authenticate);

router.post(
  '/deposit/initiate',
  rateLimit('authenticated'),
  [
    body('amount').isNumeric().withMessage('Amount must be a number').isLength({ min: 1 }),
    body('gateway_id').isInt().withMessage('Gateway ID must be an integer'),
    body('currency')
      .isString()
      .isLength({ min: 3, max: 3 })
      .withMessage('Currency must be 3 characters'),
    body('phone')
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Phone number cannot be empty if provided'),
    body('phoneNumber')
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Phone number cannot be empty if provided'),
    // Ensure at least one is provided
    body().custom((value) => {
      if (!value.phone && !value.phoneNumber) {
        throw new Error('Phone number is required');
      }
      return true;
    }),
  ],
  (req: Request, res: Response) => controller.initiateDeposit(req, res)
);

router.get('/deposit/:id/status', rateLimit('authenticated'), (req: Request, res: Response) =>
  controller.getDepositStatus(req, res)
);

router.post('/deposit/:id/sync', rateLimit('authenticated'), (req: Request, res: Response) =>
  controller.syncDepositStatus(req, res)
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
