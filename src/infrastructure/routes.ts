import { Router } from 'express';
import { healthCheck, readinessCheck } from './healthController.js';
import authRoutes from '../modules/auth/auth.routes.js';
import userRoutes from '../modules/user/user.routes.js';
import walletRoutes from '../modules/wallet/wallet.routes.js';
import paymentRoutes from '../modules/payments/payment.routes.js';
import pricingRoutes from '../modules/pricing/pricing.routes.js';
import tradingRoutes from '../modules/trading/trading.routes.js';

const router = Router();

router.get('/health', healthCheck);
router.get('/ready', readinessCheck);

// API v1 routes
router.use('/api/v1/auth', authRoutes);
router.use('/api/v1/users', userRoutes);
router.use('/api/v1/wallets', walletRoutes);
router.use('/api/v1/payments', paymentRoutes);
router.use('/api/v1/pricing', pricingRoutes);
router.use('/api/v1/trading', tradingRoutes);

export default router;
