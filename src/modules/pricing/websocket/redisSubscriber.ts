import { cacheClient } from '../../../infrastructure/cache';
import { ConnectionManager } from './connectionManager';
import { logger } from '../../../shared/middleware/logger';

export interface PriceTick {
  symbol: string;
  bid: string;
  ask: string;
  mid: string;
  time: string;
}

export class RedisSubscriber {
  private connectionManager: ConnectionManager;
  private isSubscribed: boolean = false;
  private activeChannels: Set<string> = new Set();

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
  }

  async subscribeToSymbol(symbol: string): Promise<void> {
    const channel = `ticks:${symbol}`;
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
    const channel = `ticks:${symbol}`;
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
      logger.warn('Redis subscriber already started');
      return;
    }

    try {
      await cacheClient.subscribe('pricing', 'ticks:all', (message: string) => {
        this.handlePriceMessage(message);
      });
      this.activeChannels.add('ticks:all');
      this.isSubscribed = true;
      logger.info('Redis subscriber started', { channels: Array.from(this.activeChannels) });
    } catch (error) {
      logger.error('Failed to start Redis subscriber', {
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
      logger.info('Redis subscriber stopped');
    } catch (error) {
      logger.error('Failed to stop Redis subscriber', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private handlePriceMessage(message: string, specificSymbol?: string): void {
    try {
      const tick: PriceTick = JSON.parse(message);
      const symbol = specificSymbol || tick.symbol;

      // Convert to ADS price message format
      const priceMessage = {
        type: 'price',
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
