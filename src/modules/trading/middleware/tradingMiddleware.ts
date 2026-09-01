import { Request, Response, NextFunction } from 'express';
import { cacheClient } from '../../../infrastructure/cache/index.js';

/**
 * Middleware to ensure the user has the 'trader' role.
 */
export const authorizeTrader = (req: Request, res: Response, next: NextFunction): void => {
  const user = (req as any).user;
  if (!user || user.role !== 'trader') {
    res.status(403).json({
      status: 'error',
      code: 'FORBIDDEN',
      message: 'Access denied. Only traders can perform this operation.',
    });
    return;
  }
  next();
};

/**
 * Middleware to enforce idempotency for trade placement.
 */
export const requireIdempotencyKey = (req: Request, res: Response, next: NextFunction): void => {
  const key = req.headers['idempotency-key'];
  if (!key) {
    res.status(400).json({
      error: 'IDEMPOTENCY_KEY_REQUIRED',
      message: 'Idempotency-Key header is required for this operation',
    });
    return;
  }
  next();
};

/**
 * Middleware to rate limit trading requests.
 * Redis-backed implementation for distributed environments.
 * Target: 10 req/sec per user.
 */
export const tradingRateLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = (req as any).user?.sub;
  if (!userId) {
    next();
    return;
  }

  const now = Math.floor(Date.now() / 1000); // Current second
  const key = `rate_limit:trading:${userId}:${now}`;
  const maxReq = 10;

  try {
    const currentCount = await cacheClient.incr('sessions', key);

    // Set expiry if it's a new key
    if (currentCount === 1) {
      await cacheClient.expire('sessions', key, 2); // Expire after 2 seconds to be safe
    }

    if (currentCount > maxReq) {
      res.status(429).json({
        status: 'error',
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many trading requests. Please wait a moment.',
      });
      return;
    }

    next();
  } catch (error) {
    // Fail open in case of Redis issues, but log it
    console.error('Rate limiting error:', error);
    next();
  }
};
