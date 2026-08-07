import { AuthService } from '../../src/modules/auth/services/authService';
import { UserRepository } from '../../src/modules/auth/repositories/userRepository';
import { TokenService } from '../../src/modules/auth/services/tokenService';
import { MfaRepository } from '../../src/modules/auth/repositories/mfaRepository';
import bcrypt from 'bcrypt';

jest.mock('../../src/modules/auth/repositories/userRepository');
jest.mock('../../src/modules/auth/repositories/sessionRepository');
jest.mock('../../src/modules/auth/repositories/mfaRepository');
jest.mock('../../src/modules/auth/services/tokenService');
jest.mock('bcrypt');

describe('AuthService', () => {
  let authService: AuthService;
  let userRepo: jest.Mocked<UserRepository>;
  let tokenService: jest.Mocked<TokenService>;
  let mfaRepo: jest.Mocked<MfaRepository>;

  beforeEach(() => {
    userRepo = new UserRepository() as any;
    tokenService = new TokenService() as any;
    mfaRepo = new MfaRepository() as any;

    // Inject mocks into service
    authService = new AuthService();
    (authService as any).userRepo = userRepo;
    (authService as any).tokenService = tokenService;
    (authService as any).mfaRepo = mfaRepo;
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
      userRepo.create.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        display_name: 'Test User',
        status: 'active',
        kyc_status: 'unverified',
        mfa_enabled: false,
        created_at: new Date(),
      } as any);

      const result = await authService.register({
        email: 'test@example.com',
        password: 'Password123!',
        display_name: 'Test User',
      });

      expect(result.email).toBe('test@example.com');
      expect(userRepo.create).toHaveBeenCalled();
      expect(userRepo.assignRole).toHaveBeenCalledWith('user-id', 'trader');
    });

    it('should throw error if email is already registered', async () => {
      userRepo.findByEmail.mockResolvedValue({ id: 'existing' } as any);

      await expect(authService.register({
        email: 'test@example.com',
        password: 'Password123!',
        display_name: 'Test User',
      })).rejects.toThrow('Email already registered');
    });
  });

  describe('login', () => {
    it('should login successfully without MFA', async () => {
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
      userRepo.findByEmail.mockResolvedValue(user as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      tokenService.createSession.mockResolvedValue({
        access_token: 'at',
        refresh_token: 'rt',
        expires_in: 900,
      });
      userRepo.getRoles.mockResolvedValue(['trader']);

      const result = await authService.login('test@example.com', 'password', '127.0.0.1', 'ua');

      expect(result).toHaveProperty('access_token');
      expect((result as any).user.email).toBe('test@example.com');
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
      userRepo.findByEmail.mockResolvedValue(user as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.login('test@example.com', 'password', '127.0.0.1', 'ua');

      expect(result).toHaveProperty('requires_mfa', true);
      expect(result).toHaveProperty('mfa_session_token');
    });

    it('should throw error on invalid credentials', async () => {
      userRepo.findByEmail.mockResolvedValue(null);

      await expect(authService.login('test@example.com', 'password', '127.0.0.1', 'ua'))
        .rejects.toThrow('Invalid credentials');
    });

    it('should throw error if account is locked', async () => {
      const user = {
        email: 'test@example.com',
        locked_until: new Date(Date.now() + 10000),
      };
      userRepo.findByEmail.mockResolvedValue(user as any);

      await expect(authService.login('test@example.com', 'password', '127.0.0.1', 'ua'))
        .rejects.toThrow(/Account locked/);
    });
  });
});
