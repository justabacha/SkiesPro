import { AdminRepository } from '../repositories/AdminRepository.js';
import { WalletRepository } from '../../wallet/repositories/walletRepository.js';
import { LedgerService } from '../../wallet/services/ledgerService.js';
import { WalletService } from '../../wallet/services/walletService.js';
import { pgPool } from '../../../config/database.js';
import { Decimal } from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';

export class AdminComplianceService {
  private readonly repo: AdminRepository;

  constructor() {
    this.repo = new AdminRepository();
  }

  async listPendingKyc(filters: { page: number; perPage: number; status?: string }) {
    return this.repo.listPendingKyc(filters.page, filters.perPage, filters.status || 'pending');
  }

  async getKycById(id: string) {
    return this.repo.getKycById(id);
  }

  async reviewKyc(id: string, action: string, note: string, reviewedBy: string) {
    return this.repo.reviewKyc(id, action, note, reviewedBy);
  }

  async listWithdrawals(filters: { page: number; perPage: number; status?: string }) {
    return this.repo.listWithdrawals(filters.page, filters.perPage, filters.status || 'pending');
  }

  async listPendingWithdrawals(filters: { page: number; perPage: number }) {
    return this.listWithdrawals({ ...filters, status: 'pending' });
  }

  async getWithdrawalById(id: string) {
    return this.repo.getWithdrawalById(id);
  }

  async approveWithdrawal(id: string, reviewedBy: string, note: string) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      const adminRepoTx = new AdminRepository(client);
      const walletRepoTx = new WalletRepository(client);
      const ledgerServiceTx = new LedgerService(client);

      const withdrawal = await adminRepoTx.getWithdrawalById(id);
      if (!withdrawal) {
        throw new Error('Withdrawal not found');
      }
      if (withdrawal.status !== 'pending') {
        throw new Error(`Cannot approve withdrawal with status '${withdrawal.status}' (already resolved)`);
      }

      const amount = new Decimal(withdrawal.amount);
      const userId = withdrawal.user_id;

      const wallet = await walletRepoTx.findByUserIdForUpdate(userId, 'real');
      if (!wallet) {
        throw new Error('Wallet not found for withdrawal user');
      }

      const lockedBefore = new Decimal(wallet.locked_balance);
      if (lockedBefore.lessThan(amount)) {
        throw new Error('Locked balance is less than withdrawal amount');
      }

      const balanceBefore = new Decimal(wallet.balance);
      if (balanceBefore.lessThan(amount)) {
        throw new Error('Total balance is less than withdrawal amount');
      }

      const lockedAfter = lockedBefore.minus(amount);
      const balanceAfter = balanceBefore.minus(amount);
      const transactionId = uuidv4();

      await walletRepoTx.updateBalance(
        userId,
        'real',
        wallet.id,
        balanceAfter,
        lockedAfter,
        wallet.version
      );

      await ledgerServiceTx.recordEntry({
        transactionId,
        walletId: wallet.id,
        entryType: 'debit',
        amount,
        balanceBefore,
        balanceAfter,
        referenceType: 'withdrawal',
        referenceId: id,
        description: `Withdrawal payout approved: KES ${amount.toString()}`,
      });

      const item = await adminRepoTx.updateWithdrawalStatus(id, 'approved', note, reviewedBy);

      await client.query('COMMIT');
      return { id, status: 'approved', reviewedBy, note, item };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async rejectWithdrawal(id: string, reviewedBy: string, reason: string) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      const adminRepoTx = new AdminRepository(client);
      const walletServiceTx = new WalletService(client);

      const withdrawal = await adminRepoTx.getWithdrawalById(id);
      if (!withdrawal) {
        throw new Error('Withdrawal not found');
      }
      if (withdrawal.status !== 'pending') {
        throw new Error(`Cannot reject withdrawal with status '${withdrawal.status}'`);
      }

      // Unlock/refund locked funds back to available balance
      await walletServiceTx.unlockFunds(
        withdrawal.user_id,
        'real',
        new Decimal(withdrawal.amount)
      );

      const item = await adminRepoTx.updateWithdrawalStatus(id, 'rejected', reason, reviewedBy);

      await client.query('COMMIT');
      return { id, status: 'rejected', reviewedBy, reason, item };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
