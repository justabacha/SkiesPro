export interface ICache {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  incr(key: string): Promise<number>;
  expire(key: string, ttl: number): Promise<void>;
  keys(pattern: string): Promise<string[]>;
  publish?(channel: string, message: string): Promise<void>;
  subscribe?(channel: string, callback: (message: string) => void): Promise<void>;
  unsubscribe?(channel: string): Promise<void>;
  close(): Promise<void>;
}

export type CacheCluster = 'sessions' | 'pricing';
