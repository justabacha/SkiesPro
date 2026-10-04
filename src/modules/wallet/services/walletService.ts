import { PoolClient } from 'pg';
import { pgPool } from '../../../config/database.js';
import { AccountType, WalletRepository, WalletRow } from '../repositories/walletRepository.js';
import { LedgerService } from './ledgerService.js';
import { Decimal } from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';

export type LedgerReferenceType =
  | 'deposit'
  | 'withdrawal'
  | 'trade_stake'
  | 'trade_payout'
  | 'referral_commission'
  | 'admin_adjustment'
  | 'trade_win'
  | 'trade_loss'
  | 'trade_draw'
  | 'fee'
  | 'referral_bonus'
  | 'platform_revenue'
  | 'demo_funding'
  | 'demo_reset'
  | 'demo_trade_stake'
  | 'demo_trade_payout';

export class WalletService {
  private walletRepo: WalletRepository;
  private externalClient?: PoolClient;

  constructor(client?: PoolClient) {
    this.externalClient = client;
    this.walletRepo = new WalletRepository(client);
  }

  async createWallet(
    userId: string,
    accountType: AccountType,
    currency: string = 'KES'
  ): Promise<WalletRow> {
    const existing = await this.walletRepo.findByUserId(userId, accountType);
    if (existing) return existing;
    try {
      return await this.walletRepo.create(userId, currency, accountType);
    } catch (error) {
      const concurrentlyCreated = await this.walletRepo.findByUserId(userId, accountType);
      if (concurrentlyCreated) return concurrentlyCreated;
      throw error;
    }
  }

  async getBalance(userId: string, accountType: AccountType): Promise<WalletRow> {
    const wallet = await this.walletRepo.findByUserId(userId, accountType);
    if (!wallet) throw new Error('Wallet not found');
    return wallet;
  }

  private async withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    if (this.externalClient) {
      return work(this.externalClient);
    }
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async credit(
    userId: string,
    accountType: AccountType,
    amount: Decimal,
    referenceType: LedgerReferenceType,
    referenceId?: string,
    description?: string
  ): Promise<WalletRow> {
    return this.withTransaction(async (client) => {
      const walletRepo = new WalletRepository(client);
      const ledgerService = new LedgerService(client);

      const wallet = await walletRepo.findByUserIdForUpdate(userId, accountType);
      if (!wallet) throw new Error('Wallet not found');

      const balanceBefore = new Decimal(wallet.balance);
      const balanceAfter = balanceBefore.plus(amount);
      const transactionId = uuidv4();

      const updatedWallet = await walletRepo.updateBalance(
        userId,
        accountType,
        wallet.id,
        balanceAfter,
        new Decimal(wallet.locked_balance),
        wallet.version
      );

      await ledgerService.recordEntry({
        transactionId,
        walletId: wallet.id,
        entryType: 'credit',
        amount,
        balanceBefore,
        balanceAfter,
        referenceType,
        referenceId,
        description,
      });

      return updatedWallet;
    });
  }

  async debit(
    userId: string,
    accountType: AccountType,
    amount: Decimal,
    referenceType: LedgerReferenceType,
    referenceId?: string,
    description?: string
  ): Promise<WalletRow> {
    return this.withTransaction(async (client) => {
      const walletRepo = new WalletRepository(client);
      const ledgerService = new LedgerService(client);

      const wallet = await walletRepo.findByUserIdForUpdate(userId, accountType);
      if (!wallet) throw new Error('Wallet not found');

      const availableBefore = new Decimal(wallet.available_balance);
      if (availableBefore.lessThan(amount)) {
        throw new Error('Insufficient funds');
      }

      const balanceBefore = new Decimal(wallet.balance);
      const balanceAfter = balanceBefore.minus(amount);
      const transactionId = uuidv4();

      const updatedWallet = await walletRepo.updateBalance(
        userId,
        accountType,
        wallet.id,
        balanceAfter,
        new Decimal(wallet.locked_balance),
        wallet.version
      );

      await ledgerService.recordEntry({
        transactionId,
        walletId: wallet.id,
        entryType: 'debit',
        amount,
        balanceBefore,
        balanceAfter,
        referenceType,
        referenceId,
        description,
      });

      return updatedWallet;
    });
  }

  async lockFunds(
    userId: string,
    accountType: AccountType,
    amount: Decimal,
    _referenceType: LedgerReferenceType,
    _referenceId?: string,
    _description?: string
  ): Promise<WalletRow> {
    return this.withTransaction(async (client) => {
      const walletRepo = new WalletRepository(client);
      const wallet = await walletRepo.findByUserIdForUpdate(userId, accountType);
      if (!wallet) throw new Error('Wallet not found');

      if (new Decimal(wallet.available_balance).lessThan(amount)) {
        throw new Error('Insufficient available funds to lock');
      }

      const lockedBefore = new Decimal(wallet.locked_balance);
      const lockedAfter = lockedBefore.plus(amount);

      return walletRepo.updateBalance(
        userId,
        accountType,
        wallet.id,
        new Decimal(wallet.balance),
        lockedAfter,
        wallet.version
      );
    });
  }

  async unlockFunds(userId: string, accountType: AccountType, amount: Decimal): Promise<WalletRow> {
    return this.withTransaction(async (client) => {
      const walletRepo = new WalletRepository(client);
      const wallet = await walletRepo.findByUserIdForUpdate(userId, accountType);
      if (!wallet) throw new Error('Wallet not found');

      const lockedBefore = new Decimal(wallet.locked_balance);
      if (lockedBefore.lessThan(amount)) {
        throw new Error('Cannot unlock more than currently locked balance');
      }

      const lockedAfter = lockedBefore.minus(amount);

      return walletRepo.updateBalance(
        userId,
        accountType,
        wallet.id,
        new Decimal(wallet.balance),
        lockedAfter,
        wallet.version
      );
    });
  }
}
