import * as amqp from 'amqplib';
import { IMessageQueue, PublishOptions, MessageHandler } from './IMessageQueue.js';
import { logger } from '../../shared/middleware/logger.js';

export class RabbitMQAdapter implements IMessageQueue {
  private connection: any = null;
  private channel: any = null;
  private url: string;
  private isConnecting: boolean = false;
  private reconnectionAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly RECONNECT_DELAY = 5000; // 5s

  constructor(url: string) {
    this.url = url;
  }

  private async connect(): Promise<void> {
    if (this.connection || this.isConnecting) return;

    this.isConnecting = true;
    try {
      this.connection = await (amqp as any).connect(this.url);

      this.connection.on('error', (err: any) => {
        logger.error('RabbitMQ connection error', { error: err.message });
        this.handleDisconnect();
      });

      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed');
        this.handleDisconnect();
      });

      this.channel = await this.connection.createChannel();
      logger.info('Connected to RabbitMQ');

      this.isConnecting = false;
      this.reconnectionAttempts = 0;
    } catch (error: any) {
      this.isConnecting = false;
      logger.error('Failed to connect to RabbitMQ', { error: error.message });
      this.scheduleReconnect();
    }
  }

  private handleDisconnect(): void {
    this.connection = null;
    this.channel = null;
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectionAttempts < this.MAX_RECONNECT_ATTEMPTS) {
      this.reconnectionAttempts++;
      logger.info(`Scheduling RabbitMQ reconnect (attempt ${this.reconnectionAttempts})...`);
      setTimeout(() => this.connect(), this.RECONNECT_DELAY);
    } else {
      logger.error('Max RabbitMQ reconnection attempts reached');
    }
  }

  private async ensureChannel(): Promise<any> {
    if (!this.channel) {
      await this.connect();
      // Wait a bit for connection if it was just triggered
      let attempts = 0;
      while (!this.channel && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }
      if (!this.channel) throw new Error('RabbitMQ channel not available');
    }
    return this.channel;
  }

  async publish(queueName: string, message: any, options?: PublishOptions): Promise<void> {
    const channel = await this.ensureChannel();

    // Ensure the queue exists
    await channel.assertQueue(queueName, { durable: true });

    const persistent = options?.persistent ?? true;
    const priority = options?.priority;
    const headers = options?.headers;

    // Handle Delay/Expiration using DLX pattern if expiration is provided
    if (options?.expiration) {
      const delayQueue = `${queueName}.delay.${options.expiration}`;
      await channel.assertQueue(delayQueue, {
        durable: true,
        arguments: {
          'x-message-ttl': options.expiration,
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': queueName
        }
      });

      channel.sendToQueue(delayQueue, Buffer.from(JSON.stringify(message)), {
        persistent,
        priority,
        headers
      });

      logger.debug(`Message published to delay queue ${delayQueue} for ${queueName}`);
    } else {
      channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)), {
        persistent,
        priority,
        expiration: options?.expiration?.toString(),
        headers
      });
    }
  }

  async subscribe(queueName: string, handler: MessageHandler): Promise<void> {
    const channel = await this.ensureChannel();
    await channel.assertQueue(queueName, { durable: true });

    // Set prefetch to 1 for fair dispatch (production standard)
    await channel.prefetch(1);

    await channel.consume(queueName, async (msg: any) => {
      if (msg) {
        try {
          const content = JSON.parse(msg.content.toString());

          const ack = () => channel.ack(msg);
          const nack = (requeue: boolean = true) => channel.nack(msg, false, requeue);

          await handler(content, ack, nack);
        } catch (error: any) {
          logger.error(`Error processing RabbitMQ message from ${queueName}`, { error: error.message });
          // Default to nack with requeue for unhandled errors
          channel.nack(msg, false, true);
        }
      }
    });
  }

  async acknowledge(_messageId: string): Promise<void> {
    // In RabbitMQ, acknowledgement is handled via the callback in subscribe
  }

  async retry(_messageId: string): Promise<void> {
    // Handled via nack(true) in subscribe
  }

  async deadLetter(_messageId: string): Promise<void> {
    // Handled via nack(false) in subscribe
  }

  async close(): Promise<void> {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
  }
}
