import axios from 'axios';
import { IPaymentGateway, StkPushRequest, StkPushResponse, TransactionStatusResponse } from './IPaymentGateway';
import { logger } from '../../../../shared/middleware/logger';

export class DarajaMpesaAdapter implements IPaymentGateway {
  private readonly baseUrl: string;
  private readonly consumerKey: string;
  private readonly consumerSecret: string;
  private readonly passkey: string;
  private readonly shortcode: string;
  private readonly callbackUrl: string;

  constructor() {
    this.baseUrl = process.env.MPESA_ENVIRONMENT === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';
    this.consumerKey = process.env.MPESA_CONSUMER_KEY || '';
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET || '';
    this.passkey = process.env.MPESA_PASSKEY || '';
    this.shortcode = process.env.MPESA_SHORTCODE || '';
    this.callbackUrl = process.env.MPESA_CALLBACK_URL || '';
  }

  private async getAccessToken(): Promise<string> {
    const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');

    try {
      const response = await axios.get(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      });
      return response.data.access_token;
    } catch (error: any) {
      logger.error('Daraja auth failed', { error: error.response?.data || error.message });
      throw new Error('Payment gateway authentication failed');
    }
  }

  private getTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  private getPassword(timestamp: string): string {
    return Buffer.from(`${this.shortcode}${this.passkey}${timestamp}`).toString('base64');
  }

  async initiateStkPush(request: StkPushRequest): Promise<StkPushResponse> {
    const accessToken = await this.getAccessToken();
    const timestamp = this.getTimestamp();
    const password = this.getPassword(timestamp);

    const payload = {
      BusinessShortCode: this.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.floor(request.amount),
      PartyA: request.phone.replace('+', ''),
      PartyB: this.shortcode,
      PhoneNumber: request.phone.replace('+', ''),
      CallBackURL: this.callbackUrl,
      AccountReference: `User_${request.userId.substring(0, 8)}`,
      TransactionDesc: 'Deposit to SkiesPro',
    };

    try {
      const response = await axios.post(`${this.baseUrl}/mpesa/stkpush/v1/process`, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return {
        merchantRequestId: response.data.MerchantRequestID,
        checkoutRequestId: response.data.CheckoutRequestID,
        responseCode: response.data.ResponseCode,
        responseDescription: response.data.ResponseDescription,
        customerMessage: response.data.CustomerMessage,
      };
    } catch (error: any) {
      logger.error('Daraja STK Push failed', { error: error.response?.data || error.message });
      throw new Error('Payment gateway failed to initiate STK Push');
    }
  }

  async queryTransactionStatus(checkoutRequestId: string): Promise<TransactionStatusResponse> {
    const accessToken = await this.getAccessToken();
    const timestamp = this.getTimestamp();
    const password = this.getPassword(timestamp);

    const payload = {
      BusinessShortCode: this.shortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    };

    try {
      const response = await axios.post(`${this.baseUrl}/mpesa/stkpushquery/v1/query`, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return {
        merchantRequestId: response.data.MerchantRequestID,
        checkoutRequestId: response.data.CheckoutRequestID,
        resultCode: response.data.ResultCode,
        resultDesc: response.data.ResultDesc,
      };
    } catch (error: any) {
      logger.error('Daraja STK query failed', { error: error.response?.data || error.message });
      throw new Error('Payment gateway failed to query transaction status');
    }
  }
}
