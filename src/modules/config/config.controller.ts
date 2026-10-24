import { Request, Response } from 'express';
import { logger } from '../../shared/middleware/logger.js';
import { SettingsService } from '../../shared/services/settingsService.js';

const publicSettingDefaults = {
  'deposit.min_amount': 500,
  'deposit.max_amount': 100000,
  'withdrawal.min_amount': 500,
  'withdrawal.max_amount': 60000,
  'kyc.required_for_trading': false,
  'kyc.required_for_withdrawal': true,
  'trade.min_duration_seconds': 60,
  'trade.max_duration_seconds': 3600,
  'trade.default_payout_ratio': 0.6,
  'withdrawal.fee_percentage': 0.02,
} as const;

export type PublicConfigKey = keyof typeof publicSettingDefaults;

export class ConfigController {
  constructor(private readonly settings = new SettingsService()) {}

  async getPublicConfig(_req: Request, res: Response): Promise<void> {
    try {
      const entries = await Promise.all(
        Object.entries(publicSettingDefaults).map(
          async ([key, defaultValue]) =>
            [key, await this.settings.getSetting(key, defaultValue)] as const
        )
      );
      const values = Object.fromEntries(entries) as Record<PublicConfigKey, unknown>;
      res.status(200).json({
        data: {
          deposit: {
            min_amount: Number(values['deposit.min_amount']),
            max_amount: Number(values['deposit.max_amount']),
          },
          withdrawal: {
            min_amount: Number(values['withdrawal.min_amount']),
            max_amount: Number(values['withdrawal.max_amount']),
            fee_percentage: Number(values['withdrawal.fee_percentage']),
          },
          kyc: {
            required_for_trading: values['kyc.required_for_trading'] === true,
            required_for_withdrawal: values['kyc.required_for_withdrawal'] === true,
          },
          trade: {
            min_duration_seconds: Number(values['trade.min_duration_seconds']),
            max_duration_seconds: Number(values['trade.max_duration_seconds']),
            default_payout_ratio: Number(values['trade.default_payout_ratio']),
          },
        },
        meta: { request_id: _req.correlationId },
      });
    } catch (error) {
      logger.error('Public platform configuration fetch failed', {
        error: error instanceof Error ? error.message : String(error),
        request_id: _req.correlationId,
      });
      res.status(500).json({ error: 'Unable to load platform configuration' });
    }
  }
}
