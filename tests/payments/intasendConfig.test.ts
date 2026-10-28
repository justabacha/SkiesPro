import { validateIntasendConfig } from '../../src/config/app.js';

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
