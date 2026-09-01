import { WebSocketAuthMiddleware } from '../../../src/modules/pricing/websocket/authMiddleware.js';
import { TokenService } from '../../../src/modules/auth/services/tokenService.js';

jest.mock('../../../src/modules/auth/services/tokenService');

describe('WebSocketAuthMiddleware', () => {
  let authMiddleware: WebSocketAuthMiddleware;
  let mockTokenService: jest.Mocked<TokenService>;

  beforeEach(() => {
    mockTokenService = new TokenService() as jest.Mocked<TokenService>;
    (TokenService as jest.Mock).mockImplementation(() => mockTokenService);
    authMiddleware = new WebSocketAuthMiddleware();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should return user info for valid token', async () => {
      const mockPayload = {
        sub: 'user123',
        role: 'user',
        permissions: ['read'],
        jti: 'token123',
      };

      mockTokenService.validateAccessToken.mockReturnValue(mockPayload);
      mockTokenService.isTokenRevoked.mockResolvedValue(false);

      const result = await authMiddleware.authenticate('valid_token');

      expect(result).toEqual({
        userId: 'user123',
        role: 'user',
        permissions: ['read'],
        jti: 'token123',
      });
      expect(mockTokenService.validateAccessToken).toHaveBeenCalledWith('valid_token');
      expect(mockTokenService.isTokenRevoked).toHaveBeenCalledWith('token123');
    });

    it('should return null for invalid token', async () => {
      mockTokenService.validateAccessToken.mockReturnValue(null);

      const result = await authMiddleware.authenticate('invalid_token');

      expect(result).toBeNull();
      expect(mockTokenService.validateAccessToken).toHaveBeenCalledWith('invalid_token');
      expect(mockTokenService.isTokenRevoked).not.toHaveBeenCalled();
    });

    it('should return null for revoked token', async () => {
      const mockPayload = {
        sub: 'user123',
        role: 'user',
        permissions: ['read'],
        jti: 'token123',
      };

      mockTokenService.validateAccessToken.mockReturnValue(mockPayload);
      mockTokenService.isTokenRevoked.mockResolvedValue(true);

      const result = await authMiddleware.authenticate('revoked_token');

      expect(result).toBeNull();
      expect(mockTokenService.isTokenRevoked).toHaveBeenCalledWith('token123');
    });

    it('should return null on token service error', async () => {
      mockTokenService.validateAccessToken.mockImplementation(() => {
        throw new Error('Token service error');
      });

      const result = await authMiddleware.authenticate('error_token');

      expect(result).toBeNull();
    });
  });

  describe('extractTokenFromUrl', () => {
    it('should extract token from URL', () => {
      const url = 'ws://localhost:3000/ws/v1?token=abc123';
      const token = authMiddleware.extractTokenFromUrl(url);

      expect(token).toBe('abc123');
    });

    it('should return null for URL without token', () => {
      const url = 'ws://localhost:3000/ws/v1';
      const token = authMiddleware.extractTokenFromUrl(url);

      expect(token).toBeNull();
    });

    it('should return null for invalid URL', () => {
      const url = 'invalid-url';
      const token = authMiddleware.extractTokenFromUrl(url);

      expect(token).toBeNull();
    });

    it('should handle empty token parameter', () => {
      const url = 'ws://localhost:3000/ws/v1?token=';
      const token = authMiddleware.extractTokenFromUrl(url);

      expect(token).toBe('');
    });
  });
});