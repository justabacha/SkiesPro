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
    await messageQueueClient.subscribe('trade.expiry', async (payload: any, ack, nack) => {
      try {
        if (!payload || !payload.contractId) {
          logger.warn('Received invalid expiry message', { payload });
          ack();
          return;
        }

        await this.settle(payload.contractId);
        ack();
      } catch (error: any) {
        logger.error('Failed to process settlement message', {
          error: error.message,
          contractId: payload?.contractId
        });
        // Nack with requeue so it can be retried
        nack(true);
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

      // ORACLE GAP FIX: If tick is > 10s older than expiryTime, mark as cancelled/void
      const oracleGapMs =
        contract.expiryTime.getTime() - new Date(settlementTick.tick_time).getTime();
      const MAX_ORACLE_GAP_MS = 10000; // 10 seconds

      if (oracleGapMs > MAX_ORACLE_GAP_MS) {
        logger.warn('Oracle gap too large, cancelling contract', {
          contractId,
          expiryTime: contract.expiryTime,
          tickTime: settlementTick.tick_time,
          gapMs: oracleGapMs,
        });
        await this.cancelAndRefund(contractId);
        return;
      }

      const settlementPrice = new Decimal(settlementTick.mid_price);
      const strikePrice = new Decimal(contract.strikePrice);

      let outcome: 'won' | 'lost' | 'draw';

      // Pip-Tolerance Draw Rule (DDS §18.4)
      const diff = settlementPrice.minus(strikePrice).abs();
      const DRAW_TOLERANCE = new Decimal('0.00001');

      if (diff.lt(DRAW_TOLERANCE)) {
        outcome = 'draw';
      } else if (contract.contractType === 'higher') {
        outcome = settlementPrice.gt(strikePrice) ? 'won' : 'lost';
      } else {
        outcome = settlementPrice.lt(strikePrice) ? 'won' : 'lost';
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
          await txContractRepo.updateStatus(contractId, 'won', settlementPrice.toString());
        } else if (outcome === 'draw') {
          await txWalletService.credit(
            contract.userId,
            new Decimal(contract.stake),
            'trade_draw',
            contractId,
            `Trade draw: ${contract.assetSymbol} ${contract.contractType}`
          );
          await txContractRepo.updateStatus(contractId, 'draw', settlementPrice.toString());
        } else {
          await txContractRepo.updateStatus(contractId, 'lost', settlementPrice.toString());
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

  async cancelAndRefund(contractId: string): Promise<void> {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const txWalletService = new WalletService(client);
      const txContractRepo = new ContractRepository(client);

      const contract = await txContractRepo.findById(contractId);
      if (contract) {
        await txWalletService.credit(
          contract.userId,
          new Decimal(contract.stake),
          'trade_draw',
          contractId,
          `Trade cancelled (Oracle Gap): Refunded stake`
        );
        await txContractRepo.updateStatus(contractId, 'cancelled');
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
