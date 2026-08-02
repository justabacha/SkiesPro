import { IMessageQueue, PublishOptions, MessageHandler } from './IMessageQueue';
import { InMemoryAdapter } from './InMemoryAdapter';

export class MessageQueueClient {
  private adapter: IMessageQueue;

  constructor(adapter?: IMessageQueue) {
    this.adapter = adapter || new InMemoryAdapter();
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
