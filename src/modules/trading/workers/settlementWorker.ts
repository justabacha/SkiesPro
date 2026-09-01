import { ContractRepository } from '../repositories/contractRepository.js';
import { TickRepository } from '../../pricing/repositories/tickRepository.js';
import { WalletService } from '../../wallet/services/walletService.js';
import { pgPool } from '../../../config/database.js';
import { messageQueueClient } from '../../../infrastructure/message-queue/MessageQueueClient.js';
import { logger } from '../../../shared/middleware/logger.js';
import { Decimal } from 'decimal.js';

export class SettlementWorker {
  private contractRepo: ContractRepository;
  private tickRepo: TickRepository;

  constructor() {
    this.contractRepo = new ContractRepository();
    this.tickRepo = new TickRepository();
  }

  async start(): Promise<void> {
    logger.info('Settlement Worker starting...');
    await messageQueueClient.subscribe('trade.expiry', async (message: string) => {
      try {
        const payload = JSON.parse(message);
        if (!payload.contractId) {
          logger.warn('Received expiry message without contractId', { payload });
          return;
        }
        await this.settle(payload.contractId);
      } catch (error: any) {
        logger.error('Failed to process settlement message', { error: error.message, message });
      }
    });
  }

  async settle(contractId: string): Promise<void> {
    logger.info('Settling contract', { contractId });

    // 1. Atomic CAS: Update status to 'settling' to prevent double settlement
    const updated = await this.contractRepo.updateStatusCAS(contractId, 'active', 'settling');
    if (!updated) {
      logger.info('Contract already settling or processed', { contractId });
      return;
    }

    try {
      // 2. Fetch contract details
      const contract = await this.contractRepo.findById(contractId);
      if (!contract) {
        throw new Error('Contract not found');
      }

      // 3. Fetch settlement price (tick at or just before expiry)
      const settlementTick = await this.tickRepo.getPriceAt(
        contract.assetSymbol,
        contract.expiryTime
      );
      if (!settlementTick) {
        throw new Error(
          `Price tick not found for ${contract.assetSymbol} at ${contract.expiryTime.toISOString()}`
        );
      }

      const settlementPrice = new Decimal(settlementTick.mid_price);
      const strikePrice = new Decimal(contract.strikePrice);

      let outcome: 'won' | 'lost' | 'draw';

      if (contract.contractType === 'higher') {
        outcome = settlementPrice.gt(strikePrice)
          ? 'won'
          : settlementPrice.eq(strikePrice)
            ? 'draw'
            : 'lost';
      } else {
        outcome = settlementPrice.lt(strikePrice)
          ? 'won'
          : settlementPrice.eq(strikePrice)
            ? 'draw'
            : 'lost';
      }

      // 4. Financial Transaction
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');

        const txWalletService = new WalletService(client);
        const txContractRepo = new ContractRepository(client);

        if (outcome === 'won') {
          await txWalletService.credit(
            contract.userId,
            new Decimal(contract.potentialPayout),
            'trade_win',
            contractId,
            `Trade won: ${contract.assetSymbol} ${contract.contractType} at ${settlementPrice}`
          );
          await txContractRepo.updateStatus(contractId, 'won', settlementPrice.toNumber());
        } else if (outcome === 'draw') {
          await txWalletService.credit(
            contract.userId,
            new Decimal(contract.stake),
            'trade_draw',
            contractId,
            `Trade draw: ${contract.assetSymbol} ${contract.contractType}`
          );
          await txContractRepo.updateStatus(contractId, 'draw', settlementPrice.toNumber());
        } else {
          await txContractRepo.updateStatus(contractId, 'lost', settlementPrice.toNumber());
        }

        // Record Settlement Event
        await client.query(
          `INSERT INTO trading.contract_events (contract_id, event_type, details)
           VALUES ($1, $2, $3)`,
          [
            contractId,
            'settled',
            JSON.stringify({
              outcome,
              settlementPrice: settlementPrice.toNumber(),
              settlementTime: new Date(),
            }),
          ]
        );

        await client.query('COMMIT');
        logger.info('Contract settled successfully', {
          contractId,
          outcome,
          settlementPrice: settlementPrice.toNumber(),
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error: any) {
      logger.error('Settlement failed', { contractId, error: error.message });
      // Reset status to 'active' for retry logic or move to manual reconciliation
      await this.contractRepo.updateStatus(contractId, 'active');
      throw error;
    }
  }
}
