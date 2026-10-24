import React, { useState, useEffect } from 'react';
import { adminApiClient, PlatformSetting } from '@/services/admin/adminApiClient';
import { MfaStepUpModal } from '@/components/admin/MfaStepUpModal';
import { TableEmpty, TableLoading } from '@/shared/components';
import { safeFormatNumber } from '@/shared/utils/safeFormatters';
import { Settings, RefreshCw, Save, AlertCircle } from 'lucide-react';

const categories = ['General', 'Trading', 'Fees & Referrals', 'KYC', 'Deposits', 'Withdrawals'] as const;
type SettingsCategory = (typeof categories)[number];

function getCategory(key: string): SettingsCategory {
  if (key.startsWith('trade.')) return 'Trading';
  if (
    key.startsWith('referral.') ||
    key.startsWith('fee.') ||
    key === 'withdrawal.fee_percentage'
  ) {
    return 'Fees & Referrals';
  }
  if (key.startsWith('kyc.')) return 'KYC';
  if (key.startsWith('deposit.')) return 'Deposits';
  if (key.startsWith('withdrawal.')) return 'Withdrawals';
  return 'General';
}

function isNumericSetting(key: string, value: unknown): boolean {
  return typeof value === 'number' || /(?:amount|duration_seconds|percentage|ratio)$/.test(key);
}

function getSettingUnit(key: string): string {
  if (key.endsWith('_amount')) return 'KES';
  if (key.endsWith('duration_seconds')) return 'seconds';
  if (key.endsWith('percentage')) return 'fraction';
  if (key.endsWith('ratio')) return 'ratio';
  return '';
}

function validateSettings(settings: PlatformSetting[]): string | null {
  const values = new Map(settings.map(({ key, value }) => [key, Number(value)]));
  for (const setting of settings) {
    if (setting.key.startsWith('kyc.required') && typeof setting.value !== 'boolean') {
      return `${setting.key} must be enabled or disabled.`;
    }
    if (!isNumericSetting(setting.key, setting.value)) continue;
    const value = Number(setting.value);
    if (setting.key === 'withdrawal.fee_percentage') {
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        return 'Withdrawal fee percentage must be between 0 and 1.';
      }
      continue;
    }
    if (!Number.isFinite(value) || value <= 0) {
      return `${setting.key} must be a positive number.`;
    }
    if (setting.key === 'trade.default_payout_ratio' && value > 1) {
      return 'Default payout ratio must be between 0 and 1.';
    }
    if (setting.key === 'referral.commission_percentage' && value > 1) {
      return 'Referral commission must be between 0 and 1.';
    }
  }
  for (const category of ['deposit', 'withdrawal']) {
    const minimum = values.get(`${category}.min_amount`);
    const maximum = values.get(`${category}.max_amount`);
    if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
      return `${category} minimum amount cannot exceed its maximum amount.`;
    }
  }
  return null;
}

export const PlatformSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<PlatformSetting[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMfaOpen, setIsMfaOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('General');

  const fetchSettings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await adminApiClient.getSettings();
      setSettings(list);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = () => {
    setIsMfaOpen(true);
  };

  const handleMfaConfirm = async (totpCode: string) => {
    const validationError = validateSettings(settings);
    if (validationError) {
      setError(validationError);
      throw new Error(validationError);
    }
    setError(null);
    try {
      await adminApiClient.updateSettings(
        settings.map(({ key, value }) => ({ key, value })),
        totpCode
      );
      setSuccessMessage('Platform settings updated successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchSettings();
    } catch (err) {
      const message = (err as Error).message || 'Unable to save platform settings.';
      setError(message);
      throw new Error(message);
    }
  };

  const visibleSettings = settings.filter((setting) => getCategory(setting.key) === activeCategory);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-xl p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center">
              <Settings className="w-5 h-5 text-slate-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">Global Platform Settings</h1>
              <p className="text-xs text-slate-400">
                Configure platform feature flags, payment gateway parameters, and operational thresholds.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-lg shadow-blue-600/20"
          >
            <Save className="w-4 h-4" />
            Save Platform Settings
          </button>

          <button
            onClick={fetchSettings}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors border border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs text-center font-medium">
          {successMessage}
        </div>
      )}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Setting categories">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            role="tab"
            aria-selected={activeCategory === category}
            onClick={() => setActiveCategory(category)}
            className={`rounded-lg border px-4 py-2 text-xs font-semibold transition-colors ${
              activeCategory === category
                ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Settings Form List */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-6 shadow-2xl space-y-4">
        {isLoading ? (
          <TableLoading message="Loading platform settings..." />
        ) : visibleSettings.length > 0 ? (
          visibleSettings.map((setting) => (
            <div key={setting.key} className="p-4 bg-slate-950/60 border border-slate-800 rounded-lg space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-200 uppercase font-mono">{setting.key}</label>
                {setting.category && (
                  <span className="px-2 py-0.5 text-[10px] uppercase font-semibold bg-slate-800 text-slate-400 rounded">
                    {setting.category}
                  </span>
                )}
              </div>
              {setting.description && (
                <p className="text-[11px] text-slate-400">{setting.description}</p>
              )}
              {setting.key.startsWith('kyc.required') ? (
                <label className="flex items-center gap-3 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={setting.value === true}
                    onChange={(e) =>
                      setSettings((prev) =>
                        prev.map((item) =>
                          item.key === setting.key ? { ...item, value: e.target.checked } : item
                        )
                      )
                    }
                    className="h-4 w-4 accent-blue-500"
                  />
                  {setting.value === true ? 'Enabled' : 'Disabled'}
                </label>
              ) : (
                <input
                  type={isNumericSetting(setting.key, setting.value) ? 'number' : 'text'}
                  min={isNumericSetting(setting.key, setting.value) ? '0' : undefined}
                  max={
                    setting.key === 'withdrawal.fee_percentage' ||
                    setting.key === 'trade.default_payout_ratio' ||
                    setting.key === 'referral.commission_percentage'
                      ? '1'
                      : undefined
                  }
                  step={isNumericSetting(setting.key, setting.value) ? 'any' : undefined}
                  value={String(setting.value ?? '')}
                  onChange={(e) => {
                    const value = isNumericSetting(setting.key, setting.value)
                      ? e.target.value === ''
                        ? ''
                        : Number(e.target.value)
                      : e.target.value;
                    setSettings((prev) =>
                      prev.map((item) =>
                        item.key === setting.key ? { ...item, value } : item
                      )
                    );
                  }}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                />
              )}
              <p className="text-[10px] text-slate-500">
                Current value: {isNumericSetting(setting.key, setting.value)
                  ? safeFormatNumber(setting.value)
                  : String(setting.value)}
                {getSettingUnit(setting.key) ? ` ${getSettingUnit(setting.key)}` : ''}
              </p>
            </div>
          ))
        ) : settings.length === 0 ? (
          <TableEmpty
            icon={Settings}
            title="No platform settings configured"
            description="There are no platform settings available to display."
          />
        ) : (
          <TableEmpty
            icon={Settings}
            title={`No ${activeCategory} settings`}
            description="No settings are configured in this category."
          />
        )}
      </div>

      <MfaStepUpModal
        isOpen={isMfaOpen}
        onClose={() => setIsMfaOpen(false)}
        onConfirm={handleMfaConfirm}
        title="Platform Settings Modification MFA"
        description="Updating global platform system settings requires TOTP MFA authorization."
      />
    </div>
  );
};

export default PlatformSettingsPage;
