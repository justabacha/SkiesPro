import { IMessageQueue, PublishOptions, MessageHandler } from './IMessageQueue.js';

interface QueuedMessage {
  id: string;
  queueName: string;
  message: any;
  options?: PublishOptions;
  retryCount: number;
  createdAt: Date;
}

export class InMemoryAdapter implements IMessageQueue {
  private queues: Map<string, QueuedMessage[]> = new Map();
  private handlers: Map<string, MessageHandler> = new Map();
  private timers: Set<NodeJS.Timeout> = new Set();
  private retryConfig = {
    initialDelay: 1000,
    maxDelay: 60000,
    maxRetries: 3,
  };

  async publish(queueName: string, message: any, options?: PublishOptions): Promise<void> {
    const queuedMessage: QueuedMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      queueName,
      message,
      options,
      retryCount: 0,
      createdAt: new Date(),
    };

    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, []);
    }
    this.queues.get(queueName)!.push(queuedMessage);

    const handler = this.handlers.get(queueName);
    if (handler) {
      const delay = options?.expiration || 0;
      if (delay > 0) {
        const timer = setTimeout(async () => {
          this.timers.delete(timer);
          await this.processMessage(queuedMessage, handler);
        }, delay);
        this.timers.add(timer);
      } else {
        await this.processMessage(queuedMessage, handler);
      }
    }
  }

  async subscribe(queueName: string, handler: MessageHandler): Promise<void> {
    this.handlers.set(queueName, handler);

    const queue = this.queues.get(queueName) || [];
    for (const message of queue) {
      await this.processMessage(message, handler);
    }
  }

  private async processMessage(
    queuedMessage: QueuedMessage,
    handler: MessageHandler
  ): Promise<void> {
    try {
      await handler(
        queuedMessage.message,
        () => this.acknowledge(queuedMessage.id),
        (_requeue) => this.retry(queuedMessage.id)
      );
    } catch (error) {
      console.error(`Error processing message ${queuedMessage.id}:`, error);
      await this.retry(queuedMessage.id);
    }
  }

  async acknowledge(messageId: string): Promise<void> {
    for (const [, messages] of this.queues.entries()) {
      const index = messages.findIndex((m) => m.id === messageId);
      if (index !== -1) {
        messages.splice(index, 1);
        return;
      }
    }
  }

  async retry(messageId: string): Promise<void> {
    for (const [queueName, messages] of this.queues.entries()) {
      const message = messages.find((m) => m.id === messageId);
      if (message) {
        if (message.retryCount >= this.retryConfig.maxRetries) {
          await this.deadLetter(messageId);
          return;
        }

        message.retryCount++;
        const delay = Math.min(
          this.retryConfig.initialDelay * Math.pow(2, message.retryCount),
          this.retryConfig.maxDelay
        );

        const timer = setTimeout(async () => {
          this.timers.delete(timer);
          const handler = this.handlers.get(queueName);
          if (handler) {
            await this.processMessage(message, handler);
          }
        }, delay);
        this.timers.add(timer);
        return;
      }
    }
  }

  async deadLetter(messageId: string): Promise<void> {
    for (const messages of this.queues.values()) {
      const index = messages.findIndex((m) => m.id === messageId);
      if (index !== -1) {
        const message = messages.splice(index, 1)[0];
        if (!this.queues.has('dead.letter')) {
          this.queues.set('dead.letter', []);
        }
        this.queues.get('dead.letter')!.push(message);
        console.warn(`Message ${messageId} moved to dead-letter queue`);
        return;
      }
    }
  }

  async close(): Promise<void> {
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.queues.clear();
    this.handlers.clear();
  }

  getQueueDepth(queueName: string): number {
    return this.queues.get(queueName)?.length || 0;
  }
}
