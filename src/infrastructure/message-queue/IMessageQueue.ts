export interface PublishOptions {
  persistent?: boolean;
  priority?: number;
  expiration?: number;
  headers?: Record<string, string>;
}

export interface MessageHandler {
  (message: any, ack: () => void, nack: (requeue?: boolean) => void): Promise<void> | void;
}

export interface IMessageQueue {
  publish(queueName: string, message: any, options?: PublishOptions): Promise<void>;
  subscribe(queueName: string, handler: MessageHandler): Promise<void>;
  acknowledge(messageId: string): Promise<void>;
  retry(messageId: string): Promise<void>;
  deadLetter(messageId: string): Promise<void>;
  close(): Promise<void>;
}
