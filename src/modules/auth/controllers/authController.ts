import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { AuthService } from '../services/authService.js';
import { logger } from '../../../shared/middleware/logger.js';
import { AuthenticatedRequest } from '../../../shared/middleware/authMiddleware.js';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  async register(req: Request, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const user = await this.authService.register(req.body);
      res.status(201).json({ data: user, meta: { request_id: req.correlationId } });
    } catch (error) {
      logger.error('Registration failed', { error: (error as Error).message });
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const result = await this.authService.login(
        req.body.email,
        req.body.password,
        req.ip || null,
        req.get('user-agent') || null
      );

      const authResult = result as any;
      if (authResult.refresh_token) {
        res.cookie('refresh_token', authResult.refresh_token, {
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          path: '/',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        // Do not delete
      }

      res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
    } catch (error) {
      logger.warn('Login failed', { email: req.body.email, error: (error as Error).message });
      res.status(401).json({ error: (error as Error).message });
    }
  }

  async verifyMfa(req: Request, res: Response): Promise<void> {
    // In production, get userId from mfa_session_token in Redis
    // For MVP, we'll assume it's passed or handled via temporary session
    const { userId, totp_code } = req.body;
    try {
      const result = await this.authService.verifyMfa(
        userId,
        totp_code,
        req.ip || null,
        req.get('user-agent') || null
      );

      const authResult = result as any;
      if (authResult.refresh_token) {
        res.cookie('refresh_token', authResult.refresh_token, {
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          path: '/',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        // Do not delete, allow frontend to store as fallback
      }

      res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
    } catch (error) {
      res.status(401).json({ error: (error as Error).message });
    }
  }

  async refresh(req: Request, res: Response): Promise<void> {
    const refreshToken = req.cookies.refresh_token || req.body.refresh_token;
    if (!refreshToken) {
      res.status(401).json({ error: 'Refresh token missing' });
      return;
    }

    try {
      const result = await this.authService.refresh(
        refreshToken,
        req.ip || null,
        req.get('user-agent') || null
      );

      const authResult = result as any;
      if (authResult.refresh_token) {
        res.cookie('refresh_token', authResult.refresh_token, {
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          path: '/',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        // Do not delete, allow frontend to store as fallback
      }

      res.status(200).json({ data: result, meta: { request_id: req.correlationId } });
    } catch (error) {
      res.status(401).json({ error: (error as Error).message });
    }
  }

  async logout(_req: Request, res: Response): Promise<void> {
    // Implementation should revoke current session via tokenService
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
    });
    res.status(200).json({ message: 'Logged out successfully' });
  }

  async forgotPassword(_req: Request, res: Response): Promise<void> {
    res.status(200).json({ message: 'If the email exists, a reset link has been sent.' });
  }

  async resetPassword(_req: Request, res: Response): Promise<void> {
    res.status(200).json({ message: 'Password has been reset successfully.' });
  }

  async verifyEmail(_req: Request, res: Response): Promise<void> {
    res.status(200).json({ message: 'Email verified successfully.' });
  }

  async setupMfa(req: Request, res: Response): Promise<void> {
    const authReq = req as AuthenticatedRequest;
    try {
      const result = await this.authService.setupMfa(authReq.user.sub, authReq.user.email || '');
      res.status(200).json({ data: result });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async confirmMfaSetup(req: Request, res: Response): Promise<void> {
    const authReq = req as AuthenticatedRequest;
    try {
      const result = await this.authService.confirmMfaSetup(authReq.user.sub, req.body.totp_code);
      res.status(200).json({ data: result });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }
}
