import { Request, Response, NextFunction } from 'express';
import { cacheClient } from '../../infrastructure/cache';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
}

interface RateLimitStore {
  hits: number;
  resetAt: Date;
}

const rateLimitStores = new Map<string, RateLimitStore>();

const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  unauthenticated: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
    keyGenerator: (req: Request) => `ip:${req.ip}`,
  },
  authenticated: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 300,
    keyGenerator: (req: Request) => `token:${req.headers['authorization']}`,
  },
  trading: {
    windowMs: 1 * 1000, // 1 second
    maxRequests: 10,
    keyGenerator: (req: Request) => {
      const token = req.headers['authorization'];
      return token ? `trading:${token}` : `trading:ip:${req.ip}`;
    },
  },
  login: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10,
    keyGenerator: (req: Request) => `login:${req.ip}:${(req.body?.email || '').toLowerCase().trim()}`,
  },
  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    keyGenerator: (req: Request) => `password-reset:${req.body.email}`,
  },
  kycUpload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,
    keyGenerator: (req: Request) => `kyc:${req.headers['authorization']}`,
  },
};

export function rateLimit(configName: keyof typeof RATE_LIMIT_CONFIGS) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const config = RATE_LIMIT_CONFIGS[configName];
    const key = config.keyGenerator(req);

    try {
      const currentHits = await cacheClient.incr('sessions', key);

      if (currentHits === 1) {
        await cacheClient.expire('sessions', key, config.windowMs / 1000);
      }

      const resetAt = new Date(Date.now() + config.windowMs);

      res.setHeader('X-RateLimit-Limit', config.maxRequests.toString());
      res.setHeader(
        'X-RateLimit-Remaining',
        Math.max(0, config.maxRequests - currentHits).toString()
      );
      res.setHeader('X-RateLimit-Reset', resetAt.toISOString());

      if (currentHits > config.maxRequests) {
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded',
          retryAfter: Math.ceil(config.windowMs / 1000),
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Rate limit error:', error);
      next();
    }
  };
}

export function inAppRateLimit(req: Request, configName: keyof typeof RATE_LIMIT_CONFIGS): boolean {
  const config = RATE_LIMIT_CONFIGS[configName];
  const key = config.keyGenerator(req);
  const store = rateLimitStores.get(key);

  if (!store) {
    rateLimitStores.set(key, {
      hits: 1,
      resetAt: new Date(Date.now() + config.windowMs),
    });
    return true;
  }

  if (store.resetAt < new Date()) {
    store.hits = 1;
    store.resetAt = new Date(Date.now() + config.windowMs);
    return true;
  }

  if (store.hits >= config.maxRequests) {
    return false;
  }

  store.hits++;
  return true;
}
