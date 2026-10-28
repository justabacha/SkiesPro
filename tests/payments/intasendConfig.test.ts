import { validateIntasendConfig, validateB2cConfig, config } from '../../src/config/app.js';
import { PaymentService } from '../../src/modules/payments/services/paymentService.js';
import { MpesaGatewayFactory } from '../../src/modules/payments/adapters/mpesa/MpesaGatewayFactory.js';

describe('validateIntasendConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.INTASEND_SECRET_KEY = 'ISSecretKey_valid';
    process.env.INTASEND_PUBLISHABLE_KEY = 'ISPubKey_valid';
    process.env.INTASEND_ENVIRONMENT = 'sandbox';
    process.env.INTASEND_WEBHOOK_CHALLENGE = 'challenge-valid';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('accepts a valid IntaSend configuration', async () => {
    await expect(validateIntasendConfig()).resolves.not.toThrow();
  });

  it.each([
    ['INTASEND_SECRET_KEY', 'missing'],
    ['INTASEND_PUBLISHABLE_KEY', 'missing'],
    ['INTASEND_ENVIRONMENT', 'missing'],
    ['INTASEND_WEBHOOK_CHALLENGE', 'missing'],
  ])('fails when %s is missing', async (key, _value) => {
    delete process.env[key as keyof NodeJS.ProcessEnv];
    await expect(validateIntasendConfig()).rejects.toThrow(/Invalid IntaSend config/i);
  });

  it.each([
    ['INTASEND_SECRET_KEY', 'BadKey_abc', /must start with ISSecretKey_/i],
    ['INTASEND_PUBLISHABLE_KEY', 'BadPubKey_abc', /must start with ISPubKey_/i],
    ['INTASEND_ENVIRONMENT', 'staging', /must be sandbox or live/i],
  ])('fails when %s is invalid: %s', async (key, value, expectedPattern) => {
    process.env[key as keyof NodeJS.ProcessEnv] = value;
    await expect(validateIntasendConfig()).rejects.toThrow(expectedPattern);
  });

  it('bypasses validation when NODE_ENV=test', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.INTASEND_SECRET_KEY;
    delete process.env.INTASEND_PUBLISHABLE_KEY;
    delete process.env.INTASEND_ENVIRONMENT;

    expect(() => {
      if (process.env.PAYMENT_GATEWAY_MODE === 'INTASEND' && process.env.NODE_ENV !== 'test') {
        validateIntasendConfig();
      }
    }).not.toThrow();
  });

  it('throws migration-046 error when gateway_tracking_id column is missing', async () => {
    const mockPool = {
      query: jest.fn().mockResolvedValueOnce({ rows: [] }),
    };

    await expect(validateIntasendConfig(mockPool)).rejects.toThrow(
      'MIGRATION 046 NOT APPLIED — gateway_tracking_id column missing on payments.b2c_outbox. Run migration 046 before enabling PAYMENT_GATEWAY_MODE=INTASEND.'
    );
  });
});

describe('validateB2cConfig mode conditional checks', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.MPESA_B2C_SHORTCODE;
    delete process.env.MPESA_B2C_INITIATOR_NAME;
    delete process.env.MPESA_B2C_SECURITY_CREDENTIAL;
    delete process.env.MPESA_B2C_RESULT_URL;
    delete process.env.MPESA_B2C_TIMEOUT_URL;
    config.enableB2cDisbursement = true;
    config.b2c.shortcode = '';
    config.b2c.initiatorName = '';
    config.b2c.securityCredential = '';
    config.b2c.resultUrl = '';
    config.b2c.timeoutUrl = '';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('passes when PAYMENT_GATEWAY_MODE=INTASEND and all MPESA_B2C_* are unset', () => {
    process.env.PAYMENT_GATEWAY_MODE = 'INTASEND';
    expect(() => validateB2cConfig()).not.toThrow();
  });

  it('passes when PAYMENT_GATEWAY_MODE=MOCK and all MPESA_B2C_* are unset', () => {
    process.env.PAYMENT_GATEWAY_MODE = 'MOCK';
    expect(() => validateB2cConfig()).not.toThrow();
  });

  it('throws when PAYMENT_GATEWAY_MODE=DARAJA and any MPESA_B2C_* is missing', () => {
    process.env.PAYMENT_GATEWAY_MODE = 'DARAJA';
    expect(() => validateB2cConfig()).toThrow(/missing required env vars/i);
  });
});

describe('PaymentService deposit idempotency ambiguity handling', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ambiguous deposit error marks idempotency key ambiguous and refuses retry with 409', async () => {
    const mockRepo = {
      findIdempotencyKey: jest.fn(),
      saveIdempotencyKey: jest.fn().mockResolvedValue(undefined),
      createDeposit: jest.fn(),
    };
    const mockSettings = {
      getSetting: jest.fn().mockImplementation((_k, def) => Promise.resolve(def)),
    };
    const mockGateway = {
      initiateStkPush: jest.fn().mockRejectedValueOnce(
        Object.assign(new Error('Timeout contacting IntaSend'), { outcome: 'possibly_sent' })
      ),
    };

    jest.spyOn(MpesaGatewayFactory, 'getGateway').mockReturnValue(mockGateway as any);

    const service = new PaymentService(mockSettings as any, mockRepo as any);

    mockRepo.findIdempotencyKey.mockResolvedValueOnce(null);

    await expect(
      service.initiateDeposit('user-1', { amount: '1000', currency: 'KES', gateway_id: 1, phone: '0712345678' }, 'ik-ambig')
    ).rejects.toMatchObject({
      message: expect.stringContaining('DEPOSIT_STATUS_AMBIGUOUS'),
      status: 409,
    });

    expect(mockRepo.saveIdempotencyKey).toHaveBeenCalledWith('ik-ambig', {
      status: 'ambiguous',
      error: 'Timeout contacting IntaSend',
      timestamp: expect.any(String),
    });

    mockRepo.findIdempotencyKey.mockResolvedValueOnce({ status: 'ambiguous', error: 'Timeout' });

    await expect(
      service.initiateDeposit('user-1', { amount: '1000', currency: 'KES', gateway_id: 1, phone: '0712345678' }, 'ik-ambig')
    ).rejects.toMatchObject({
      message: 'Deposit is in ambiguous state — manual reconciliation required before retry',
      status: 409,
    });

    expect(mockGateway.initiateStkPush).toHaveBeenCalledTimes(1);
  });

  it('definitely_not_sent deposit error clears idempotency and allows retry', async () => {
    const mockRepo = {
      findIdempotencyKey: jest.fn(),
      saveIdempotencyKey: jest.fn().mockResolvedValue(undefined),
      createDeposit: jest.fn(),
    };
    const mockSettings = {
      getSetting: jest.fn().mockImplementation((_k, def) => Promise.resolve(def)),
    };
    const mockGateway = {
      initiateStkPush: jest
        .fn()
        .mockRejectedValueOnce(
          Object.assign(new Error('Connection refused'), { outcome: 'definitely_not_sent' })
        )
        .mockResolvedValueOnce({
          checkoutRequestId: 'INV_RETRY_OK',
          customerMessage: 'STK push sent',
        }),
    };

    jest.spyOn(MpesaGatewayFactory, 'getGateway').mockReturnValue(mockGateway as any);

    const service = new PaymentService(mockSettings as any, mockRepo as any);

    mockRepo.findIdempotencyKey.mockResolvedValueOnce(null);

    await expect(
      service.initiateDeposit('user-1', { amount: '1000', currency: 'KES', gateway_id: 1, phone: '0712345678' }, 'ik-retry')
    ).rejects.toThrow('Connection refused');

    expect(mockRepo.saveIdempotencyKey).toHaveBeenCalledWith('ik-retry', null);

    mockRepo.findIdempotencyKey.mockResolvedValueOnce(null);
    mockRepo.createDeposit.mockResolvedValueOnce({
      id: 'dep-123',
      status: 'pending',
      amount: '1000',
      currency: 'KES',
      gateway_reference: 'INV_RETRY_OK',
    });

    const res = await service.initiateDeposit(
      'user-1',
      { amount: '1000', currency: 'KES', gateway_id: 1, phone: '0712345678' },
      'ik-retry'
    );

    expect(res.gateway_reference).toBe('INV_RETRY_OK');
    expect(mockGateway.initiateStkPush).toHaveBeenCalledTimes(2);
  });
});
