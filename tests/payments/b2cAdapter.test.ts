import axios from 'axios';
import { Decimal } from 'decimal.js';
import {
  B2CPayoutError,
  B2CPayoutRequest,
} from '../../src/modules/payments/adapters/mpesa/IB2CPayoutGateway.js';
import {
  DarajaB2CAdapter,
  normalizeMsisdn,
} from '../../src/modules/payments/adapters/mpesa/DarajaB2CAdapter.js';
import { MpesaB2CMockAdapter } from '../../src/modules/payments/adapters/mpesa/MpesaB2CMockAdapter.js';
import {
  B2CGatewayFactory,
  getB2CGateway,
} from '../../src/modules/payments/adapters/mpesa/B2CGatewayFactory.js';
import { config, validateB2cConfig } from '../../src/config/app.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('B2C Payout Adapter & Components (Slice 1)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...originalEnv };
    process.env.MPESA_CALLBACK_TOKEN = 'test_secret_token_123';
    process.env.MPESA_ENVIRONMENT = 'sandbox';
    process.env.MPESA_CONSUMER_KEY = 'test_consumer_key';
    process.env.MPESA_CONSUMER_SECRET = 'test_consumer_secret';
    process.env.MPESA_B2C_SHORTCODE = '600980';
    process.env.MPESA_B2C_INITIATOR_NAME = 'test_initiator';
    process.env.MPESA_B2C_SECURITY_CREDENTIAL = 'EncryptedRSAString123';
    process.env.MPESA_B2C_COMMAND_ID = 'BusinessPayment';
    process.env.MPESA_B2C_RESULT_URL = 'https://example.com/b2c/result';
    process.env.MPESA_B2C_TIMEOUT_URL = 'https://example.com/b2c/timeout';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('1. normalizeMsisdn', () => {
    it('normalizes 07XXXXXXXX to 2547XXXXXXXX', () => {
      expect(normalizeMsisdn('0712345678')).toBe('254712345678');
      expect(normalizeMsisdn('0722000000')).toBe('254722000000');
    });

    it('normalizes +2547XXXXXXXX to 2547XXXXXXXX', () => {
      expect(normalizeMsisdn('+254712345678')).toBe('254712345678');
      expect(normalizeMsisdn('+254 722 000 000')).toBe('254722000000');
    });

    it('normalizes 2547XXXXXXXX to 2547XXXXXXXX', () => {
      expect(normalizeMsisdn('254712345678')).toBe('254712345678');
    });

    it('normalizes 7XXXXXXXX to 2547XXXXXXXX', () => {
      expect(normalizeMsisdn('712345678')).toBe('254712345678');
    });

    it('throws B2CPayoutError on invalid input formats', () => {
      expect(() => normalizeMsisdn('1234')).toThrow(B2CPayoutError);
      expect(() => normalizeMsisdn('abcdefghijk')).toThrow(B2CPayoutError);
      expect(() => normalizeMsisdn('')).toThrow(B2CPayoutError);
      expect(() => normalizeMsisdn(null as any)).toThrow(B2CPayoutError);
      expect(() => normalizeMsisdn('0812345678')).toThrow(B2CPayoutError); // invalid prefix
    });
  });

  describe('2. DarajaB2CAdapter - initiateB2CPayout Payload Construction', () => {
    it('constructs correct payload and headers when calling Daraja B2C API', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { access_token: 'mock_access_token_123' },
      });

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          ConversationID: 'AG_20250101_12345',
          OriginatorConversationID: 'orig-uuid-111',
          ResponseCode: '0',
          ResponseDescription: 'Accept the service request successfully.',
        },
      });

      const adapter = new DarajaB2CAdapter();
      const request: B2CPayoutRequest = {
        originatorConversationId: 'orig-uuid-111',
        amount: new Decimal(1500),
        recipientPhone: '0712345678',
        remarks: 'Trader withdrawal payout',
        occasion: 'Weekly payout',
      };

      const result = await adapter.initiateB2CPayout(request);

      // Verify OAuth call
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Basic /),
          }),
        })
      );

      // Verify B2C POST call
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest',
        {
          OriginatorConversationID: 'orig-uuid-111',
          InitiatorName: 'test_initiator',
          SecurityCredential: 'EncryptedRSAString123',
          CommandID: 'BusinessPayment',
          Amount: 1500,
          PartyA: '600980',
          PartyB: '254712345678',
          Remarks: 'Trader withdrawal payout',
          QueueTimeOutURL: 'https://example.com/b2c/timeout',
          ResultURL: 'https://example.com/b2c/result',
          Occasion: 'Weekly payout',
        },
        {
          headers: {
            Authorization: 'Bearer mock_access_token_123',
          },
          timeout: 30000,
        }
      );

      expect(result).toEqual({
        conversationId: 'AG_20250101_12345',
        originatorConversationId: 'orig-uuid-111',
        responseCode: '0',
        responseDescription: 'Accept the service request successfully.',
        raw: expect.any(Object),
      });
    });
  });

  describe('3. Amount Validation', () => {
    it('throws B2CPayoutError for non-integer decimal amount', async () => {
      const adapter = new DarajaB2CAdapter();
      const request: B2CPayoutRequest = {
        originatorConversationId: 'orig-uuid-222',
        amount: new Decimal('100.50'),
        recipientPhone: '0712345678',
        remarks: 'Fractional amount test',
      };

      await expect(adapter.initiateB2CPayout(request)).rejects.toThrow(B2CPayoutError);
      await expect(adapter.initiateB2CPayout(request)).rejects.toThrow(
        /positive integer KES value/
      );
    });

    it('throws B2CPayoutError for zero or negative amount', async () => {
      const adapter = new DarajaB2CAdapter();
      const requestNegative: B2CPayoutRequest = {
        originatorConversationId: 'orig-uuid-223',
        amount: new Decimal('-500'),
        recipientPhone: '0712345678',
        remarks: 'Negative test',
      };

      await expect(adapter.initiateB2CPayout(requestNegative)).rejects.toThrow(
        B2CPayoutError
      );
    });
  });

  describe('4. Success Mapping', () => {
    it('maps ResponseCode "0" to B2CPayoutResponse accurately', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { access_token: 'token_abc' },
      });

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          ConversationID: 'CONV_123',
          OriginatorConversationID: 'ORIG_123',
          ResponseCode: '0',
          ResponseDescription: 'Accepted',
        },
      });

      const adapter = new DarajaB2CAdapter();
      const res = await adapter.initiateB2CPayout({
        originatorConversationId: 'ORIG_123',
        amount: new Decimal(2000),
        recipientPhone: '254712345678',
        remarks: 'Payout test',
      });

      expect(res.responseCode).toBe('0');
      expect(res.conversationId).toBe('CONV_123');
      expect(res.originatorConversationId).toBe('ORIG_123');
    });
  });

  describe('5. Error Mapping', () => {
    it('throws B2CPayoutError with preserved code when Daraja returns non-zero ResponseCode', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { access_token: 'token_abc' },
      });

      mockedAxios.post.mockResolvedValue({
        data: {
          ResponseCode: '500.001.1001',
          ResponseDescription: 'Initiator authorization failed',
        },
      });

      const adapter = new DarajaB2CAdapter();

      await expect(
        adapter.initiateB2CPayout({
          originatorConversationId: 'ORIG_ERR',
          amount: new Decimal(1000),
          recipientPhone: '0712345678',
          remarks: 'Err test',
        })
      ).rejects.toThrow(B2CPayoutError);

      try {
        await adapter.initiateB2CPayout({
          originatorConversationId: 'ORIG_ERR2',
          amount: new Decimal(1000),
          recipientPhone: '0712345678',
          remarks: 'Err test',
        });
      } catch (err: any) {
        expect(err).toBeInstanceOf(B2CPayoutError);
        expect(err.code).toBe('500.001.1001');
        expect(err.message).toBe('Initiator authorization failed');
      }
    });
  });

  describe('6. HTTP Failure Handling', () => {
    it('surfaces axios network / HTTP failure as B2CPayoutError', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { access_token: 'token_abc' },
      });

      mockedAxios.post.mockRejectedValueOnce({
        response: {
          status: 500,
          data: {
            errorCode: '500.001.1002',
            errorMessage: 'Internal Server Error from Daraja Gateway',
          },
        },
      });

      const adapter = new DarajaB2CAdapter();

      try {
        await adapter.initiateB2CPayout({
          originatorConversationId: 'ORIG_HTTP_ERR',
          amount: new Decimal(1000),
          recipientPhone: '0712345678',
          remarks: 'HTTP fail test',
        });
        fail('Should have thrown B2CPayoutError');
      } catch (err: any) {
        expect(err).toBeInstanceOf(B2CPayoutError);
        expect(err.code).toBe('500.001.1002');
        expect(err.message).toContain('Internal Server Error');
      }
    });
  });

  describe('7. MpesaB2CMockAdapter', () => {
    it('returns deterministic success response in success mode', async () => {
      const mockAdapter = new MpesaB2CMockAdapter('success');
      const req: B2CPayoutRequest = {
        originatorConversationId: 'mock-orig-001',
        amount: new Decimal(3000),
        recipientPhone: '0712345678',
        remarks: 'Mock payout',
      };

      const res = await mockAdapter.initiateB2CPayout(req);
      expect(res.responseCode).toBe('0');
      expect(res.originatorConversationId).toBe('mock-orig-001');
      expect(res.conversationId).toMatch(/^AG_/);

      const statusRes = await mockAdapter.queryB2CStatus(res.conversationId);
      expect(statusRes.status).toBe('completed');
    });

    it('throws B2CPayoutError in failure mode', async () => {
      const mockAdapter = new MpesaB2CMockAdapter('failure');
      const req: B2CPayoutRequest = {
        originatorConversationId: 'mock-orig-fail',
        amount: new Decimal(3000),
        recipientPhone: '0712345678',
        remarks: 'Mock fail payout',
      };

      await expect(mockAdapter.initiateB2CPayout(req)).rejects.toThrow(B2CPayoutError);
    });

    it('throws timeout error in timeout mode', async () => {
      const mockAdapter = new MpesaB2CMockAdapter('timeout');
      const req: B2CPayoutRequest = {
        originatorConversationId: 'mock-orig-timeout',
        amount: new Decimal(3000),
        recipientPhone: '0712345678',
        remarks: 'Mock timeout payout',
      };

      await expect(mockAdapter.initiateB2CPayout(req)).rejects.toThrow(/timeout/i);
    });
  });

  describe('8. B2CGatewayFactory', () => {
    it('returns MpesaB2CMockAdapter when PAYMENT_GATEWAY_MODE is MOCK or default', () => {
      delete process.env.PAYMENT_GATEWAY_MODE;
      const gateway = B2CGatewayFactory.getB2CGateway();
      expect(gateway).toBeInstanceOf(MpesaB2CMockAdapter);

      process.env.PAYMENT_GATEWAY_MODE = 'MOCK';
      const gateway2 = getB2CGateway();
      expect(gateway2).toBeInstanceOf(MpesaB2CMockAdapter);
    });

    it('returns DarajaB2CAdapter when PAYMENT_GATEWAY_MODE is DARAJA', () => {
      process.env.PAYMENT_GATEWAY_MODE = 'DARAJA';
      const gateway = B2CGatewayFactory.getB2CGateway();
      expect(gateway).toBeInstanceOf(DarajaB2CAdapter);
    });
  });

  describe('9. Config Feature Flag & Graceful Degradation', () => {
    it('allows app boot with empty B2C env vars when ENABLE_B2C_DISBURSEMENT is false', () => {
      process.env.ENABLE_B2C_DISBURSEMENT = 'false';
      delete process.env.MPESA_B2C_SHORTCODE;
      delete process.env.MPESA_B2C_INITIATOR_NAME;
      delete process.env.MPESA_B2C_SECURITY_CREDENTIAL;

      // Updating config properties manually to mirror process.env changes
      config.enableB2cDisbursement = false;
      config.b2c.shortcode = '';
      config.b2c.initiatorName = '';
      config.b2c.securityCredential = '';

      expect(() => validateB2cConfig()).not.toThrow();
    });

    it('throws error on boot if ENABLE_B2C_DISBURSEMENT is true but required env vars are missing', () => {
      config.enableB2cDisbursement = true;
      config.b2c.shortcode = '';
      config.b2c.initiatorName = '';

      expect(() => validateB2cConfig()).toThrow(
        /ENABLE_B2C_DISBURSEMENT is true but missing required env vars/
      );
    });
  });
});
