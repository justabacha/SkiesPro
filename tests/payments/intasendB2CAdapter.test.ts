import axios from 'axios';
import { Decimal } from 'decimal.js';
import { IntaSendB2CAdapter } from '../../src/modules/payments/adapters/intasend/IntaSendB2CAdapter.js';
import { B2CPayoutRequest } from '../../src/modules/payments/adapters/mpesa/IB2CPayoutGateway.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('IntaSendB2CAdapter', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...originalEnv };
    process.env.INTASEND_SECRET_KEY = 'ISSecretKey_test_secret';
    process.env.INTASEND_ENVIRONMENT = 'sandbox';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('wraps the request in the required batch payload and uses NO approval', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        batch: {
          tracking_id: 'batch_987',
          transactions: [{ transaction_id: 'txn_789' }],
        },
      },
    });

    const adapter = new IntaSendB2CAdapter();
    const req: B2CPayoutRequest = {
      originatorConversationId: 'orig-001',
      amount: new Decimal('1500.00'),
      recipientPhone: '0712345678',
      remarks: 'Withdrawal payout',
    };

    const result = await adapter.initiateB2CPayout(req);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://sandbox.intasend.com/api/v1/send-money/initiate/',
      {
        currency: 'KES',
        provider: 'MPESA-B2C',
        requires_approval: 'NO',
        transactions: [
          {
            account: '254712345678',
            amount: 1500,
            narrative: 'Withdrawal payout',
            idempotency_key: 'orig-001',
          },
        ],
      },
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer ISSecretKey_test_secret' }),
        timeout: 30000,
      })
    );

    expect(result).toEqual({
      conversationId: 'txn_789',
      originatorConversationId: 'orig-001',
      responseCode: '0',
      responseDescription: 'Success',
      raw: {
        batch: {
          tracking_id: 'batch_987',
          transactions: [{ transaction_id: 'txn_789' }],
        },
      },
    });
  });

  it('falls back to batch tracking_id when transaction_id is missing', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        tracking_id: 'batch_123',
      },
    });

    const adapter = new IntaSendB2CAdapter();
    const result = await adapter.initiateB2CPayout({
      originatorConversationId: 'orig-002',
      amount: new Decimal('2000'),
      recipientPhone: '0712345678',
      remarks: 'Fallback payout',
    });

    expect(result.conversationId).toBe('batch_123');
  });

  it('throws B2CPayoutError with code and raw payload on HTTP error', async () => {
    mockedAxios.post.mockRejectedValueOnce({
      message: 'Request denied',
      code: 'ERR_FORBIDDEN',
      response: { status: 403, data: { message: 'Forbidden' } },
    });

    const adapter = new IntaSendB2CAdapter();

    await expect(
      adapter.initiateB2CPayout({
        originatorConversationId: 'orig-403',
        amount: new Decimal('1000'),
        recipientPhone: '0712345678',
        remarks: 'Reject',
      })
    ).rejects.toMatchObject({
      name: 'B2CPayoutError',
      code: 403,
      raw: { message: 'Forbidden' },
    });
  });

  it('throws the unverified endpoint error for B2C status queries', async () => {
    const adapter = new IntaSendB2CAdapter();
    await expect(adapter.queryB2CStatus('txn_123')).rejects.toThrow(
      'IntaSend B2C status query endpoint unverified — must be confirmed in Phase 2B before use'
    );
  });
});
