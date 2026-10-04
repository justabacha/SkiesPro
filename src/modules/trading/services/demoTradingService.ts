import { Decimal } from 'decimal.js';
import { createHash } from 'node:crypto';
import { pgPool } from '../../../config/database.js';
import { messageQueueClient } from '../../../infrastructure/message-queue/MessageQueueClient.js';
import { OutboxRepository } from '../../auth/repositories/outboxRepository.js';
import { UserRepository } from '../../auth/repositories/userRepository.js';
import type { DemoPriceFeedService } from '../../pricing/services/DemoPriceFeedService.js';
import { normalizeSymbol } from '../../pricing/utils/symbolNormalizer.js';
import { DemoWalletService } from '../../wallet/services/demoWalletService.js';
import { WalletService } from '../../wallet/services/walletService.js';
import { AssetConfigRepository } from '../repositories/assetConfigRepository.js';
import { AssetRepository } from '../repositories/assetRepository.js';
import { BinaryContract, ContractRepository } from '../repositories/contractRepository.js';
import { StakeValidator } from '../validators/stakeValidator.js';
import { PlaceTradeRequest } from '../dto/trading.dto.js';

export class DemoTradingService {
  private readonly userRepository = new UserRepository();
  private readonly assetConfigRepository = new AssetConfigRepository();
  private readonly assetRepository = new AssetRepository();
  private readonly stakeValidator = new StakeValidator();
  private readonly contractRepository = new ContractRepository();

  constructor(
    private readonly demoPriceFeed: Pick<DemoPriceFeedService, 'getQuote'>,
    private readonly demoWalletService = new DemoWalletService()
  ) {}

  async placeDemoTrade(
    userId: string,
    request: PlaceTradeRequest,
    idempotencyKey: string
  ): Promise<BinaryContract> {
    if (!idempotencyKey || idempotencyKey.length > 255) {
      throw new Error('A valid Idempotency-Key is required');
    }
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          assetSymbol: normalizeSymbol(request.assetSymbol),
          contractType: request.contractType,
          stake: request.stake,
          expirySeconds: request.expirySeconds,
          strikePrice: request.strikePrice ?? null,
        })
      )
      .digest('hex');

    const previous = await pgPool.query<{
      request_hash: string;
      response_payload: BinaryContract;
    }>(
      `SELECT request_hash, response_payload
         FROM trading.demo_trade_idempotency
        WHERE user_id = $1 AND idempotency_key = $2`,
      [userId, idempotencyKey]
    );
    if (previous.rows[0]) {
      if (previous.rows[0].request_hash !== requestHash) {
        throw new Error('Idempotency-Key was already used with a different request');
      }
      const replay = previous.rows[0].response_payload;
      return {
        ...replay,
        purchaseTime: new Date(replay.purchaseTime),
        expiryTime: new Date(replay.expiryTime),
      };
    }

    const assetSymbol = normalizeSymbol(request.assetSymbol);
    const user = await this.userRepository.findById(userId);
    if (!user || user.status !== 'active') {
      throw new Error('User account is not active or suspended');
    }

    const config = await this.assetConfigRepository.findBySymbol(assetSymbol);
    if (!config) throw new Error(`No configuration found for asset ${assetSymbol}`);

    const stakeValidation = this.stakeValidator.validateStake(request.stake, config);
    if (!stakeValidation.valid) throw new Error(stakeValidation.error);
    const durationValidation = this.stakeValidator.validateDuration(request.expirySeconds, config);
    if (!durationValidation.valid) throw new Error(durationValidation.error);

    const wallet = await this.demoWalletService.getBalance(userId);
    const stake = new Decimal(request.stake);
    if (new Decimal(wallet.available_balance).lt(stake)) {
      throw new Error('Insufficient available balance');
    }

    const exposure = await this.contractRepository.getActiveExposure(assetSymbol, 'demo', userId);
    const maxExposure = config.maxExposure
      ? new Decimal(config.maxExposure)
      : new Decimal('1000000000');
    if (new Decimal(exposure).plus(stake).gt(maxExposure)) {
      throw new Error(`Maximum demo exposure reached for ${assetSymbol}`);
    }

    const quote = await this.demoPriceFeed.getQuote(assetSymbol);
    if (!quote) throw new Error('DEMO_MARKET_DATA_UNAVAILABLE');
    const quoteTime = new Date(quote.time).getTime();
    const now = Date.now();
    if (!Number.isFinite(quoteTime) || quoteTime > now + 1000 || now - quoteTime > 10_000) {
      throw new Error('DEMO_MARKET_DATA_UNAVAILABLE');
    }

    const bid = new Decimal(quote.bid);
    const ask = new Decimal(quote.ask);
    const mid = new Decimal(quote.mid);
    if ([bid, ask, mid].some((price) => !price.isFinite() || price.lte(0))) {
      throw new Error('DEMO_MARKET_DATA_UNAVAILABLE');
    }
    if (request.strikePrice !== undefined) {
      if (!Number.isFinite(request.strikePrice) || request.strikePrice <= 0) {
        throw new Error('INVALID_STRIKE_PRICE');
      }
      const clientStrike = new Decimal(request.strikePrice);
      const asset = await this.assetRepository.findBySymbol(assetSymbol);
      const places = asset?.pipDecimalPlaces || 5;
      const pipSize = places >= 4 ? new Decimal(10).pow(1 - places) : new Decimal(10).pow(-places);
      if (clientStrike.minus(mid).abs().gt(pipSize.times(5))) {
        throw new Error('PRICE_SLIPPAGE_EXCEEDED');
      }
    }

    const strikePrice = request.contractType === 'higher' ? ask : bid;
    const payoutRate = new Decimal(config.payoutRate);
    const potentialPayout = stake.times(payoutRate.plus(1));
    const transactionClient = await pgPool.connect();
    try {
      await transactionClient.query('BEGIN');
      await transactionClient.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [
        userId,
        idempotencyKey,
      ]);
      const previous = await transactionClient.query<{
        request_hash: string;
        response_payload: BinaryContract;
      }>(
        `SELECT request_hash, response_payload
           FROM trading.demo_trade_idempotency
          WHERE user_id = $1 AND idempotency_key = $2`,
        [userId, idempotencyKey]
      );
      if (previous.rows[0]) {
        if (previous.rows[0].request_hash !== requestHash) {
          throw new Error('Idempotency-Key was already used with a different request');
        }
        await transactionClient.query('COMMIT');
        const replay = previous.rows[0].response_payload;
        return {
          ...replay,
          purchaseTime: new Date(replay.purchaseTime),
          expiryTime: new Date(replay.expiryTime),
        };
      }

      const transactionWallet = new WalletService(transactionClient);
      const transactionContracts = new ContractRepository(transactionClient);
      const transactionOutbox = new OutboxRepository(transactionClient);
      await transactionClient.query(
        `SELECT id FROM wallet.wallets
          WHERE user_id = $1 AND account_type = 'demo'
          FOR UPDATE`,
        [userId]
      );

      const txExposure = await transactionContracts.getActiveExposure(assetSymbol, 'demo', userId);
      if (new Decimal(txExposure).plus(stake).gt(maxExposure)) {
        throw new Error(`Maximum demo exposure reached for ${assetSymbol}`);
      }

      await transactionWallet.debit(
        userId,
        'demo',
        stake,
        'demo_trade_stake',
        undefined,
        `Virtual stake for ${assetSymbol} ${request.contractType} trade`
      );

      const purchaseTime = new Date();
      const expiryTime = new Date(purchaseTime.getTime() + request.expirySeconds * 1000);
      const contract: BinaryContract = {
        userId,
        accountType: 'demo',
        assetSymbol,
        stake: stake.toString(),
        contractType: request.contractType,
        strikePrice: strikePrice.toString(),
        payoutRate: payoutRate.toString(),
        potentialPayout: potentialPayout.toString(),
        purchaseTime,
        expiryTime,
        status: 'active',
      };
      const createdContract = await transactionContracts.create(contract);
      await transactionClient.query(
        `INSERT INTO trading.contract_events (contract_id, event_type, details)
         VALUES ($1, 'created', $2::jsonb)`,
        [
          createdContract.id,
          JSON.stringify({
            accountType: 'demo',
            strikePrice: strikePrice.toString(),
            purchaseTime: purchaseTime.toISOString(),
            expiryTime: expiryTime.toISOString(),
          }),
        ]
      );

      await transactionOutbox.create({
        event_type: 'TradeOpened',
        aggregate_type: 'Contract',
        aggregate_id: createdContract.id!,
        payload: {
          userId,
          contractId: createdContract.id,
          accountType: 'demo',
          assetSymbol,
          stake: stake.toNumber(),
          contractType: request.contractType,
          strikePrice: parseFloat(strikePrice.toString()),
          expiryTime: expiryTime.toISOString(),
        },
      });

      await messageQueueClient.publish(
        'trade.expiry',
        { contractId: createdContract.id, expiryTime: expiryTime.toISOString() },
        { expiration: request.expirySeconds * 1000 }
      );
      await transactionClient.query(
        `INSERT INTO trading.demo_trade_idempotency
           (user_id, idempotency_key, request_hash, response_payload)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [userId, idempotencyKey, requestHash, JSON.stringify(createdContract)]
      );
      await transactionClient.query('COMMIT');
      return createdContract;
    } catch (error) {
      await transactionClient.query('ROLLBACK');
      throw error;
    } finally {
      transactionClient.release();
    }
  }

  getTradeHistory(
    userId: string,
    filters: {
      status?: string;
      assetSymbol?: string;
      limit?: number;
      cursor?: string;
    }
  ): Promise<BinaryContract[]> {
    return this.contractRepository.listByUser(userId, 'demo', filters);
  }

  getActiveTrades(userId: string): Promise<BinaryContract[]> {
    return this.contractRepository.getActiveByUser(userId, 'demo');
  }
}
