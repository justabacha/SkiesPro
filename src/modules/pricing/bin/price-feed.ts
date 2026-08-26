import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

import { PriceFeedIngestionService } from '../services/PriceFeedIngestionService';
import { PriceValidationService } from '../services/priceValidationService';
import { TickRepository } from '../repositories/tickRepository';
import { PriceDistributionService } from '../services/priceDistributionService';
import { OHLCService } from '../services/OHLCService';
import { CandleRepository } from '../repositories/candleRepository';
import { logger } from '../../../shared/middleware/logger';

async function main() {
  logger.info('Starting Pricing Service Daemon...');

  const validationService = new PriceValidationService();
  const tickRepo = new TickRepository();
  const distributionService = new PriceDistributionService();
  const candleRepo = new CandleRepository();
  const ohlcService = new OHLCService(candleRepo);

  const ingestionService = new PriceFeedIngestionService(
    validationService,
    tickRepo,
    distributionService,
    ohlcService
  );

  ingestionService.start();

  logger.info('Pricing Service Daemon is running.');

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
