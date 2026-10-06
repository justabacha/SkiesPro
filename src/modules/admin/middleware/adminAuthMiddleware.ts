import { NextFunction, Request, Response } from 'express';
import { rateLimit } from '../../../shared/middleware/rateLimit.js';

export const ADMIN_ROLES = [
  'support',
  'finance',
  'risk_manager',
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
  !!role && ADMIN_ROLES.includes(role as AdminRole);

export const requiresMfaStepUp = (user: { mfa_verified?: boolean } = {}): boolean =>
  user.mfa_verified === undefined || user.mfa_verified === false;

export const adminRateLimit = rateLimit('authenticated');

export const requireAdminRole = (allowedRoles: string[] = [...ADMIN_ROLES]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AdminAuthenticatedRequest).user;

    if (!user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const effectiveRoles = user.role ? [user.role] : [];
    const allowed =
      allowedRoles.length === 0 || effectiveRoles.some((role) => allowedRoles.includes(role));

    if (!allowed) {
      res.status(403).json({ error: 'Insufficient admin privileges' });
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

  if (requiresMfaStepUp(user)) {
    res.status(403).json({ error: 'Admin MFA step-up verification required' });
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

    const hasRole = allowedRoles.includes(user.role);
    if (!hasRole) {
      res
        .status(403)
        .json({ error: 'This administrator is not allowed to perform write operations' });
      return;
    }

    if (requiresMfaStepUp(user)) {
      res.status(403).json({ error: 'Admin MFA step-up verification required' });
      return;
    }

    next();
  };
};
