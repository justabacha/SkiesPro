import { pgPool } from '../../../config/database.js';
import { ContractRepository, BinaryContract } from '../repositories/contractRepository.js';
import { AssetConfigRepository } from '../repositories/assetConfigRepository.js';
import { StakeValidator } from '../validators/stakeValidator.js';
import { WalletService } from '../../wallet/services/walletService.js';
import { PricingService } from '../../pricing/services/pricingService.js';
import { UserRepository } from '../../auth/repositories/userRepository.js';
import { OutboxRepository } from '../../auth/repositories/outboxRepository.js';
import { messageQueueClient } from '../../../infrastructure/message-queue/MessageQueueClient.js';
import { PlaceTradeRequest } from '../dto/trading.dto.js';
import { Decimal } from 'decimal.js';

export class TradingService {
  private contractRepo: ContractRepository;
  private assetConfigRepo: AssetConfigRepository;
  private stakeValidator: StakeValidator;
  private walletService: WalletService;
  private pricingService: PricingService;
  private userRepo: UserRepository;

  constructor(pricingService: PricingService) {
    this.contractRepo = new ContractRepository();
    this.assetConfigRepo = new AssetConfigRepository();
    this.stakeValidator = new StakeValidator();
    this.walletService = new WalletService();
    this.pricingService = pricingService;
    this.userRepo = new UserRepository();
  }

  /**
   * Main entry point for placing a trade.
   * Implements the 10-step validation chain from WP-10 §4.5.
   */
  async placeTrade(
    userId: string,
    request: PlaceTradeRequest,
    requestTimestamp: number
  ): Promise<BinaryContract> {
    // 1. User Status Check
    const user = await this.userRepo.findById(userId);
    if (!user || user.status !== 'active') {
      throw new Error('User account is not active or suspended');
    }

    // 2. Self-Exclusion Check
    if (user.self_excluded_until && user.self_excluded_until > new Date()) {
      throw new Error(`User is self-excluded until ${user.self_excluded_until.toISOString()}`);
    }

    // 3. Market Hours Check
    const marketStatus = await this.pricingService.getMarketStatus(request.assetSymbol);
    if (!marketStatus.is_open) {
      throw new Error(`Market for ${request.assetSymbol} is currently closed`);
    }

    // Get Asset Configuration for limits
    const config = await this.assetConfigRepo.findBySymbol(request.assetSymbol);
    if (!config) {
      throw new Error(`No configuration found for asset ${request.assetSymbol}`);
    }

    // 4. Stake Range Check
    const stakeValidation = this.stakeValidator.validateStake(request.stake, config);
    if (!stakeValidation.valid) {
      throw new Error(stakeValidation.error);
    }

    // 5. Expiry Bounds Check
    const durationValidation = this.stakeValidator.validateDuration(request.expirySeconds, config);
    if (!durationValidation.valid) {
      throw new Error(durationValidation.error);
    }

    // 6. Balance Check (pre-transaction check for performance)
    const wallet = await this.walletService.getBalance(userId);
    const stakeAmount = new Decimal(request.stake);
    if (new Decimal(wallet.available_balance).lt(stakeAmount)) {
      throw new Error('Insufficient available balance');
    }

    // 7. Exposure Limit Check
    const currentExposure = await this.contractRepo.getActiveExposure(request.assetSymbol);
    const maxExposure = config.maxExposure
      ? new Decimal(config.maxExposure)
      : new Decimal('1000000000'); // Default to very high if null
    if (new Decimal(currentExposure).plus(stakeAmount).gt(maxExposure)) {
      throw new Error(`Maximum platform exposure reached for ${request.assetSymbol}`);
    }

    // 8. Latency Check
    const latencyThreshold = parseInt(process.env.LATENCY_THRESHOLD_MS || '800');
    if (Date.now() - requestTimestamp > latencyThreshold) {
      throw new Error('Request latency too high. Price may have changed.');
    }

    // Get Latest Price for Strike
    const tick = await this.pricingService.getLatestPrice(request.assetSymbol);
    const strikePrice = request.contractType === 'higher' ? tick.ask : tick.bid;

    // Calculate potential payout
    const payoutRate = new Decimal(config.payoutRate);
    const potentialPayout = stakeAmount.times(payoutRate.plus(1));

    // START TRANSACTION (Steps 9 & 10)
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');

      const txWalletService = new WalletService(client);
      const txContractRepo = new ContractRepository(client);
      const txOutboxRepo = new OutboxRepository(client);

      // 9. Wallet Lock (Explicit for visibility and compliance with Blueprint §4.1)
      await client.query('SELECT 1 FROM wallet.wallets WHERE user_id = $1 FOR UPDATE', [userId]);

      // 10. Wallet Debit (Stake)
      await txWalletService.debit(
        userId,
        stakeAmount,
        'trade_stake',
        undefined,
        `Stake for ${request.assetSymbol} ${request.contractType} trade`
      );

      // 11. Persistence
      const purchaseTime = new Date();
      const expiryTime = new Date(purchaseTime.getTime() + request.expirySeconds * 1000);

      const contract: BinaryContract = {
        userId,
        assetSymbol: request.assetSymbol,
        stake: stakeAmount.toNumber(),
        contractType: request.contractType,
        strikePrice: parseFloat(strikePrice),
        payoutRate: payoutRate.toNumber(),
        potentialPayout: potentialPayout.toNumber(),
        purchaseTime,
        expiryTime,
        status: 'active',
      };

      const createdContract = await txContractRepo.create(contract);

      // 12. Record Audit Event (Internal to trading module)
      await client.query(
        `INSERT INTO trading.contract_events (contract_id, event_type, details)
         VALUES ($1, $2, $3)`,
        [createdContract.id, 'created', JSON.stringify({ strikePrice, purchaseTime, expiryTime })]
      );

      // 13. Transactional Outbox (External integration event per Blueprint §4.1)
      await txOutboxRepo.create({
        event_type: 'TradeOpened',
        aggregate_type: 'Contract',
        aggregate_id: createdContract.id!,
        payload: {
          userId,
          contractId: createdContract.id,
          assetSymbol: request.assetSymbol,
          stake: stakeAmount.toNumber(),
          contractType: request.contractType,
          strikePrice: parseFloat(strikePrice),
          expiryTime: expiryTime.toISOString(),
        },
      });

      // 14. Enqueue Expiry Task
      await messageQueueClient.publish(
        'trade.expiry',
        {
          contractId: createdContract.id,
          expiryTime: expiryTime.toISOString(),
        },
        {
          expiration: request.expirySeconds * 1000,
        }
      );

      await client.query('COMMIT');
      return createdContract;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getTradeHistory(userId: string, filters: any): Promise<BinaryContract[]> {
    return this.contractRepo.listByUser(userId, filters);
  }

  async getActiveTrades(userId: string): Promise<BinaryContract[]> {
    return this.contractRepo.getActiveByUser(userId);
  }

  async getTradeById(id: string, userId: string): Promise<BinaryContract> {
    const contract = await this.contractRepo.findById(id);
    if (!contract || contract.userId !== userId) {
      throw new Error('Trade not found');
    }
    return contract;
  }
}
