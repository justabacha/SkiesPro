import { body, ValidationChain } from 'express-validator';

export interface KycReviewDto {
  action: 'approved' | 'rejected';
  note?: string;
}

export const validateKycReview: ValidationChain[] = [
  body('action').isIn(['approved', 'rejected']).withMessage('Action must be approved or rejected'),
  body('note').optional().isString(),
];
