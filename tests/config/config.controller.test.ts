import { Request, Response } from 'express';
import { ConfigController } from '../../src/modules/config/config.controller.js';
import { SettingsService } from '../../src/shared/services/settingsService.js';

describe('Public config controller', () => {
  it('returns only the allow-listed trader settings', async () => {
    const getSetting = jest.fn(async (key: string, fallback: unknown) => {
      if (key === 'deposit.min_amount') return 1000;
      if (key === 'withdrawal.fee_percentage') return 0.025;
      if (key === 'private.smtp_password') return 'must-not-be-returned';
      return fallback;
    });
    const controller = new ConfigController({ getSetting } as unknown as SettingsService);
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await controller.getPublicConfig({ correlationId: 'request-1' } as Request, response);

    expect(getSetting).toHaveBeenCalledTimes(10);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      data: {
        deposit: { min_amount: 1000, max_amount: 100000 },
        withdrawal: { min_amount: 500, max_amount: 60000, fee_percentage: 0.025 },
        kyc: { required_for_trading: false, required_for_withdrawal: true },
        trade: {
          min_duration_seconds: 60,
          max_duration_seconds: 3600,
          default_payout_ratio: 0.6,
        },
      },
      meta: { request_id: 'request-1' },
    });
  });
});
