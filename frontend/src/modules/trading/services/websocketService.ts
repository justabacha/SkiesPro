import { WebSocketClient, WebSocketMessage, SubscribeChannel } from '@/shared/ws/websocketClient';
import { PriceTick, LatencyState, LatencyStatus } from '../types/trading.types';
import type { AccountMode } from '@/shared/context/AccountModeContext';

export type PriceTickCallback = (tick: PriceTick) => void;
export type LatencyCallback = (state: LatencyState) => void;
export type ConnectionStateCallback = (isConnected: boolean) => void;

class WebsocketService {
  private client: WebSocketClient | null = null;
  private currentSymbol: string | null = null;
  private currentMode: AccountMode = 'real';
  private priceCallbacks: Set<PriceTickCallback> = new Set();
  private latencyCallbacks: Set<LatencyCallback> = new Set();
  private connectionCallbacks: Set<ConnectionStateCallback> = new Set();
  private lastPingTime: number = 0;
  private latencyMs: number = 25;
  private pingIntervalId: ReturnType<typeof setInterval> | null = null;
  private isConnected: boolean = false;

  public initialize(token: string, wsUrl?: string): void {
    if (this.client) {
      this.disconnect();
    }

    const defaultWsUrl =
      typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_URL
        ? import.meta.env.VITE_WS_URL
        : 'ws://localhost:3000/ws/v1';

    const url = wsUrl || defaultWsUrl;

    this.client = new WebSocketClient({
      url,
      token,
      onConnected: () => {
        this.isConnected = true;
        this.notifyConnectionState(true);
        this.startPingInterval();

        if (this.currentSymbol) {
          this.subscribeSymbol(this.currentSymbol, this.currentMode);
        }
      },
      onMessage: (msg: WebSocketMessage) => {
        this.handleMessage(msg);
      },
      onDisconnected: () => {
        this.isConnected = false;
        this.stopPingInterval();
        this.notifyConnectionState(false);
        this.notifyLatency({
          latencyMs: 0,
          status: 'disconnected',
          isConnected: false,
        });
      },
      onError: (err) => {
        console.warn('Trading WebSocket error:', err);
      },
    });

    this.client.connect();
  }

  public subscribeSymbol(symbol: string, mode: AccountMode = 'real'): void {
    const previousSymbol = this.currentSymbol;
    const previousMode = this.currentMode;
    this.currentSymbol = symbol;
    this.currentMode = mode;

    if (!this.client || !this.client.isConnected()) {
      return;
    }

    if (previousSymbol && (previousSymbol !== symbol || previousMode !== mode)) {
      const unsubChannel = this.toChannel(previousSymbol, previousMode);
      this.client.unsubscribe([unsubChannel]);
    }

    const subChannel = this.toChannel(symbol, mode);
    this.client.subscribe([subChannel]);
  }

  public unsubscribeSymbol(symbol: string, mode: AccountMode = this.currentMode): void {
    if (this.currentSymbol === symbol && this.currentMode === mode) {
      this.currentSymbol = null;
    }

    if (this.client) {
      const unsubChannel = this.toChannel(symbol, mode);
      this.client.unsubscribe([unsubChannel]);
    }
  }

  public onPriceTick(callback: PriceTickCallback): () => void {
    this.priceCallbacks.add(callback);
    return () => {
      this.priceCallbacks.delete(callback);
    };
  }

  public onLatencyChange(callback: LatencyCallback): () => void {
    this.latencyCallbacks.add(callback);
    // Immediately emit current latency
    callback(this.getLatencyState());
    return () => {
      this.latencyCallbacks.delete(callback);
    };
  }

  public onConnectionStateChange(callback: ConnectionStateCallback): () => void {
    this.connectionCallbacks.add(callback);
    callback(this.isConnected);
    return () => {
      this.connectionCallbacks.delete(callback);
    };
  }

  public getLatencyState(): LatencyState {
    if (!this.isConnected) {
      return { latencyMs: 0, status: 'disconnected', isConnected: false };
    }

    let status: LatencyStatus = 'good';
    if (this.latencyMs > 300) {
      status = 'poor';
    } else if (this.latencyMs > 100) {
      status = 'moderate';
    }

    return {
      latencyMs: this.latencyMs,
      status,
      isConnected: true,
    };
  }

  public disconnect(): void {
    this.stopPingInterval();
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
    this.isConnected = false;
    this.currentSymbol = null;
    this.currentMode = 'real';
  }

  private handleMessage(msg: WebSocketMessage): void {
    if (msg.type === 'price') {
      if (this.currentMode === 'demo' && msg.source !== 'demo') return;
      if (this.currentMode === 'real' && msg.source !== 'live') return;

      const rawPrice = msg.price !== undefined ? msg.price : msg.mid;
      const numericPrice =
        typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice || '0'));

      const tick: PriceTick = {
        symbol: String(msg.symbol || this.currentSymbol || 'EUR/USD'),
        price: numericPrice,
        bid: msg.bid !== undefined ? Number(msg.bid) : undefined,
        ask: msg.ask !== undefined ? Number(msg.ask) : undefined,
        tick_time: String(msg.tick_time || msg.time || new Date().toISOString()),
        timestamp: Date.now(),
      };

      // Measure message transit time if tick_time is present
      if (msg.tick_time) {
        const tickTs = new Date(String(msg.tick_time)).getTime();
        if (!isNaN(tickTs) && tickTs > 0) {
          const delta = Math.abs(Date.now() - tickTs);
          if (delta > 0 && delta < 5000) {
            this.latencyMs = Math.round(this.latencyMs * 0.7 + delta * 0.3);
            this.notifyLatency(this.getLatencyState());
          }
        }
      }

      this.priceCallbacks.forEach((cb) => cb(tick));
    } else if (msg.type === 'pong') {
      if (this.lastPingTime > 0) {
        const roundTrip = Date.now() - this.lastPingTime;
        this.latencyMs = Math.round(roundTrip / 2);
        this.notifyLatency(this.getLatencyState());
      }
    }
  }

  private startPingInterval(): void {
    this.stopPingInterval();
    this.pingIntervalId = setInterval(() => {
      if (this.client && this.client.isConnected()) {
        this.lastPingTime = Date.now();
        // Ping is managed by WebSocket client / browser or server message
      }
    }, 10000);
  }

  private stopPingInterval(): void {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
  }

  private toChannel(symbol: string, mode: AccountMode): SubscribeChannel {
    return { channel: mode === 'demo' ? 'demo.price' : 'price', symbol };
  }

  private notifyLatency(state: LatencyState): void {
    this.latencyCallbacks.forEach((cb) => cb(state));
  }

  private notifyConnectionState(connected: boolean): void {
    this.connectionCallbacks.forEach((cb) => cb(connected));
  }
}

export const websocketService = new WebsocketService();
