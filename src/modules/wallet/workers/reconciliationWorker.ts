import { LedgerRepository } from '../repositories/ledgerRepository.js';
import { pgPool } from '../../../config/database.js';
import { logger } from '../../../shared/middleware/logger.js';
import { Decimal } from 'decimal.js';

export class ReconciliationWorker {
  private ledgerRepo: LedgerRepository;

  constructor() {
    this.ledgerRepo = new LedgerRepository();
  }

  async reconcileAllWallets(): Promise<void> {
    logger.info('Starting wallet reconciliation job');

    try {
      const result = await pgPool.query('SELECT id, user_id, balance FROM wallet.wallets');
      const wallets = result.rows;

      for (const wallet of wallets) {
        const ledgerSum = await this.ledgerRepo.sumByWalletId(wallet.id);
        const walletBalance = new Decimal(wallet.balance);
        const ledgerTotal = new Decimal(ledgerSum);

        if (!walletBalance.equals(ledgerTotal)) {
          logger.error('Reconciliation mismatch detected!', {
            walletId: wallet.id,
            userId: wallet.user_id,
            walletBalance: walletBalance.toString(),
            ledgerTotal: ledgerTotal.toString(),
            difference: walletBalance.minus(ledgerTotal).toString(),
          });
          // In production, this would trigger an alert or freeze the wallet
        }
      }

      logger.info('Wallet reconciliation job completed', { count: wallets.length });
    } catch (error) {
      logger.error('Wallet reconciliation job failed', { error: (error as Error).message });
    }
  }
}
