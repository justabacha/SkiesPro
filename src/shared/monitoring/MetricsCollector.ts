export interface MetricData {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp: Date;
}

export interface MetricsAdapter {
  increment(metricName: string, value?: number, tags?: Record<string, string>): void;
  gauge(metricName: string, value: number, tags?: Record<string, string>): void;
  histogram(metricName: string, value: number, tags?: Record<string, string>): void;
  timing(metricName: string, duration: number, tags?: Record<string, string>): void;
}

class NoOpMetricsAdapter implements MetricsAdapter {
  increment(): void {}
  gauge(): void {}
  histogram(): void {}
  timing(): void {}
}

export class MetricsCollector {
  private adapter: MetricsAdapter;
  private metrics: MetricData[] = [];
  private maxBufferSize = 1000;

  constructor(adapter?: MetricsAdapter) {
    this.adapter = adapter || new NoOpMetricsAdapter();
  }

  increment(metricName: string, value = 1, tags?: Record<string, string>): void {
    const metric: MetricData = {
      name: metricName,
      value,
      tags,
      timestamp: new Date(),
    };
    this.addMetric(metric);
    this.adapter.increment(metricName, value, tags);
  }

  gauge(metricName: string, value: number, tags?: Record<string, string>): void {
    const metric: MetricData = {
      name: metricName,
      value,
      tags,
      timestamp: new Date(),
    };
    this.addMetric(metric);
    this.adapter.gauge(metricName, value, tags);
  }

  histogram(metricName: string, value: number, tags?: Record<string, string>): void {
    const metric: MetricData = {
      name: metricName,
      value,
      tags,
      timestamp: new Date(),
    };
    this.addMetric(metric);
    this.adapter.histogram(metricName, value, tags);
  }

  timing(metricName: string, duration: number, tags?: Record<string, string>): void {
    const metric: MetricData = {
      name: metricName,
      value: duration,
      tags,
      timestamp: new Date(),
    };
    this.addMetric(metric);
    this.adapter.timing(metricName, duration, tags);
  }

  private addMetric(metric: MetricData): void {
    this.metrics.push(metric);
    if (this.metrics.length > this.maxBufferSize) {
      this.metrics.shift();
    }
  }

  getMetrics(): MetricData[] {
    return [...this.metrics];
  }

  clearMetrics(): void {
    this.metrics = [];
  }
}

export const metricsCollector = new MetricsCollector();
