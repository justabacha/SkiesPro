import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserRepository, UserRow } from '../../auth/repositories/userRepository.js';
import { OutboxRepository } from '../../auth/repositories/outboxRepository.js';
import { storageClient } from '../../../shared/storage/supabaseStorage.js';
import { UpdateProfileDto } from '../dto/UpdateProfileDto.js';
import { ProfileResponseDto } from '../dto/ProfileResponseDto.js';

export class UserService {
  private userRepo: UserRepository;
  private outboxRepo: OutboxRepository;

  constructor() {
    this.userRepo = new UserRepository();
    this.outboxRepo = new OutboxRepository();
  }

  async getProfile(userId: string): Promise<ProfileResponseDto> {
    const user = await this.userRepo.getProfile(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return this.mapToDto(user);
  }

  async updateProfile(userId: string, data: UpdateProfileDto): Promise<ProfileResponseDto> {
    const user = await this.userRepo.updateProfile(userId, data);
    return this.mapToDto(user);
  }

  async uploadAvatar(userId: string, file: Buffer, filename: string): Promise<string> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.avatar_url) {
      await storageClient.deleteAvatar(user.avatar_url);
    }

    const avatarUrl = await storageClient.uploadAvatar(userId, file, filename);
    await this.userRepo.updateAvatar(userId, avatarUrl);
    return avatarUrl;
  }

  async getKycStatus(userId: string): Promise<string> {
    const status = await this.userRepo.getKycStatus(userId);
    if (!status) {
      throw new Error('User not found');
    }
    return status;
  }

  async initiateKyc(userId: string): Promise<string> {
    const user = await this.userRepo.initiateKyc(userId);
    console.log(`KYC initiated for user ${userId} at ${new Date().toISOString()}`);
    return user.kyc_status;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    currentJti?: string
  ): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new Error('User not found');

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) throw new Error('Invalid current password');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.userRepo.updatePassword(userId, passwordHash);
    await this.userRepo.addToPasswordHistory(userId, passwordHash);

    // Invalidate all OTHER sessions for this user
    await this.userRepo.revokeOtherSessions(userId, currentJti);
  }

  async initiateEmailChange(
    userId: string,
    newEmail: string,
    password: string
  ): Promise<{ token: string }> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new Error('User not found');

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) throw new Error('Invalid password');

    const normalizedNewEmail = newEmail.toLowerCase().trim();
    if (normalizedNewEmail === user.email.toLowerCase()) {
      throw new Error('New email must be different from current email');
    }

    const existingUser = await this.userRepo.findByEmail(normalizedNewEmail);
    if (existingUser) {
      throw new Error('Email is already registered');
    }

    const secret = process.env.JWT_SECRET || 'secret';
    const token = jwt.sign(
      { sub: userId, old_email: user.email, new_email: normalizedNewEmail, purpose: 'email_change' },
      secret,
      { expiresIn: '15m' }
    );

    // Record outbox event for email change notification
    await this.outboxRepo.create({
      event_type: 'EmailChangeInitiated',
      aggregate_type: 'User',
      aggregate_id: userId,
      payload: {
        userId,
        oldEmail: user.email,
        newEmail: normalizedNewEmail,
        token,
      },
    });

    return { token };
  }

  async verifyEmailChange(
    userId: string,
    token: string,
    currentJti?: string
  ): Promise<{ email: string }> {
    const secret = process.env.JWT_SECRET || 'secret';
    let payload: any;
    try {
      payload = jwt.verify(token, secret);
    } catch {
      throw new Error('Invalid or expired token');
    }

    if (!payload || payload.purpose !== 'email_change' || payload.sub !== userId) {
      throw new Error('Invalid token claims');
    }

    const newEmail = payload.new_email;
    const existingUser = await this.userRepo.findByEmail(newEmail);
    if (existingUser) {
      throw new Error('Email is already registered');
    }

    await this.userRepo.updateEmail(userId, newEmail);
    await this.userRepo.revokeOtherSessions(userId, currentJti);

    return { email: newEmail };
  }

  async getActiveSessions(
    userId: string,
    currentJti?: string
  ): Promise<
    Array<{
      id: string;
      user_agent: string;
      ip_address: string;
      last_seen_at: string;
      created_at: string;
      is_current: boolean;
    }>
  > {
    const sessions = await this.userRepo.getActiveSessions(userId);
    return sessions.map((s) => ({
      id: s.id,
      user_agent: s.user_agent || 'Unknown',
      ip_address: s.ip_address || 'Unknown',
      last_seen_at: (s.last_seen_at || s.created_at).toISOString(),
      created_at: s.created_at.toISOString(),
      is_current: !!currentJti && s.access_token_jti === currentJti,
    }));
  }

  async revokeSession(userId: string, sessionId: string, currentJti?: string): Promise<void> {
    const session = await this.userRepo.findSessionById(sessionId, userId);
    if (!session) throw new Error('Session not found');

    if (currentJti && session.access_token_jti === currentJti) {
      throw new Error('Cannot revoke current session. Use logout instead.');
    }

    await this.userRepo.revokeSessionById(sessionId);
  }

  async deactivateAccount(userId: string, password: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new Error('User not found');

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) throw new Error('Invalid password');

    await this.userRepo.deactivate(userId);
    await this.userRepo.revokeAllSessions(userId);
  }

  private mapToDto(user: UserRow): ProfileResponseDto {
    return {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      phone: user.phone,
      avatar_url: user.avatar_url || null,
      kyc_status: user.kyc_status,
      created_at: user.created_at.toISOString(),
      mfa_enabled: !!user.mfa_enabled,
    };
  }
}
