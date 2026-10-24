import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { UserService } from '../services/UserService.js';
import { AuthenticatedRequest } from '../../../shared/middleware/authMiddleware.js';
import { logger } from '../../../shared/middleware/logger.js';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  async getProfile(req: Request, res: Response): Promise<void> {
    const authReq = req as AuthenticatedRequest;
    try {
      const profile = await this.userService.getProfile(authReq.user.sub);
      res.status(200).json({ data: profile, meta: { request_id: req.correlationId } });
    } catch (error) {
      res.status(404).json({ error: (error as Error).message });
    }
  }

  async updateProfile(req: Request, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    try {
      const profile = await this.userService.updateProfile(authReq.user.sub, req.body);
      res.status(200).json({ data: profile, meta: { request_id: req.correlationId } });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async uploadAvatar(req: Request, res: Response): Promise<void> {
    const authReq = req as AuthenticatedRequest;

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    try {
      const avatarUrl = await this.userService.uploadAvatar(
        authReq.user.sub,
        req.file.buffer,
        req.file.originalname
      );
      res
        .status(200)
        .json({ data: { avatar_url: avatarUrl }, meta: { request_id: req.correlationId } });
    } catch (error) {
      logger.error('Avatar upload failed', {
        userId: authReq.user.sub,
        error: (error as Error).message,
      });
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async getKycStatus(req: Request, res: Response): Promise<void> {
    const authReq = req as AuthenticatedRequest;
    try {
      const status = await this.userService.getKycStatus(authReq.user.sub);
      res
        .status(200)
        .json({ data: { kyc_status: status }, meta: { request_id: req.correlationId } });
    } catch (error) {
      res.status(404).json({ error: (error as Error).message });
    }
  }

  async initiateKyc(req: Request, res: Response): Promise<void> {
    const authReq = req as AuthenticatedRequest;
    try {
      const status = await this.userService.initiateKyc(authReq.user.sub);
      res
        .status(200)
        .json({ data: { kyc_status: status }, meta: { request_id: req.correlationId } });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid current status')) {
        res.status(409).json({ error: error.message });
      } else {
        res.status(400).json({ error: (error as Error).message });
      }
    }
  }

  async changePassword(req: Request, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    try {
      await this.userService.changePassword(
        authReq.user.sub,
        req.body.current_password,
        req.body.new_password,
        authReq.user.jti
      );
      res.status(200).json({
        data: { message: 'Password updated successfully' },
        meta: { request_id: req.correlationId },
      });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async initiateEmailChange(req: Request, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    try {
      const result = await this.userService.initiateEmailChange(
        authReq.user.sub,
        req.body.new_email,
        req.body.password
      );
      res.status(200).json({
        data: {
          message: 'Verification token generated and outbox alert recorded',
          token: result.token,
        },
        meta: { request_id: req.correlationId },
      });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async verifyEmailChange(req: Request, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    try {
      const result = await this.userService.verifyEmailChange(
        authReq.user.sub,
        req.body.token,
        authReq.user.jti
      );
      res.status(200).json({
        data: { message: 'Email updated successfully', email: result.email },
        meta: { request_id: req.correlationId },
      });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async getSessions(req: Request, res: Response): Promise<void> {
    const authReq = req as AuthenticatedRequest;
    try {
      const sessions = await this.userService.getActiveSessions(authReq.user.sub, authReq.user.jti);
      res.status(200).json({ data: sessions, meta: { request_id: req.correlationId } });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  async revokeSession(req: Request, res: Response): Promise<void> {
    const authReq = req as AuthenticatedRequest;
    try {
      await this.userService.revokeSession(
        authReq.user.sub,
        req.params.id,
        authReq.user.jti
      );
      res.status(200).json({
        data: { message: 'Session revoked successfully' },
        meta: { request_id: req.correlationId },
      });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async deactivateAccount(req: Request, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    try {
      await this.userService.deactivateAccount(authReq.user.sub, req.body.password);
      res.status(200).json({
        data: { message: 'Account deactivated successfully' },
        meta: { request_id: req.correlationId },
      });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }
}
