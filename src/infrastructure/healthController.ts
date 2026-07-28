import { Request, Response } from 'express';
import { logger } from '../shared/middleware/logger';

export const healthCheck = (req: Request, res: Response): void => {
  logger.info('Health check requested', { correlationId: req.correlationId });
  
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
};

export const readinessCheck = (req: Request, res: Response): void => {
  logger.info('Readiness check requested', { correlationId: req.correlationId });
  
  // In future WPs, add actual checks (database, redis, etc.)
  const checks: Record<string, string> = {};
  
  res.status(200).json({
    status: 'ready',
    checks,
  });
};
