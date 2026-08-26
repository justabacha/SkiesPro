import { SubscriptionManager } from '../../../src/modules/pricing/websocket/subscriptionManager';
import { ConnectionManager } from '../../../src/modules/pricing/websocket/connectionManager';

jest.mock('../../../src/modules/pricing/websocket/connectionManager');

describe('SubscriptionManager', () => {
  let subscriptionManager: SubscriptionManager;
  let mockConnectionManager: jest.Mocked<ConnectionManager>;

  beforeEach(() => {
    mockConnectionManager = {
      addConnection: jest.fn(),
      removeConnection: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      sendToConnection: jest.fn(),
      getConnection: jest.fn(),
      getUserConnections: jest.fn(),
      sendToUser: jest.fn(),
      sendToChannel: jest.fn(),
      getStats: jest.fn(),
      shutdown: jest.fn(),
    } as any;

    (ConnectionManager as jest.Mock).mockImplementation(() => mockConnectionManager);
    subscriptionManager = new SubscriptionManager(mockConnectionManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('handleMessage', () => {
    it('should handle subscribe message', () => {
      mockConnectionManager.getConnection.mockReturnValue({
        subscriptions: new Set(),
      } as any);
      mockConnectionManager.subscribe.mockReturnValue(true);

      const message = JSON.stringify({
        type: 'subscribe',
        channels: [{ channel: 'price', symbol: 'EUR/USD' }],
      });

      const result = subscriptionManager.handleMessage('conn123', message);

      expect(result.success).toBe(true);
      expect(result.response).toEqual({
        type: 'subscribed',
        channels: [{ channel: 'price', symbol: 'EUR/USD' }],
      });
    });

    it('should handle unsubscribe message', () => {
      mockConnectionManager.getConnection.mockReturnValue({
        subscriptions: new Set(['price.EUR/USD']),
      } as any);
      mockConnectionManager.unsubscribe.mockReturnValue(true);

      const message = JSON.stringify({
        type: 'unsubscribe',
        channels: [{ channel: 'price', symbol: 'EUR/USD' }],
      });

      const result = subscriptionManager.handleMessage('conn123', message);

      expect(result.success).toBe(true);
      expect(result.response).toEqual({
        type: 'unsubscribed',
        channels: [{ channel: 'price', symbol: 'EUR/USD' }],
      });
    });

    it('should handle ping message', () => {
      mockConnectionManager.getConnection.mockReturnValue({} as any);

      const message = JSON.stringify({ type: 'ping' });

      const result = subscriptionManager.handleMessage('conn123', message);

      expect(result.success).toBe(true);
      expect(result.response).toEqual({
        type: 'pong',
        timestamp: expect.any(String),
      });
    });

    it('should return error for invalid JSON', () => {
      const result = subscriptionManager.handleMessage('conn123', 'invalid json');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid JSON');
    });

    it('should return error for unknown message type', () => {
      const message = JSON.stringify({ type: 'unknown' });

      const result = subscriptionManager.handleMessage('conn123', message);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown message type');
    });

    it('should return error for missing connection', () => {
      mockConnectionManager.getConnection.mockReturnValue(undefined);

      const message = JSON.stringify({
        type: 'subscribe',
        channels: [{ channel: 'price', symbol: 'EUR/USD' }],
      });

      const result = subscriptionManager.handleMessage('conn123', message);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection not found');
    });

    it('should propagate request_id for malformed input', () => {
      mockConnectionManager.getConnection.mockReturnValue({
        subscriptions: new Set(),
      } as any);

      const result = subscriptionManager.handleMessage(
        'conn123',
        JSON.stringify({
          type: 'subscribe',
          channels: 'not-an-array',
          request_id: 'req-123',
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid channels format');
      expect(subscriptionManager.sendError).toBeDefined();
    });
  });

  describe('handleSubscribe validation', () => {
    it('should reject invalid channel', () => {
      mockConnectionManager.getConnection.mockReturnValue({
        subscriptions: new Set(),
      } as any);

      const message = JSON.stringify({
        type: 'subscribe',
        channels: [{ channel: 'invalid', symbol: 'EUR/USD' }],
      });

      const result = subscriptionManager.handleMessage('conn123', message);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid channel');
    });

    it('should reject unavailable channel', () => {
      mockConnectionManager.getConnection.mockReturnValue({
        subscriptions: new Set(),
      } as any);

      const message = JSON.stringify({
        type: 'subscribe',
        channels: [{ channel: 'trades' }],
      });

      const result = subscriptionManager.handleMessage('conn123', message);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Channel not available yet');
    });

    it('should reject price channel without symbol', () => {
      mockConnectionManager.getConnection.mockReturnValue({
        subscriptions: new Set(),
      } as any);

      const message = JSON.stringify({
        type: 'subscribe',
        channels: [{ channel: 'price' }],
      });

      const result = subscriptionManager.handleMessage('conn123', message);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Symbol required for price channel');
    });

    it('should enforce subscription limit', () => {
      mockConnectionManager.getConnection.mockReturnValue({
        subscriptions: new Set(['1', '2', '3', '4', '5', '6', '7', '8']),
      } as any);

      const message = JSON.stringify({
        type: 'subscribe',
        channels: [{ channel: 'price', symbol: 'EUR/USD' }],
      });

      const result = subscriptionManager.handleMessage('conn123', message);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum 8 subscriptions');
    });
  });

  describe('sendError', () => {
    it('should send error message to connection', () => {
      subscriptionManager.sendError('conn123', 'WS_001', 'Test error', 'req123');

      expect(mockConnectionManager.sendToConnection).toHaveBeenCalledWith(
        'conn123',
        JSON.stringify({
          type: 'error',
          code: 'WS_001',
          message: 'Test error',
          request_id: 'req123',
        })
      );
    });
  });

  describe('sendConnected', () => {
    it('should send connected message to connection', () => {
      subscriptionManager.sendConnected('conn123', 'client123');

      expect(mockConnectionManager.sendToConnection).toHaveBeenCalledWith(
        'conn123',
        JSON.stringify({
          type: 'connected',
          client_id: 'client123',
        })
      );
    });
  });
});
