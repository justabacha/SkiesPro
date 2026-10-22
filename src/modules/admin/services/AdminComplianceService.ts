import { AdminRepository } from '../repositories/AdminRepository.js';
import { PaymentRepository } from '../../payments/repositories/paymentRepository.js';
import { WalletRepository } from '../../wallet/repositories/walletRepository.js';
import { WalletService } from '../../wallet/services/walletService.js';
import { pgPool } from '../../../config/database.js';
import { Decimal } from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';
import { normalizeMsisdn } from '../../payments/adapters/mpesa/DarajaB2CAdapter.js';
import { logger } from '../../../shared/middleware/logger.js';

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

  async retryWithdrawal(id: string, reviewedBy: string) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      const adminRepoTx = new AdminRepository(client);
      const paymentRepoTx = new PaymentRepository(client);
      const walletRepoTx = new WalletRepository(client);
      const walletServiceTx = new WalletService(client);

      const withdrawal = await adminRepoTx.getWithdrawalByIdForUpdate(id);
      if (!withdrawal) {
        throw new Error('Withdrawal not found');
      }
      if (withdrawal.status !== 'failed') {
        throw new Error(`Cannot retry withdrawal with status '${withdrawal.status}'`);
      }

      const outbox = await paymentRepoTx.findLatestOutboxByWithdrawalIdForUpdate(id);
      if (!outbox) {
        throw new Error('Associated B2C outbox record not found');
      }
      if (outbox.status !== 'failed') {
        throw new Error(`Cannot retry withdrawal: outbox status is '${outbox.status}' (must be 'failed')`);
      }
      if ((outbox.retry_count || 0) >= 3) {
        throw new Error('Maximum retry limit (3) reached for this withdrawal');
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
      if (new Decimal(wallet.available_balance).lessThan(amount)) {
        throw new Error('Insufficient available balance to re-lock for retry');
      }

      // Re-lock funds
      await walletServiceTx.lockFunds(
        userId,
        'real',
        amount,
        'withdrawal',
        id,
        'Retry: re-lock for re-dispatch'
      );

      const newOriginatorConversationId = uuidv4();
      const fee = new Decimal(withdrawal.fee);
      const netAmount = amount.minus(fee);
      const payload = {
        amount: amount.toString(),
        netAmount: netAmount.toString(),
        recipientPhone: normalizedPhone,
        remarks: 'Withdrawal payout',
        occasion: id,
      };

      await paymentRepoTx.resetOutboxForRetry(outbox.id, newOriginatorConversationId, payload);
      const nextRetryCount = (outbox.retry_count || 0) + 1;
      const reviewNote = `Retry: dispatched by ${reviewedBy} (attempt ${nextRetryCount})`;
      const updatedWithdrawal = await adminRepoTx.updateWithdrawalStatus(id, 'dispatched', reviewNote, reviewedBy);

      await client.query('COMMIT');

      logger.info('B2C withdrawal retried', { withdrawalId: id, retryCount: nextRetryCount, reviewedBy });

      return {
        id,
        status: 'dispatched',
        retryCount: nextRetryCount,
        item: updatedWithdrawal,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async forceCompleteWithdrawal(id: string, reviewedBy: string, mpesaReceipt: string, note?: string) {
    if (!mpesaReceipt || typeof mpesaReceipt !== 'string' || !mpesaReceipt.trim()) {
      throw new Error('M-Pesa receipt code is required for force completion');
    }

    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      const adminRepoTx = new AdminRepository(client);
      const paymentRepoTx = new PaymentRepository(client);
      const walletServiceTx = new WalletService(client);

      const withdrawal = await adminRepoTx.getWithdrawalByIdForUpdate(id);
      if (!withdrawal) {
        throw new Error('Withdrawal not found');
      }
      if (withdrawal.status !== 'dispatched') {
        throw new Error(`Cannot force-complete withdrawal with status '${withdrawal.status}'`);
      }

      const outbox = await paymentRepoTx.findLatestOutboxByWithdrawalIdForUpdate(id);
      if (!outbox) {
        throw new Error('Associated B2C outbox record not found');
      }
      if (outbox.status !== 'sent' || outbox.processed_at !== null) {
        throw new Error('Cannot force-complete withdrawal: outbox is not in pending sent state');
      }

      const amount = new Decimal(withdrawal.amount);
      const completionNote = `Manual completion by ops: ${mpesaReceipt}` + (note ? ` (${note})` : '');

      // Finalize debit
      await walletServiceTx.finalizeWithdrawalDebit(
        withdrawal.user_id,
        'real',
        amount,
        'withdrawal',
        id,
        completionNote
      );

      await paymentRepoTx.updateWithdrawalStatusAndRef(id, 'completed', mpesaReceipt);
      await adminRepoTx.updateWithdrawalStatus(id, 'completed', completionNote, reviewedBy);
      await paymentRepoTx.clearManualReviewFlag(outbox.id);
      await paymentRepoTx.updateOutboxStatus(outbox.id, 'sent', null, null, new Date());

      await client.query('COMMIT');

      logger.warn('B2C withdrawal force-completed by ops', { withdrawalId: id, reviewedBy, mpesaReceipt });

      return { id, status: 'completed', mpesaReceipt };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async forceRefundWithdrawal(id: string, reviewedBy: string, reason: string) {
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      throw new Error('Reason is required for force refund');
    }

    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      const adminRepoTx = new AdminRepository(client);
      const paymentRepoTx = new PaymentRepository(client);
      const walletServiceTx = new WalletService(client);

      const withdrawal = await adminRepoTx.getWithdrawalByIdForUpdate(id);
      if (!withdrawal) {
        throw new Error('Withdrawal not found');
      }
      if (withdrawal.status !== 'dispatched') {
        throw new Error(`Cannot force-refund withdrawal with status '${withdrawal.status}'`);
      }

      const outbox = await paymentRepoTx.findLatestOutboxByWithdrawalIdForUpdate(id);
      if (!outbox) {
        throw new Error('Associated B2C outbox record not found');
      }
      if (outbox.status !== 'sent' || outbox.processed_at !== null) {
        throw new Error('Cannot force-refund withdrawal: outbox is not in pending sent state');
      }

      const amount = new Decimal(withdrawal.amount);

      // Refund / unlock funds back to available
      await walletServiceTx.unlockFunds(withdrawal.user_id, 'real', amount);

      await adminRepoTx.updateWithdrawalStatus(id, 'failed', reason, reviewedBy);
      await paymentRepoTx.clearManualReviewFlag(outbox.id);
      await paymentRepoTx.updateOutboxStatus(outbox.id, 'failed', null, reason, new Date());

      await client.query('COMMIT');

      logger.warn('B2C withdrawal force-refunded by ops — monitor for late Daraja payout', { withdrawalId: id, reviewedBy, reason });
      logger.error('B2C force refund monitor late payout warning', { event: 'b2c_force_refund_monitor_late_payout', withdrawalId: id, reviewedBy, reason });

      return { id, status: 'failed', reason };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
