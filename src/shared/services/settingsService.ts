import { pgPool } from '../../config/database.js';

const CACHE_TTL_MS = 5000;
const cache = new Map<string, { value: unknown; expiresAt: number }>();

export function parseSettingValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export class SettingsService {
  async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }

    const result = await pgPool.query<{ value: unknown }>(
      'SELECT value FROM config.platform_settings WHERE key = $1',
      [key]
    );
    const value =
      result.rows.length > 0 ? (parseSettingValue(result.rows[0].value) as T) : defaultValue;
    cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  }

  static invalidate(key?: string): void {
    if (key) {
      cache.delete(key);
    } else {
      cache.clear();
    }
  }
}
