import { CacheCluster } from './ICache';

export const KEY_PATTERNS = {
  SESSION: {
    USER_SESSION: (userId: string) => `session:${userId}`,
    RATE_LIMIT: (ip: string, endpoint: string) => `ratelimit:${ip}:${endpoint}`,
    TOKEN_BLACKLIST: (jti: string) => `token:blacklist:${jti}`,
  },
  PRICING: {
    LATEST_PRICE: (symbol: string) => `price:${symbol}:latest`,
    CANDLE: (symbol: string, granularity: string, epoch: number) =>
      `candle:${symbol}:${granularity}:${epoch}`,
    EXPOSURE: (symbol: string) => `exposure:${symbol}`,
  },
} as const;

export const DEFAULT_TTLS = {
  SESSION: 15 * 60, // 15 minutes (JWT expiry)
  RATE_LIMIT: 60, // 1 minute
  TOKEN_BLACKLIST: 15 * 60, // 15 minutes (max JWT TTL)
  LATEST_PRICE: 2, // 2 seconds
  CANDLE: 120, // 2 minutes
} as const;

export function getClusterForKey(key: string): CacheCluster {
  if (key.startsWith('session:') || key.startsWith('ratelimit:') || key.startsWith('token:')) {
    return 'sessions';
  }
  return 'pricing';
}
