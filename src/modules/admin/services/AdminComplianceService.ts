import { AdminRepository } from '../repositories/AdminRepository.js';
import { WalletService } from '../../wallet/services/walletService.js';
import { pgPool } from '../../../config/database.js';
import { Decimal } from 'decimal.js';

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
    const item = await this.repo.updateWithdrawalStatus(id, 'approved', note, reviewedBy);
    return { id, status: 'approved', reviewedBy, note, item };
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
