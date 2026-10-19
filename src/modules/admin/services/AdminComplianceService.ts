import { AdminRepository } from '../repositories/AdminRepository.js';
import { WalletRepository } from '../../wallet/repositories/walletRepository.js';
import { WalletService } from '../../wallet/services/walletService.js';
import { pgPool } from '../../../config/database.js';
import { Decimal } from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';
import { normalizeMsisdn } from '../../payments/adapters/mpesa/DarajaB2CAdapter.js';

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

      const withdrawal = await adminRepoTx.getWithdrawalByIdForUpdate(id);
      if (!withdrawal) {
        throw new Error('Withdrawal not found');
      }
      if (withdrawal.status !== 'pending') {
        throw new Error(`Cannot approve withdrawal with status '${withdrawal.status}' (already resolved)`);
      }

      const userId = withdrawal.user_id;
      const rawPhone = await adminRepoTx.getUserPhone(userId);
      if (!rawPhone) {
        throw new Error('User phone number is missing or not configured');
      }

      let normalizedPhone: string;
      try {
        normalizedPhone = normalizeMsisdn(rawPhone);
      } catch (err: any) {
        throw new Error(`Invalid user phone number format: ${rawPhone}`);
      }

      const wallet = await walletRepoTx.findByUserIdForUpdate(userId, 'real');
      if (!wallet) {
        throw new Error('Wallet not found for withdrawal user');
      }

      const amount = new Decimal(withdrawal.amount);
      const fee = new Decimal(withdrawal.fee);
      const netAmount = amount.minus(fee);

      if (netAmount.lessThanOrEqualTo(0)) {
        throw new Error('Invalid withdrawal fee configuration (net amount must be positive)');
      }

      const lockedBefore = new Decimal(wallet.locked_balance);
      if (lockedBefore.lessThan(amount)) {
        throw new Error('Locked balance is less than withdrawal amount');
      }

      const originatorConversationId = uuidv4();
      const payload = {
        amount: amount.toString(),
        netAmount: netAmount.toString(),
        recipientPhone: normalizedPhone,
        remarks: 'Withdrawal payout',
        occasion: id,
      };

      await adminRepoTx.insertB2COutboxRow(id, originatorConversationId, payload);
      const item = await adminRepoTx.updateWithdrawalStatus(id, 'dispatched', note, reviewedBy);

      await client.query('COMMIT');
      return { id, status: 'dispatched', reviewedBy, note, item };
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
