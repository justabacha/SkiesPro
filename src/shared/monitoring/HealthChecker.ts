import { pgPool } from '../../config/database';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency_ms?: number;
  error?: string;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime_seconds: number;
  dependencies: Record<string, HealthCheckResult>;
}

export class HealthChecker {
  private startTime: Date;
  private version: string;

  constructor(version: string = '1.0.0') {
    this.startTime = new Date();
    this.version = version;
  }

  async checkPostgreSQL(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      await pgPool.query('SELECT 1');
      const latency = Date.now() - startTime;
      return {
        status: 'healthy',
        latency_ms: latency,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async checkRedis(url?: string): Promise<HealthCheckResult> {
    if (!url) {
      return {
        status: 'degraded',
        error: 'Redis URL not configured',
      };
    }
    const startTime = Date.now();
    try {
      // Placeholder for actual Redis check
      // Will be implemented when Redis adapter is added
      const latency = Date.now() - startTime;
      return {
        status: 'healthy',
        latency_ms: latency,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async checkMessageBroker(url?: string): Promise<HealthCheckResult> {
    if (!url) {
      return {
        status: 'degraded',
        error: 'Message broker URL not configured',
      };
    }
    const startTime = Date.now();
    try {
      // Placeholder for actual message broker check
      // Will be implemented when message queue adapter is added
      const latency = Date.now() - startTime;
      return {
        status: 'healthy',
        latency_ms: latency,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getSystemHealth(): Promise<SystemHealth> {
    const [postgresql, redis, messageBroker] = await Promise.all([
      this.checkPostgreSQL(),
      this.checkRedis(process.env.REDIS_URL),
      this.checkMessageBroker(process.env.MESSAGE_BROKER_URL),
    ]);

    const dependencies: Record<string, HealthCheckResult> = {
      postgresql,
      redis_sessions: redis,
      redis_pricing: redis,
      message_broker: messageBroker,
    };

    const allHealthy = Object.values(dependencies).every((dep) => dep.status === 'healthy');
    const anyUnhealthy = Object.values(dependencies).some((dep) => dep.status === 'unhealthy');

    const status = allHealthy ? 'healthy' : anyUnhealthy ? 'unhealthy' : 'degraded';

    return {
      status,
      version: this.version,
      uptime_seconds: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
      dependencies,
    };
  }
}

export const healthChecker = new HealthChecker();
