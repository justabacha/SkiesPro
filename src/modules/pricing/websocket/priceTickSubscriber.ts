import { cacheClient } from '../../../infrastructure/cache/index.js';
import { normalizeSymbol } from '../utils/symbolNormalizer.js';
import { ConnectionManager } from './connectionManager.js';
import { logger } from '../../../shared/middleware/logger.js';

export interface PriceTick {
  symbol: string;
  bid: string;
  ask: string;
  mid: string;
  time: string;
}

export class PriceTickSubscriber {
  private connectionManager: ConnectionManager;
  private isSubscribed: boolean = false;
  private activeChannels: Set<string> = new Set();

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
  }

  async subscribeToSymbol(symbol: string): Promise<void> {
    const normalizedSymbol = normalizeSymbol(symbol);
    const channel = `ticks:${normalizedSymbol}`;
    if (this.activeChannels.has(channel)) {
      return;
    }

    try {
      await cacheClient.subscribe('pricing', channel, (message: string) => {
        this.handlePriceMessage(message, symbol);
      });
      this.activeChannels.add(channel);
      logger.info('Subscribed to symbol channel', { channel });
    } catch (error) {
      logger.error('Failed to subscribe to symbol channel', {
        channel,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async unsubscribeFromSymbol(symbol: string): Promise<void> {
    const channel = `ticks:${normalizeSymbol(symbol)}`;
    if (!this.activeChannels.has(channel)) {
      return;
    }

    try {
      await cacheClient.unsubscribe('pricing', channel);
      this.activeChannels.delete(channel);
      logger.info('Unsubscribed from symbol channel', { channel });
    } catch (error) {
      logger.error('Failed to unsubscribe from symbol channel', {
        channel,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async start(): Promise<void> {
    if (this.isSubscribed) {
      logger.warn('Price tick subscriber already started');
      return;
    }

    try {
      await cacheClient.subscribe('pricing', 'ticks:all', (message: string) => {
        this.handlePriceMessage(message);
      });
      this.activeChannels.add('ticks:all');
      this.isSubscribed = true;
      logger.info('Price tick subscriber started', { channels: Array.from(this.activeChannels) });
    } catch (error) {
      logger.error('Failed to start price tick subscriber', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isSubscribed && this.activeChannels.size === 0) {
      return;
    }

    try {
      for (const channel of Array.from(this.activeChannels)) {
        await cacheClient.unsubscribe('pricing', channel);
      }
      this.activeChannels.clear();
      this.isSubscribed = false;
      logger.info('Price tick subscriber stopped');
    } catch (error) {
      logger.error('Failed to stop price tick subscriber', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private handlePriceMessage(message: string, specificSymbol?: string): void {
    try {
      const tick: PriceTick = JSON.parse(message);
      const symbol = normalizeSymbol(specificSymbol || tick.symbol);

      // Convert to ADS price message format
      const priceMessage = {
        type: 'price',
        source: 'live',
        symbol: symbol,
        price: tick.mid,
        bid: tick.bid,
        ask: tick.ask,
        tick_time: tick.time,
      };

      const messageString = JSON.stringify(priceMessage);

      // Send to subscribers of this specific symbol
      const channelKey = `price.${symbol}`;
      const sentCount = this.connectionManager.sendToChannel(channelKey, messageString);

      // Also send to price.all subscribers
      const allCount = this.connectionManager.sendToChannel('price.all', messageString);

      if (sentCount > 0 || allCount > 0) {
        logger.debug('Price tick forwarded to WebSocket clients', {
          symbol,
          specificSubscribers: sentCount,
          allSubscribers: allCount,
        });
      }
    } catch (error) {
      logger.error('Failed to handle price message', {
        message,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  isActive(): boolean {
    return this.isSubscribed;
  }
}
