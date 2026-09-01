import { PriceFeedIngestionService } from './services/PriceFeedIngestionService.js';
import { PriceValidationService } from './services/priceValidationService.js';
import { TickRepository } from './repositories/tickRepository.js';
import { PriceDistributionService } from './services/priceDistributionService.js';
import { OHLCService } from './services/OHLCService.js';
import { CandleRepository } from './repositories/candleRepository.js';
import { logger } from '../../shared/middleware/logger.js';
import { config } from '../../config/app.js';

export async function bootstrapPriceFeed() {
  logger.info('Initializing Price Feed Service...', { useMockPrices: config.useMockPrices });

  const validationService = new PriceValidationService();
  const tickRepo = new TickRepository();
  const distributionService = new PriceDistributionService();
  const candleRepo = new CandleRepository();
  const ohlcService = new OHLCService(candleRepo);

  const ingestionService = new PriceFeedIngestionService(
    validationService,
    tickRepo,
    distributionService,
    ohlcService,
    config.useMockPrices
  );

  ingestionService.start();

  logger.info('Price Feed Service started successfully.');

  return ingestionService;
}
