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
      // Return 409 Conflict if status is already pending/verified
      if (error instanceof Error && error.message.includes('Invalid current status')) {
        res.status(409).json({ error: error.message });
      } else {
        res.status(400).json({ error: (error as Error).message });
      }
    }
  }
}
