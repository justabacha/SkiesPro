import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { UserRepository } from '../repositories/userRepository';
import { TokenService } from './tokenService';
import { MfaService } from './mfaService';
import { MfaRepository } from '../repositories/mfaRepository';
import { RegisterDto } from '../dto/register.dto';
import { logger } from '../../../shared/middleware/logger';

export class AuthService {
  private userRepo: UserRepository;
  private tokenService: TokenService;
  private mfaService: MfaService;
  private mfaRepo: MfaRepository;

  constructor() {
    this.userRepo = new UserRepository();
    this.tokenService = new TokenService();
    this.mfaService = new MfaService();
    this.mfaRepo = new MfaRepository();
  }

  async register(data: RegisterDto) {
    const existingUser = await this.userRepo.findByEmail(data.email);
    if (existingUser) {
      throw new Error('Email already registered');
    }

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(data.password, saltRounds);
    const referralCode = uuidv4().split('-')[0].toUpperCase();

    const user = await this.userRepo.create({
      ...data,
      password_hash: passwordHash,
      referral_code: referralCode,
    });

    await this.userRepo.assignRole(user.id, 'trader');
    await this.userRepo.addToPasswordHistory(user.id, passwordHash);

    logger.info('User registered', { userId: user.id, email: user.email });

    return {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      status: user.status,
      kyc_status: user.kyc_status,
      mfa_enabled: user.mfa_enabled,
      created_at: user.created_at.toISOString(),
    };
  }

  async login(email: string, password: string, ip: string | null, userAgent: string | null) {
    const user = await this.userRepo.findByEmail(email);

    if (!user) {
      throw new Error('Invalid credentials');
    }

    if (user.locked_until && user.locked_until > new Date()) {
      throw new Error(`Account locked. Try again after ${user.locked_until.toISOString()}`);
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      const attempts = user.failed_login_attempts + 1;
      let lockedUntil: Date | null = null;

      if (attempts >= 5) {
        const lockoutMinutes = 15 * Math.pow(2, Math.floor((attempts - 5) / 5));
        lockedUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
        logger.warn('Account locked', { userId: user.id, lockoutMinutes });
      }

      await this.userRepo.updateLoginAttempts(user.id, attempts, lockedUntil);
      throw new Error('Invalid credentials');
    }

    if (user.mfa_enabled) {
      const mfaSessionToken = uuidv4();
      // In production, store this in Redis: redis.set(`mfa_session:${mfaSessionToken}`, user.id, 'EX', 300)
      return {
        requires_mfa: true,
        mfa_session_token: mfaSessionToken,
        userId: user.id, // Internal use
      };
    }

    await this.userRepo.updateLastLogin(user.id);
    const roles = await this.userRepo.getRoles(user.id);
    const permissions: string[] = []; // Placeholder

    const tokens = await this.tokenService.createSession(user.id, roles[0] || 'trader', permissions, ip, userAgent);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: roles[0] || 'trader',
        kyc_status: user.kyc_status,
      },
    };
  }

  async verifyMfa(userId: string, code: string, ip: string | null, userAgent: string | null) {
    const mfa = await this.mfaRepo.findByUserId(userId);
    if (!mfa || !mfa.is_enabled) {
      throw new Error('MFA not enabled for this user');
    }

    const secret = this.mfaService.decrypt(mfa.secret_encrypted);
    const isValid = await this.mfaService.verifyToken(code, secret);

    if (!isValid) {
      throw new Error('Invalid MFA code');
    }

    const user = await this.userRepo.findById(userId);
    if (!user) throw new Error('User not found');

    await this.userRepo.updateLastLogin(user.id);
    const roles = await this.userRepo.getRoles(user.id);
    const permissions: string[] = [];

    const tokens = await this.tokenService.createSession(user.id, roles[0] || 'trader', permissions, ip, userAgent);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: roles[0] || 'trader',
        kyc_status: user.kyc_status,
      },
    };
  }

  async setupMfa(userId: string, email: string) {
    const setup = await this.mfaService.generateMfaSetup(email, userId);
    const backupCodes = this.mfaService.generateBackupCodes();

    await this.mfaRepo.upsert(userId, setup.encryptedSecret, backupCodes);

    return {
      secret: setup.secret,
      qr_code_url: setup.qr_code_url,
      setup_completed: false,
    };
  }

  async confirmMfaSetup(userId: string, code: string) {
    const mfa = await this.mfaRepo.findByUserId(userId);
    if (!mfa) throw new Error('MFA setup not found');

    const secret = this.mfaService.decrypt(mfa.secret_encrypted);
    const isValid = await this.mfaService.verifyToken(code, secret);

    if (!isValid) {
      throw new Error('Invalid MFA code');
    }

    await this.mfaRepo.verify(userId);
    await this.userRepo.updateMfaStatus(userId, true, 'totp');

    return { message: 'MFA enabled successfully', recovery_codes: mfa.backup_codes };
  }

  async refresh(refreshToken: string, ip: string | null, userAgent: string | null) {
    const userId = await this.tokenService.refreshSession(refreshToken, ip, userAgent);
    if (!userId) {
      throw new Error('Invalid or expired refresh token');
    }

    const user = await this.userRepo.findById(userId);
    if (!user) throw new Error('User not found');

    const roles = await this.userRepo.getRoles(userId);
    const permissions: string[] = [];

    const tokens = await this.tokenService.createSession(userId, roles[0] || 'trader', permissions, ip, userAgent);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: roles[0] || 'trader',
        kyc_status: user.kyc_status,
      },
    };
  }
}
