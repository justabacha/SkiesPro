import { pgPool } from '../../config/database.js';

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
  private readonly postgresqlCacheTtlMs = 5000;
  private postgresqlCache: { result: HealthCheckResult; checkedAt: number } | null = null;
  private postgresqlCheckInFlight: Promise<HealthCheckResult> | null = null;

  constructor(
    version: string = '1.0.0',
    private readonly postgresProbe: () => Promise<void> = async () => {
      await pgPool.query('SELECT 1');
    }
  ) {
    this.startTime = new Date();
    this.version = version;
  }

  async checkPostgreSQL(): Promise<HealthCheckResult> {
    if (
      this.postgresqlCache &&
      Date.now() - this.postgresqlCache.checkedAt < this.postgresqlCacheTtlMs
    ) {
      return this.postgresqlCache.result;
    }
    if (this.postgresqlCheckInFlight) return this.postgresqlCheckInFlight;

    const check = this.runPostgreSQLCheck();
    this.postgresqlCheckInFlight = check;
    try {
      return await check;
    } finally {
      if (this.postgresqlCheckInFlight === check) {
        this.postgresqlCheckInFlight = null;
      }
    }
  }

  private async runPostgreSQLCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    let result: HealthCheckResult;
    try {
      await this.postgresProbe();
      const latency = Date.now() - startTime;
      result = {
        status: 'healthy',
        latency_ms: latency,
      };
    } catch (error) {
      result = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
    this.postgresqlCache = { result, checkedAt: Date.now() };
    return result;
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
    const [postgresql, messageBroker] = await Promise.all([
      this.checkPostgreSQL(),
      this.checkMessageBroker(process.env.MESSAGE_BROKER_URL),
    ]);

    const dependencies: Record<string, HealthCheckResult> = {
      postgresql,
      memory_cache: { status: 'healthy' },
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
