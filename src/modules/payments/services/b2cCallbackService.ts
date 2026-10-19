import { Decimal } from 'decimal.js';
import { pgPool } from '../../../config/database.js';
import { PaymentRepository } from '../repositories/paymentRepository.js';
import { AdminRepository } from '../../admin/repositories/AdminRepository.js';
import { WalletService } from '../../wallet/services/walletService.js';
import { logger } from '../../../shared/middleware/logger.js';

export interface DarajaB2CResultPayload {
  Result: {
    ResultType?: number;
    ResultCode: number;
    ResultDesc: string;
    OriginatorConversationID: string;
    ConversationID: string;
    TransactionID?: string;
    ResultParameters?: {
      ResultParameter?: Array<{ Key?: string; Name?: string; Value: any }>;
    };
    ReferenceData?: any;
  };
}

export interface DarajaB2CTimeoutPayload {
  Result?: {
    OriginatorConversationID?: string;
    ResultCode?: number;
    ResultDesc?: string;
  };
  OriginatorConversationID?: string;
}

export class B2CCallbackService {
  async handleResultCallback(payload: DarajaB2CResultPayload): Promise<void> {
    const result = payload?.Result;
    const originatorConvId = result?.OriginatorConversationID;

    if (!originatorConvId) {
      logger.warn('B2C result callback missing OriginatorConversationID', { payload });
      return;
    }

    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      const paymentRepoTx = new PaymentRepository(client);
      const adminRepoTx = new AdminRepository(client);
      const walletServiceTx = new WalletService(client);

      const outbox = await paymentRepoTx.findOutboxByOriginatorConversationIdForUpdate(originatorConvId);
      if (!outbox) {
        logger.warn('B2C result callback received for unknown OriginatorConversationID', { originatorConvId });
        await client.query('COMMIT');
        return;
      }

      if (outbox.status !== 'sent') {
        logger.info('B2C result callback received for outbox row not in sent state, skipping', {
          outboxId: outbox.id,
          status: outbox.status,
          originatorConvId,
        });
        await client.query('COMMIT');
        return;
      }

      const withdrawal = await adminRepoTx.getWithdrawalByIdForUpdate(outbox.withdrawal_id);
      if (!withdrawal) {
        logger.warn('Withdrawal not found for B2C outbox row', { withdrawalId: outbox.withdrawal_id });
        await client.query('COMMIT');
        return;
      }

      if (withdrawal.status !== 'dispatched') {
        logger.warn('B2C result callback received for withdrawal not in dispatched state, skipping', {
          withdrawalId: withdrawal.id,
          status: withdrawal.status,
        });
        await client.query('COMMIT');
        return;
      }

      const resultCode = result.ResultCode;
      const resultDesc = result.ResultDesc || 'No description provided';
      const conversationId = result.ConversationID;
      const transactionId = result.TransactionID || null;

      if (resultCode === 0) {
        // SUCCESS
        const amount = new Decimal(withdrawal.amount);
        await walletServiceTx.finalizeWithdrawalDebit(
          withdrawal.user_id,
          'real',
          amount,
          'withdrawal',
          withdrawal.id,
          `Withdrawal payout completed: KES ${withdrawal.net_amount || withdrawal.amount}`
        );

        await paymentRepoTx.updateWithdrawalStatusAndRef(withdrawal.id, 'completed', transactionId);
        await paymentRepoTx.updateOutboxStatus(outbox.id, 'sent', conversationId, null, null);

        logger.info('B2C payout successfully finalized', {
          withdrawalId: withdrawal.id,
          outboxId: outbox.id,
          transactionId,
          amount: withdrawal.amount,
        });
      } else {
        // FAILURE
        const amount = new Decimal(withdrawal.amount);
        await walletServiceTx.unlockFunds(withdrawal.user_id, 'real', amount);

        await paymentRepoTx.updateWithdrawalStatusAndRef(withdrawal.id, 'failed', transactionId);
        await paymentRepoTx.updateOutboxStatus(outbox.id, 'failed', conversationId, resultDesc, null);

        logger.info('B2C payout failed, funds unlocked to available balance (no ledger entry — mirrors reject path; ledger completeness tracked for Slice 6)', {
          withdrawalId: withdrawal.id,
          outboxId: outbox.id,
          resultCode,
          resultDesc,
          amount: amount.toString(),
        });
      }

      await client.query('COMMIT');
    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error('Error handling B2C result callback', { error: error.message, originatorConvId });
      throw error;
    } finally {
      client.release();
    }
  }

  async handleTimeoutCallback(payload: DarajaB2CTimeoutPayload): Promise<void> {
    const originatorConvId = payload?.Result?.OriginatorConversationID || payload?.OriginatorConversationID;

    if (!originatorConvId) {
      logger.warn('B2C timeout callback missing OriginatorConversationID', { payload });
      return;
    }

    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      const paymentRepoTx = new PaymentRepository(client);
      const outbox = await paymentRepoTx.findOutboxByOriginatorConversationIdForUpdate(originatorConvId);

      if (!outbox) {
        logger.warn('B2C timeout callback received for unknown OriginatorConversationID', { originatorConvId });
        await client.query('COMMIT');
        return;
      }

      if (outbox.status !== 'sent') {
        logger.info('B2C timeout callback received for outbox row not in sent state, skipping', {
          outboxId: outbox.id,
          status: outbox.status,
          originatorConvId,
        });
        await client.query('COMMIT');
        return;
      }

      // NO wallet mutation, NO withdrawal status change
      // Force next_attempt_at = NOW() so Slice 5 reconciliation picks it up
      await paymentRepoTx.updateOutboxStatus(
        outbox.id,
        'sent',
        null,
        'Timeout callback received; outcome unknown; pending reconciliation',
        new Date()
      );

      logger.warn('B2C timeout callback recorded for reconciliation', {
        outboxId: outbox.id,
        withdrawalId: outbox.withdrawal_id,
        originatorConvId,
      });

      await client.query('COMMIT');
    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error('Error handling B2C timeout callback', { error: error.message, originatorConvId });
      throw error;
    } finally {
      client.release();
    }
  }
}
