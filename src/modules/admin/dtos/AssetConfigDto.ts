import { body, ValidationChain } from 'express-validator';

export interface AssetConfigDto {
  payout_rate?: number;
  min_stake?: number;
  max_stake?: number;
}

export const validateAssetConfig: ValidationChain[] = [
  body('payout_rate')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('Payout rate must be between 0 and 1'),
  body('min_stake').optional().isFloat({ min: 0 }).withMessage('Min stake must be >= 0'),
  body('max_stake').optional().isFloat({ min: 0 }).withMessage('Max stake must be >= 0'),
];
