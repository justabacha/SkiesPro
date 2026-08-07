import { pgPool } from '../src/config/database';
import { cacheClient } from '../src/infrastructure/cache';

jest.mock('otplib', () => ({
  TOTP: jest.fn().mockImplementation(() => ({
    generateSecret: jest.fn().mockReturnValue('secret'),
    toURI: jest.fn().mockReturnValue('otpauth://...'),
    verify: jest.fn().mockResolvedValue({ valid: true }),
  })),
  NobleCryptoPlugin: jest.fn(),
  ScureBase32Plugin: jest.fn(),
}));

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('qr_code_data'),
}));

afterAll(async () => {
  await pgPool.end();
  await cacheClient.close();
});
