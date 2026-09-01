import { logger } from '../../../shared/middleware/logger.js';

/**
 * Handler for when a trade is opened.
 * This can be used for secondary actions like sending notifications,
 * updating analytics, etc.
 */
export const handleTradeOpened = async (payload: any) => {
  const { contractId, userId, assetSymbol, stake } = payload;

  logger.info('Trade opened event received', {
    contractId,
    userId,
    assetSymbol,
    stake,
  });

  // Future logic: Push to analytics, notify followers in copy-trading, etc.
};
