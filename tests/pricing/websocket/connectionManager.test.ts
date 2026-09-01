import { ConnectionManager } from '../../../src/modules/pricing/websocket/connectionManager.js';
import WebSocket from 'ws';

// Mock WebSocket
jest.mock('ws');

describe('ConnectionManager', () => {
  let connectionManager: ConnectionManager;
  let mockWebSocket: jest.Mocked<WebSocket>;

  beforeEach(() => {
    connectionManager = new ConnectionManager();
    mockWebSocket = {
      readyState: WebSocket.OPEN,
      send: jest.fn(),
      ping: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
    } as any;
  });

  afterEach(() => {
    connectionManager.shutdown();
  });

  describe('addConnection', () => {
    it('should add a new connection', () => {
      const connectionId = connectionManager.addConnection('user123', mockWebSocket);

      expect(connectionId).toBeDefined();
      const connection = connectionManager.getConnection(connectionId);
      expect(connection).toBeDefined();
      expect(connection?.userId).toBe('user123');
      expect(connection?.socket).toBe(mockWebSocket);
    });

    it('should track user connections', () => {
      connectionManager.addConnection('user123', mockWebSocket);
      connectionManager.addConnection('user123', mockWebSocket);

      const userConnections = connectionManager.getUserConnections('user123');
      expect(userConnections).toHaveLength(2);
    });

    it('should start ping interval', () => {
      jest.useFakeTimers();
      connectionManager.addConnection('user123', mockWebSocket);

      expect(mockWebSocket.ping).not.toHaveBeenCalled();

      jest.advanceTimersByTime(30000); // 30 seconds

      expect(mockWebSocket.ping).toHaveBeenCalled();

      jest.useRealTimers();
    });
  });

  describe('removeConnection', () => {
    it('should remove a connection', () => {
      const connectionId = connectionManager.addConnection('user123', mockWebSocket);
      connectionManager.removeConnection(connectionId);

      const connection = connectionManager.getConnection(connectionId);
      expect(connection).toBeUndefined();
    });

    it('should close socket on removal', () => {
      const connectionId = connectionManager.addConnection('user123', mockWebSocket);
      connectionManager.removeConnection(connectionId);

      expect(mockWebSocket.close).toHaveBeenCalledWith(1000, 'Normal closure');
    });

    it('should clear ping interval', () => {
      jest.useFakeTimers();
      const connectionId = connectionManager.addConnection('user123', mockWebSocket);
      connectionManager.removeConnection(connectionId);

      jest.advanceTimersByTime(30000); // 30 seconds

      expect(mockWebSocket.ping).not.toHaveBeenCalled();

      jest.useRealTimers();
    });
  });

  describe('subscribe', () => {
    it('should subscribe connection to channel', () => {
      const connectionId = connectionManager.addConnection('user123', mockWebSocket);
      const result = connectionManager.subscribe(connectionId, 'price.EUR/USD');

      expect(result).toBe(true);
      const connection = connectionManager.getConnection(connectionId);
      expect(connection?.subscriptions.has('price.EUR/USD')).toBe(true);
    });

    it('should return false for non-existent connection', () => {
      const result = connectionManager.subscribe('nonexistent', 'price.EUR/USD');
      expect(result).toBe(false);
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe connection from channel', () => {
      const connectionId = connectionManager.addConnection('user123', mockWebSocket);
      connectionManager.subscribe(connectionId, 'price.EUR/USD');
      const result = connectionManager.unsubscribe(connectionId, 'price.EUR/USD');

      expect(result).toBe(true);
      const connection = connectionManager.getConnection(connectionId);
      expect(connection?.subscriptions.has('price.EUR/USD')).toBe(false);
    });

    it('should return false for non-existent connection', () => {
      const result = connectionManager.unsubscribe('nonexistent', 'price.EUR/USD');
      expect(result).toBe(false);
    });
  });

  describe('sendToConnection', () => {
    it('should send message to connection', () => {
      const connectionId = connectionManager.addConnection('user123', mockWebSocket);
      const message = JSON.stringify({ type: 'price', symbol: 'EUR/USD', price: '1.1234' });

      const result = connectionManager.sendToConnection(connectionId, message);

      expect(result).toBe(true);
      expect(mockWebSocket.send).toHaveBeenCalledWith(message);
    });

    it('should return false for non-existent connection', () => {
      const result = connectionManager.sendToConnection('nonexistent', 'message');
      expect(result).toBe(false);
    });

    it('should return false for closed socket', () => {
      const closedWebSocket = {
        ...mockWebSocket,
        readyState: WebSocket.CLOSED,
      } as any;

      const connectionId = connectionManager.addConnection('user123', closedWebSocket);

      const result = connectionManager.sendToConnection(connectionId, 'message');

      expect(result).toBe(false);
      expect(mockWebSocket.send).not.toHaveBeenCalled();
    });

    it('should drop messages exceeding 64KB', () => {
      const connectionId = connectionManager.addConnection('user123', mockWebSocket);
      const largeMessage = 'x'.repeat(65537); // > 64KB

      const result = connectionManager.sendToConnection(connectionId, largeMessage);

      expect(result).toBe(false);
      expect(mockWebSocket.send).not.toHaveBeenCalled();
    });
  });

  describe('sendToUser', () => {
    it('should send message to all user connections', () => {
      connectionManager.addConnection('user123', mockWebSocket);
      connectionManager.addConnection('user123', mockWebSocket);
      const message = 'test message';

      const sentCount = connectionManager.sendToUser('user123', message);

      expect(sentCount).toBe(2);
      expect(mockWebSocket.send).toHaveBeenCalledTimes(2);
    });

    it('should return 0 for user with no connections', () => {
      const sentCount = connectionManager.sendToUser('nonexistent', 'message');
      expect(sentCount).toBe(0);
    });
  });

  describe('sendToChannel', () => {
    it('should send message to subscribed connections', () => {
      const connId1 = connectionManager.addConnection('user123', mockWebSocket);
      const connId2 = connectionManager.addConnection('user456', mockWebSocket);

      connectionManager.subscribe(connId1, 'price.EUR/USD');
      connectionManager.subscribe(connId2, 'price.GBP/USD');

      const message = 'test message';
      const sentCount = connectionManager.sendToChannel('price.EUR/USD', message);

      expect(sentCount).toBe(1);
      expect(mockWebSocket.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('getStats', () => {
    it('should return connection statistics', () => {
      connectionManager.addConnection('user123', mockWebSocket);
      connectionManager.addConnection('user456', mockWebSocket);

      const firstConnectionId = Array.from(connectionManager['connections'].keys())[0];
      if (firstConnectionId) {
        connectionManager.subscribe(firstConnectionId, 'price.EUR/USD');
      }

      const stats = connectionManager.getStats();

      expect(stats.totalConnections).toBe(2);
      expect(stats.totalUsers).toBe(2);
      expect(stats.totalSubscriptions).toBe(1);
    });
  });

  describe('timeout handling', () => {
    it('should close connection after timeout', () => {
      jest.useFakeTimers();
      const connectionId = connectionManager.addConnection('user123', mockWebSocket);

      // Simulate timeout (60 seconds + 1ms)
      jest.advanceTimersByTime(60001);

      const connection = connectionManager.getConnection(connectionId);
      expect(connection).toBeUndefined();
      expect(mockWebSocket.close).toHaveBeenCalledWith(4001, 'Timeout');

      jest.useRealTimers();
    });
  });
});