import { cacheClient } from '../../../src/infrastructure/cache/index.js';

export class IdempotencyService {
  /**
   * Checks if a key exists in the cache.
   * Used for message deduplication in workers.
   */
  async isDuplicate(key: string, ttlSeconds: number = 3600): Promise<boolean> {
    const fullKey = `idempotency:${key}`;
    const exists = await cacheClient.get('sessions', fullKey);

    if (exists) {
      return true;
    }

    // Set the key to mark as processed
    await cacheClient.set('sessions', fullKey, 'processed');
    await cacheClient.expire('sessions', fullKey, ttlSeconds);

    return false;
  }

  /**
   * Clears an idempotency key (e.g., if a transaction fails and needs retry).
   */
  async clearKey(key: string): Promise<void> {
    await cacheClient.del('sessions', `idempotency:${key}`);
  }
}
