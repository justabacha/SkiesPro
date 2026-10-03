import WebSocket from 'ws';
import { logger } from '../../../shared/middleware/logger.js';

export interface CoinbaseTick {
  product_id: string;
  price?: string;
  best_bid?: string;
  best_ask?: string;
}

export class CoinbaseAdapter {
  private ws: WebSocket | null = null;
  private readonly url = 'wss://advanced-trade-ws.coinbase.com';
  private readonly symbolMapping: Record<string, string> = {
    'EUR-USD': 'EUR/USD',
    'GBP-USD': 'GBP/USD',
    'USD-JPY': 'USD/JPY',
    'PAXG-USD': 'XAU/USD',
    'BTC-USD': 'BTC/USD',
    'ETH-USD': 'ETH/USD',
  };

  private shouldReconnect = false;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private watchdogTimer: NodeJS.Timeout | null = null;
  private readonly watchdogMs = 20000;

  constructor(
    private onTick: (symbol: string, bid: string, ask: string, time: Date) => void,
    private onError?: (error: any) => void
  ) {}

  connect() {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    this.shouldReconnect = true;
    this.open();
  }

  disconnect() {
    this.shouldReconnect = false;
    this.clearTimers();
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.on('error', () => {});
      this.ws.close();
      this.ws = null;
    }
    logger.info('Coinbase WebSocket disconnected');
  }

  private open() {
    logger.info(`Connecting to Coinbase WebSocket: ${this.url}`);

    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.on('open', () => {
      logger.info('Connected to Coinbase WebSocket');
      this.reconnectAttempts = 0;
      this.resetWatchdog();

      const productIds = Object.keys(this.symbolMapping);
      ws.send(
        JSON.stringify({
          type: 'subscribe',
          product_ids: productIds,
          channel: 'ticker',
        })
      );
    });

    ws.on('message', (raw: WebSocket.RawData) => {
      this.resetWatchdog();
      try {
        this.handleMessage(JSON.parse(raw.toString()));
      } catch (error: any) {
        logger.error('Error parsing Coinbase message', { error: error.message });
      }
    });

    ws.on('error', (error: any) => {
      logger.error('Coinbase WebSocket error', { error: error.message });
      if (this.onError) {
        this.onError(error);
      }
    });

    ws.on('close', () => {
      logger.warn('Coinbase WebSocket closed');
      this.clearTimers();
      if (this.ws === ws) {
        this.ws = null;
      }
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    });
  }

  private handleMessage(msg: any) {
    const time = new Date();

    if (msg.channel === 'ticker' && Array.isArray(msg.events)) {
      for (const event of msg.events) {
        if (!Array.isArray(event.tickers)) continue;
        for (const ticker of event.tickers) {
          const symbol = this.symbolMapping[ticker.product_id];
          if (!symbol) continue;
          const bid = ticker.best_bid || ticker.price;
          const ask = ticker.best_ask || ticker.price;
          if (bid && ask && Number(bid) > 0 && Number(ask) > 0) {
            this.onTick(symbol, String(bid), String(ask), time);
          }
        }
      }
      return;
    }

    if (msg.type === 'ticker' && msg.product_id) {
      const symbol = this.symbolMapping[msg.product_id];
      if (symbol) {
        const bid = msg.best_bid || msg.price;
        const ask = msg.best_ask || msg.price;
        if (bid && ask && Number(bid) > 0 && Number(ask) > 0) {
          this.onTick(symbol, String(bid), String(ask), time);
        }
      }
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;

    const base = Math.min(30000, 1000 * 2 ** this.reconnectAttempts);
    const delay = base / 2 + Math.random() * (base / 2);
    this.reconnectAttempts++;

    logger.info(
      `Reconnecting to Coinbase in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})`
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.shouldReconnect) {
        this.open();
      }
    }, delay);
  }

  private resetWatchdog() {
    if (this.watchdogTimer) clearTimeout(this.watchdogTimer);
    this.watchdogTimer = setTimeout(() => {
      logger.warn('Coinbase WebSocket stalled, reconnecting');
      this.ws?.terminate();
    }, this.watchdogMs);
  }

  private clearTimers() {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
