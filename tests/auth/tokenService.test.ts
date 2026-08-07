import { TokenService } from '../../src/modules/auth/services/tokenService';
import { SessionRepository } from '../../src/modules/auth/repositories/sessionRepository';
import jwt from 'jsonwebtoken';

jest.mock('../../src/modules/auth/repositories/sessionRepository');
jest.mock('jsonwebtoken');

describe('TokenService', () => {
  let tokenService: TokenService;
  let sessionRepo: jest.Mocked<SessionRepository>;

  beforeEach(() => {
    // Set environment variables for testing
    process.env.JWT_PRIVATE_KEY = Buffer.from('private_key').toString('base64');
    process.env.JWT_PUBLIC_KEY = Buffer.from('public_key').toString('base64');

    sessionRepo = new SessionRepository() as any;
    tokenService = new TokenService();
    (tokenService as any).sessionRepo = sessionRepo;
  });

  describe('generateAccessToken', () => {
    it('should generate a valid JWT', () => {
      (jwt.sign as jest.Mock).mockReturnValue('token');

      const result = tokenService.generateAccessToken('user-id', 'trader', ['perm1']);

      expect(result.token).toBe('token');
      expect(result.jti).toBeDefined();
      expect(jwt.sign).toHaveBeenCalled();
    });
  });

  describe('validateAccessToken', () => {
    it('should return payload for valid token', () => {
      const payload = { sub: 'user-id', jti: 'jti' };
      (jwt.verify as jest.Mock).mockReturnValue(payload);

      const result = tokenService.validateAccessToken('token');

      expect(result).toBe(payload);
    });

    it('should return null for invalid token', () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('invalid');
      });

      const result = tokenService.validateAccessToken('token');

      expect(result).toBeNull();
    });
  });

  describe('isTokenRevoked', () => {
    it('should return true if session is revoked', async () => {
      sessionRepo.findByJti.mockResolvedValue({ is_revoked: true } as any);

      const result = await tokenService.isTokenRevoked('jti');

      expect(result).toBe(true);
    });

    it('should return false if session is not revoked', async () => {
      sessionRepo.findByJti.mockResolvedValue({ is_revoked: false } as any);

      const result = await tokenService.isTokenRevoked('jti');

      expect(result).toBe(false);
    });
  });
});
