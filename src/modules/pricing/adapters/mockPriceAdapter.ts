import { logger } from '../../../shared/middleware/logger';

export class MockPriceAdapter {
  private interval: NodeJS.Timeout | null = null;
  private readonly symbols = [
    { name: 'EUR/USD', base: 1.085, volatility: 0.0002 },
    { name: 'GBP/USD', base: 1.265, volatility: 0.0003 },
    { name: 'USD/JPY', base: 150.5, volatility: 0.05 },
    { name: 'XAU/USD', base: 2025.0, volatility: 0.5 },
    { name: 'BTC/USD', base: 52000.0, volatility: 10.0 },
    { name: 'ETH/USD', base: 2800.0, volatility: 1.0 },
    { name: 'WTI/USD', base: 78.0, volatility: 0.05 },
  ];

  private currentPrices: Record<string, number> = {};

  constructor(private onTick: (symbol: string, bid: string, ask: string, time: Date) => void) {
    // Initialize current prices with base values
    this.symbols.forEach((s) => {
      this.currentPrices[s.name] = s.base;
    });
  }

  connect() {
    logger.info('Starting Mock Price Generator');

    if (this.interval) {
      clearInterval(this.interval);
    }

    this.interval = setInterval(() => {
      this.generateTicks();
    }, 1000); // Generate ticks every second
  }

  private generateTicks() {
    const time = new Date();
    this.symbols.forEach((s) => {
      const change = (Math.random() - 0.5) * s.volatility * 2;
      this.currentPrices[s.name] += change;

      const mid = this.currentPrices[s.name];
      const spread = s.volatility * 2;
      const bid = (mid - spread / 2).toFixed(5);
      const ask = (mid + spread / 2).toFixed(5);

      this.onTick(s.name, bid, ask, time);
    });
  }

  disconnect() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    logger.info('Stopped Mock Price Generator');
  }
}
