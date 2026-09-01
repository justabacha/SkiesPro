import { ICache } from './ICache.js';
import { createClient, type RedisClientType } from 'redis';

export class RedisAdapter implements ICache {
  private client: RedisClientType | null = null;
  private subscriber: RedisClientType | null = null;
  private readonly connectionString: string;
  private readonly callbackMap: Map<string, Set<(message: string) => void>> = new Map();
  private readonly enabled: boolean;

  constructor(connectionString?: string) {
    this.connectionString = (connectionString || process.env.REDIS_URL || '').trim();
    this.enabled = this.connectionString.length > 0;

    if (!this.enabled) {
      return;
    }

    this.client = createClient({ url: this.connectionString });
    this.subscriber = this.client.duplicate();

    this.client.on('error', (error: unknown) => {
      console.error('Redis cache client error:', error);
    });

    this.subscriber.on('error', (error: unknown) => {
      console.error('Redis cache subscriber error:', error);
    });

    this.subscriber.on('message', (channel: string, message: string) => {
      const listeners = this.callbackMap.get(channel);
      if (!listeners) {
        return;
      }

      listeners.forEach((callback) => callback(message));
    });
  }

  private async ensureConnected(): Promise<void> {
    if (!this.enabled || !this.client || !this.subscriber) {
      return;
    }

    if (!this.client.isOpen) {
      await this.client.connect();
    }

    if (!this.subscriber.isOpen) {
      await this.subscriber.connect();
    }
  }

  async get(key: string): Promise<any> {
    if (!this.enabled || !this.client) {
      return null;
    }

    await this.ensureConnected();
    return this.client.get(key);
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.enabled || !this.client) {
      return;
    }

    await this.ensureConnected();
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);

    if (ttl !== undefined) {
      await this.client.set(key, serialized, { EX: ttl });
      return;
    }

    await this.client.set(key, serialized);
  }

  async del(key: string): Promise<void> {
    if (!this.enabled || !this.client) {
      return;
    }

    await this.ensureConnected();
    await this.client.del(key);
  }

  async incr(key: string): Promise<number> {
    if (!this.enabled || !this.client) {
      return 0;
    }

    await this.ensureConnected();
    return this.client.incr(key);
  }

  async expire(key: string, ttl: number): Promise<void> {
    if (!this.enabled || !this.client) {
      return;
    }

    await this.ensureConnected();
    await this.client.expire(key, ttl);
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.enabled || !this.client) {
      return [];
    }

    await this.ensureConnected();
    const normalizedPattern = pattern.replace(/\*/g, '*');
    const keys = await this.client.keys(normalizedPattern);
    return keys;
  }

  async publish(channel: string, message: string): Promise<void> {
    if (!this.enabled || !this.client) {
      return;
    }

    await this.ensureConnected();
    await this.client.publish(channel, message);
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    if (!this.enabled || !this.subscriber) {
      return;
    }

    await this.ensureConnected();

    if (!this.callbackMap.has(channel)) {
      this.callbackMap.set(channel, new Set());
    }

    const listeners = this.callbackMap.get(channel)!;
    listeners.add(callback);

    // In node-redis v4, subscribe takes a callback.
    // We route it to our callback map to support multiple listeners per channel if needed,
    // although our internal map already does this.
    await this.subscriber.subscribe(channel, (message) => {
      const currentListeners = this.callbackMap.get(channel);
      if (currentListeners) {
        currentListeners.forEach((l) => l(message));
      }
    });
  }

  async unsubscribe(channel: string): Promise<void> {
    if (!this.enabled || !this.subscriber) {
      return;
    }

    await this.ensureConnected();
    await this.subscriber.unsubscribe(channel);
    this.callbackMap.delete(channel);
  }

  async close(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    if (this.subscriber && this.subscriber.isOpen) {
      await this.subscriber.quit();
    }

    if (this.client && this.client.isOpen) {
      await this.client.quit();
    }

    this.callbackMap.clear();
  }
}
