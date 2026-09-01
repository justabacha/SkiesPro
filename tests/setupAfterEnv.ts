import { pgPool } from '../src/config/database.js';
import { cacheClient } from '../src/infrastructure/cache/index.js';

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

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockImplementation((payload) => {
    return 'mock.token.' + Buffer.from(JSON.stringify(payload)).toString('base64');
  }),
  verify: jest.fn().mockImplementation((token) => {
    if (token.startsWith('mock.token.')) {
      const b64 = token.split('.')[2];
      return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    }
    // Fallback for explicitly signed tokens in tests
    if (token.startsWith('eyJ')) {
       return { sub: 'user-123', role: 'trader', permissions: [], jti: 'mock-jti' };
    }
    throw new Error('invalid token');
  }),
}));

jest.mock('../src/modules/auth/repositories/sessionRepository', () => ({
  SessionRepository: jest.fn().mockImplementation(() => ({
    findByJti: jest.fn().mockResolvedValue({ is_revoked: false }),
    create: jest.fn().mockResolvedValue({}),
    revokeByJti: jest.fn().mockResolvedValue({}),
    revokeAllForUser: jest.fn().mockResolvedValue({}),
  })),
}));

// Mock it again with the path used by TokenService relative to its own location
// Wait, Jest mocks are based on the path relative to the root or the module name.
// Since it's a relative path in TokenService, Jest uses that.
jest.mock('../../modules/auth/repositories/sessionRepository', () => ({
  SessionRepository: jest.fn().mockImplementation(() => ({
    findByJti: jest.fn().mockResolvedValue({ is_revoked: false }),
    create: jest.fn().mockResolvedValue({}),
    revokeByJti: jest.fn().mockResolvedValue({}),
    revokeAllForUser: jest.fn().mockResolvedValue({}),
  })),
}), { virtual: true });

afterAll(async () => {
  await pgPool.end();
  await cacheClient.close();
});
