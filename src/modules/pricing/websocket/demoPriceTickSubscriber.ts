import { cacheClient } from '../../../infrastructure/cache/index.js';
import { logger } from '../../../shared/middleware/logger.js';
import { ConnectionManager } from './connectionManager.js';
import { normalizeSymbol } from '../utils/symbolNormalizer.js';

interface DemoPriceMessage {
  symbol: string;
  bid: string;
  ask: string;
  mid: string;
  time: string;
  source: 'demo';
}

export class DemoPriceTickSubscriber {
  private active = false;

  constructor(private readonly connectionManager: ConnectionManager) {}

  async start(): Promise<void> {
    if (this.active) return;
    await cacheClient.subscribe('pricing', 'demo:ticks:all', (message) => {
      this.handleMessage(message);
    });
    this.active = true;
  }

  async stop(): Promise<void> {
    if (!this.active) return;
    await cacheClient.unsubscribe('pricing', 'demo:ticks:all');
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }

  private handleMessage(message: string): void {
    let tick: DemoPriceMessage;
    try {
      tick = JSON.parse(message) as DemoPriceMessage;
    } catch (error) {
      logger.error('Invalid demo price message', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return;
    }

    if (
      tick.source !== 'demo' ||
      typeof tick.symbol !== 'string' ||
      typeof tick.bid !== 'string' ||
      typeof tick.ask !== 'string' ||
      typeof tick.mid !== 'string' ||
      typeof tick.time !== 'string' ||
      ![tick.bid, tick.ask, tick.mid].every(
        (price) => Number.isFinite(Number(price)) && Number(price) > 0
      ) ||
      !Number.isFinite(new Date(tick.time).getTime())
    ) {
      logger.warn('Discarded demo price message with invalid provenance or shape');
      return;
    }

    const symbol = normalizeSymbol(tick.symbol);
    if (!symbol) {
      logger.warn('Discarded demo price message with an invalid symbol');
      return;
    }
    this.connectionManager.sendToChannel(
      `demo.price.${symbol}`,
      JSON.stringify({
        type: 'price',
        source: 'demo',
        symbol,
        price: tick.mid,
        bid: tick.bid,
        ask: tick.ask,
        tick_time: tick.time,
      })
    );
  }
}
