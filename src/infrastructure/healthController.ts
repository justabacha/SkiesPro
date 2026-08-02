import { Request, Response } from 'express';
import { logger } from '../shared/middleware/logger';
import { healthChecker } from '../shared/monitoring';

export const healthCheck = async (req: Request, res: Response): Promise<void> => {
  logger.info('Health check requested', { correlationId: req.correlationId });

  const systemHealth = await healthChecker.getSystemHealth();

  const statusCode = systemHealth.status === 'healthy' ? 200 : 
                     systemHealth.status === 'degraded' ? 200 : 503;

  res.status(statusCode).json(systemHealth);
};

export const readinessCheck = async (req: Request, res: Response): Promise<void> => {
  logger.info('Readiness check requested', { correlationId: req.correlationId });

  const systemHealth = await healthChecker.getSystemHealth();

  const statusCode = systemHealth.status === 'healthy' ? 200 : 503;

  res.status(statusCode).json({
    status: systemHealth.status === 'healthy' ? 'ready' : 'not_ready',
    checks: systemHealth.dependencies,
  });
};
