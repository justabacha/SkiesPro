import axios from 'axios';
import { logger } from '../../../../shared/middleware/logger.js';
import { normalizeMsisdn } from '../mpesa/DarajaB2CAdapter.js';
import {
  B2CPayoutError,
  B2CPayoutRequest,
  B2CPayoutResponse,
  B2CStatusResponse,
  IB2CPayoutGateway,
} from '../mpesa/IB2CPayoutGateway.js';

export class IntaSendB2CAdapter implements IB2CPayoutGateway {
  private readonly baseUrl: string;
  private readonly secretKey: string;

  constructor() {
    const env = (process.env.INTASEND_ENVIRONMENT || 'sandbox').toLowerCase();
    this.baseUrl = env === 'live' ? 'https://api.intasend.com' : 'https://sandbox.intasend.com';
    this.secretKey = process.env.INTASEND_SECRET_KEY || '';
  }

  async initiateB2CPayout(req: B2CPayoutRequest): Promise<B2CPayoutResponse> {
    const amount = Number(req.amount.toFixed(2));
    const normalizedPhone = normalizeMsisdn(req.recipientPhone);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new B2CPayoutError(
        `IntaSend payout amount must be a positive value, received: ${req.amount.toString()}`
      );
    }

    const payload = {
      currency: 'KES',
      provider: 'MPESA-B2C',
      requires_approval: 'NO',
      transactions: [
        {
          account: normalizedPhone,
          amount,
          narrative: req.remarks || 'Withdrawal payout',
          idempotency_key: req.originatorConversationId,
        },
      ],
    };

    try {
      const response = await axios.post(`${this.baseUrl}/api/v1/send-money/initiate/`, payload, {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
        },
        timeout: 30000,
      });

      const batch = response.data?.batch ?? response.data ?? {};
      const transaction =
        Array.isArray(batch.transactions) && batch.transactions.length > 0
          ? batch.transactions[0]
          : response.data?.transaction ??
            response.data?.transactions?.[0] ??
            {};

      const conversationId = String(
        transaction.transaction_id ?? batch.tracking_id ?? response.data?.tracking_id ?? ''
      );

      if (!conversationId) {
        throw new Error('IntaSend payout response missing transaction.transaction_id or tracking_id');
      }

      return {
        conversationId,
        originatorConversationId: req.originatorConversationId,
        responseCode: '0',
        responseDescription: batch.status || response.data?.message || 'Success',
        raw: response.data,
      };
    } catch (error: any) {
      const code = error.response?.status ?? error.code ?? 'INTASEND_HTTP_ERROR';
      const raw = error.response?.data ?? error;
      const message =
        error.response?.data?.message ||
        error.response?.data?.error?.message ||
        error.message ||
        'IntaSend payout initiation failed';

      let outcome: 'definitely_not_sent' | 'possibly_sent' | 'server_rejected' = 'possibly_sent';

      if (error.response) {
        outcome = 'server_rejected';
      } else if (error.request) {
        const errCode = String(error.code || '').toUpperCase();
        if (['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(errCode)) {
          outcome = 'definitely_not_sent';
        } else if (['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET'].includes(errCode)) {
          outcome = 'possibly_sent';
        } else {
          outcome = 'possibly_sent';
        }
      } else {
        outcome = 'possibly_sent';
      }

      throw new B2CPayoutError(message, code, raw, outcome);
    }
  }

  async queryB2CStatus(trackingId: string): Promise<B2CStatusResponse> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/v1/send-money/status/`,
        { tracking_id: trackingId },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
          timeout: 30000,
        }
      );

      const result = response.data ?? {};
      const batchState = String(result.state ?? result.status ?? 'PENDING').toUpperCase();
      const rawResultCode = String(result.resultCode ?? result.result_code ?? '');
      const rawResultDescription = String(
        result.resultDescription ?? result.result_description ?? result.message ?? 'Pending'
      );

      let status: B2CStatusResponse['status'] = 'pending';
      if (batchState === 'COMPLETE' || batchState === 'COMPLETED') {
        status = 'completed';
      } else if (batchState === 'FAILED' || batchState === 'CANCELED' || batchState === 'CANCELLED') {
        status = 'failed';
      } else if (
        batchState === 'PENDING' ||
        batchState === 'PROCESSING' ||
        batchState === 'RETRY' ||
        batchState === 'PARTIAL' ||
        batchState === 'TP111' ||
        batchState === 'APPROVAL_PENDING' ||
        batchState === 'APPROVAL-PENDING'
      ) {
        status = 'pending';
      } else {
        logger.warn('Unhandled IntaSend B2C status state; treating as pending to avoid failed payout', {
          trackingId,
          state: batchState,
        });
      }

      return {
        conversationId: String(trackingId),
        status,
        resultCode: rawResultCode ? Number(rawResultCode) : undefined,
        resultDescription: rawResultDescription || batchState || 'pending',
        raw: result,
      };
    } catch (error: any) {
      const code = error.response?.status ?? error.code ?? 'INTASEND_HTTP_ERROR';
      const raw = error.response?.data ?? error;
      const message =
        error.response?.data?.message ||
        error.response?.data?.error?.message ||
        error.message ||
        'IntaSend B2C status query failed';

      throw new B2CPayoutError(message, code, raw);
    }
  }
}
