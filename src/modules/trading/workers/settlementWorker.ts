import { ContractRepository } from '../repositories/contractRepository.js';
import { TickRepository } from '../../pricing/repositories/tickRepository.js';
import { WalletService } from '../../wallet/services/walletService.js';
import { pgPool } from '../../../config/database.js';
import { messageQueueClient } from '../../../infrastructure/message-queue/MessageQueueClient.js';
import { logger } from '../../../shared/middleware/logger.js';
import { Decimal } from 'decimal.js';
import { PayoutService } from '../services/payoutService.js';
import { SettlementRepository } from '../repositories/settlementRepository.js';
import { IdempotencyService } from '../../../shared/services/idempotencyService.js';
import { OutboxRepository } from '../../auth/repositories/outboxRepository.js';

export class SettlementWorker {
  private contractRepo: ContractRepository;
  private tickRepo: TickRepository;
  private payoutService: PayoutService;
  private idempotencyService: IdempotencyService;

  constructor() {
    this.contractRepo = new ContractRepository();
    this.tickRepo = new TickRepository();
    this.payoutService = new PayoutService();
    this.idempotencyService = new IdempotencyService();
  }

  async start(): Promise<void> {
    logger.info('Settlement Worker starting...');
    await messageQueueClient.subscribe('trade.expiry', async (payload: any, ack, nack) => {
      const contractId = payload?.contractId;
      try {
        if (!payload || !contractId) {
          logger.warn('Received invalid expiry message', { payload });
          ack();
          return;
        }

        // 0. Idempotency Check (Message Level)
        const isDuplicate = await this.idempotencyService.isDuplicate(`settle:${contractId}`);
        if (isDuplicate) {
          logger.info('Duplicate settlement message discarded', { contractId });
          ack();
          return;
        }

        await this.settle(contractId);
        ack();
      } catch (error: any) {
        logger.error('Failed to process settlement message', {
          error: error.message,
          contractId
        });

        // Clear idempotency key on failure to allow retry
        if (contractId) {
          await this.idempotencyService.clearKey(`settle:${contractId}`);
        }

        // Nack with requeue so it can be retried
        nack(true);
      }
    });
  }

  async settle(contractId: string): Promise<void> {
    logger.info('Settling contract', { contractId });

    // 1. Atomic CAS: Update status to 'settling' to prevent double settlement
    // This is the Database-level protection (ADR-010)
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
        // Retry logic for missing ticks could be added here,
        // for now we throw to trigger RabbitMQ nack/retry
        throw new Error(
          `Price tick not found for ${contract.assetSymbol} at ${contract.expiryTime.toISOString()}`
        );
      }

      // 4. Oracle Gap Check (Hardened Security Kill-Switch)
      const oracleGapMs =
        contract.expiryTime.getTime() - new Date(settlementTick.tick_time).getTime();
      const MAX_ORACLE_GAP_MS = parseInt(process.env.MAX_ORACLE_GAP_MS || '10000');

      if (oracleGapMs > MAX_ORACLE_GAP_MS) {
        logger.warn('Oracle gap too large, cancelling contract', {
          contractId,
          expiryTime: contract.expiryTime,
          tickTime: settlementTick.tick_time,
          gapMs: oracleGapMs,
        });
        await this.cancelAndRefund(contract, `Oracle gap too large (${oracleGapMs}ms)`);
        return;
      }

      const settlementPrice = new Decimal(settlementTick.mid_price);

      // 5. Calculate Outcome and Payout (Using PayoutService with Pip-Tolerance)
      const result = this.payoutService.calculatePayout(contract, settlementPrice);

      // 6. Financial Transaction (REPEATABLE READ per DDS §8.2)
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');

        const txWalletService = new WalletService(client);
        const txContractRepo = new ContractRepository(client);
        const txSettlementRepo = new SettlementRepository(client);
        const txOutboxRepo = new OutboxRepository(client);

        // A. Update Wallet Balance (If win or draw)
        if (result.payoutAmount.gt(0)) {
          const txType = result.outcome === 'won' ? 'trade_win' : 'trade_draw';
          await txWalletService.credit(
            contract.userId,
            result.payoutAmount,
            txType,
            contractId,
            result.description
          );
        }

        // B. Update Contract to Terminal Status
        await txContractRepo.updateStatus(contractId, result.outcome, settlementPrice.toString());

        // C. Record Settlement Audit Event
        await txSettlementRepo.recordSettlementEvent(
          contractId,
          result.outcome,
          settlementPrice.toString(),
          { description: result.description }
        );

        // D. Transactional Outbox (External integration event per ADR-011)
        await txOutboxRepo.create({
          event_type: 'TradeSettled',
          aggregate_type: 'Contract',
          aggregate_id: contractId,
          payload: {
            userId: contract.userId,
            contractId,
            assetSymbol: contract.assetSymbol,
            outcome: result.outcome,
            payoutAmount: result.payoutAmount.toString(),
            settlementPrice: settlementPrice.toString(),
            settledAt: new Date().toISOString()
          },
        });

        await client.query('COMMIT');
        logger.info('Contract settled successfully', {
          contractId,
          outcome: result.outcome,
          settlementPrice: settlementPrice.toNumber(),
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error: any) {
      // Revert status to active so it can be retried
      // IMPORTANT: Only revert if it was 'settling'
      await this.contractRepo.updateStatusCAS(contractId, 'settling', 'active');
      throw error;
    }
  }

  /**
   * Internal helper to cancel a trade and refund the stake.
   */
  private async cancelAndRefund(contract: any, reason: string): Promise<void> {
    const contractId = contract.id;
    const result = this.payoutService.getCancelResult(contract, reason);

    const client = await pgPool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
      const txWalletService = new WalletService(client);
      const txContractRepo = new ContractRepository(client);
      const txSettlementRepo = new SettlementRepository(client);
      const txOutboxRepo = new OutboxRepository(client);

      // Refund Stake
      await txWalletService.credit(
        contract.userId,
        result.payoutAmount,
        'trade_draw',
        contractId,
        result.description
      );

      // Update terminal status
      await txContractRepo.updateStatus(contractId, 'cancelled');

      // Record Audit
      await txSettlementRepo.recordCancellationEvent(contractId, reason);

      // Outbox event
      await txOutboxRepo.create({
        event_type: 'TradeSettled', // Same event type, with 'cancelled' outcome
        aggregate_type: 'Contract',
        aggregate_id: contractId,
        payload: {
          userId: contract.userId,
          contractId,
          assetSymbol: contract.assetSymbol,
          outcome: 'cancelled',
          payoutAmount: result.payoutAmount.toString(),
          settledAt: new Date().toISOString()
        },
      });

      await client.query('COMMIT');
      logger.info('Contract cancelled and refunded', { contractId, reason });
    } catch (error) {
      await client.query('ROLLBACK');
      // Revert CAS lock
      await this.contractRepo.updateStatusCAS(contractId, 'settling', 'active');
      throw error;
    } finally {
      client.release();
    }
  }
}
