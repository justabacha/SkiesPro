import { InMemoryAdapter } from '../src/infrastructure/cache/InMemoryAdapter.js';
import { CacheClient } from '../src/infrastructure/cache/CacheClient.js';
import { KEY_PATTERNS, DEFAULT_TTLS, getClusterForKey } from '../src/infrastructure/cache/keyPatterns.js';

describe('InMemoryAdapter', () => {
  let adapter: InMemoryAdapter;

  beforeEach(() => {
    adapter = new InMemoryAdapter();
  });

  afterEach(async () => {
    await adapter.close();
  });

  describe('get', () => {
    it('should return null for non-existent key', async () => {
      const value = await adapter.get('nonexistent');
      expect(value).toBeNull();
    });

    it('should return value for existing key', async () => {
      await adapter.set('test', 'value');
      const value = await adapter.get('test');
      expect(value).toBe('value');
    });

    it('should return null for expired key', async () => {
      await adapter.set('test', 'value', 0.1); // 100ms TTL
      await new Promise(resolve => setTimeout(resolve, 150));
      const value = await adapter.get('test');
      expect(value).toBeNull();
    });
  });

  describe('set', () => {
    it('should set value without TTL', async () => {
      await adapter.set('test', 'value');
      const value = await adapter.get('test');
      expect(value).toBe('value');
    });

    it('should set value with TTL', async () => {
      await adapter.set('test', 'value', 10);
      const value = await adapter.get('test');
      expect(value).toBe('value');
    });
  });

  describe('del', () => {
    it('should delete key', async () => {
      await adapter.set('test', 'value');
      await adapter.del('test');
      const value = await adapter.get('test');
      expect(value).toBeNull();
    });
  });

  describe('incr', () => {
    it('should increment value', async () => {
      const result = await adapter.incr('counter');
      expect(result).toBe(1);
    });

    it('should increment existing value', async () => {
      await adapter.set('counter', 5);
      const result = await adapter.incr('counter');
      expect(result).toBe(6);
    });
  });

  describe('expire', () => {
    it('should set TTL on existing key', async () => {
      await adapter.set('test', 'value');
      await adapter.expire('test', 0.1);
      await new Promise(resolve => setTimeout(resolve, 150));
      const value = await adapter.get('test');
      expect(value).toBeNull();
    });
  });

  describe('keys', () => {
    it('should return keys matching pattern', async () => {
      await adapter.set('test:1', 'value1');
      await adapter.set('test:2', 'value2');
      await adapter.set('other:1', 'value3');
      
      const keys = await adapter.keys('test:*');
      expect(keys).toHaveLength(2);
      expect(keys).toContain('test:1');
      expect(keys).toContain('test:2');
    });
  });
});

describe('CacheClient', () => {
  let client: CacheClient;

  beforeEach(() => {
    client = new CacheClient();
  });

  afterEach(async () => {
    await client.close();
  });

  describe('two-cluster architecture', () => {
    it('should use sessions cluster for session keys', async () => {
      await client.set('sessions', 'session:user123', 'value');
      const value = await client.get('sessions', 'session:user123');
      expect(value).toBe('value');
    });

    it('should use pricing cluster for pricing keys', async () => {
      await client.set('pricing', 'price:EUR/USD:latest', '1.1234');
      const value = await client.get('pricing', 'price:EUR/USD:latest');
      expect(value).toBe('1.1234');
    });

    it('should isolate clusters', async () => {
      await client.set('sessions', 'test', 'sessions-value');
      await client.set('pricing', 'test', 'pricing-value');
      
      const sessionsValue = await client.get('sessions', 'test');
      const pricingValue = await client.get('pricing', 'test');
      
      expect(sessionsValue).toBe('sessions-value');
      expect(pricingValue).toBe('pricing-value');
    });
  });

  describe('fail-closed behavior', () => {
    it('should enter fail-closed mode on error', async () => {
      client.setFailClosedMode(true);
      expect(client.isFailClosedMode()).toBe(true);
    });

    it('should return null in fail-closed mode', async () => {
      await client.set('sessions', 'test', 'value');
      client.setFailClosedMode(true);
      const value = await client.get('sessions', 'test');
      expect(value).toBeNull();
    });
  });
});

describe('keyPatterns', () => {
  describe('KEY_PATTERNS', () => {
    it('should generate session key', () => {
      const key = KEY_PATTERNS.SESSION.USER_SESSION('user123');
      expect(key).toBe('session:user123');
    });

    it('should generate rate limit key', () => {
      const key = KEY_PATTERNS.SESSION.RATE_LIMIT('127.0.0.1', '/api/test');
      expect(key).toBe('ratelimit:127.0.0.1:/api/test');
    });

    it('should generate token blacklist key', () => {
      const key = KEY_PATTERNS.SESSION.TOKEN_BLACKLIST('jti123');
      expect(key).toBe('token:blacklist:jti123');
    });

    it('should generate latest price key', () => {
      const key = KEY_PATTERNS.PRICING.LATEST_PRICE('EUR/USD');
      expect(key).toBe('price:EUR/USD:latest');
    });

    it('should generate candle key', () => {
      const key = KEY_PATTERNS.PRICING.CANDLE('EUR/USD', '1m', 1234567890);
      expect(key).toBe('candle:EUR/USD:1m:1234567890');
    });

    it('should generate exposure key', () => {
      const key = KEY_PATTERNS.PRICING.EXPOSURE('EUR/USD');
      expect(key).toBe('exposure:EUR/USD');
    });
  });

  describe('DEFAULT_TTLS', () => {
    it('should have session TTL of 15 minutes', () => {
      expect(DEFAULT_TTLS.SESSION).toBe(15 * 60);
    });

    it('should have rate limit TTL of 1 minute', () => {
      expect(DEFAULT_TTLS.RATE_LIMIT).toBe(60);
    });

    it('should have latest price TTL of 2 seconds', () => {
      expect(DEFAULT_TTLS.LATEST_PRICE).toBe(2);
    });
  });

  describe('getClusterForKey', () => {
    it('should return sessions cluster for session keys', () => {
      expect(getClusterForKey('session:user123')).toBe('sessions');
      expect(getClusterForKey('ratelimit:127.0.0.1:/api')).toBe('sessions');
      expect(getClusterForKey('token:blacklist:jti')).toBe('sessions');
    });

    it('should return pricing cluster for pricing keys', () => {
      expect(getClusterForKey('price:EUR/USD:latest')).toBe('pricing');
      expect(getClusterForKey('candle:EUR/USD:1m:123')).toBe('pricing');
      expect(getClusterForKey('exposure:EUR/USD')).toBe('pricing');
    });
  });
});
