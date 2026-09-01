import WebSocket from 'ws';
import { ConnectionManager } from './connectionManager.js';
import { SubscriptionManager } from './subscriptionManager.js';
import { RedisSubscriber } from './redisSubscriber.js';
import { webSocketAuthMiddleware } from './authMiddleware.js';
import { logger } from '../../../shared/middleware/logger.js';
import { v4 as uuidv4 } from 'uuid';

export class PriceGateway {
  private wss: WebSocket.Server | null = null;
  private connectionManager: ConnectionManager;
  private subscriptionManager: SubscriptionManager;
  private redisSubscriber: RedisSubscriber;
  private readonly MAX_CONNECTIONS_PER_USER = parseInt(
    process.env.WS_MAX_CONNECTIONS_PER_USER || '5',
    10
  );
  private readonly INBOUND_RATE_LIMIT_PER_MIN = parseInt(
    process.env.WS_INBOUND_RATE_LIMIT_PER_MIN || '10',
    10
  );
  private rateLimitMap: Map<string, { count: number; resetTime: Date }> = new Map();

  constructor() {
    this.connectionManager = new ConnectionManager();
    this.redisSubscriber = new RedisSubscriber(this.connectionManager);
    this.subscriptionManager = new SubscriptionManager(this.connectionManager, (symbol, action) => {
      if (action === 'subscribe') {
        void this.redisSubscriber.subscribeToSymbol(symbol);
        return;
      }

      void this.redisSubscriber.unsubscribeFromSymbol(symbol);
    });
  }

  attach(server: any, options: { path?: string } = {}): void {
    const path = options.path || process.env.WS_PATH || '/ws/v1';

    this.wss = new WebSocket.Server({
      server,
      path,
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    this.wss.on('error', this.handleError.bind(this));

    logger.info('WebSocket gateway attached to server', { path });
  }

  private async handleConnection(socket: WebSocket, request: any): Promise<void> {
    const connectionId = uuidv4();
    const url = request.url;

    // Extract and validate token
    const token = webSocketAuthMiddleware.extractTokenFromUrl(url);
    if (!token) {
      logger.warn('WebSocket connection rejected: No token provided', { connectionId });
      socket.close(1008, 'Policy violation: No token provided');
      return;
    }

    // Authenticate
    const auth = await webSocketAuthMiddleware.authenticate(token);
    if (!auth) {
      logger.warn('WebSocket connection rejected: Invalid token', { connectionId });
      socket.close(1008, 'Policy violation: Invalid token');
      return;
    }

    // Check connection limit per user
    const userConnections = this.connectionManager.getUserConnections(auth.userId);
    if (userConnections.length >= this.MAX_CONNECTIONS_PER_USER) {
      logger.warn('WebSocket connection rejected: Too many connections', {
        connectionId,
        userId: auth.userId,
        currentConnections: userConnections.length,
        maxConnections: this.MAX_CONNECTIONS_PER_USER,
      });
      socket.close(1008, 'Policy violation: Too many connections');
      return;
    }

    // Add connection
    const connId = this.connectionManager.addConnection(auth.userId, socket);

    // Send connected message
    this.subscriptionManager.sendConnected(connId, connId);

    logger.info('WebSocket connection established', {
      connectionId: connId,
      userId: auth.userId,
      role: auth.role,
    });

    // Setup message handler
    socket.on('message', (data: WebSocket.Data) => {
      this.handleMessage(connId, auth.userId, data);
    });

    // Start Redis subscriber if not already started
    if (!this.redisSubscriber.isActive()) {
      try {
        await this.redisSubscriber.start();
      } catch (error) {
        logger.error('Failed to start Redis subscriber', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  private handleMessage(connectionId: string, userId: string, data: WebSocket.Data): void {
    const rawMessage = data.toString();
    const requestId = (() => {
      try {
        const parsed = JSON.parse(rawMessage) as Record<string, unknown>;
        return typeof parsed.request_id === 'string' ? parsed.request_id : undefined;
      } catch {
        return undefined;
      }
    })();

    if (!this.checkRateLimit(connectionId)) {
      logger.warn('WebSocket rate limit exceeded', { connectionId, userId });
      this.subscriptionManager.sendError(connectionId, 'WS_001', 'Rate limit exceeded', requestId);

      const rateLimitInfo = this.rateLimitMap.get(connectionId);
      if (rateLimitInfo && rateLimitInfo.count >= 3) {
        const connection = this.connectionManager.getConnection(connectionId);
        if (connection && connection.socket.readyState === WebSocket.OPEN) {
          connection.socket.close(4001, 'Rate limit exceeded');
        }
      }
      return;
    }

    try {
      const result = this.subscriptionManager.handleMessage(connectionId, rawMessage);

      if (result.success && result.response) {
        this.connectionManager.sendToConnection(connectionId, JSON.stringify(result.response));
      } else if (!result.success && result.error) {
        this.subscriptionManager.sendError(
          connectionId,
          'WS_001',
          result.error,
          result.requestId || requestId
        );
      }
    } catch (error) {
      logger.error('Error handling WebSocket message', {
        connectionId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.subscriptionManager.sendError(
        connectionId,
        'WS_001',
        'Internal server error',
        requestId
      );
    }
  }

  private handleError(error: Error): void {
    logger.error('WebSocket server error', {
      error: error.message,
    });
  }

  private checkRateLimit(connectionId: string): boolean {
    const now = new Date();
    const rateLimitInfo = this.rateLimitMap.get(connectionId);

    if (!rateLimitInfo || now > rateLimitInfo.resetTime) {
      // Reset or create new rate limit entry
      this.rateLimitMap.set(connectionId, {
        count: 1,
        resetTime: new Date(now.getTime() + 60000), // 1 minute
      });
      return true;
    }

    if (rateLimitInfo.count >= this.INBOUND_RATE_LIMIT_PER_MIN) {
      return false;
    }

    rateLimitInfo.count++;
    return true;
  }

  getStats(): {
    totalConnections: number;
    totalUsers: number;
    totalSubscriptions: number;
    redisSubscriberActive: boolean;
  } {
    const connStats = this.connectionManager.getStats();
    return {
      ...connStats,
      redisSubscriberActive: this.redisSubscriber.isActive(),
    };
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down WebSocket gateway');

    // Stop Redis subscriber
    await this.redisSubscriber.stop();

    // Shutdown connection manager
    this.connectionManager.shutdown();

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    logger.info('WebSocket gateway shutdown complete');
  }
}

export const priceGateway = new PriceGateway();
