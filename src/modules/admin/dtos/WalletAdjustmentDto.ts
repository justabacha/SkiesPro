import { body, ValidationChain } from 'express-validator';

export interface WalletAdjustmentDto {
  user_id: string;
  amount: number;
  type: 'credit' | 'debit';
  reason: string;
}

export const validateWalletAdjustment: ValidationChain[] = [
  body('user_id').isUUID().withMessage('Valid user_id UUID is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be positive'),
  body('type').isIn(['credit', 'debit']).withMessage('Type must be credit or debit'),
  body('reason').notEmpty().withMessage('Reason is required'),
];
