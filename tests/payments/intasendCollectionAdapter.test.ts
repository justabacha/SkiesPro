import axios from 'axios';
import { IntaSendCollectionAdapter } from '../../src/modules/payments/adapters/intasend/IntaSendCollectionAdapter.js';
import { StkPushRequest } from '../../src/modules/payments/adapters/mpesa/IPaymentGateway.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('IntaSendCollectionAdapter', () => {
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

  it('maps fields and invoice id into the payment gateway response', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        invoice: {
          invoice_id: 'INTA_INV_123',
          status: 'PENDING',
          message: 'Queued for payment',
        },
      },
    });

    const adapter = new IntaSendCollectionAdapter();
    const request: StkPushRequest = {
      userId: 'user_123',
      amount: 1500,
      phone: '0712345678',
      idempotencyKey: 'idem-123',
    };

    const result = await adapter.initiateStkPush(request);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://sandbox.intasend.com/api/v1/payment/mpesa-stk-push/',
      {
        amount: 1500,
        phone_number: '254712345678',
        api_ref: 'idem-123',
      },
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer ISSecretKey_test_secret' }),
        timeout: 30000,
      })
    );

    expect(result).toEqual({
      merchantRequestId: 'INTA_INV_123',
      checkoutRequestId: 'INTA_INV_123',
      responseCode: '0',
      responseDescription: 'PENDING',
      customerMessage: 'Queued for payment',
    });
  });

  it('maps all supported IntaSend states to gateway result codes', async () => {
    const states = [
      ['COMPLETE', '0'],
      ['FAILED', '1'],
      ['CANCELED', '1'],
      ['PENDING', '2'],
      ['PROCESSING', '2'],
      ['RETRY', '2'],
      ['PARTIAL', '2'],
    ] as const;

    for (const [state, expected] of states) {
      mockedAxios.post.mockResolvedValueOnce({ data: { state } });
      const adapter = new IntaSendCollectionAdapter();
      const result = await adapter.queryTransactionStatus('invoice_1');
      expect(result.resultCode).toBe(expected);
      expect(result.resultDesc).toBe(state);
    }
  });

  it('falls back to pending when the state is unknown', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { state: 'UNKNOWN' } });
    const adapter = new IntaSendCollectionAdapter();
    const result = await adapter.queryTransactionStatus('invoice_2');
    expect(result.resultCode).toBe('2');
    expect(result.resultDesc).toBe('UNKNOWN');
  });

  it('throws an error with code and raw payload on HTTP failure', async () => {
    mockedAxios.post.mockRejectedValueOnce({
      message: 'IntaSend call failed',
      code: 'ERR_BAD_REQUEST',
      response: { status: 400, data: { message: 'Invalid payload' } },
    });

    const adapter = new IntaSendCollectionAdapter();

    await expect(
      adapter.initiateStkPush({
        userId: 'user_456',
        amount: 250,
        phone: '0712345678',
        idempotencyKey: 'idem-456',
      })
    ).rejects.toMatchObject({ code: 400, raw: { message: 'Invalid payload' }, outcome: 'server_rejected' });
  });

  it("throws with outcome='possibly_sent' on Axios ETIMEDOUT", async () => {
    mockedAxios.post.mockRejectedValueOnce({
      message: 'timeout of 30000ms exceeded',
      code: 'ETIMEDOUT',
      request: {},
    });

    const adapter = new IntaSendCollectionAdapter();

    await expect(
      adapter.initiateStkPush({
        userId: 'user_timeout',
        amount: 1000,
        phone: '0712345678',
        idempotencyKey: 'idem-timeout',
      })
    ).rejects.toMatchObject({ outcome: 'possibly_sent' });
  });

  it("throws with outcome='definitely_not_sent' on Axios ECONNREFUSED", async () => {
    mockedAxios.post.mockRejectedValueOnce({
      message: 'connect ECONNREFUSED 127.0.0.1:443',
      code: 'ECONNREFUSED',
      request: {},
    });

    const adapter = new IntaSendCollectionAdapter();

    await expect(
      adapter.initiateStkPush({
        userId: 'user_refused',
        amount: 1000,
        phone: '0712345678',
        idempotencyKey: 'idem-refused',
      })
    ).rejects.toMatchObject({ outcome: 'definitely_not_sent' });
  });

  it("throws with outcome='server_rejected' on 400 response", async () => {
    mockedAxios.post.mockRejectedValueOnce({
      message: 'Bad Request',
      code: 'ERR_BAD_REQUEST',
      response: { status: 400, data: { error: 'Invalid phone' } },
    });

    const adapter = new IntaSendCollectionAdapter();

    await expect(
      adapter.initiateStkPush({
        userId: 'user_bad',
        amount: 1000,
        phone: '0712345678',
        idempotencyKey: 'idem-400',
      })
    ).rejects.toMatchObject({ outcome: 'server_rejected' });
  });
});
