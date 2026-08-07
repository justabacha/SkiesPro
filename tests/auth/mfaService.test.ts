import { MfaService } from '../../src/modules/auth/services/mfaService';
import QRCode from 'qrcode';

describe('MfaService', () => {
  let mfaService: MfaService;

  beforeEach(() => {
    process.env.TOTP_ENCRYPTION_KEY = Buffer.from('12345678901234567890123456789012').toString('base64');
    mfaService = new MfaService();
  });

  describe('generateMfaSetup', () => {
    it('should generate MFA setup details', async () => {
      (QRCode.toDataURL as jest.Mock).mockResolvedValue('qr_code_data');

      const result = await mfaService.generateMfaSetup('test@example.com', 'user-id');

      expect(result.secret).toBe('secret');
      expect(result.qr_code_url).toBe('qr_code_data');
      expect(result.encryptedSecret).toBeDefined();
    });
  });

  describe('verifyToken', () => {
    it('should return true for valid token', async () => {
      const result = await mfaService.verifyToken('123456', 'secret');
      expect(result).toBe(true);
    });
  });

  describe('encryption/decryption', () => {
    it('should encrypt and decrypt correctly', () => {
      const text = 'my-secret';
      const encrypted = (mfaService as any).encrypt(text);
      const decrypted = mfaService.decrypt(encrypted);

      expect(decrypted).toBe(text);
      expect(encrypted).not.toBe(text);
    });
  });
});
