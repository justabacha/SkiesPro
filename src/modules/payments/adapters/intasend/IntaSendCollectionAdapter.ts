import axios from 'axios';
import { logger } from '../../../../shared/middleware/logger.js';
import { normalizeMsisdn } from '../mpesa/DarajaB2CAdapter.js';
import {
  IPaymentGateway,
  StkPushRequest,
  StkPushResponse,
  TransactionStatusResponse,
} from '../mpesa/IPaymentGateway.js';

export class IntaSendCollectionAdapter implements IPaymentGateway {
  private readonly baseUrl: string;
  private readonly secretKey: string;

  constructor() {
    const env = (process.env.INTASEND_ENVIRONMENT || 'sandbox').toLowerCase();
    this.baseUrl = env === 'live' ? 'https://api.intasend.com' : 'https://sandbox.intasend.com';
    this.secretKey = process.env.INTASEND_SECRET_KEY || '';
  }

  async initiateStkPush(request: StkPushRequest): Promise<StkPushResponse> {
    const normalizedPhone = normalizeMsisdn(request.phone);

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/v1/payment/mpesa-stk-push/`,
        {
          amount: request.amount,
          phone_number: normalizedPhone,
          api_ref: request.idempotencyKey,
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
          timeout: 30000,
        }
      );

      const invoice = response.data?.invoice ?? response.data ?? {};
      const checkoutRequestId = String(
        invoice.invoice_id ?? invoice.checkoutRequestId ?? invoice.id ?? ''
      );

      if (!checkoutRequestId) {
        throw new Error('IntaSend STK push response missing invoice.invoice_id');
      }

      return {
        merchantRequestId: String(invoice.invoice_id ?? invoice.id ?? checkoutRequestId),
        checkoutRequestId,
        responseCode: '0',
        responseDescription: invoice.status || invoice.message || 'Success',
        customerMessage: invoice.message || response.data?.message || 'Success',
      };
    } catch (error: any) {
      const code = error.response?.status ?? error.code ?? 'INTASEND_HTTP_ERROR';
      const raw = error.response?.data ?? error;
      const message =
        error.response?.data?.message ||
        error.response?.data?.error?.message ||
        error.message ||
        'IntaSend STK push initiation failed';

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

      const wrapped: any = new Error(message);
      wrapped.code = code;
      wrapped.raw = raw;
      wrapped.outcome = outcome;
      throw wrapped;
    }
  }

  async queryTransactionStatus(checkoutRequestId: string): Promise<TransactionStatusResponse> {
    const payload = { invoice_id: checkoutRequestId };

    try {
      const response = await axios.post(`${this.baseUrl}/api/v1/payment/status/`, payload, {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
        },
        timeout: 30000,
      });

      const rawState = String(
        response.data?.state ?? response.data?.status ?? response.data?.result ?? 'PENDING'
      ).toUpperCase();

      let resultCode = '2';
      if (rawState === 'COMPLETE') {
        resultCode = '0';
      } else if (rawState === 'FAILED' || rawState === 'CANCELED') {
        resultCode = '1';
      } else if (
        rawState === 'PENDING' ||
        rawState === 'PROCESSING' ||
        rawState === 'RETRY' ||
        rawState === 'PARTIAL'
      ) {
        resultCode = '2';
      } else {
        logger.warn('Unhandled IntaSend payment state; treating as pending to avoid failed deposit', {
          checkoutRequestId,
          state: rawState,
        });
      }

      return {
        merchantRequestId: checkoutRequestId,
        checkoutRequestId,
        resultCode,
        resultDesc: rawState,
      };
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'IntaSend status query failed';
      throw new Error(message);
    }
  }
}
