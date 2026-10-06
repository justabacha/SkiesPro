import { Router } from 'express';
import { healthCheck, readinessCheck } from './healthController.js';
import { metricsCollector } from '../shared/monitoring/MetricsCollector.js';
import authRoutes from '../modules/auth/auth.routes.js';
import userRoutes from '../modules/user/user.routes.js';
import walletRoutes from '../modules/wallet/wallet.routes.js';
import paymentRoutes from '../modules/payments/payment.routes.js';
import pricingRoutes from '../modules/pricing/pricing.routes.js';
import tradingRoutes from '../modules/trading/trading.routes.js';
import demoRoutes from '../modules/demo/demo.routes.js';
import adminRoutes from '../modules/admin/admin.routes.js';

const router = Router();

const rootHandler = (_req: any, res: any) => {
  res.status(200).json({ status: 'ok', service: 'SkiesPro API' });
};

router.get('/', rootHandler);
router.head('/', rootHandler);

router.get('/health', healthCheck);
router.get('/ready', readinessCheck);

router.get('/metrics', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    status: 'success',
    timestamp: new Date().toISOString(),
    metrics: metricsCollector.getMetrics(),
  });
});

// API v1 routes
router.use('/api/v1/auth', authRoutes);
router.use('/api/v1/users', userRoutes);
router.use('/api/v1/wallets', walletRoutes);
router.use('/api/v1/payments', paymentRoutes);
router.use('/api/v1/pricing', pricingRoutes);
router.use('/api/v1/trading', tradingRoutes);
router.use('/api/v1/demo', demoRoutes);
router.use('/api/v1/admin', adminRoutes);

export default router;
