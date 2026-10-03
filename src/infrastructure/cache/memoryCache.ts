import { LRUCache } from 'lru-cache';

export const DEFAULT_PRICE_TTL_MS = 10_000;

const cache = new LRUCache<string, any>({
  max: 2000,
  ttl: DEFAULT_PRICE_TTL_MS,
});

export const localCache = {
  get(key: string): any {
    return cache.get(key);
  },

  set(key: string, value: any, ttlMs?: number): void {
    cache.set(key, value, ttlMs === undefined ? undefined : { ttl: ttlMs });
  },

  del(key: string): void {
    cache.delete(key);
  },

  flush(): void {
    cache.clear();
  },
};
