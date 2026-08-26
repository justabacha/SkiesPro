import { ICache } from './ICache';
import { EventEmitter } from 'events';

interface CacheEntry {
  value: any;
  ttl?: number;
  expiresAt?: Date;
}

export class InMemoryAdapter implements ICache {
  private cache: Map<string, CacheEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private eventEmitter: EventEmitter = new EventEmitter();
  private subscriptions: Map<string, Set<(message: string) => void>> = new Map();

  constructor() {
    this.startCleanup();
  }

  async get(key: string): Promise<any> {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt && entry.expiresAt < new Date()) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const entry: CacheEntry = {
      value,
      ttl,
    };

    if (ttl) {
      entry.expiresAt = new Date(Date.now() + ttl * 1000);
    }

    this.cache.set(key, entry);
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async incr(key: string): Promise<number> {
    const entry = this.cache.get(key);
    const currentValue = entry?.value || 0;
    const newValue = currentValue + 1;
    await this.set(key, newValue);
    return newValue;
  }

  async expire(key: string, ttl: number): Promise<void> {
    const entry = this.cache.get(key);
    if (entry) {
      entry.ttl = ttl;
      entry.expiresAt = new Date(Date.now() + ttl * 1000);
    }
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace('*', '.*'));
    return Array.from(this.cache.keys()).filter((key) => regex.test(key));
  }

  async publish(channel: string, message: string): Promise<void> {
    // In-memory Pub/Sub implementation
    this.eventEmitter.emit(channel, message);
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }
    this.subscriptions.get(channel)!.add(callback);
    this.eventEmitter.on(channel, callback);
  }

  async unsubscribe(channel: string): Promise<void> {
    const callbacks = this.subscriptions.get(channel);
    if (callbacks) {
      callbacks.forEach(callback => {
        this.eventEmitter.removeListener(channel, callback);
      });
      this.subscriptions.delete(channel);
    }
  }

  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Clean up subscriptions
    this.subscriptions.forEach((callbacks, channel) => {
      callbacks.forEach(callback => {
        this.eventEmitter.removeListener(channel, callback);
      });
    });
    this.subscriptions.clear();
    
    this.cache.clear();
    this.eventEmitter.removeAllListeners();
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = new Date();
      for (const [key, entry] of this.cache.entries()) {
        if (entry.expiresAt && entry.expiresAt < now) {
          this.cache.delete(key);
        }
      }
    }, 60000); // Cleanup every minute
  }

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}
