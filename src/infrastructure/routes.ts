import { Router } from 'express';
import { healthCheck, readinessCheck } from './healthController';

const router = Router();

router.get('/health', healthCheck);
router.get('/ready', readinessCheck);

export default router;
