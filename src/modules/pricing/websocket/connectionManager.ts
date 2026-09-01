import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../../shared/middleware/logger.js';

export interface ConnectionInfo {
  id: string;
  userId: string;
  socket: WebSocket;
  subscriptions: Set<string>;
  lastSeen: Date;
  pingInterval?: NodeJS.Timeout;
  messageQueue: string[];
  isDead: boolean;
}

export class ConnectionManager {
  private connections: Map<string, ConnectionInfo> = new Map();
  private userConnections: Map<string, Set<string>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly PING_INTERVAL = 30000; // 30 seconds
  private readonly TIMEOUT_MS = 60000; // 60 seconds
  private readonly MAX_QUEUE_SIZE = 256;

  constructor() {
    this.startCleanup();
  }

  addConnection(userId: string, socket: WebSocket): string {
    const connectionId = uuidv4();
    const connectionInfo: ConnectionInfo = {
      id: connectionId,
      userId,
      socket,
      subscriptions: new Set(),
      lastSeen: new Date(),
      messageQueue: [],
      isDead: false,
    };

    this.connections.set(connectionId, connectionInfo);

    // Track user connections
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(connectionId);

    // Start ping interval
    this.startPingInterval(connectionInfo);

    // Setup socket event handlers
    this.setupSocketHandlers(connectionInfo);

    logger.info('WebSocket connection added', {
      connectionId,
      userId,
      totalConnections: this.connections.size,
    });

    return connectionId;
  }

  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Clear ping interval
    if (connection.pingInterval) {
      clearInterval(connection.pingInterval);
    }

    // Remove from user connections
    const userConns = this.userConnections.get(connection.userId);
    if (userConns) {
      userConns.delete(connectionId);
      if (userConns.size === 0) {
        this.userConnections.delete(connection.userId);
      }
    }

    // Close socket if not already closed
    if (connection.socket.readyState === WebSocket.OPEN) {
      connection.socket.close(1000, 'Normal closure');
    }

    this.connections.delete(connectionId);

    logger.info('WebSocket connection removed', {
      connectionId,
      userId: connection.userId,
      remainingConnections: this.connections.size,
    });
  }

  subscribe(connectionId: string, channel: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.isDead) {
      return false;
    }

    connection.subscriptions.add(channel);
    logger.debug('Connection subscribed to channel', {
      connectionId,
      channel,
      totalSubscriptions: connection.subscriptions.size,
    });

    return true;
  }

  unsubscribe(connectionId: string, channel: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    const removed = connection.subscriptions.delete(channel);
    if (removed) {
      logger.debug('Connection unsubscribed from channel', {
        connectionId,
        channel,
        remainingSubscriptions: connection.subscriptions.size,
      });
    }

    return removed;
  }

  sendToConnection(connectionId: string, message: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.isDead) {
      return false;
    }

    if (connection.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    // Check message size (64KB max)
    if (Buffer.byteLength(message, 'utf8') > 65536) {
      logger.warn('Message exceeds 64KB limit, dropping', {
        connectionId,
        size: Buffer.byteLength(message, 'utf8'),
      });
      return false;
    }

    // Manage queue size
    if (connection.messageQueue.length >= this.MAX_QUEUE_SIZE) {
      // Drop oldest message
      connection.messageQueue.shift();
      logger.debug('Message queue full, dropped oldest message', {
        connectionId,
        queueSize: connection.messageQueue.length,
      });
    }

    connection.messageQueue.push(message);
    this.flushQueue(connection);

    return true;
  }

  sendToUser(userId: string, message: string): number {
    const userConns = this.userConnections.get(userId);
    if (!userConns) {
      return 0;
    }

    let sentCount = 0;
    userConns.forEach((connectionId) => {
      if (this.sendToConnection(connectionId, message)) {
        sentCount++;
      }
    });

    return sentCount;
  }

  sendToChannel(channel: string, message: string): number {
    let sentCount = 0;
    this.connections.forEach((connection) => {
      if (connection.subscriptions.has(channel)) {
        if (this.sendToConnection(connection.id, message)) {
          sentCount++;
        }
      }
    });

    return sentCount;
  }

  getConnection(connectionId: string): ConnectionInfo | undefined {
    return this.connections.get(connectionId);
  }

  getUserConnections(userId: string): ConnectionInfo[] {
    const userConnIds = this.userConnections.get(userId);
    if (!userConnIds) {
      return [];
    }

    const connections: ConnectionInfo[] = [];
    userConnIds.forEach((connId) => {
      const conn = this.connections.get(connId);
      if (conn) {
        connections.push(conn);
      }
    });

    return connections;
  }

  private startPingInterval(connection: ConnectionInfo): void {
    connection.pingInterval = setInterval(() => {
      if (connection.isDead || connection.socket.readyState !== WebSocket.OPEN) {
        this.removeConnection(connection.id);
        return;
      }

      connection.socket.ping();

      // Check for timeout
      const now = new Date();
      const timeSinceLastSeen = now.getTime() - connection.lastSeen.getTime();

      if (timeSinceLastSeen >= this.TIMEOUT_MS) {
        logger.warn('Connection timeout, closing', {
          connectionId: connection.id,
          userId: connection.userId,
          timeSinceLastSeen,
        });

        if (connection.socket.readyState === WebSocket.OPEN) {
          connection.socket.close(4001, 'Timeout');
        }
        this.removeConnection(connection.id);
      }
    }, this.PING_INTERVAL);
  }

  private setupSocketHandlers(connection: ConnectionInfo): void {
    connection.socket.on('pong', () => {
      connection.lastSeen = new Date();
    });

    connection.socket.on('close', (code, reason) => {
      logger.info('WebSocket connection closed', {
        connectionId: connection.id,
        userId: connection.userId,
        code,
        reason: reason.toString(),
      });
      this.removeConnection(connection.id);
    });

    connection.socket.on('error', (error) => {
      logger.error('WebSocket connection error', {
        connectionId: connection.id,
        userId: connection.userId,
        error: error.message,
      });
      connection.isDead = true;
      this.removeConnection(connection.id);
    });
  }

  private flushQueue(connection: ConnectionInfo): void {
    while (connection.messageQueue.length > 0 && connection.socket.readyState === WebSocket.OPEN) {
      const message = connection.messageQueue.shift();
      if (message) {
        try {
          connection.socket.send(message);
        } catch (error) {
          logger.error('Failed to send message', {
            connectionId: connection.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          connection.isDead = true;
          break;
        }
      }
    }
  }

  private startCleanup(): void {
    // Cleanup dead connections every minute
    this.cleanupInterval = setInterval(() => {
      const now = new Date();
      const deadConnections: string[] = [];

      this.connections.forEach((connection) => {
        if (connection.isDead) {
          deadConnections.push(connection.id);
          return;
        }

        const timeSinceLastSeen = now.getTime() - connection.lastSeen.getTime();
        if (timeSinceLastSeen >= this.TIMEOUT_MS) {
          deadConnections.push(connection.id);
        }
      });

      deadConnections.forEach((connId) => {
        this.removeConnection(connId);
      });

      if (deadConnections.length > 0) {
        logger.info('Cleaned up dead connections', {
          count: deadConnections.length,
        });
      }
    }, 60000);
  }

  getStats(): {
    totalConnections: number;
    totalUsers: number;
    totalSubscriptions: number;
  } {
    let totalSubscriptions = 0;
    this.connections.forEach((conn) => {
      totalSubscriptions += conn.subscriptions.size;
    });

    return {
      totalConnections: this.connections.size,
      totalUsers: this.userConnections.size,
      totalSubscriptions,
    };
  }

  shutdown(): void {
    logger.info('Shutting down connection manager', {
      connections: this.connections.size,
    });

    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.connections.forEach((connection) => {
      if (connection.socket.readyState === WebSocket.OPEN) {
        connection.socket.close(1001, 'Server shutdown');
      }
    });

    this.connections.clear();
    this.userConnections.clear();
  }
}
