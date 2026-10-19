import { Decimal } from 'decimal.js';
import {
  IB2CPayoutGateway,
  B2CPayoutRequest,
  B2CPayoutResponse,
  B2CStatusResponse,
  B2CPayoutError,
} from './IB2CPayoutGateway.js';
import { normalizeMsisdn } from './DarajaB2CAdapter.js';

export class MpesaB2CMockAdapter implements IB2CPayoutGateway {
  private mockMode: 'success' | 'failure' | 'timeout';

  constructor(mockMode?: 'success' | 'failure' | 'timeout') {
    this.mockMode =
      mockMode ||
      (process.env.MPESA_B2C_MOCK_MODE as 'success' | 'failure' | 'timeout') ||
      'success';
  }

  public setMockMode(mode: 'success' | 'failure' | 'timeout'): void {
    this.mockMode = mode;
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

    normalizeMsisdn(req.recipientPhone);

    const mode = this.mockMode;

    if (mode === 'failure') {
      throw new B2CPayoutError('Mock B2C payout failure', '500.001.1001', {
        ResultCode: 2001,
        ResultDesc: 'The initiator information is invalid.',
      });
    }

    if (mode === 'timeout') {
      throw new B2CPayoutError('Mock B2C payout timeout', 'ETIMEDOUT', {
        code: 'ETIMEDOUT',
        message: 'Connection timed out',
      });
    }

    const mockConversationId = `AG_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    return {
      conversationId: mockConversationId,
      originatorConversationId: req.originatorConversationId,
      responseCode: '0',
      responseDescription: 'Accept the service request successfully.',
      raw: {
        ConversationID: mockConversationId,
        OriginatorConversationID: req.originatorConversationId,
        ResponseCode: '0',
        ResponseDescription: 'Accept the service request successfully.',
      },
    };
  }

  async queryB2CStatus(conversationId: string): Promise<B2CStatusResponse> {
    const mode = this.mockMode;

    if (mode === 'failure') {
      return {
        conversationId,
        status: 'failed',
        resultCode: 2001,
        resultDescription: 'Mock transaction status query failed',
        raw: { ResultCode: 2001 },
      };
    }

    if (mode === 'timeout') {
      return {
        conversationId,
        status: 'pending',
        resultCode: 0,
        resultDescription: 'Mock transaction in progress',
        raw: {},
      };
    }

    return {
      conversationId,
      status: 'completed',
      resultCode: 0,
      resultDescription: 'The service request is processed successfully.',
      transactionAmount: new Decimal(1000),
      raw: { ResultCode: 0 },
    };
  }
}
