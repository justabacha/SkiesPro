import { Router, Request, Response } from 'express';
import { body, query } from 'express-validator';
import { AuthController } from './controllers/authController';
import { authenticate } from '../../shared/middleware/authMiddleware';
import { rateLimit } from '../../shared/middleware/rateLimit';

const router = Router();
const controller = new AuthController();

// Registration
router.post(
  '/register',
  rateLimit('unauthenticated'),
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
    body('display_name').isLength({ min: 2, max: 100 }).trim(),
    body('phone').optional().isMobilePhone('any'),
  ],
  (req: Request, res: Response) => controller.register(req, res)
);

// Email Verification
router.get(
  '/verify-email',
  rateLimit('unauthenticated'),
  [query('token').notEmpty()],
  (req: Request, res: Response) => controller.verifyEmail(req, res)
);

// Login
router.post(
  '/login',
  rateLimit('login'),
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  (req: Request, res: Response) => controller.login(req, res)
);

// MFA Verification (during login)
router.post(
  '/mfa/verify',
  rateLimit('login'),
  [
    body('userId').isUUID(),
    body('totp_code').isLength({ min: 6, max: 6 }).isNumeric(),
  ],
  (req: Request, res: Response) => controller.verifyMfa(req, res)
);

// Token Refresh
router.post(
  '/refresh',
  rateLimit('unauthenticated'),
  [body('refresh_token').notEmpty()],
  (req: Request, res: Response) => controller.refresh(req, res)
);

// Logout
router.post('/logout', authenticate, (req: Request, res: Response) => controller.logout(req, res));

// Password Management
router.post(
  '/forgot-password',
  rateLimit('passwordReset'),
  [body('email').isEmail().normalizeEmail()],
  (req: Request, res: Response) => controller.forgotPassword(req, res)
);

router.post(
  '/reset-password',
  rateLimit('passwordReset'),
  [
    body('token').notEmpty(),
    body('new_password').isLength({ min: 8 }),
  ],
  (req: Request, res: Response) => controller.resetPassword(req, res)
);

// MFA Setup (authenticated)
router.post('/mfa/setup', authenticate, (req: Request, res: Response) => controller.setupMfa(req, res));
router.post(
  '/mfa/verify-setup',
  authenticate,
  [body('totp_code').isLength({ min: 6, max: 6 }).isNumeric()],
  (req: Request, res: Response) => controller.confirmMfaSetup(req, res)
);

export default router;
