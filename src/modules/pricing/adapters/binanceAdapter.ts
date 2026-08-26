import { logger } from '../../../shared/middleware/logger';

export interface BinanceTick {
  s: string; // Symbol
  b: string; // Bid price
  B: string; // Bid quantity
  a: string; // Ask price
  A: string; // Ask quantity
  T: number; // Transaction time
}

export class BinanceAdapter {
  private ws: any;
  private readonly baseUrl = 'wss://stream.binance.com:9443/ws';
  private readonly symbolMapping: Record<string, string> = {
    EURUSDT: 'EUR/USD',
    GBPUSDT: 'GBP/USD',
    USDJPY: 'USD/JPY',
    PAXGUSDT: 'XAU/USD',
    BTCUSDT: 'BTC/USD',
    ETHUSDT: 'ETH/USD',
    USDCUSDT: 'WTI/USD', // Placeholder for Oil
  };

  constructor(private onTick: (symbol: string, bid: string, ask: string, time: Date) => void) {}

  connect() {
    const streams = Object.keys(this.symbolMapping)
      .map((s) => `${s.toLowerCase()}@bookTicker`)
      .join('/');
    const url = `${this.baseUrl}/${streams}`;

    logger.info(`Connecting to Binance WebSocket: ${url}`);

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      logger.info('Connected to Binance WebSocket');
    };

    this.ws.onmessage = (event: any) => {
      try {
        const data = JSON.parse(event.data);
        if (data.s && this.symbolMapping[data.s]) {
          const symbol = this.symbolMapping[data.s];
          const bid = data.b;
          const ask = data.a;
          const time = new Date(); // bookTicker doesn't always have T, using current time for normalized feed
          this.onTick(symbol, bid, ask, time);
        }
      } catch (error: any) {
        logger.error('Error parsing Binance message', { error: error.message });
      }
    };

    this.ws.onerror = (error: any) => {
      logger.error('Binance WebSocket error', { error: error.message });
    };

    this.ws.onclose = () => {
      logger.warn('Binance WebSocket closed. Reconnecting in 5s...');
      setTimeout(() => this.connect(), 5000);
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}
