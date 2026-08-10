import { Router } from 'express';
import { healthCheck, readinessCheck } from './healthController';
import authRoutes from '../modules/auth/auth.routes';
import userRoutes from '../modules/user/user.routes';

const router = Router();

router.get('/health', healthCheck);
router.get('/ready', readinessCheck);

// API v1 routes
router.use('/api/v1/auth', authRoutes);
router.use('/api/v1/users', userRoutes);

export default router;
