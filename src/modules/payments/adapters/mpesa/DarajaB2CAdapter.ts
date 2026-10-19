import axios from 'axios';
import { Decimal } from 'decimal.js';
import {
  IB2CPayoutGateway,
  B2CPayoutRequest,
  B2CPayoutResponse,
  B2CStatusResponse,
  B2CPayoutError,
} from './IB2CPayoutGateway.js';
import { logger } from '../../../../shared/middleware/logger.js';

export function normalizeMsisdn(phone: string): string {
  if (!phone || typeof phone !== 'string') {
    throw new B2CPayoutError('Phone number is required and must be a string');
  }

  const clean = phone.replace(/[\s\-\+]/g, '');

  if (!clean) {
    throw new B2CPayoutError('Phone number cannot be empty');
  }

  // 07XXXXXXXX or 01XXXXXXXX (10 digits starting with 0) -> 2547XXXXXXXX or 2541XXXXXXXX
  if (/^0[17]\d{8}$/.test(clean)) {
    return `254${clean.substring(1)}`;
  }

  // +2547XXXXXXXX or 2547XXXXXXXX (12 digits starting with 254)
  if (/^254[17]\d{8}$/.test(clean)) {
    return clean;
  }

  // 7XXXXXXXX or 1XXXXXXXX (9 digits starting with 7 or 1)
  if (/^[17]\d{8}$/.test(clean)) {
    return `254${clean}`;
  }

  throw new B2CPayoutError(`Invalid phone number format for M-Pesa MSISDN: ${phone}`);
}

function maskPhone(phone: string): string {
  if (!phone || phone.length < 8) return '****';
  return `${phone.substring(0, 6)}***${phone.substring(phone.length - 2)}`;
}

export class DarajaB2CAdapter implements IB2CPayoutGateway {
  private readonly baseUrl: string;
  private readonly consumerKey: string;
  private readonly consumerSecret: string;
  private readonly shortcode: string;
  private readonly initiatorName: string;
  private readonly securityCredential: string;
  private readonly commandId: string;
  private readonly timeoutUrl: string;
  private readonly resultUrl: string;

  constructor() {
    this.baseUrl =
      process.env.MPESA_ENVIRONMENT === 'production'
        ? 'https://api.safaricom.co.ke'
        : 'https://sandbox.safaricom.co.ke';
    this.consumerKey = process.env.MPESA_CONSUMER_KEY || '';
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET || '';
    this.shortcode = process.env.MPESA_B2C_SHORTCODE || process.env.MPESA_SHORTCODE || '';
    this.initiatorName = process.env.MPESA_B2C_INITIATOR_NAME || '';
    this.securityCredential = process.env.MPESA_B2C_SECURITY_CREDENTIAL || '';
    this.commandId = process.env.MPESA_B2C_COMMAND_ID || 'BusinessPayment';
    this.timeoutUrl = process.env.MPESA_B2C_TIMEOUT_URL || '';
    this.resultUrl = process.env.MPESA_B2C_RESULT_URL || '';
  }

  private async getAccessToken(): Promise<string> {
    const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');

    try {
      const response = await axios.get(
        `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
          },
          timeout: 30000,
        }
      );
      return response.data.access_token;
    } catch (error: any) {
      logger.error('Daraja B2C auth failed', { error: error.response?.data || error.message });
      throw new B2CPayoutError(
        'Payment gateway authentication failed',
        error.response?.status,
        error.response?.data
      );
    }
  }

  async initiateB2CPayout(req: B2CPayoutRequest): Promise<B2CPayoutResponse> {
    const isDecimal =
      req.amount &&
      (Decimal.isDecimal(req.amount) || typeof (req.amount as any).isInteger === 'function');

    if (!req.amount || !isDecimal) {
      throw new B2CPayoutError('Amount must be a Decimal instance');
    }

    if (!req.amount.isPositive() || !req.amount.isInteger()) {
      throw new B2CPayoutError(
        `B2C payout amount must be a positive integer KES value, received: ${req.amount.toString()}`
      );
    }

    const normalizedPhone = normalizeMsisdn(req.recipientPhone);

    if (!this.shortcode || !this.initiatorName || !this.securityCredential) {
      throw new B2CPayoutError(
        'Missing required Daraja B2C credentials (shortcode, initiatorName, or securityCredential)'
      );
    }

    if (!this.resultUrl || !this.timeoutUrl) {
      throw new B2CPayoutError(
        'Missing required Daraja B2C callback URLs (resultUrl or timeoutUrl)'
      );
    }

    const accessToken = await this.getAccessToken();

    const payload: Record<string, any> = {
      OriginatorConversationID: req.originatorConversationId,
      InitiatorName: this.initiatorName,
      SecurityCredential: this.securityCredential,
      CommandID: this.commandId,
      Amount: req.amount.toNumber(),
      PartyA: this.shortcode,
      PartyB: normalizedPhone,
      Remarks: (req.remarks || 'Payout').substring(0, 100),
      QueueTimeOutURL: this.timeoutUrl,
      ResultURL: this.resultUrl,
    };

    if (req.occasion) {
      payload.Occasion = req.occasion.substring(0, 100);
    }

    logger.info('Initiating Daraja B2C payout', {
      originatorConversationId: req.originatorConversationId,
      recipientPhone: maskPhone(normalizedPhone),
      amount: req.amount.toString(),
      commandId: this.commandId,
    });

    try {
      const response = await axios.post(
        `${this.baseUrl}/mpesa/b2c/v1/paymentrequest`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          timeout: 30000,
        }
      );

      const data = response.data;
      const responseCode = String(data.ResponseCode ?? data.responseCode ?? '');

      if (responseCode === '0') {
        return {
          conversationId: data.ConversationID || data.conversationID || '',
          originatorConversationId:
            data.OriginatorConversationID ||
            data.originatorConversationId ||
            req.originatorConversationId,
          responseCode,
          responseDescription:
            data.ResponseDescription || data.responseDescription || 'Success',
          raw: data,
        };
      }

      logger.error('Daraja B2C payout returned non-zero response code', {
        originatorConversationId: req.originatorConversationId,
        responseCode,
        responseDescription: data.ResponseDescription,
      });

      throw new B2CPayoutError(
        data.ResponseDescription || 'Daraja B2C payout request rejected',
        responseCode,
        data
      );
    } catch (error: any) {
      if (error instanceof B2CPayoutError) {
        throw error;
      }

      logger.error('Daraja B2C payout request failed', {
        originatorConversationId: req.originatorConversationId,
        error: error.response?.data || error.message,
      });

      throw new B2CPayoutError(
        error.response?.data?.errorMessage ||
          error.response?.data?.ResponseDescription ||
          error.message ||
          'Daraja B2C payout request failed',
        error.response?.data?.errorCode || error.response?.status,
        error.response?.data
      );
    }
  }

  async queryB2CStatus(conversationId: string): Promise<B2CStatusResponse> {
    const accessToken = await this.getAccessToken();

    const payload = {
      Initiator: this.initiatorName,
      SecurityCredential: this.securityCredential,
      CommandID: 'TransactionStatusQuery',
      TransactionID: conversationId,
      PartyA: this.shortcode,
      IdentifierType: '4',
      ResultURL: this.resultUrl,
      QueueTimeOutURL: this.timeoutUrl,
      Remarks: 'Status Query',
      Occasion: 'Status Query',
    };

    try {
      const response = await axios.post(
        `${this.baseUrl}/mpesa/transactionstatus/v1/query`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          timeout: 30000,
        }
      );

      const data = response.data;
      const responseCode = String(data.ResponseCode ?? data.responseCode ?? '');

      if (responseCode === '0') {
        return {
          conversationId,
          status: 'pending',
          resultCode: 0,
          resultDescription:
            data.ResponseDescription || 'Transaction status query accepted',
          raw: data,
        };
      }

      return {
        conversationId,
        status: 'failed',
        resultCode: Number(responseCode) || 999,
        resultDescription:
          data.ResponseDescription || 'Transaction status query failed',
        raw: data,
      };
    } catch (error: any) {
      logger.error('Daraja B2C status query failed', {
        conversationId,
        error: error.response?.data || error.message,
      });

      throw new B2CPayoutError(
        error.response?.data?.errorMessage ||
          error.message ||
          'Daraja B2C status query failed',
        error.response?.status,
        error.response?.data
      );
    }
  }
}
