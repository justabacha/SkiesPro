import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { pgPool } from '../../../config/database.js';
import { UserRepository } from '../repositories/userRepository.js';
import { TokenService } from './tokenService.js';
import { MfaService } from './mfaService.js';
import { MfaRepository } from '../repositories/mfaRepository.js';
import { OutboxRepository } from '../repositories/outboxRepository.js';
import { RegisterDto } from '../dto/register.dto.js';
import { logger } from '../../../shared/middleware/logger.js';

const ADMIN_ROLES = new Set([
  'super_admin',
  'admin',
  'compliance',
  'risk',
  'risk_manager',
  'finance',
  'support',
]);

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

  private normalizeRoles(roles: string[]): string[] {
    return [...new Set(roles.map((role) => role.trim().toLowerCase().replace(/[\s-]+/g, '_')))];
  }

  private primaryRole(roles: string[]): string {
    const normalizedRoles = this.normalizeRoles(roles);
    return normalizedRoles.find((role) => ADMIN_ROLES.has(role)) || normalizedRoles[0] || 'trader';
  }

  async register(data: RegisterDto) {
    const email = data.email.toLowerCase().trim();
    const existingUser = await this.userRepo.findByEmail(email);
    if (existingUser) {
      throw new Error('Email already registered');
    }

    if (data.phone) {
      const existingPhone = await this.userRepo.findByPhone(data.phone);
      if (existingPhone) {
        throw new Error('Phone number already registered');
      }
    }

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(data.password, saltRounds);
    const referralCode = uuidv4().split('-')[0].toUpperCase();

    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      const userRepoTx = new UserRepository(client);
      const outboxRepoTx = new OutboxRepository(client);

      const user = await userRepoTx.create({
        ...data,
        email, // Use normalized email
        password_hash: passwordHash,
        referral_code: referralCode,
      });

      await userRepoTx.assignRole(user.id, 'trader');
      await userRepoTx.addToPasswordHistory(user.id, passwordHash);

      // Emit UserRegisteredEvent to outbox
      await outboxRepoTx.create({
        event_type: 'UserRegisteredEvent',
        aggregate_type: 'User',
        aggregate_id: user.id,
        payload: {
          userId: user.id,
          email: user.email,
          displayName: user.display_name,
          currency: process.env.BASE_CURRENCY || 'KES',
        },
      });

      await client.query('COMMIT');

      logger.info('User registered with outbox event', { userId: user.id, email: user.email });

      return {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        status: user.status,
        kyc_status: user.kyc_status,
        mfa_enabled: user.mfa_enabled,
        created_at: user.created_at.toISOString(),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async login(email: string, password: string, ip: string | null, userAgent: string | null) {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.userRepo.findByEmail(normalizedEmail);

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

    const roles = this.normalizeRoles(await this.userRepo.getRoles(user.id));
    const adminRole = roles.find((role) => ADMIN_ROLES.has(role));

    if (adminRole && !user.mfa_enabled) {
      return {
        mfa_setup_required: true,
        mfa_enrollment_token: this.tokenService.generateAdminMfaEnrollmentToken(
          user.id,
          user.email,
          adminRole
        ),
      };
    }

    if (user.mfa_enabled) {
      const mfaSessionToken = uuidv4();
      // The MFA token is returned for verification; no server-side cache is used.
      return {
        requires_mfa: true,
        mfa_session_token: mfaSessionToken,
        userId: user.id, // Internal use
      };
    }

    await this.userRepo.updateLastLogin(user.id);
    const permissions: string[] = []; // Placeholder

    const tokens = await this.tokenService.createSession(
      user.id,
      this.primaryRole(roles),
      permissions,
      ip,
      userAgent,
      !user.mfa_enabled
    );

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: this.primaryRole(roles),
        roles,
        mfa_enabled: user.mfa_enabled,
        kyc_status: user.kyc_status,
      },
    };
  }

  async getMe(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    const roles = this.normalizeRoles(await this.userRepo.getRoles(userId));
    return {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      phone: user.phone,
      status: user.status,
      kyc_status: user.kyc_status,
      mfa_enabled: user.mfa_enabled,
      role: this.primaryRole(roles),
      roles,
      created_at: user.created_at,
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
    const roles = this.normalizeRoles(await this.userRepo.getRoles(user.id));
    const permissions: string[] = [];

    const tokens = await this.tokenService.createSession(
      user.id,
      this.primaryRole(roles),
      permissions,
      ip,
      userAgent,
      true
    );

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: this.primaryRole(roles),
        roles,
        mfa_enabled: user.mfa_enabled,
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

  async setupAdminMfa(userId: string, email: string) {
    const user = await this.userRepo.findById(userId);
    const roles = this.normalizeRoles(await this.userRepo.getRoles(userId));
    if (!user || !roles.some((role) => ADMIN_ROLES.has(role.toLowerCase()))) {
      throw new Error('FORBIDDEN_NOT_ADMIN');
    }
    if (user.mfa_enabled) {
      throw new Error('MFA already enabled for this administrator');
    }
    return this.setupMfa(userId, email);
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

  async confirmAdminMfaSetup(userId: string, code: string) {
    const user = await this.userRepo.findById(userId);
    const roles = this.normalizeRoles(await this.userRepo.getRoles(userId));
    if (!user || !roles.some((role) => ADMIN_ROLES.has(role.toLowerCase()))) {
      throw new Error('FORBIDDEN_NOT_ADMIN');
    }
    if (user.mfa_enabled) {
      throw new Error('MFA already enabled for this administrator');
    }
    return this.confirmMfaSetup(userId, code);
  }

  async verifyAdminStepUp(userId: string, role: string, code: string): Promise<string> {
    if (!ADMIN_ROLES.has(role.toLowerCase())) {
      throw new Error('FORBIDDEN_NOT_ADMIN');
    }

    const mfa = await this.mfaRepo.findByUserId(userId);
    if (!mfa || !mfa.is_enabled) {
      throw new Error('MFA_STEP_UP_REQUIRED');
    }

    const secret = this.mfaService.decrypt(mfa.secret_encrypted);
    if (!(await this.mfaService.verifyToken(code, secret))) {
      throw new Error('MFA_STEP_UP_REQUIRED');
    }

    return this.tokenService.generateAdminMfaToken(userId, role);
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

    const tokens = await this.tokenService.createSession(
      userId,
      this.primaryRole(roles),
      permissions,
      ip,
      userAgent
    );

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: this.primaryRole(roles),
        roles,
        kyc_status: user.kyc_status,
      },
    };
  }
}
