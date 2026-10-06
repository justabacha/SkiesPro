import { body, ValidationChain } from 'express-validator';

export interface UserStatusDto {
  status: 'active' | 'suspended' | 'closed';
  reason: string;
}

export const validateUserStatus: ValidationChain[] = [
  body('status').isIn(['active', 'suspended', 'closed']).withMessage('Invalid status'),
  body('reason').notEmpty().withMessage('Reason is required'),
];
