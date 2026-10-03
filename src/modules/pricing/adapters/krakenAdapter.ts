import WebSocket from 'ws';
import { logger } from '../../../shared/middleware/logger.js';

export interface KrakenTick {
  symbol: string;
  bid: number;
  bid_qty: number;
  ask: number;
  ask_qty: number;
  last?: number;
  timestamp?: string;
}

export class KrakenAdapter {
  private ws: WebSocket | null = null;
  private readonly url = 'wss://ws.kraken.com/v2';
  private readonly symbolMapping: Record<string, string> = {
    'EUR/USD': 'EUR/USD',
    'GBP/USD': 'GBP/USD',
    'USD/JPY': 'USD/JPY',
    'PAXG/USD': 'XAU/USD',
    'BTC/USD': 'BTC/USD',
    'ETH/USD': 'ETH/USD',
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
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
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
    logger.info('Kraken WebSocket disconnected');
  }

  private open() {
    logger.info(`Connecting to Kraken WebSocket: ${this.url}`);

    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.on('open', () => {
      logger.info('Connected to Kraken WebSocket');
      this.reconnectAttempts = 0;
      this.resetWatchdog();

      ws.send(
        JSON.stringify({
          method: 'subscribe',
          params: {
            channel: 'ticker',
            symbol: Object.keys(this.symbolMapping),
            event_trigger: 'bbo',
          },
        })
      );
    });

    ws.on('message', (raw: WebSocket.RawData) => {
      this.resetWatchdog();
      try {
        this.handleMessage(JSON.parse(raw.toString()));
      } catch (error: any) {
        logger.error('Error parsing Kraken message', { error: error.message });
      }
    });

    ws.on('error', (error: any) => {
      logger.error('Kraken WebSocket error', { error: error.message });
      if (this.onError) {
        this.onError(error);
      }
    });

    ws.on('close', () => {
      logger.warn('Kraken WebSocket closed');
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
    if (msg.method === 'subscribe') {
      if (msg.success === false) {
        logger.error('Kraken subscription failed', { symbol: msg.symbol ?? msg.result?.symbol, error: msg.error });
      }
      return;
    }

    if (msg.channel !== 'ticker' || !Array.isArray(msg.data)) {
      return;
    }

    const time = new Date();
    for (const tick of msg.data as KrakenTick[]) {
      const symbol = this.symbolMapping[tick.symbol];
      if (!symbol) continue;
      if (!(tick.bid > 0) || !(tick.ask > 0) || tick.bid > tick.ask) continue;

      this.onTick(symbol, String(tick.bid), String(tick.ask), time);
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;

    const base = Math.min(30000, 1000 * 2 ** this.reconnectAttempts);
    const delay = base / 2 + Math.random() * (base / 2);
    this.reconnectAttempts++;

    logger.info(`Reconnecting to Kraken in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})`);

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
      logger.warn('Kraken WebSocket stalled, reconnecting');
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
