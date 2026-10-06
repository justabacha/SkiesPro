import { Request, Response, NextFunction } from 'express';
import { TokenService } from '../../modules/auth/services/tokenService.js';

const tokenService = new TokenService();

export interface AuthenticatedRequest extends Request {
  user: {
    sub: string;
    role: string;
    permissions: string[];
    email?: string;
    mfa_verified?: boolean;
  };
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization header missing or invalid' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const payload = tokenService.validateAccessToken(token);

  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  const isRevoked = await tokenService.isTokenRevoked(payload.jti);
  if (isRevoked) {
    res.status(401).json({ error: 'Token has been revoked' });
    return;
  }

  (req as AuthenticatedRequest).user = payload;
  next();
};

export const authenticateAdminMfaEnrollment = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Admin MFA enrollment token missing or invalid' });
    return;
  }

  const tokenService = new TokenService();
  const payload = tokenService.validateAdminMfaEnrollmentToken(authHeader.slice(7));
  const enrollmentRoles = [
    'super_admin',
    'admin',
    'compliance',
    'risk',
    'risk_manager',
    'finance',
    'support',
  ];
  if (!payload || !enrollmentRoles.includes(String(payload.role).toLowerCase())) {
    res.status(401).json({ error: 'Admin MFA enrollment token is invalid or expired' });
    return;
  }

  (req as AuthenticatedRequest).user = payload as AuthenticatedRequest['user'];
  next();
};

export const authorize = (permissions: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (permissions.length === 0) {
      next();
      return;
    }

    const hasPermission = permissions.every((p) => user.permissions.includes(p));
    if (!hasPermission) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};

export const authorizeRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;

    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    next();
  };
};
