import { Router } from 'express';
import { param, query } from 'express-validator';
import { PricingController } from './controllers/pricingController.js';
import { authenticate } from '../../shared/middleware/authMiddleware.js';
import { rateLimit } from '../../shared/middleware/rateLimit.js';
import { validate } from '../../shared/middleware/validate.js';

const router = Router();
const controller = new PricingController();

router.use(authenticate);
router.use(rateLimit('authenticated'));

router.get('/assets', (req, res) => controller.getAssets(req, res));

router.get(
  '/assets/:symbol/price',
  [param('symbol').isString().notEmpty(), validate],
  (req: any, res: any) => controller.getPrice(req, res)
);

router.get(
  '/assets/:symbol/candles',
  [
    param('symbol').isString().notEmpty(),
    query('granularity').optional().isInt({ min: 60 }),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
    validate,
  ],
  (req: any, res: any) => controller.getCandles(req, res)
);

router.get('/status', (req, res) => controller.getStatus(req, res));

export default router;
