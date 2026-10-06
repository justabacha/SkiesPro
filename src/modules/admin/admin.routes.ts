import { Router, Request, Response } from 'express';
import { body, query } from 'express-validator';
import { AdminController } from './controllers/AdminController.js';
import { authenticate } from '../../shared/middleware/authMiddleware.js';
import { validate } from '../../shared/middleware/validate.js';
import {
  adminRateLimit,
  requireAdminMfa,
  requireAdminRole,
  requireAdminWriteAccess,
} from './middleware/adminAuthMiddleware.js';
import {
  validateUserStatus,
  validateKycReview,
  validateWithdrawalApprove,
  validateWithdrawalReject,
  validateAssetConfig,
  validateWalletAdjustment,
} from './dtos/index.js';

const router = Router();
const controller = new AdminController();

router.use(authenticate);
router.use(adminRateLimit);

router.get('/users', requireAdminRole(['admin', 'super_admin']), (req: Request, res: Response) =>
  controller.listUsers(req, res)
);
router.get(
  '/users/:id',
  requireAdminRole(['admin', 'super_admin']),
  (req: Request, res: Response) => controller.getUserById(req, res)
);
router.put(
  '/users/:id/status',
  requireAdminWriteAccess(['admin', 'super_admin']),
  requireAdminMfa,
  validateUserStatus,
  validate,
  (req: Request, res: Response) => controller.updateUserStatus(req, res)
);
router.get(
  '/users/:id/ledger',
  requireAdminRole(['finance', 'admin', 'super_admin']),
  requireAdminMfa,
  (req: Request, res: Response) => controller.getUserLedger(req, res)
);

router.get(
  '/kyc/pending',
  requireAdminRole(['compliance', 'admin', 'super_admin']),
  requireAdminMfa,
  (req: Request, res: Response) => controller.listPendingKyc(req, res)
);
router.get(
  '/kyc/:id',
  requireAdminRole(['compliance', 'admin', 'super_admin']),
  requireAdminMfa,
  (req: Request, res: Response) => controller.getKycById(req, res)
);
router.put(
  '/kyc/:id/review',
  requireAdminRole(['compliance', 'admin', 'super_admin']),
  requireAdminMfa,
  validateKycReview,
  validate,
  (req: Request, res: Response) => controller.reviewKyc(req, res)
);

router.get(
  '/withdrawals/pending',
  requireAdminRole(['finance', 'admin', 'super_admin']),
  requireAdminMfa,
  (req: Request, res: Response) => controller.listPendingWithdrawals(req, res)
);
router.get(
  '/withdrawals/:id',
  requireAdminRole(['finance', 'admin', 'super_admin']),
  requireAdminMfa,
  (req: Request, res: Response) => controller.getWithdrawalById(req, res)
);
router.put(
  '/withdrawals/:id/approve',
  requireAdminRole(['finance', 'admin', 'super_admin']),
  requireAdminMfa,
  validateWithdrawalApprove,
  validate,
  (req: Request, res: Response) => controller.approveWithdrawal(req, res)
);
router.put(
  '/withdrawals/:id/reject',
  requireAdminRole(['finance', 'admin', 'super_admin']),
  requireAdminMfa,
  validateWithdrawalReject,
  validate,
  (req: Request, res: Response) => controller.rejectWithdrawal(req, res)
);

router.get(
  '/risk/dashboard',
  requireAdminRole(['risk_manager', 'admin', 'super_admin']),
  requireAdminMfa,
  (req: Request, res: Response) => controller.getRiskDashboard(req, res)
);
router.get(
  '/risk/exposure',
  requireAdminRole(['risk_manager', 'admin', 'super_admin']),
  requireAdminMfa,
  (req: Request, res: Response) => controller.getRiskExposure(req, res)
);
router.put(
  '/risk/asset-config/:symbol',
  requireAdminRole(['risk_manager', 'admin', 'super_admin']),
  requireAdminMfa,
  validateAssetConfig,
  validate,
  (req: Request, res: Response) => controller.updateAssetConfig(req, res)
);

router.get(
  '/settings',
  requireAdminRole(['admin', 'super_admin']),
  requireAdminMfa,
  (req: Request, res: Response) => controller.listSettings(req, res)
);
router.get(
  '/settings/:key',
  requireAdminRole(['admin', 'super_admin']),
  requireAdminMfa,
  (req: Request, res: Response) => controller.getSettingByKey(req, res)
);
router.put(
  '/settings',
  requireAdminRole(['admin', 'super_admin']),
  requireAdminMfa,
  [body('key').notEmpty(), body('value').notEmpty(), body('reason').notEmpty()],
  validate,
  (req: Request, res: Response) => controller.updateSettings(req, res)
);

router.get(
  '/reports/daily-revenue',
  requireAdminRole(['finance', 'admin', 'super_admin']),
  requireAdminMfa,
  (req: Request, res: Response) => controller.getDailyRevenue(req, res)
);
router.get(
  '/reports/trade-volume',
  requireAdminRole(['finance', 'admin', 'super_admin']),
  requireAdminMfa,
  (req: Request, res: Response) => controller.getTradeVolume(req, res)
);
router.get(
  '/reports/user-registrations',
  requireAdminRole(['admin', 'super_admin']),
  requireAdminMfa,
  (req: Request, res: Response) => controller.getUserRegistrations(req, res)
);
router.get(
  '/reports/settlement-performance',
  requireAdminRole(['admin', 'super_admin']),
  requireAdminMfa,
  (req: Request, res: Response) => controller.getSettlementPerformance(req, res)
);

router.get(
  '/audit-logs',
  requireAdminRole(['compliance', 'admin', 'super_admin']),
  requireAdminMfa,
  [query('page').optional().isInt({ min: 1 }), query('per_page').optional().isInt({ min: 1 })],
  validate,
  (req: Request, res: Response) => controller.getAuditLogs(req, res)
);
router.get(
  '/audit-chain/verify',
  requireAdminRole(['compliance', 'admin', 'super_admin']),
  requireAdminMfa,
  (req: Request, res: Response) => controller.verifyAuditChain(req, res)
);

router.get(
  '/support/tickets',
  requireAdminRole(['support', 'admin', 'super_admin']),
  requireAdminMfa,
  (req: Request, res: Response) => controller.listTickets(req, res)
);
router.get(
  '/support/tickets/:id',
  requireAdminRole(['support', 'admin', 'super_admin']),
  requireAdminMfa,
  (req: Request, res: Response) => controller.getTicketById(req, res)
);
router.put(
  '/support/tickets/:id',
  requireAdminRole(['support', 'admin', 'super_admin']),
  requireAdminMfa,
  [
    body('status').optional().isIn(['open', 'in_progress', 'resolved', 'closed']),
    body('response').optional().isString(),
    body('assigned_to').optional().isUUID(),
  ],
  validate,
  (req: Request, res: Response) => controller.updateTicket(req, res)
);

router.post(
  '/wallets/adjust',
  requireAdminRole(['super_admin']),
  requireAdminMfa,
  validateWalletAdjustment,
  validate,
  (req: Request, res: Response) => controller.adjustWallet(req, res)
);
router.put(
  '/actions/:id/approve',
  requireAdminRole(['super_admin']),
  requireAdminMfa,
  (req: Request, res: Response) => controller.approveAction(req, res)
);

export default router;
