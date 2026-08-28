import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

import { bootstrapPriceFeed } from '../bootstrap';
import { logger } from '../../../shared/middleware/logger';

async function main() {
  const ingestionService = await bootstrapPriceFeed();

  // Handle termination
  process.on('SIGINT', () => {
    logger.info('Shutting down Pricing Service Daemon...');
    ingestionService.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Shutting down Pricing Service Daemon...');
    ingestionService.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  logger.error('Failed to start Pricing Service Daemon', { error: err.message });
  process.exit(1);
});
