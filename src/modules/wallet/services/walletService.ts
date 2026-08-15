import { PoolClient } from 'pg';
import { pgPool } from '../../../config/database';
import { WalletRepository, WalletRow } from '../repositories/walletRepository';
import { LedgerService } from './ledgerService';
import { Decimal } from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';

export class WalletService {
  private walletRepo: WalletRepository;
  private externalClient?: PoolClient;

  constructor(client?: PoolClient) {
    this.externalClient = client;
    this.walletRepo = new WalletRepository(client);
  }

  async createWallet(userId: string, currency: string = 'KES'): Promise<WalletRow> {
    const existing = await this.walletRepo.findByUserId(userId);
    if (existing) return existing;
    return this.walletRepo.create(userId, currency);
  }

  async getBalance(userId: string): Promise<WalletRow> {
    const wallet = await this.walletRepo.findByUserId(userId);
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

  async credit(userId: string, amount: Decimal, referenceType: string, referenceId?: string, description?: string): Promise<WalletRow> {
    return this.withTransaction(async (client) => {
      const walletRepo = new WalletRepository(client);
      const ledgerService = new LedgerService(client);

      const wallet = await walletRepo.findByUserIdForUpdate(userId);
      if (!wallet) throw new Error('Wallet not found');

      const balanceBefore = new Decimal(wallet.balance);
      const balanceAfter = balanceBefore.plus(amount);
      const transactionId = uuidv4();

      const updatedWallet = await walletRepo.updateBalance(
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

  async debit(userId: string, amount: Decimal, referenceType: string, referenceId?: string, description?: string): Promise<WalletRow> {
    return this.withTransaction(async (client) => {
      const walletRepo = new WalletRepository(client);
      const ledgerService = new LedgerService(client);

      const wallet = await walletRepo.findByUserIdForUpdate(userId);
      if (!wallet) throw new Error('Wallet not found');

      const availableBefore = new Decimal(wallet.available_balance);
      if (availableBefore.lessThan(amount)) {
        throw new Error('Insufficient funds');
      }

      const balanceBefore = new Decimal(wallet.balance);
      const balanceAfter = balanceBefore.minus(amount);
      const transactionId = uuidv4();

      const updatedWallet = await walletRepo.updateBalance(
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

  async lockFunds(userId: string, amount: Decimal, _referenceType: string, _referenceId?: string, _description?: string): Promise<WalletRow> {
    return this.withTransaction(async (client) => {
      const walletRepo = new WalletRepository(client);
      const wallet = await walletRepo.findByUserIdForUpdate(userId);
      if (!wallet) throw new Error('Wallet not found');

      if (new Decimal(wallet.available_balance).lessThan(amount)) {
        throw new Error('Insufficient available funds to lock');
      }

      const lockedBefore = new Decimal(wallet.locked_balance);
      const lockedAfter = lockedBefore.plus(amount);

      return walletRepo.updateBalance(
        wallet.id,
        new Decimal(wallet.balance),
        lockedAfter,
        wallet.version
      );
    });
  }

  async unlockFunds(userId: string, amount: Decimal): Promise<WalletRow> {
    return this.withTransaction(async (client) => {
      const walletRepo = new WalletRepository(client);
      const wallet = await walletRepo.findByUserIdForUpdate(userId);
      if (!wallet) throw new Error('Wallet not found');

      const lockedBefore = new Decimal(wallet.locked_balance);
      if (lockedBefore.lessThan(amount)) {
        throw new Error('Cannot unlock more than currently locked balance');
      }

      const lockedAfter = lockedBefore.minus(amount);

      return walletRepo.updateBalance(
        wallet.id,
        new Decimal(wallet.balance),
        lockedAfter,
        wallet.version
      );
    });
  }
}
