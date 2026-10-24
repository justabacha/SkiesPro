import { AdminRepository } from '../repositories/AdminRepository.js';
import { AdminAuditService } from './AdminAuditService.js';
import { pgPool } from '../../../config/database.js';
import { SettingsService, parseSettingValue } from '../../../shared/services/settingsService.js';

function validateSetting(key: string, value: unknown): void {
  if (key.startsWith('kyc.required_')) {
    if (typeof value !== 'boolean') throw new Error(`${key} must be a boolean`);
    return;
  }
  if (/(?:amount|duration_seconds|percentage|ratio)$/.test(key)) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      throw new Error(`${key} must be a positive number`);
    }
  }
  if (
    (key === 'trade.default_payout_ratio' || key === 'referral.commission_percentage') &&
    typeof value === 'number' &&
    value > 1
  ) {
    throw new Error(`${key} must not exceed 1`);
  }
}

function normalizeSetting(setting: any): any {
  const descriptions: Record<string, string> = {
    'trade.default_payout_ratio': 'Default payout ratio for assets without a configured payout',
    'referral.commission_percentage': 'Referral commission percentage',
  };
  return {
    ...setting,
    value: parseSettingValue(setting.value),
    description: descriptions[setting.key] ?? setting.description,
  };
}

export class AdminRiskService {
  private readonly repo: AdminRepository;

  constructor(repo = new AdminRepository()) {
    this.repo = repo;
  }

  async getDashboard() {
    return this.repo.getRiskDashboard();
  }

  async getExposure() {
    return this.repo.getRiskExposure();
  }

  async updateAssetConfig(symbol: string, payload: Record<string, any>, updatedBy: string) {
    return this.repo.updateAssetConfig(symbol, payload, updatedBy);
  }

  async listSettings() {
    const settings = await this.repo.listSettings();
    return settings.map(normalizeSetting);
  }

  async getSetting(key: string) {
    const setting = await this.repo.getSetting(key);
    return setting ? normalizeSetting(setting) : null;
  }

  async updateSettings(key: string, value: unknown, updatedBy: string, reason: string) {
    const [setting] = await this.updateSettingsBatch([{ key, value }], updatedBy, reason);
    return setting;
  }

  async updateSettingsBatch(
    settings: Array<{ key: string; value: unknown }>,
    updatedBy: string,
    reason: string
  ) {
    const client = await pgPool.connect();
    const changedKeys: string[] = [];
    try {
      await client.query('BEGIN');
      const repository = new AdminRepository(client);
      const audit = new AdminAuditService(repository);
      const results = [];
      const seenKeys = new Set<string>();

      for (const setting of settings) {
        if (typeof setting.key !== 'string' || !setting.key.trim() || setting.value === undefined) {
          throw new Error('Each setting must include a key and value');
        }
        if (seenKeys.has(setting.key)) throw new Error(`Duplicate setting key: ${setting.key}`);
        seenKeys.add(setting.key);
        validateSetting(setting.key, setting.value);
        const previous = await repository.getSetting(setting.key);
        const oldValue = previous ? parseSettingValue(previous.value) : null;
        if (JSON.stringify(oldValue) === JSON.stringify(setting.value)) {
          results.push({ ...previous, value: oldValue });
          continue;
        }

        const serializedValue = JSON.stringify(setting.value);
        if (serializedValue === undefined) {
          throw new Error(`Setting ${setting.key} has an unsupported value`);
        }
        const updated = await repository.setSetting(setting.key, serializedValue, updatedBy);
        await audit.createEntry({
          actorId: updatedBy,
          action: 'PLATFORM_SETTING_UPDATED',
          affectedEntity: 'platform_setting',
          details: { key: setting.key, oldValue, newValue: setting.value, reason },
        });
        changedKeys.push(setting.key);
        results.push({ ...updated, value: setting.value });
      }

      await client.query('COMMIT');
      changedKeys.forEach((key) => SettingsService.invalidate(key));
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
