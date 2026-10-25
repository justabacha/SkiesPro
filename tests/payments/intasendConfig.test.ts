import { validateIntasendConfig } from '../../src/config/app.js';

describe('validateIntasendConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.INTASEND_SECRET_KEY = 'ISSecretKey_valid';
    process.env.INTASEND_PUBLISHABLE_KEY = 'ISPubKey_valid';
    process.env.INTASEND_ENVIRONMENT = 'sandbox';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('accepts a valid IntaSend configuration', () => {
    expect(() => validateIntasendConfig()).not.toThrow();
  });

  it.each([
    ['INTASEND_SECRET_KEY', 'missing'],
    ['INTASEND_PUBLISHABLE_KEY', 'missing'],
    ['INTASEND_ENVIRONMENT', 'missing'],
  ])('fails when %s is missing', (key, _value) => {
    delete process.env[key as keyof NodeJS.ProcessEnv];
    expect(() => validateIntasendConfig()).toThrow(/Invalid IntaSend config/i);
  });

  it.each([
    ['INTASEND_SECRET_KEY', 'BadKey_abc', /must start with ISSecretKey_/i],
    ['INTASEND_PUBLISHABLE_KEY', 'BadPubKey_abc', /must start with ISPubKey_/i],
    ['INTASEND_ENVIRONMENT', 'staging', /must be sandbox or live/i],
  ])('fails when %s is invalid: %s', (key, value, expectedPattern) => {
    process.env[key as keyof NodeJS.ProcessEnv] = value;
    expect(() => validateIntasendConfig()).toThrow(expectedPattern);
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
});
