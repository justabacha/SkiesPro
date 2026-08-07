import { TOTP, NobleCryptoPlugin, ScureBase32Plugin } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';

export class MfaService {
  private encryptionKey: Buffer;
  private totp: TOTP;

  constructor() {
    this.encryptionKey = Buffer.from(process.env.TOTP_ENCRYPTION_KEY || '', 'base64');
    this.totp = new TOTP({
      crypto: new NobleCryptoPlugin(),
      base32: new ScureBase32Plugin(),
    });
  }

  async generateMfaSetup(email: string, _userId: string) {
    const secret = this.totp.generateSecret();
    const otpauth = this.totp.toURI({
      label: email,
      issuer: 'SkiesPro',
      secret,
    });
    const qrCodeUrl = await QRCode.toDataURL(otpauth);

    // Encrypt secret before returning or storing
    const encryptedSecret = this.encrypt(secret);

    return {
      secret, // Return plaintext once for setup
      qr_code_url: qrCodeUrl,
      encryptedSecret,
    };
  }

  async verifyToken(token: string, secret: string): Promise<boolean> {
    const result = await this.totp.verify(token, { secret });
    return result.valid;
  }

  generateBackupCodes(): string[] {
    const codes = [];
    for (let i = 0; i < 10; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  decrypt(data: string): string {
    const buffer = Buffer.from(data, 'base64');
    const iv = buffer.slice(0, 16);
    const tag = buffer.slice(16, 32);
    const encrypted = buffer.slice(32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final('utf8');
  }
}
