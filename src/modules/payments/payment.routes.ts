import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { Decimal } from 'decimal.js';
import { PaymentController } from './controllers/paymentController.js';
import { B2CCallbackController } from './controllers/b2cCallbackController.js';
import { authenticate } from '../../shared/middleware/authMiddleware.js';
import { rateLimit } from '../../shared/middleware/rateLimit.js';
import { verifyIntasendChallenge } from './middleware/verifyIntasendChallenge.js';
import { logger } from '../../shared/middleware/logger.js';
import { PaymentRepository } from './repositories/paymentRepository.js';
import { WalletService } from '../wallet/services/walletService.js';
import { AdminRepository } from '../admin/repositories/AdminRepository.js';
import { pgPool } from '../../config/database.js';

const router = Router();
const controller = new PaymentController();
const b2cCallbackController = new B2CCallbackController();

const handleIntaSendCollectionCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const invoiceId = req.body?.invoice_id;
    const state = String(req.body?.state || '').toUpperCase();
    const apiRef = req.body?.api_ref;

    if (!invoiceId) {
      logger.warn('IntaSend collection callback missing invoice_id', {
        correlationId: (req as any).correlationId,
      });
      res.status(200).json({ ok: true });
      return;
    }

    logger.info('IntaSend collection callback received', {
      correlationId: (req as any).correlationId,
      invoiceId,
      state,
      apiRef,
    });

    const paymentRepo = new PaymentRepository();
    let deposit = await paymentRepo.findDepositByReference(String(invoiceId));

    // Race Condition Guard: Wait up to 5 seconds for the initiate API to finish
    if (!deposit) {
      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        deposit = await paymentRepo.findDepositByReference(String(invoiceId));
        if (deposit) break;
      }
    }

    if (!deposit) {
      // If still not found after 5 seconds, check if it's a genuinely unknown deposit
      logger.warn('IntaSend collection callback matched no deposit after 5s wait', {
        correlationId: (req as any).correlationId,
        invoiceId,
        apiRef,
      });
      res.status(200).json({ ok: true });
      return;
    }

    if (deposit.status !== 'pending') {
      logger.info('IntaSend collection callback ignored duplicate deposit state', {
        correlationId: (req as any).correlationId,
        depositId: deposit.id,
        status: deposit.status,
      });
      res.status(200).json({ ok: true });
      return;
    }

    if (state === 'COMPLETE') {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        const repoTx = new PaymentRepository(client);
        const walletServiceTx = new WalletService(client);
        const lockDeposit = await repoTx.findDepositByReferenceForUpdate(String(invoiceId));
        if (!lockDeposit || lockDeposit.status !== 'pending') {
          await client.query('COMMIT');
          res.status(200).json({ ok: true });
          return;
        }
        await repoTx.updateDepositStatus(lockDeposit.id, 'completed', req.body);
        await walletServiceTx.credit(
          lockDeposit.user_id,
          'real',
          new Decimal(lockDeposit.net_amount),
          'deposit',
          lockDeposit.id,
          `IntaSend deposit: ${invoiceId}`
        );
        await client.query('COMMIT');

        logger.info('IntaSend collection callback credited wallet', {
          correlationId: (req as any).correlationId,
          depositId: lockDeposit.id,
          userId: lockDeposit.user_id,
          amount: lockDeposit.net_amount,
          invoiceId,
        });
      } catch (error: any) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      res.status(200).json({ ok: true });
      return;
    }

    if (state === 'FAILED' || state === 'CANCELED' || state === 'CANCELLED') {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        const repoTx = new PaymentRepository(client);
        const lockDeposit = await repoTx.findDepositByReferenceForUpdate(String(invoiceId));
        if (lockDeposit && lockDeposit.status === 'pending') {
          await repoTx.updateDepositStatus(lockDeposit.id, 'failed', req.body);
        }
        await client.query('COMMIT');
      } catch (error: any) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    res.status(200).json({ ok: true });
  } catch (error: any) {
    logger.error('IntaSend collection callback failed', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
};

const handleIntaSendB2CCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = req.body || {};

    logger.info('IntaSend B2C callback received', {
      correlationId: (req as any).correlationId,
      trackingId: payload.tracking_id,
      transactionCount: Array.isArray(payload.transactions) ? payload.transactions.length : 0,
    });

    const transactions = Array.isArray(payload.transactions) ? payload.transactions : [];

    if (!transactions.length) {
      res.status(200).json({ ok: true });
      return;
    }

    for (const tx of transactions) {
      const txState = String(tx.status || tx.state || '').toUpperCase();
      const candidateIdempotencyKey = tx.idempotency_key;
      const candidateTransactionId = tx.transaction_id;
      const candidateTrackingId = payload.tracking_id;

      let matchKey: 'idempotency_key' | 'transaction_id' | 'tracking_id' | null = null;
      let outbox: any = null;

      const client = await pgPool.connect();
      try {
        if (candidateIdempotencyKey) {
          const result = await client.query(
            `SELECT * FROM payments.b2c_outbox WHERE originator_conversation_id = $1 FOR UPDATE`,
            [candidateIdempotencyKey]
          );
          if (result.rows[0]) {
            outbox = result.rows[0];
            matchKey = 'idempotency_key';
          }
        }
        if (!outbox && candidateTransactionId) {
          const result = await client.query(
            `SELECT * FROM payments.b2c_outbox WHERE conversation_id = $1 FOR UPDATE`,
            [candidateTransactionId]
          );
          if (result.rows[0]) {
            outbox = result.rows[0];
            matchKey = 'transaction_id';
          }
        }
        if (!outbox && candidateTrackingId) {
          const result = await client.query(
            `SELECT * FROM payments.b2c_outbox WHERE gateway_tracking_id = $1 FOR UPDATE`,
            [candidateTrackingId]
          );
          if (result.rows[0]) {
            outbox = result.rows[0];
            matchKey = 'tracking_id';
          }
        }
      } finally {
        client.release();
      }

      if (!outbox) {
        logger.warn('IntaSend B2C callback saw no outbox match', {
          correlationId: (req as any).correlationId,
          idempotencyKey: candidateIdempotencyKey,
          transactionId: candidateTransactionId,
          trackingId: candidateTrackingId,
        });
        continue;
      }

      if (outbox.status !== 'sent') {
        logger.info('IntaSend B2C callback ignored outbox row outside sent state', {
          correlationId: (req as any).correlationId,
          outboxId: outbox.id,
          status: outbox.status,
          matchKey,
        });
        continue;
      }

      const withdrawalClient = await pgPool.connect();
      try {
        await withdrawalClient.query('BEGIN');
        const repoTx = new PaymentRepository(withdrawalClient);
        const adminRepoTx = new AdminRepository(withdrawalClient);
        const walletServiceTx = new WalletService(withdrawalClient);
        const row = await withdrawalClient.query<any>(
          `SELECT * FROM payments.b2c_outbox WHERE id = $1 FOR UPDATE`,
          [outbox.id]
        );
        const outboxRow = row.rows[0];
        if (!outboxRow || outboxRow.status !== 'sent') {
          await withdrawalClient.query('COMMIT');
          continue;
        }

        const withdrawal = await adminRepoTx.getWithdrawalByIdForUpdate(outboxRow.withdrawal_id);
        if (!withdrawal || withdrawal.status !== 'dispatched') {
          await withdrawalClient.query('COMMIT');
          continue;
        }

        const isSuccess = ['COMPLETE', 'COMPLETED', 'SUCCESS', 'SUCCEEDED'].includes(txState);
        const isFailure = ['FAILED', 'CANCELED', 'CANCELLED', 'UNSUCCESSFUL'].includes(txState);

        if (isSuccess) {
          await walletServiceTx.finalizeWithdrawalDebit(
            withdrawal.user_id,
            'real',
            new Decimal(withdrawal.amount),
            'withdrawal',
            withdrawal.id,
            `IntaSend payout completed: ${candidateTransactionId || payload.tracking_id}`
          );
          await repoTx.updateWithdrawalStatusAndRef(withdrawal.id, 'completed', candidateTransactionId || payload.tracking_id);
          await repoTx.updateOutboxStatus(outboxRow.id, 'sent', candidateTransactionId || payload.tracking_id, null, null);
          logger.info('IntaSend B2C callback finalized withdrawal', {
            correlationId: (req as any).correlationId,
            outboxId: outboxRow.id,
            withdrawalId: withdrawal.id,
            matchKey,
          });
        } else if (isFailure) {
          await walletServiceTx.unlockFunds(withdrawal.user_id, 'real', new Decimal(withdrawal.amount));
          await repoTx.updateWithdrawalStatusAndRef(withdrawal.id, 'failed', candidateTransactionId || payload.tracking_id);
          await repoTx.updateOutboxStatus(outboxRow.id, 'failed', candidateTransactionId || payload.tracking_id, txState, null);
          logger.warn('IntaSend B2C callback unlocked funds after failure', {
            correlationId: (req as any).correlationId,
            outboxId: outboxRow.id,
            withdrawalId: withdrawal.id,
            matchKey,
          });
        } else {
          logger.info('IntaSend B2C callback ignored pending/unknown transaction state', {
            correlationId: (req as any).correlationId,
            outboxId: outboxRow.id,
            state: txState,
            matchKey,
          });
        }

        await withdrawalClient.query('COMMIT');
      } catch (error: any) {
        await withdrawalClient.query('ROLLBACK');
        logger.error('IntaSend B2C callback transaction failure', {
          correlationId: (req as any).correlationId,
          error: error.message,
        });
        throw error;
      } finally {
        withdrawalClient.release();
      }
    }

    res.status(200).json({ ok: true });
  } catch (error: any) {
    logger.error('IntaSend B2C callback failed', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Public Callback Routes (Exempt from JWT)
router.post('/deposit/callback', (req: Request, res: Response) =>
  controller.handleMpesaCallback(req, res)
);

router.post('/mpesa/callback', (req: Request, res: Response) =>
  controller.handleMpesaCallback(req, res)
);

router.post('/mpesa/b2c/result', (req: Request, res: Response) =>
  b2cCallbackController.handleResultCallback(req, res)
);

router.post('/mpesa/b2c/timeout', (req: Request, res: Response) =>
  b2cCallbackController.handleTimeoutCallback(req, res)
);

router.post('/intasend/collection/callback', verifyIntasendChallenge, (req: Request, res: Response) =>
  handleIntaSendCollectionCallback(req, res)
);

router.post('/intasend/b2c/callback', verifyIntasendChallenge, (req: Request, res: Response) =>
  handleIntaSendB2CCallback(req, res)
);

// Protected Routes (Require JWT)
router.use(authenticate);

router.post(
  ['/deposit/initiate', '/deposit/stkpush', '/mpesa/stkpush'],
  rateLimit('authenticated'),
  [
    body('amount').isNumeric().withMessage('Amount must be a number').isLength({ min: 1 }),
    body('gateway_id').optional().isInt().withMessage('Gateway ID must be an integer'),
    body('currency')
      .optional()
      .isString()
      .isLength({ min: 3, max: 3 })
      .withMessage('Currency must be 3 characters'),
    body('phone')
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Phone number cannot be empty if provided'),
    body('phoneNumber')
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Phone number cannot be empty if provided'),
    // Ensure at least one is provided
    body().custom((value) => {
      if (!value.phone && !value.phoneNumber) {
        throw new Error('Phone number is required');
      }
      return true;
    }),
  ],
  (req: Request, res: Response) => controller.initiateDeposit(req, res)
);

router.get('/deposit/:id/status', rateLimit('authenticated'), (req: Request, res: Response) =>
  controller.getDepositStatus(req, res)
);

router.post('/deposit/:id/sync', rateLimit('authenticated'), (req: Request, res: Response) =>
  controller.syncDepositStatus(req, res)
);

router.post(
  '/withdraw/request',
  rateLimit('authenticated'),
  [
    body('amount').isNumeric().isLength({ min: 1 }),
    body('gateway_id').isInt(),
    body('currency').isString().isLength({ min: 3, max: 3 }),
    body('phone').isString().isLength({ min: 10 }),
  ],
  (req: Request, res: Response) => controller.requestWithdrawal(req, res)
);

export default router;
