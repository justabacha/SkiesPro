import axios from 'axios';
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

      throw new B2CPayoutError(message, code, raw);
    }
  }

  async queryB2CStatus(_conversationId: string): Promise<B2CStatusResponse> {
    throw new Error('IntaSend B2C status query endpoint unverified — must be confirmed in Phase 2B before use');
  }
}
