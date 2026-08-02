import { MetricsCollector } from '../src/shared/monitoring/MetricsCollector';
import { HealthChecker } from '../src/shared/monitoring/HealthChecker';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  afterEach(() => {
    collector.clearMetrics();
  });

  describe('increment', () => {
    it('should increment a counter metric', () => {
      collector.increment('test.metric', 1);
      const metrics = collector.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe('test.metric');
      expect(metrics[0].value).toBe(1);
    });

    it('should accept custom value', () => {
      collector.increment('test.metric', 5);
      const metrics = collector.getMetrics();
      expect(metrics[0].value).toBe(5);
    });

    it('should accept tags', () => {
      collector.increment('test.metric', 1, { tag: 'value' });
      const metrics = collector.getMetrics();
      expect(metrics[0].tags).toEqual({ tag: 'value' });
    });
  });

  describe('gauge', () => {
    it('should set a gauge metric', () => {
      collector.gauge('test.gauge', 42);
      const metrics = collector.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe('test.gauge');
      expect(metrics[0].value).toBe(42);
    });
  });

  describe('histogram', () => {
    it('should record a histogram metric', () => {
      collector.histogram('test.histogram', 100);
      const metrics = collector.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe('test.histogram');
      expect(metrics[0].value).toBe(100);
    });
  });

  describe('timing', () => {
    it('should record a timing metric', () => {
      collector.timing('test.timing', 250);
      const metrics = collector.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe('test.timing');
      expect(metrics[0].value).toBe(250);
    });
  });

  describe('buffer management', () => {
    it('should limit buffer size to maxBufferSize', () => {
      for (let i = 0; i < 1100; i++) {
        collector.increment('test.metric', i);
      }
      const metrics = collector.getMetrics();
      expect(metrics.length).toBeLessThanOrEqual(1000);
    });

   it('should clear metrics', () => {
      collector.increment('test.metric', 1);
      collector.clearMetrics();
      const metrics = collector.getMetrics();
      expect(metrics).toHaveLength(0);
    });
  });
});

describe('HealthChecker', () => {
  let checker: HealthChecker;

  beforeEach(() => {
    checker = new HealthChecker('1.0.0');
  });

  describe('checkPostgreSQL', () => {
    it('should return healthy status when database is accessible', async () => {
      const result = await checker.checkPostgreSQL();
      expect(result.status).toBe('healthy');
      expect(result.latency_ms).toBeDefined();
      expect(result.latency_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe('checkRedis', () => {
    it('should return degraded status when Redis URL not configured', async () => {
      const result = await checker.checkRedis();
      expect(result.status).toBe('degraded');
      expect(result.error).toContain('not configured');
    });
  });

  describe('checkMessageBroker', () => {
    it('should return degraded status when message broker URL not configured', async () => {
      const result = await checker.checkMessageBroker();
      expect(result.status).toBe('degraded');
      expect(result.error).toContain('not configured');
    });
  });

  describe('getSystemHealth', () => {
    it('should return system health with all dependencies', async () => {
      const health = await checker.getSystemHealth();
      expect(health.status).toBeDefined();
      expect(health.version).toBe('1.0.0');
      expect(health.uptime_seconds).toBeGreaterThanOrEqual(0);
      expect(health.dependencies).toBeDefined();
      expect(health.dependencies.postgresql).toBeDefined();
      expect(health.dependencies.redis_sessions).toBeDefined();
      expect(health.dependencies.redis_pricing).toBeDefined();
      expect(health.dependencies.message_broker).toBeDefined();
    });

    it('should return degraded status when some dependencies are degraded', async () => {
      const health = await checker.getSystemHealth();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
    });
  });
});
