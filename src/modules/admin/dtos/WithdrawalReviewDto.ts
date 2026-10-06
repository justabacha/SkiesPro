import { body, ValidationChain } from 'express-validator';

export interface WithdrawalApproveDto {
  note?: string;
}

export interface WithdrawalRejectDto {
  reason: string;
}

export const validateWithdrawalApprove: ValidationChain[] = [body('note').optional().isString()];

export const validateWithdrawalReject: ValidationChain[] = [
  body('reason').notEmpty().withMessage('Reason is required for rejection'),
];
