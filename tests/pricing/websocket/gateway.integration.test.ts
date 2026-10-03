import { PriceGateway } from '../../../src/modules/pricing/websocket/priceGateway.js';
import { ConnectionManager } from '../../../src/modules/pricing/websocket/connectionManager.js';
import { SubscriptionManager } from '../../../src/modules/pricing/websocket/subscriptionManager.js';
import { PriceTickSubscriber } from '../../../src/modules/pricing/websocket/priceTickSubscriber.js';
import { cacheClient } from '../../../src/infrastructure/cache/index.js';

describe('WebSocket Gateway Integration Tests', () => {
  let gateway: PriceGateway;
  let connectionManager: ConnectionManager;
  let subscriptionManager: SubscriptionManager;
  let priceTickSubscriber: PriceTickSubscriber;

  beforeEach(() => {
    connectionManager = new ConnectionManager();
    subscriptionManager = new SubscriptionManager(connectionManager);
    priceTickSubscriber = new PriceTickSubscriber(connectionManager);
    gateway = new PriceGateway();
  });

  afterEach(async () => {
    await gateway.shutdown();
  });

  describe('Component integration', () => {
    it('should integrate connection manager with subscription manager', () => {
      const mockWebSocket = {
        readyState: 1, // OPEN
        send: jest.fn(),
        ping: jest.fn(),
        close: jest.fn(),
        on: jest.fn(),
      } as any;

      const connectionId = connectionManager.addConnection('user123', mockWebSocket);
      connectionManager.subscribe(connectionId, 'price.EUR/USD');

      const message = JSON.stringify({
        type: 'subscribe',
        channels: [{ channel: 'price', symbol: 'GBP/USD' }],
      });

      const result = subscriptionManager.handleMessage(connectionId, message);

      expect(result.success).toBe(true);
      expect(result.response?.type).toBe('subscribed');

      connectionManager.shutdown();
    });

    it('should integrate the local tick subscriber with connection manager', async () => {
      const mockWebSocket = {
        readyState: 1,
        send: jest.fn(),
        ping: jest.fn(),
        close: jest.fn(),
        on: jest.fn(),
      } as any;

      const connectionId = connectionManager.addConnection('user123', mockWebSocket);
      connectionManager.subscribe(connectionId, 'price.EUR/USD');

      await priceTickSubscriber.start();
      await priceTickSubscriber.subscribeToSymbol('EUR/USD');

      // Publish a test tick
      const tickData = {
        symbol: 'EUR/USD',
        bid: '1.1234',
        ask: '1.1236',
        mid: '1.1235',
        time: new Date().toISOString(),
      };

      await cacheClient.publish('pricing', 'ticks:EUR/USD', JSON.stringify(tickData));

      // Give time for message processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify message was sent to connection
      expect(mockWebSocket.send).toHaveBeenCalled();

      await priceTickSubscriber.stop();
      connectionManager.shutdown();
    });
  });

  describe('Message flow', () => {
    it('should handle complete message flow from local pub/sub to client', async () => {
      const mockWebSocket = {
        readyState: 1,
        send: jest.fn(),
        ping: jest.fn(),
        close: jest.fn(),
        on: jest.fn(),
      } as any;

      const connectionId = connectionManager.addConnection('user123', mockWebSocket);
      connectionManager.subscribe(connectionId, 'price.EUR/USD');

      await priceTickSubscriber.start();
      await priceTickSubscriber.subscribeToSymbol('EUR/USD');

      // Simulate price tick from WP-08
      const tickData = {
        symbol: 'EUR/USD',
        bid: '1.1234',
        ask: '1.1236',
        mid: '1.1235',
        time: new Date().toISOString(),
      };

      await cacheClient.publish('pricing', 'ticks:EUR/USD', JSON.stringify(tickData));

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify the message was converted to ADS format and sent
      expect(mockWebSocket.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0]);

      expect(sentMessage.type).toBe('price');
      expect(sentMessage.symbol).toBe('EUR/USD');
      expect(sentMessage.price).toBe('1.1235');
      expect(sentMessage.bid).toBe('1.1234');
      expect(sentMessage.ask).toBe('1.1236');

      await priceTickSubscriber.stop();
      connectionManager.shutdown();
    });

    it('should subscribe to both global and symbol-specific price tick channels', async () => {
      const mockWebSocket = {
        readyState: 1,
        send: jest.fn(),
        ping: jest.fn(),
        close: jest.fn(),
        on: jest.fn(),
      } as any;

      const connectionId = connectionManager.addConnection('user123', mockWebSocket);
      connectionManager.subscribe(connectionId, 'price.EUR/USD');
      connectionManager.subscribe(connectionId, 'price.all');

      await priceTickSubscriber.start();
      await priceTickSubscriber.subscribeToSymbol('EUR/USD');

      const tickData = {
        symbol: 'EUR/USD',
        bid: '1.1234',
        ask: '1.1236',
        mid: '1.1235',
        time: new Date().toISOString(),
      };

      await cacheClient.publish('pricing', 'ticks:EUR/USD', JSON.stringify(tickData));
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockWebSocket.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('price');
      expect(sentMessage.symbol).toBe('EUR/USD');

      await priceTickSubscriber.stop();
      connectionManager.shutdown();
    });
  });

  describe('Connection lifecycle', () => {
    it('should handle connection timeout', () => {
      jest.useFakeTimers();

      const mockWebSocket = {
        readyState: 1,
        send: jest.fn(),
        ping: jest.fn(),
        close: jest.fn(),
        on: jest.fn(),
      } as any;

      const connectionId = connectionManager.addConnection('user123', mockWebSocket);

      // Simulate timeout (60 seconds + 1ms)
      jest.advanceTimersByTime(60001);

      const connection = connectionManager.getConnection(connectionId);
      expect(connection).toBeUndefined();
      expect(mockWebSocket.close).toHaveBeenCalledWith(4001, 'Timeout');

      jest.useRealTimers();
      connectionManager.shutdown();
    });
  });
});
