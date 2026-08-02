import { ICache, CacheCluster } from './ICache';
import { InMemoryAdapter } from './InMemoryAdapter';

export class CacheClient {
  private sessionsCluster: ICache;
  private pricingCluster: ICache;
  private failClosedMode: boolean = false;

  constructor(
    sessionsAdapter?: ICache,
    pricingAdapter?: ICache
  ) {
    this.sessionsCluster = sessionsAdapter || new InMemoryAdapter();
    this.pricingCluster = pricingAdapter || new InMemoryAdapter();
  }

  async get(cluster: CacheCluster, key: string): Promise<any> {
    if (this.failClosedMode) {
      return null;
    }
    try {
      const cache = this.getCluster(cluster);
      return await cache.get(key);
    } catch (error) {
      this.handleCacheError(error);
      return null;
    }
  }

  async set(cluster: CacheCluster, key: string, value: any, ttl?: number): Promise<void> {
    try {
      const cache = this.getCluster(cluster);
      await cache.set(key, value, ttl);
    } catch (error) {
      this.handleCacheError(error);
    }
  }

  async del(cluster: CacheCluster, key: string): Promise<void> {
    try {
      const cache = this.getCluster(cluster);
      await cache.del(key);
    } catch (error) {
      this.handleCacheError(error);
    }
  }

  async incr(cluster: CacheCluster, key: string): Promise<number> {
    try {
      const cache = this.getCluster(cluster);
      return await cache.incr(key);
    } catch (error) {
      this.handleCacheError(error);
      return 0;
    }
  }

  async expire(cluster: CacheCluster, key: string, ttl: number): Promise<void> {
    try {
      const cache = this.getCluster(cluster);
      await cache.expire(key, ttl);
    } catch (error) {
      this.handleCacheError(error);
    }
  }

  async keys(cluster: CacheCluster, pattern: string): Promise<string[]> {
    try {
      const cache = this.getCluster(cluster);
      return await cache.keys(pattern);
    } catch (error) {
      this.handleCacheError(error);
      return [];
    }
  }

  private getCluster(cluster: CacheCluster): ICache {
    return cluster === 'sessions' ? this.sessionsCluster : this.pricingCluster;
  }

  private handleCacheError(error: unknown): void {
    console.error('Cache error:', error);
    this.failClosedMode = true;
  }

  async close(): Promise<void> {
    await this.sessionsCluster.close();
    await this.pricingCluster.close();
  }

  isFailClosedMode(): boolean {
    return this.failClosedMode;
  }

  setFailClosedMode(enabled: boolean): void {
    this.failClosedMode = enabled;
  }
}

export const cacheClient = new CacheClient();
