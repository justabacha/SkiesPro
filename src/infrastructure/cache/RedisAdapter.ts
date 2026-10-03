import { ICache } from './ICache.js';
import { createClient, type RedisClientType } from 'redis';

export let isRedisDisabled = false;
let warningLogged = false;

export function handleRedisError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes('ERR max requests limit exceeded') ||
    message.includes('max requests limit exceeded')
  ) {
    if (!isRedisDisabled) {
      isRedisDisabled = true;
      if (!warningLogged) {
        warningLogged = true;
        console.warn('Redis quota limit exceeded: ERR max requests limit exceeded. Redis operations will be bypassed.');
      }
    }
  }
}

export function resetRedisDisabled(): void {
  isRedisDisabled = false;
  warningLogged = false;
}

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
      handleRedisError(error);
      console.error('Redis cache client error:', error);
    });

    this.subscriber.on('error', (error: unknown) => {
      handleRedisError(error);
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
    if (isRedisDisabled || !this.enabled || !this.client || !this.subscriber) {
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
    if (isRedisDisabled || !this.enabled || !this.client) {
      return null;
    }

    try {
      await this.ensureConnected();
      return await this.client.get(key);
    } catch (error) {
      handleRedisError(error);
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (isRedisDisabled || !this.enabled || !this.client) {
      return;
    }

    try {
      await this.ensureConnected();
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);

      if (ttl !== undefined) {
        await this.client.set(key, serialized, { EX: ttl });
        return;
      }

      await this.client.set(key, serialized);
    } catch (error) {
      handleRedisError(error);
    }
  }

  async del(key: string): Promise<void> {
    if (isRedisDisabled || !this.enabled || !this.client) {
      return;
    }

    try {
      await this.ensureConnected();
      await this.client.del(key);
    } catch (error) {
      handleRedisError(error);
    }
  }

  async incr(key: string): Promise<number> {
    if (isRedisDisabled || !this.enabled || !this.client) {
      return 0;
    }

    try {
      await this.ensureConnected();
      return await this.client.incr(key);
    } catch (error) {
      handleRedisError(error);
      return 0;
    }
  }

  async expire(key: string, ttl: number): Promise<void> {
    if (isRedisDisabled || !this.enabled || !this.client) {
      return;
    }

    try {
      await this.ensureConnected();
      await this.client.expire(key, ttl);
    } catch (error) {
      handleRedisError(error);
    }
  }

  async keys(pattern: string): Promise<string[]> {
    if (isRedisDisabled || !this.enabled || !this.client) {
      return [];
    }

    try {
      await this.ensureConnected();
      const normalizedPattern = pattern.replace(/\*/g, '*');
      const keys = await this.client.keys(normalizedPattern);
      return keys;
    } catch (error) {
      handleRedisError(error);
      return [];
    }
  }

  async publish(channel: string, message: string): Promise<void> {
    if (isRedisDisabled || !this.enabled || !this.client) {
      return;
    }

    try {
      await this.ensureConnected();
      await this.client.publish(channel, message);
    } catch (error) {
      handleRedisError(error);
    }
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    if (isRedisDisabled || !this.enabled || !this.subscriber) {
      return;
    }

    try {
      await this.ensureConnected();

      if (!this.callbackMap.has(channel)) {
        this.callbackMap.set(channel, new Set());
      }

      const listeners = this.callbackMap.get(channel)!;
      listeners.add(callback);

      await this.subscriber.subscribe(channel, (message) => {
        const currentListeners = this.callbackMap.get(channel);
        if (currentListeners) {
          currentListeners.forEach((l) => l(message));
        }
      });
    } catch (error) {
      handleRedisError(error);
    }
  }

  async unsubscribe(channel: string): Promise<void> {
    if (isRedisDisabled || !this.enabled || !this.subscriber) {
      return;
    }

    try {
      await this.ensureConnected();
      await this.subscriber.unsubscribe(channel);
      this.callbackMap.delete(channel);
    } catch (error) {
      handleRedisError(error);
    }
  }

  async close(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      if (this.subscriber && this.subscriber.isOpen) {
        await this.subscriber.quit();
      }

      if (this.client && this.client.isOpen) {
        await this.client.quit();
      }
    } catch (error) {
      handleRedisError(error);
    }

    this.callbackMap.clear();
  }
}
