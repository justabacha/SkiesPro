export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export interface SubscribeChannel {
  channel: string;
  symbol?: string;
}

export interface WebSocketClientConfig {
  url: string;
  token: string;
  reconnectDelays?: number[];
  maxReconnectAttempts?: number;
  onConnected?: (clientId: string) => void;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: WebSocketMessage) => void;
  onDisconnected?: () => void;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketClientConfig>;
  private reconnectAttempts: number = 0;
  private reconnectTimeout: any = null;
  private subscriptions: SubscribeChannel[] = [];
  private clientId: string | null = null;
  private isManualDisconnect: boolean = false;

  private readonly DEFAULT_RECONNECT_DELAYS = [1000, 5000, 15000, 30000]; // 1s, 5s, 15s, 30s
  private readonly MAX_RECONNECT_ATTEMPTS = 5;

  constructor(config: WebSocketClientConfig) {
    const defaultWsUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_URL
      ? import.meta.env.VITE_WS_URL
      : undefined;

    this.config = {
      url: config.url || defaultWsUrl || 'ws://localhost:3000/ws/v1',
      token: config.token,
      reconnectDelays: config.reconnectDelays || this.DEFAULT_RECONNECT_DELAYS,
      maxReconnectAttempts: config.maxReconnectAttempts || this.MAX_RECONNECT_ATTEMPTS,
      onConnected: config.onConnected || (() => {}),
      onMessage: config.onMessage || (() => {}),
      onError: config.onError || (() => {}),
      onDisconnected: config.onDisconnected || (() => {}),
    };
  }

  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.warn('WebSocket already connected');
      return;
    }

    this.isManualDisconnect = false;
    const url = `${this.config.url}?token=${this.config.token}`;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
    } catch (error) {
      console.error('Failed to create WebSocket connection', error);
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.isManualDisconnect = true;
    this.clearReconnectTimeout();

    if (this.ws) {
      this.ws.close(1000, 'Normal closure');
      this.ws = null;
    }
  }

  subscribe(channels: SubscribeChannel[]): void {
    this.subscriptions.push(...channels);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendSubscribe(channels);
    }
  }

  unsubscribe(channels: SubscribeChannel[]): void {
    this.subscriptions = this.subscriptions.filter(
      sub => !channels.some(ch => ch.channel === sub.channel && ch.symbol === sub.symbol)
    );

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendUnsubscribe(channels);
    }
  }

  private sendSubscribe(channels: SubscribeChannel[]): void {
    this.send({
      type: 'subscribe',
      channels,
    });
  }

  private sendUnsubscribe(channels: SubscribeChannel[]): void {
    this.send({
      type: 'unsubscribe',
      channels,
    });
  }

  private send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private handleOpen(): void {
    console.log('WebSocket connected');
    this.reconnectAttempts = 0;
    this.clearReconnectTimeout();

    // Re-subscribe to all channels after reconnection
    if (this.subscriptions.length > 0) {
      this.sendSubscribe(this.subscriptions);
    }
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);

      switch (message.type) {
        case 'connected':
          this.clientId = message.client_id;
          this.config.onConnected(this.clientId);
          break;

        case 'subscribed':
          console.log('Subscribed to channels', message.channels);
          break;

        case 'unsubscribed':
          console.log('Unsubscribed from channels', message.channels);
          break;

        case 'pong':
          // Ping/pong handled automatically by browser
          break;

        case 'error':
          this.config.onError(message);
          break;

        default:
          this.config.onMessage(message);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message', error);
    }
  }

  private handleError(error: Event): void {
    console.error('WebSocket error', error);
  }

  private handleClose(event: CloseEvent): void {
    console.log('WebSocket closed', {
      code: event.code,
      reason: event.reason,
    });

    this.ws = null;
    this.clientId = null;
    this.config.onDisconnected();

    if (!this.isManualDisconnect) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    const delayIndex = Math.min(this.reconnectAttempts, this.config.reconnectDelays.length - 1);
    const delay = this.config.reconnectDelays[delayIndex];

    console.log(`Scheduling reconnection in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay) as any;
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout as any);
      this.reconnectTimeout = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  getClientId(): string | null {
    return this.clientId;
  }

  getSubscriptions(): SubscribeChannel[] {
    return [...this.subscriptions];
  }
}