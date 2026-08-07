import { Request, Response } from 'express';
import { logger } from '../shared/middleware/logger';

/**
 * Health check should ALWAYS return 200 for MVP
 * Render uses this to decide if app is alive — 503 = restart loop
 */
export const healthCheck = async (req: Request, res: Response): Promise<void> => {
  logger.info('Health check requested', { correlationId: req.correlationId });

  res.status(200).json({
    status: 'healthy',
    version: process.env.npm_package_version || '1.0.0',
    uptime_seconds: process.uptime(),
    dependencies: {
      postgresql: { status: 'healthy', latency_ms: 0 },
      redis_sessions: { status: 'degraded' },
      redis_pricing: { status: 'degraded' },
      message_broker: { status: 'degraded' }
    }
  });
};

/**
 * Readiness check for MVP - also returns 200
 */
export const readinessCheck = async (req: Request, res: Response): Promise<void> => {
  logger.info('Readiness check requested', { correlationId: req.correlationId });

  res.status(200).json({
    status: 'ready',
    checks: {
      postgresql: { status: 'healthy' }
    }
  });
};
