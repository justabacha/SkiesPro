import { IMessageQueue, PublishOptions, MessageHandler } from './IMessageQueue.js';
import { InMemoryAdapter } from './InMemoryAdapter.js';
import { RabbitMQAdapter } from './RabbitMQAdapter.js';
import { logger } from '../../shared/middleware/logger.js';

export class MessageQueueClient {
  private adapter: IMessageQueue;

  constructor(adapter?: IMessageQueue) {
    if (adapter) {
      this.adapter = adapter;
      return;
    }

    const rabbitUrl = process.env.RABBITMQ_URL;

    if (rabbitUrl && process.env.NODE_ENV !== 'test') {
      logger.info('Initializing MessageQueue with RabbitMQ');
      this.adapter = new RabbitMQAdapter(rabbitUrl);
    } else {
      if (rabbitUrl && process.env.NODE_ENV === 'test') {
        logger.info('NODE_ENV is test, falling back to InMemory message queue');
      } else if (!rabbitUrl) {
        logger.warn('RABBITMQ_URL not found, falling back to InMemory message queue');
      }
      this.adapter = new InMemoryAdapter();
    }
  }

  async publish(queueName: string, message: any, options?: PublishOptions): Promise<void> {
    return this.adapter.publish(queueName, message, options);
  }

  async subscribe(queueName: string, handler: MessageHandler): Promise<void> {
    return this.adapter.subscribe(queueName, handler);
  }

  async acknowledge(messageId: string): Promise<void> {
    return this.adapter.acknowledge(messageId);
  }

  async retry(messageId: string): Promise<void> {
    return this.adapter.retry(messageId);
  }

  async deadLetter(messageId: string): Promise<void> {
    return this.adapter.deadLetter(messageId);
  }

  async close(): Promise<void> {
    return this.adapter.close();
  }

  getQueueDepth(queueName: string): number {
    if (this.adapter instanceof InMemoryAdapter) {
      return this.adapter.getQueueDepth(queueName);
    }
    return 0;
  }
}

export const messageQueueClient = new MessageQueueClient();
