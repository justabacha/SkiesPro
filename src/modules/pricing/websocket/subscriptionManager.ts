import { ConnectionManager } from './connectionManager';
import { logger } from '../../../shared/middleware/logger';

export interface SubscribeMessage {
  type: 'subscribe';
  channels: Array<{ channel: string; symbol?: string }>;
}

export interface UnsubscribeMessage {
  type: 'unsubscribe';
  channels: Array<{ channel: string; symbol?: string }>;
}

export interface PingMessage {
  type: 'ping';
}

export type ClientMessage = SubscribeMessage | UnsubscribeMessage | PingMessage;

export class SubscriptionManager {
  private connectionManager: ConnectionManager;
  private readonly MAX_SUBSCRIPTIONS_PER_CONNECTION = parseInt(
    process.env.WS_MAX_SUBSCRIPTIONS_PER_CONNECTION || '8',
    10
  );
  private readonly VALID_CHANNELS = ['price', 'trades', 'notifications', 'wallet'];
  private readonly AVAILABLE_CHANNELS = ['price']; // Only price is available in WP-09
  private readonly MAX_MESSAGE_BYTES = 65536;
  private readonly onSymbolMutation?: (symbol: string, action: 'subscribe' | 'unsubscribe') => void;

  constructor(
    connectionManager: ConnectionManager,
    onSymbolMutation?: (symbol: string, action: 'subscribe' | 'unsubscribe') => void
  ) {
    this.connectionManager = connectionManager;
    this.onSymbolMutation = onSymbolMutation;
  }

  handleMessage(
    connectionId: string,
    message: string
  ): { success: boolean; response?: any; error?: string; requestId?: string } {
    try {
      if (Buffer.byteLength(message, 'utf8') > this.MAX_MESSAGE_BYTES) {
        return this.errorResponse('Message exceeds 64KB limit');
      }

      const parsed = JSON.parse(message) as Record<string, unknown>;

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return this.errorResponse('Invalid message format');
      }

      const requestId = typeof parsed.request_id === 'string' ? parsed.request_id : undefined;
      if (typeof parsed.type !== 'string') {
        return this.errorResponse('Invalid message format', requestId);
      }

      switch (parsed.type) {
        case 'subscribe':
          return this.handleSubscribe(connectionId, parsed as unknown as SubscribeMessage, requestId);
        case 'unsubscribe':
          return this.handleUnsubscribe(connectionId, parsed as unknown as UnsubscribeMessage, requestId);
        case 'ping':
          return this.handlePing(connectionId, requestId);
        default:
          return this.errorResponse('Unknown message type', requestId);
      }
    } catch (error) {
      logger.error('Failed to parse WebSocket message', {
        connectionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return this.errorResponse('Invalid JSON');
    }
  }

  private handleSubscribe(
    connectionId: string,
    message: SubscribeMessage,
    requestId?: string
  ): { success: boolean; response?: any; error?: string; requestId?: string } {
    const connection = this.connectionManager.getConnection(connectionId);
    if (!connection) {
      return this.errorResponse('Connection not found', requestId);
    }

    if (!message.channels || !Array.isArray(message.channels)) {
      return this.errorResponse('Invalid channels format', requestId);
    }

    const subscribedChannels: Array<{ channel: string; symbol?: string }> = [];
    const errors: string[] = [];

    if (
      connection.subscriptions.size + message.channels.length >
      this.MAX_SUBSCRIPTIONS_PER_CONNECTION
    ) {
      return this.errorResponse(
        `Maximum ${this.MAX_SUBSCRIPTIONS_PER_CONNECTION} subscriptions per connection`,
        requestId
      );
    }

    for (const channelRequest of message.channels) {
      if (!channelRequest || typeof channelRequest !== 'object' || Array.isArray(channelRequest)) {
        errors.push('Invalid channel request');
        continue;
      }

      const { channel, symbol } = channelRequest;
      const normalizedChannel = typeof channel === 'string' ? channel.trim() : '';
      const normalizedSymbol = typeof symbol === 'string' ? symbol.trim() : '';

      if (!this.VALID_CHANNELS.includes(normalizedChannel)) {
        errors.push(`Invalid channel: ${normalizedChannel || 'undefined'}`);
        continue;
      }

      if (!this.AVAILABLE_CHANNELS.includes(normalizedChannel)) {
        errors.push(`Channel not available yet: ${normalizedChannel}`);
        continue;
      }

      if (normalizedChannel === 'price') {
        if (!normalizedSymbol) {
          errors.push('Symbol required for price channel');
          continue;
        }

        if (!/^[A-Za-z0-9_./-]+$/.test(normalizedSymbol)) {
          errors.push(`Invalid symbol: ${normalizedSymbol}`);
          continue;
        }
      }

      const channelKey = normalizedSymbol
        ? `${normalizedChannel}.${normalizedSymbol}`
        : normalizedChannel;

      if (this.connectionManager.subscribe(connectionId, channelKey)) {
        subscribedChannels.push({
          channel: normalizedChannel,
          symbol: normalizedSymbol || undefined,
        });
        if (normalizedChannel === 'price' && normalizedSymbol && this.onSymbolMutation) {
          this.onSymbolMutation(normalizedSymbol, 'subscribe');
        }
      } else {
        errors.push(`Failed to subscribe to ${channelKey}`);
      }
    }

    if (subscribedChannels.length === 0 && errors.length > 0) {
      return this.errorResponse(errors.join(', '), requestId);
    }

    logger.info('Client subscribed to channels', {
      connectionId,
      userId: connection.userId,
      channels: subscribedChannels,
    });

    return {
      success: true,
      response: {
        type: 'subscribed',
        channels: subscribedChannels,
      },
      requestId,
    };
  }

  private handleUnsubscribe(
    connectionId: string,
    message: UnsubscribeMessage,
    requestId?: string
  ): { success: boolean; response?: any; error?: string; requestId?: string } {
    const connection = this.connectionManager.getConnection(connectionId);
    if (!connection) {
      return this.errorResponse('Connection not found', requestId);
    }

    if (!message.channels || !Array.isArray(message.channels)) {
      return this.errorResponse('Invalid channels format', requestId);
    }

    const unsubscribedChannels: Array<{ channel: string; symbol?: string }> = [];

    for (const channelRequest of message.channels) {
      if (!channelRequest || typeof channelRequest !== 'object' || Array.isArray(channelRequest)) {
        continue;
      }

      const { channel, symbol } = channelRequest;
      const normalizedChannel = typeof channel === 'string' ? channel.trim() : '';
      const normalizedSymbol = typeof symbol === 'string' ? symbol.trim() : '';
      const channelKey = normalizedSymbol
        ? `${normalizedChannel}.${normalizedSymbol}`
        : normalizedChannel;

      if (this.connectionManager.unsubscribe(connectionId, channelKey)) {
        unsubscribedChannels.push({
          channel: normalizedChannel,
          symbol: normalizedSymbol || undefined,
        });
        if (normalizedChannel === 'price' && normalizedSymbol && this.onSymbolMutation) {
          this.onSymbolMutation(normalizedSymbol, 'unsubscribe');
        }
      }
    }

    logger.info('Client unsubscribed from channels', {
      connectionId,
      userId: connection.userId,
      channels: unsubscribedChannels,
    });

    return {
      success: true,
      response: {
        type: 'unsubscribed',
        channels: unsubscribedChannels,
      },
      requestId,
    };
  }

  private handlePing(
    connectionId: string,
    requestId?: string
  ): { success: boolean; response?: any; requestId?: string } {
    const connection = this.connectionManager.getConnection(connectionId);
    if (!connection) {
      return { success: false, requestId };
    }

    return {
      success: true,
      response: {
        type: 'pong',
        timestamp: new Date().toISOString(),
      },
      requestId,
    };
  }

  private errorResponse(
    message: string,
    requestId?: string
  ): { success: boolean; error: string; requestId?: string } {
    return {
      success: false,
      error: message,
      requestId,
    };
  }

  sendError(connectionId: string, code: string, message: string, requestId?: string): void {
    const errorMessage = {
      type: 'error',
      code,
      message,
      request_id: requestId,
    };

    this.connectionManager.sendToConnection(connectionId, JSON.stringify(errorMessage));
  }

  sendConnected(connectionId: string, clientId: string): void {
    const connectedMessage = {
      type: 'connected',
      client_id: clientId,
    };

    this.connectionManager.sendToConnection(connectionId, JSON.stringify(connectedMessage));
  }
}
