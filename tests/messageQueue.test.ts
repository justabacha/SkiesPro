import { InMemoryAdapter } from '../src/infrastructure/message-queue/InMemoryAdapter';
import { MessageQueueClient } from '../src/infrastructure/message-queue/MessageQueueClient';
import { PublishOptions } from '../src/infrastructure/message-queue/IMessageQueue';

describe('InMemoryAdapter', () => {
  let adapter: InMemoryAdapter;

  beforeEach(() => {
    adapter = new InMemoryAdapter();
  });

  afterEach(async () => {
    await adapter.close();
  });

  describe('publish', () => {
    it('should publish a message to a queue', async () => {
      await adapter.publish('test.queue', { data: 'test' });
      const depth = adapter.getQueueDepth('test.queue');
      expect(depth).toBe(1);
    });

    it('should publish with options', async () => {
      const options: PublishOptions = {
        persistent: true,
        priority: 1,
      };
      await adapter.publish('test.queue', { data: 'test' }, options);
      const depth = adapter.getQueueDepth('test.queue');
      expect(depth).toBe(1);
    });
  });

  describe('subscribe', () => {
    it('should process messages when handler is subscribed', async () => {
      let receivedMessage: any = null;
      const handler = jest.fn(async (msg, ack) => {
        receivedMessage = msg;
        ack();
      });

      await adapter.subscribe('test.queue', handler);
      await adapter.publish('test.queue', { data: 'test' });

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(handler).toHaveBeenCalled();
      expect(receivedMessage).toEqual({ data: 'test' });
    });

    it('should process existing messages on subscribe', async () => {
      await adapter.publish('test.queue', { data: 'existing' });

      let receivedMessage: any = null;
      const handler = jest.fn(async (msg, ack) => {
        receivedMessage = msg;
        ack();
      });

      await adapter.subscribe('test.queue', handler);
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(receivedMessage).toEqual({ data: 'existing' });
    });
  });

  describe('acknowledge', () => {
    it('should remove message from queue on ack', async () => {
      await adapter.publish('test.queue', { data: 'test' });
      
      const handler = jest.fn(async (_msg, ack) => {
        ack();
      });

      await adapter.subscribe('test.queue', handler);
      await adapter.publish('test.queue', { data: 'test' });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      const depth = adapter.getQueueDepth('test.queue');
      expect(depth).toBe(0);
    });
  });

  describe('retry', () => {
    it('should increment retry count on retry', async () => {
      let attemptCount = 0;
      const handler = jest.fn(async (_msg, _ack, nack) => {
        attemptCount++;
        nack(true);
      });

      await adapter.subscribe('test.queue', handler);
      await adapter.publish('test.queue', { data: 'test' });

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(attemptCount).toBeGreaterThan(0);
    });
  });

  describe('deadLetter', () => {
    it('should move message to dead-letter queue', async () => {
      await adapter.publish('test.queue', { data: 'test' });
      const messages = (adapter as any).queues.get('test.queue');
      const messageId = messages[0].id;

      await adapter.deadLetter(messageId);
      
      const queueDepth = adapter.getQueueDepth('test.queue');
      const deadLetterDepth = adapter.getQueueDepth('dead.letter');
      
      expect(queueDepth).toBe(0);
      expect(deadLetterDepth).toBe(1);
    });
  });
});

describe('MessageQueueClient', () => {
  let client: MessageQueueClient;

  beforeEach(() => {
    client = new MessageQueueClient();
  });

  afterEach(async () => {
    await client.close();
  });

  describe('publish', () => {
    it('should publish message through adapter', async () => {
      await client.publish('test.queue', { data: 'test' });
      const depth = client.getQueueDepth('test.queue');
      expect(depth).toBe(1);
    });
  });

  describe('subscribe', () => {
    it('should subscribe to queue', async () => {
      const handler = jest.fn(async (_msg, ack) => ack());
      await client.subscribe('test.queue', handler);
      await client.publish('test.queue', { data: 'test' });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(handler).toHaveBeenCalled();
    });
  });
});
