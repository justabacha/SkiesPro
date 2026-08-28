import { PriceFeedIngestionService } from './services/PriceFeedIngestionService';
import { PriceValidationService } from './services/priceValidationService';
import { TickRepository } from './repositories/tickRepository';
import { PriceDistributionService } from './services/priceDistributionService';
import { OHLCService } from './services/OHLCService';
import { CandleRepository } from './repositories/candleRepository';
import { logger } from '../../shared/middleware/logger';
import { config } from '../../config/app';

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
