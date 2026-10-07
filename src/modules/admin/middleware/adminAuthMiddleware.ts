import { NextFunction, Request, Response } from 'express';
import { rateLimit } from '../../../shared/middleware/rateLimit.js';
import { TokenService } from '../../auth/services/tokenService.js';

export const ADMIN_ROLES = [
  'support',
  'finance',
  'risk_manager',
  'risk',
  'compliance',
  'admin',
  'super_admin',
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export interface AdminAuthenticatedRequest extends Request {
  user: {
    sub: string;
    role: string;
    permissions: string[];
    email?: string;
    mfa_verified?: boolean;
  };
}

export const hasAdminRole = (role?: string): boolean =>
  !!role && ADMIN_ROLES.includes(role.toLowerCase() as AdminRole);

export const requiresMfaStepUp = (user: { mfa_verified?: boolean } = {}): boolean =>
  user.mfa_verified === undefined || user.mfa_verified === false;

export const adminRateLimit = rateLimit('admin');

const hasValidAdminMfaToken = (req: Request, user: AdminAuthenticatedRequest['user']): boolean => {
  const token = req.header('X-Admin-MFA-Token');
  const payload = token ? new TokenService().validateAdminMfaToken(token) : null;
  return !!(
    payload &&
    payload.sub === user.sub &&
    typeof user.role === 'string' &&
    typeof payload.role === 'string' &&
    payload.role.toLowerCase() === user.role.toLowerCase()
  );
};

export const requireAdminRole = (allowedRoles: string[] = [...ADMIN_ROLES]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AdminAuthenticatedRequest).user;

    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!hasAdminRole(user.role)) {
      res.status(403).json({
        error: 'Administrative access is restricted to staff accounts',
        code: 'FORBIDDEN_NOT_ADMIN',
      });
      return;
    }

    const effectiveRoles = user.role ? [user.role.toLowerCase()] : [];
    const allowed =
      allowedRoles.length === 0 ||
      effectiveRoles.some((role) =>
        allowedRoles.map((allowedRole) => allowedRole.toLowerCase()).includes(role)
      );

    if (!allowed) {
      res.status(403).json({
        error: 'Insufficient admin privileges',
        code: 'FORBIDDEN_INSUFFICIENT_ROLE',
      });
      return;
    }

    next();
  };
};

export const requireAdminMfa = (req: Request, res: Response, next: NextFunction): void => {
  const user = (req as AdminAuthenticatedRequest).user;

  if (!user) {
    res.status(401).json({ error: 'User not authenticated' });
    return;
  }

  if (!hasAdminRole(user.role)) {
    res.status(403).json({
      error: 'Administrative access is restricted to staff accounts',
      code: 'FORBIDDEN_NOT_ADMIN',
    });
    return;
  }

  if (!hasValidAdminMfaToken(req, user)) {
    res.status(403).json({
      error: 'A valid, unexpired administrator MFA step-up token is required',
      code: 'MFA_STEP_UP_REQUIRED',
    });
    return;
  }

  next();
};

export const requireAdminWriteAccess = (allowedRoles: string[] = ['admin', 'super_admin']) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AdminAuthenticatedRequest).user;

    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!hasAdminRole(user.role)) {
      res.status(403).json({
        error: 'Administrative access is restricted to staff accounts',
        code: 'FORBIDDEN_NOT_ADMIN',
      });
      return;
    }

    const hasRole = allowedRoles
      .map((role) => role.toLowerCase())
      .includes(user.role.toLowerCase());
    if (!hasRole) {
      res.status(403).json({
        error: 'This administrator is not allowed to perform write operations',
        code: 'FORBIDDEN_INSUFFICIENT_ROLE',
      });
      return;
    }

    if (!hasValidAdminMfaToken(req, user)) {
      res.status(403).json({
        error: 'A valid, unexpired administrator MFA step-up token is required',
        code: 'MFA_STEP_UP_REQUIRED',
      });
      return;
    }

    next();
  };
};
