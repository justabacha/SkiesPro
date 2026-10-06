import { AuthService } from '../../src/modules/auth/services/authService.js';
import { UserRepository } from '../../src/modules/auth/repositories/userRepository.js';
import { TokenService } from '../../src/modules/auth/services/tokenService.js';
import { MfaRepository } from '../../src/modules/auth/repositories/mfaRepository.js';
import { OutboxRepository } from '../../src/modules/auth/repositories/outboxRepository.js';
import { pgPool } from '../../src/config/database.js';
import bcrypt from 'bcrypt';

jest.mock('../../src/modules/auth/repositories/userRepository');
jest.mock('../../src/modules/auth/repositories/mfaRepository');
jest.mock('../../src/modules/auth/repositories/outboxRepository');
jest.mock('../../src/modules/auth/services/tokenService');
jest.mock('../../src/config/database');
jest.mock('bcrypt');

describe('AuthService', () => {
  let authService: AuthService;
  let userRepoMock: any;
  let mfaRepoMock: any;
  let outboxRepoMock: any;
  let tokenServiceMock: any;
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup repository mocks on prototypes so ALL instances share them
    userRepoMock = UserRepository.prototype;
    mfaRepoMock = MfaRepository.prototype;
    outboxRepoMock = OutboxRepository.prototype;
    tokenServiceMock = TokenService.prototype;

    mockClient = {
      query: jest.fn().mockResolvedValue({ rowCount: 1, rows: [] }),
      release: jest.fn(),
    };
    (pgPool.connect as jest.Mock).mockResolvedValue(mockClient);

    authService = new AuthService();
  });

  describe('register', () => {
    it('should register a new user successfully with normalized email', async () => {
      userRepoMock.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');

      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        display_name: 'Test User',
        status: 'active',
        kyc_status: 'unverified',
        mfa_enabled: false,
        created_at: new Date(),
      };
      userRepoMock.create.mockResolvedValue(mockUser);

      const result = await authService.register({
        email: 'TEST@EXAMPLE.com',
        password: 'Password123!',
        display_name: 'Test User',
      });

      expect(result.email).toBe('test@example.com');
      expect(userRepoMock.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(userRepoMock.create).toHaveBeenCalled();
      expect(outboxRepoMock.create).toHaveBeenCalled();
    });

    it('should throw error if email is already registered', async () => {
      userRepoMock.findByEmail.mockResolvedValue({ id: 'existing' });

      await expect(authService.register({
        email: 'test@example.com',
        password: 'Password123!',
        display_name: 'Test User',
      })).rejects.toThrow('Email already registered');
    });
  });

  describe('login', () => {
    it('should login successfully with normalized email', async () => {
      const user = {
        id: 'user-id',
        email: 'test@example.com',
        password_hash: 'hashed',
        mfa_enabled: false,
        failed_login_attempts: 0,
        locked_until: null,
        display_name: 'Test User',
        kyc_status: 'unverified',
      };
      userRepoMock.findByEmail.mockResolvedValue(user);
      userRepoMock.getRoles.mockResolvedValue(['trader']);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      tokenServiceMock.createSession.mockResolvedValue({
        access_token: 'at',
        refresh_token: 'rt',
        expires_in: 900,
      });
      userRepoMock.getRoles.mockResolvedValue(['trader']);

      const result = await authService.login(' TEST@example.com ', 'password', '127.0.0.1', 'ua');

      expect(userRepoMock.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(result).toHaveProperty('access_token');
    });

    it('should return mfa_session_token if MFA is enabled', async () => {
      const user = {
        id: 'user-id',
        email: 'test@example.com',
        password_hash: 'hashed',
        mfa_enabled: true,
        failed_login_attempts: 0,
        locked_until: null,
      };
      userRepoMock.findByEmail.mockResolvedValue(user);
      userRepoMock.getRoles.mockResolvedValue(['admin']);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.login('test@example.com', 'password', '127.0.0.1', 'ua');

      expect(result).toHaveProperty('requires_mfa', true);
      expect(result).toHaveProperty('mfa_session_token');
    });

    it('requires TOTP enrollment before issuing a session to staff without MFA', async () => {
      userRepoMock.findByEmail.mockResolvedValue({
        id: 'staff-id',
        email: 'staff@example.com',
        password_hash: 'hashed',
        mfa_enabled: false,
        failed_login_attempts: 0,
        locked_until: null,
      });
      userRepoMock.getRoles.mockResolvedValue(['support']);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      tokenServiceMock.generateAdminMfaEnrollmentToken.mockReturnValue('enrollment-token');

      const result = await authService.login('staff@example.com', 'password', '127.0.0.1', 'ua');

      expect(result).toEqual({
        mfa_setup_required: true,
        mfa_enrollment_token: 'enrollment-token',
      });
      expect(tokenServiceMock.createSession).not.toHaveBeenCalled();
    });

    it('should throw error on invalid credentials', async () => {
      userRepoMock.findByEmail.mockResolvedValue(null);

      await expect(authService.login('test@example.com', 'password', '127.0.0.1', 'ua'))
        .rejects.toThrow('Invalid credentials');
    });

    it('should throw error if account is locked', async () => {
      const user = {
        email: 'test@example.com',
        locked_until: new Date(Date.now() + 10000),
      };
      userRepoMock.findByEmail.mockResolvedValue(user);

      await expect(authService.login('test@example.com', 'password', '127.0.0.1', 'ua'))
        .rejects.toThrow(/Account locked/);
    });
  });

  describe('verifyMfa', () => {
    it('should verify MFA successfully', async () => {
      mfaRepoMock.findByUserId.mockResolvedValue({ is_enabled: true, secret_encrypted: 'enc' });
      (authService as any).mfaService = {
        decrypt: jest.fn().mockReturnValue('secret'),
        verifyToken: jest.fn().mockResolvedValue(true),
      };
      userRepoMock.findById.mockResolvedValue({ id: 'user-id', email: 'test@example.com' });
      userRepoMock.getRoles.mockResolvedValue(['trader']);
      tokenServiceMock.createSession.mockResolvedValue({ access_token: 'at' });

      const result = await authService.verifyMfa('user-id', '123456', 'ip', 'ua');
      expect(result).toHaveProperty('access_token');
    });

    it('resolves uppercase super-admin roles consistently in authentication payloads', async () => {
      mfaRepoMock.findByUserId.mockResolvedValue({ is_enabled: true, secret_encrypted: 'enc' });
      (authService as any).mfaService = {
        decrypt: jest.fn().mockReturnValue('secret'),
        verifyToken: jest.fn().mockResolvedValue(true),
      };
      userRepoMock.findById.mockResolvedValue({
        id: 'user-id',
        email: 'admin@example.com',
        display_name: 'Admin',
        kyc_status: 'verified',
      });
      userRepoMock.getRoles.mockResolvedValue(['TRADER', 'SUPER_ADMIN']);
      tokenServiceMock.createSession.mockResolvedValue({ access_token: 'at' });

      const result = await authService.verifyMfa('user-id', '123456', 'ip', 'ua');

      expect(tokenServiceMock.createSession).toHaveBeenCalledWith(
        'user-id',
        'super_admin',
        [],
        'ip',
        'ua',
        true
      );
      expect(result.user).toMatchObject({
        role: 'super_admin',
        roles: ['trader', 'super_admin'],
      });
    });

    it('should throw if MFA code is invalid', async () => {
      mfaRepoMock.findByUserId.mockResolvedValue({ is_enabled: true, secret_encrypted: 'enc' });
      (authService as any).mfaService = {
        decrypt: jest.fn().mockReturnValue('secret'),
        verifyToken: jest.fn().mockResolvedValue(false),
      };

      await expect(authService.verifyMfa('user-id', '123456', 'ip', 'ua'))
        .rejects.toThrow('Invalid MFA code');
    });
  });

  describe('getMe', () => {
    it('returns a normalized staff role and all active roles', async () => {
      userRepoMock.findById.mockResolvedValue({
        id: 'user-id',
        email: 'admin@example.com',
        display_name: 'Admin',
        status: 'active',
        kyc_status: 'verified',
        mfa_enabled: true,
        created_at: new Date(),
      });
      userRepoMock.getRoles.mockResolvedValue(['TRADER', 'SUPER_ADMIN']);

      const result = await authService.getMe('user-id');

      expect(result.role).toBe('super_admin');
      expect(result.roles).toEqual(['trader', 'super_admin']);
    });
  });

  describe('refresh', () => {
    it('should refresh tokens successfully', async () => {
      tokenServiceMock.refreshSession.mockResolvedValue('user-id');
      userRepoMock.findById.mockResolvedValue({ id: 'user-id', email: 'test@example.com' });
      userRepoMock.getRoles.mockResolvedValue(['trader']);
      tokenServiceMock.createSession.mockResolvedValue({ access_token: 'new-at' });

      const result = await authService.refresh('refresh-token', 'ip', 'ua');
      expect(result).toHaveProperty('access_token', 'new-at');
    });

    it('should throw if refresh token is invalid', async () => {
      tokenServiceMock.refreshSession.mockResolvedValue(null);
      await expect(authService.refresh('bad-token', 'ip', 'ua'))
        .rejects.toThrow('Invalid or expired refresh token');
    });
  });
});
