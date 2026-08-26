import { TokenService } from '../../auth/services/tokenService';
import { logger } from '../../../shared/middleware/logger';

export interface AuthenticatedWebSocket {
  userId: string;
  role: string;
  permissions: string[];
  jti: string;
}

export class WebSocketAuthMiddleware {
  private tokenService: TokenService;

  constructor() {
    this.tokenService = new TokenService();
  }

  async authenticate(token: string): Promise<AuthenticatedWebSocket | null> {
    try {
      // Validate JWT access token
      const payload = this.tokenService.validateAccessToken(token);
      
      if (!payload) {
        logger.warn('WebSocket authentication failed: Invalid token');
        return null;
      }

      // Check if token is revoked
      const isRevoked = await this.tokenService.isTokenRevoked(payload.jti);
      if (isRevoked) {
        logger.warn('WebSocket authentication failed: Token revoked', { jti: payload.jti });
        return null;
      }

      return {
        userId: payload.sub,
        role: payload.role,
        permissions: payload.permissions || [],
        jti: payload.jti,
      };
    } catch (error) {
      logger.error('WebSocket authentication error', { error: error instanceof Error ? error.message : 'Unknown error' });
      return null;
    }
  }

  extractTokenFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url, 'http://localhost');
      const tokenParam = urlObj.searchParams.get('token');
      return tokenParam;
    } catch (error) {
      logger.error('Failed to extract token from URL', { url, error: error instanceof Error ? error.message : 'Unknown error' });
      return null;
    }
  }
}

export const webSocketAuthMiddleware = new WebSocketAuthMiddleware();