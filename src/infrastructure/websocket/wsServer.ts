import { priceGateway } from '../../modules/pricing/websocket/priceGateway';
import { logger } from '../../shared/middleware/logger';

export function attachWebSocketServer(server: any, options: { path?: string } = {}): void {
  try {
    priceGateway.attach(server, { path: options.path || process.env.WS_PATH || '/ws/v1' });
    logger.info('WebSocket server attached successfully');
  } catch (error) {
    logger.error('Failed to attach WebSocket server', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

export function getWebSocketStats() {
  return priceGateway.getStats();
}

export async function shutdownWebSocketServer(): Promise<void> {
  try {
    await priceGateway.shutdown();
    logger.info('WebSocket server shutdown successfully');
  } catch (error) {
    logger.error('Failed to shutdown WebSocket server', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}
