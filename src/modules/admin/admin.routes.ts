import { Router, Request, Response } from 'express';
import { body, query } from 'express-validator';
import { AdminController } from './controllers/AdminController.js';
import { authenticate } from '../../shared/middleware/authMiddleware.js';
import { validate } from '../../shared/middleware/validate.js';
import {
  adminRateLimit,
  requireAdminRole,
  requireAdminWriteAccess,
} from './middleware/adminAuthMiddleware.js';
import { requireAdminMFA } from '../../middleware/requireAdminMFA.js';
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

router.get(
  '/users',
  requireAdminRole(['admin', 'super_admin']),
  requireAdminMFA,
  (req: Request, res: Response) => controller.listUsers(req, res)
);
router.get(
  '/users/:id',
  requireAdminRole(['admin', 'super_admin']),
  requireAdminMFA,
  (req: Request, res: Response) => controller.getUserById(req, res)
);
router.put(
  '/users/:id/status',
  requireAdminWriteAccess(['admin', 'super_admin']),
  requireAdminMFA,
  validateUserStatus,
  validate,
  (req: Request, res: Response) => controller.updateUserStatus(req, res)
);
router.get(
  '/users/:id/ledger',
  requireAdminRole(['finance', 'admin', 'super_admin']),
  requireAdminMFA,
  (req: Request, res: Response) => controller.getUserLedger(req, res)
);

router.get(
  '/kyc',
  requireAdminRole(['compliance', 'admin', 'super_admin']),
  requireAdminMFA,
  [
    query('status').optional().isIn(['pending', 'approved', 'rejected', 'all']),
    query('page').optional().isInt({ min: 1 }),
    query('per_page').optional().isInt({ min: 1 }),
  ],
  validate,
  (req: Request, res: Response) => controller.listPendingKyc(req, res)
);
router.get(
  '/kyc/pending',
  requireAdminRole(['compliance', 'admin', 'super_admin']),
  requireAdminMFA,
  [
    query('status').optional().isIn(['pending', 'approved', 'rejected', 'all']),
    query('page').optional().isInt({ min: 1 }),
    query('per_page').optional().isInt({ min: 1 }),
  ],
  validate,
  (req: Request, res: Response) => controller.listPendingKyc(req, res)
);
router.get(
  '/kyc/:id',
  requireAdminRole(['compliance', 'admin', 'super_admin']),
  requireAdminMFA,
  (req: Request, res: Response) => controller.getKycById(req, res)
);
router.put(
  '/kyc/:id/review',
  requireAdminRole(['compliance', 'admin', 'super_admin']),
  requireAdminMFA,
  validateKycReview,
  validate,
  (req: Request, res: Response) => controller.reviewKyc(req, res)
);

router.get(
  '/withdrawals',
  requireAdminRole(['finance', 'admin', 'super_admin']),
  requireAdminMFA,
  [
    query('status')
      .optional()
      .isIn(['pending', 'approved', 'rejected', 'dispatched', 'completed', 'failed', 'all']),
    query('page').optional().isInt({ min: 1 }),
    query('per_page').optional().isInt({ min: 1 }),
  ],
  validate,
  (req: Request, res: Response) => controller.listWithdrawals(req, res)
);
router.get(
  '/withdrawals/pending',
  requireAdminRole(['finance', 'admin', 'super_admin']),
  requireAdminMFA,
  (req: Request, res: Response) => controller.listPendingWithdrawals(req, res)
);
router.get(
  '/withdrawals/:id',
  requireAdminRole(['finance', 'admin', 'super_admin']),
  requireAdminMFA,
  (req: Request, res: Response) => controller.getWithdrawalById(req, res)
);
router.put(
  '/withdrawals/:id/approve',
  requireAdminRole(['finance', 'admin', 'super_admin']),
  requireAdminMFA,
  validateWithdrawalApprove,
  validate,
  (req: Request, res: Response) => controller.approveWithdrawal(req, res)
);
router.put(
  '/withdrawals/:id/reject',
  requireAdminRole(['finance', 'admin', 'super_admin']),
  requireAdminMFA,
  validateWithdrawalReject,
  validate,
  (req: Request, res: Response) => controller.rejectWithdrawal(req, res)
);

router.post(
  '/withdrawals/:id/retry',
  requireAdminRole(['super_admin']),
  requireAdminMFA,
  (req: Request, res: Response) => controller.retryWithdrawal(req, res)
);
router.post(
  '/withdrawals/:id/force-complete',
  requireAdminRole(['super_admin']),
  requireAdminMFA,
  [
    body('mpesaReceipt')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('M-Pesa receipt code is required')
      .isLength({ min: 10, max: 16 })
      .withMessage('M-Pesa receipt code must be 10-16 characters'),
  ],
  validate,
  (req: Request, res: Response) => controller.forceCompleteWithdrawal(req, res)
);
router.post(
  '/withdrawals/:id/force-refund',
  requireAdminRole(['super_admin']),
  requireAdminMFA,
  [
    body('reason')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Reason is required')
      .isLength({ max: 500 })
      .withMessage('Reason must not exceed 500 characters'),
  ],
  validate,
  (req: Request, res: Response) => controller.forceRefundWithdrawal(req, res)
);

router.get(
  '/risk/dashboard',
  requireAdminRole(['risk_manager', 'admin', 'super_admin']),
  requireAdminMFA,
  (req: Request, res: Response) => controller.getRiskDashboard(req, res)
);
router.get(
  '/risk/exposure',
  requireAdminRole(['risk_manager', 'admin', 'super_admin']),
  requireAdminMFA,
  (req: Request, res: Response) => controller.getRiskExposure(req, res)
);
router.put(
  '/risk/asset-config/:symbol',
  requireAdminRole(['risk_manager', 'admin', 'super_admin']),
  requireAdminMFA,
  validateAssetConfig,
  validate,
  (req: Request, res: Response) => controller.updateAssetConfig(req, res)
);

router.get(
  '/settings',
  requireAdminRole(['admin', 'super_admin']),
  requireAdminMFA,
  (req: Request, res: Response) => controller.listSettings(req, res)
);
router.get(
  '/settings/:key',
  requireAdminRole(['admin', 'super_admin']),
  requireAdminMFA,
  (req: Request, res: Response) => controller.getSettingByKey(req, res)
);
router.put(
  '/settings',
  requireAdminRole(['admin', 'super_admin']),
  requireAdminMFA,
  body().custom((payload) => {
    const settings = Array.isArray(payload) ? payload : [payload];
    if (settings.length === 0) throw new Error('At least one setting is required');
    for (const setting of settings) {
      if (!setting || typeof setting.key !== 'string' || !setting.key.trim()) {
        throw new Error('Each setting must have a key');
      }
      if (setting.value === undefined || setting.value === null) {
        throw new Error(`Setting ${setting.key} must have a value`);
      }
      if (setting.key.startsWith('kyc.required_') && typeof setting.value !== 'boolean') {
        throw new Error(`${setting.key} must be a boolean`);
      }
      if (/^(deposit|withdrawal)\.(min|max)_amount$|^trade\.(min|max)_duration_seconds$/.test(setting.key)) {
        if (typeof setting.value !== 'number' || !Number.isFinite(setting.value) || setting.value <= 0) {
          throw new Error(`${setting.key} must be a positive number`);
        }
      }
      if (setting.key === 'referral.commission_percentage') {
        if (typeof setting.value !== 'number' || setting.value <= 0 || setting.value > 1) {
          throw new Error('referral.commission_percentage must be greater than 0 and at most 1');
        }
      }
      if (setting.key === 'trade.default_payout_ratio') {
        if (typeof setting.value !== 'number' || setting.value <= 0 || setting.value > 1) {
          throw new Error('trade.default_payout_ratio must be greater than 0 and at most 1');
        }
      }
    }
    return true;
  }),
  validate,
  (req: Request, res: Response) => controller.updateSettings(req, res)
);

router.get(
  '/reports/daily-revenue',
  requireAdminRole(['finance', 'admin', 'super_admin']),
  requireAdminMFA,
  (req: Request, res: Response) => controller.getDailyRevenue(req, res)
);
router.get(
  '/reports/trade-volume',
  requireAdminRole(['finance', 'admin', 'super_admin']),
  requireAdminMFA,
  (req: Request, res: Response) => controller.getTradeVolume(req, res)
);
router.get(
  '/reports/user-registrations',
  requireAdminRole(['admin', 'super_admin']),
  requireAdminMFA,
  (req: Request, res: Response) => controller.getUserRegistrations(req, res)
);
router.get(
  '/reports/settlement-performance',
  requireAdminRole(['admin', 'super_admin']),
  requireAdminMFA,
  (req: Request, res: Response) => controller.getSettlementPerformance(req, res)
);

router.get(
  '/audit-logs',
  requireAdminRole(['compliance', 'admin', 'super_admin']),
  requireAdminMFA,
  [query('page').optional().isInt({ min: 1 }), query('per_page').optional().isInt({ min: 1 })],
  validate,
  (req: Request, res: Response) => controller.getAuditLogs(req, res)
);
router.get(
  '/audit-chain/verify',
  requireAdminRole(['compliance', 'admin', 'super_admin']),
  requireAdminMFA,
  (req: Request, res: Response) => controller.verifyAuditChain(req, res)
);

router.get(
  '/support/tickets',
  requireAdminRole(['support', 'admin', 'super_admin']),
  requireAdminMFA,
  (req: Request, res: Response) => controller.listTickets(req, res)
);
router.get(
  '/support/tickets/:id',
  requireAdminRole(['support', 'admin', 'super_admin']),
  requireAdminMFA,
  (req: Request, res: Response) => controller.getTicketById(req, res)
);
router.put(
  '/support/tickets/:id',
  requireAdminRole(['support', 'admin', 'super_admin']),
  requireAdminMFA,
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
  requireAdminMFA,
  validateWalletAdjustment,
  validate,
  (req: Request, res: Response) => controller.adjustWallet(req, res)
);
router.get(
  '/actions/pending',
  requireAdminRole(['super_admin']),
  requireAdminMFA,
  (req: Request, res: Response) => controller.listPendingActions(req, res)
);
router.put(
  '/actions/:id/approve',
  requireAdminRole(['super_admin']),
  requireAdminMFA,
  (req: Request, res: Response) => controller.approveAction(req, res)
);
router.put(
  '/actions/:id/reject',
  requireAdminRole(['super_admin']),
  (req: Request, res: Response) => controller.rejectAction(req, res)
);

export default router;
