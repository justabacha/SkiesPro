import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { SessionRepository } from '../repositories/sessionRepository';

export class TokenService {
  private privateKey: string;
  private publicKey: string;
  private sessionRepo: SessionRepository;

  constructor() {
    const privB64 = process.env.JWT_PRIVATE_KEY || '';
    const pubB64 = process.env.JWT_PUBLIC_KEY || '';

    this.privateKey = this.loadKey(privB64);
    this.publicKey = this.loadKey(pubB64);

    this.sessionRepo = new SessionRepository();
  }

  private loadKey(key: string): string {
    if (key.includes('-----BEGIN')) {
      return key.replace(/\\n/g, '\n');
    }
    return Buffer.from(key, 'base64').toString('utf8');
  }

  generateAccessToken(
    userId: string,
    role: string,
    permissions: string[]
  ): { token: string; jti: string } {
    const jti = uuidv4();
    const token = jwt.sign(
      {
        sub: userId,
        role,
        permissions,
        jti,
      },
      this.privateKey,
      {
        algorithm: 'RS256',
        expiresIn: '15m',
      }
    );
    return { token, jti };
  }

  generateRefreshToken(): { token: string; hash: string } {
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    return { token, hash };
  }

  async createSession(
    userId: string,
    role: string,
    permissions: string[],
    ip: string | null,
    userAgent: string | null
  ) {
    const { token: accessToken, jti } = this.generateAccessToken(userId, role, permissions);
    const { token: refreshToken, hash: refreshTokenHash } = this.generateRefreshToken();

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.sessionRepo.create({
      user_id: userId,
      token_hash: refreshTokenHash, // Reusing legacy column for refresh token hash
      ip_address: ip,
      user_agent: userAgent,
      expires_at: expiresAt,
      access_token_jti: jti,
      refresh_token_hash: refreshTokenHash,
      refresh_token_expires_at: refreshExpiresAt,
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 900,
    };
  }

  validateAccessToken(token: string): any {
    try {
      return jwt.verify(token, this.publicKey, { algorithms: ['RS256'] });
    } catch (error) {
      return null;
    }
  }

  async isTokenRevoked(jti: string): Promise<boolean> {
    // Check in Redis if possible, fallback to DB
    // For MVP, we check DB
    const session = await this.sessionRepo.findByJti(jti);
    return !session || session.is_revoked;
  }

  async refreshSession(refreshToken: string, _ip: string | null, _userAgent: string | null) {
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const session = await this.sessionRepo.findByRefreshToken(hash);

    if (!session) {
      return null;
    }

    // Revoke old session (Rotation)
    await this.sessionRepo.revoke(session.id);

    return session.user_id;
  }
}
