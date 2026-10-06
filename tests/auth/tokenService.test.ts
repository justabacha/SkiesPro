import { TokenService } from '../../src/modules/auth/services/tokenService.js';
import { SessionRepository } from '../../src/modules/auth/repositories/sessionRepository.js';

jest.mock('../../src/modules/auth/repositories/sessionRepository');

describe('TokenService', () => {
  let tokenService: TokenService;
  let sessionRepo: jest.Mocked<SessionRepository>;

  beforeEach(() => {
    sessionRepo = new SessionRepository() as any;
    tokenService = new TokenService();
    (tokenService as any).sessionRepo = sessionRepo;
  });

  describe('generateAccessToken', () => {
    it('should generate a valid JWT', () => {
      const result = tokenService.generateAccessToken('user-id', 'trader', ['perm1']);

      expect(result.token).toBeDefined();
      expect(result.jti).toBeDefined();
    });
  });

  describe('validateAccessToken', () => {
    it('should return payload for valid token', () => {
      const { token } = tokenService.generateAccessToken('user-id', 'trader', ['perm1']);
      const result = tokenService.validateAccessToken(token);

      expect(result.sub).toBe('user-id');
    });

    describe('administrator MFA tokens', () => {
      it('creates short-lived, purpose-restricted enrollment and step-up tokens', () => {
        const enrollmentToken = tokenService.generateAdminMfaEnrollmentToken(
          'admin-id',
          'admin@example.com',
          'admin'
        );
        const stepUpToken = tokenService.generateAdminMfaToken('admin-id', 'admin');

        expect(tokenService.validateAdminMfaEnrollmentToken(enrollmentToken)).toMatchObject({
          sub: 'admin-id',
          email: 'admin@example.com',
          role: 'admin',
          purpose: 'admin_mfa_enrollment',
        });
        expect(tokenService.validateAdminMfaToken(stepUpToken)).toMatchObject({
          sub: 'admin-id',
          role: 'admin',
          purpose: 'admin_mfa_step_up',
          mfa_verified: true,
        });
        expect(tokenService.validateAdminMfaToken(enrollmentToken)).toBeNull();
        expect(tokenService.validateAdminMfaEnrollmentToken(stepUpToken)).toBeNull();
      });
    });

    it('should return null for invalid token', () => {
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
