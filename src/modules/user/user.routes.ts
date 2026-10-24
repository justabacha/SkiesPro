import { Router, Request, Response } from 'express';
import multer from 'multer';
import { body } from 'express-validator';
import { UserController } from './controllers/UserController.js';
import { authenticate } from '../../shared/middleware/authMiddleware.js';
import { rateLimit } from '../../shared/middleware/rateLimit.js';
import { validate } from '../../shared/middleware/validate.js';
import { updateProfileValidator } from './validators/ProfileValidator.js';

const router = Router();
const controller = new UserController();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG and PNG are allowed.'));
    }
  },
});

// Profile routes
router.get('/profile', authenticate, rateLimit('authenticated'), (req: Request, res: Response) =>
  controller.getProfile(req, res)
);

router.put(
  '/profile',
  authenticate,
  rateLimit('authenticated'),
  updateProfileValidator,
  (req: Request, res: Response) => controller.updateProfile(req, res)
);

router.post(
  '/profile/avatar',
  authenticate,
  rateLimit('authenticated'),
  (req: Request, res: Response) => {
    upload.single('image')(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }
      controller.uploadAvatar(req, res);
    });
  }
);

// Password Management
router.put(
  '/password',
  authenticate,
  rateLimit('authenticated'),
  [
    body('current_password').notEmpty().withMessage('Current password is required'),
    body('new_password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage(
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)'
      ),
  ],
  validate,
  (req: Request, res: Response) => controller.changePassword(req, res)
);

// Email Change (Double Opt-in)
router.post(
  '/email-change/initiate',
  authenticate,
  rateLimit('authenticated'),
  [
    body('new_email').isEmail().normalizeEmail({ gmail_remove_dots: false }).withMessage('Valid new email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  (req: Request, res: Response) => controller.initiateEmailChange(req, res)
);

router.post(
  '/email-change/verify',
  authenticate,
  rateLimit('authenticated'),
  [body('token').notEmpty().withMessage('Verification token is required')],
  validate,
  (req: Request, res: Response) => controller.verifyEmailChange(req, res)
);

// Session Management
router.get('/sessions', authenticate, rateLimit('authenticated'), (req: Request, res: Response) =>
  controller.getSessions(req, res)
);

router.delete('/sessions/:id', authenticate, rateLimit('authenticated'), (req: Request, res: Response) =>
  controller.revokeSession(req, res)
);

// Account Deactivation (Soft)
router.post(
  '/deactivate',
  authenticate,
  rateLimit('authenticated'),
  [body('password').notEmpty().withMessage('Password is required')],
  validate,
  (req: Request, res: Response) => controller.deactivateAccount(req, res)
);

// KYC routes
router.get('/kyc/status', authenticate, rateLimit('authenticated'), (req: Request, res: Response) =>
  controller.getKycStatus(req, res)
);

router.post(
  '/kyc/initiate',
  authenticate,
  rateLimit('authenticated'),
  (req: Request, res: Response) => controller.initiateKyc(req, res)
);

export default router;
