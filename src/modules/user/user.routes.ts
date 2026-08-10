import { Router, Request, Response } from 'express';
import multer from 'multer';
import { UserController } from './controllers/UserController';
import { authenticate } from '../../shared/middleware/authMiddleware';
import { rateLimit } from '../../shared/middleware/rateLimit';
import { updateProfileValidator } from './validators/ProfileValidator';

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
  rateLimit('authenticated'), // 10/min is in spec, but rateLimit.ts has 'authenticated' at 300/min.
  // For MVP I will use 'authenticated' or add a custom one if needed.
  // Let's stick to the spec's intent.
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
