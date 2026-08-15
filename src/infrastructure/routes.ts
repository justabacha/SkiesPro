import { Router } from 'express';
import { healthCheck, readinessCheck } from './healthController';
import authRoutes from '../modules/auth/auth.routes';
import userRoutes from '../modules/user/user.routes';
import walletRoutes from '../modules/wallet/wallet.routes';
import paymentRoutes from '../modules/payments/payment.routes';

const router = Router();

router.get('/health', healthCheck);
router.get('/ready', readinessCheck);

// API v1 routes
router.use('/api/v1/auth', authRoutes);
router.use('/api/v1/users', userRoutes);
router.use('/api/v1/wallets', walletRoutes);
router.use('/api/v1/payments', paymentRoutes);

export default router;
