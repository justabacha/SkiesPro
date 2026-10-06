import React, { useState, useEffect } from 'react';
import { adminApiClient, PlatformSetting } from '@/services/admin/adminApiClient';
import { MfaStepUpModal } from '@/components/admin/MfaStepUpModal';
import { Settings, RefreshCw, Save, AlertCircle } from 'lucide-react';

export const PlatformSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<PlatformSetting[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMfaOpen, setIsMfaOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
    const payload: Record<string, unknown> = {};
    settings.forEach((s) => {
      payload[s.key] = s.value;
    });

    await adminApiClient.updateSettings(payload, totpCode);
    setSuccessMessage('Platform settings updated successfully.');
    setTimeout(() => setSuccessMessage(null), 3000);
    await fetchSettings();
  };

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

      {/* Settings Form List */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-6 shadow-2xl space-y-4">
        {settings.length > 0 ? (
          settings.map((setting, idx) => (
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
              <input
                type="text"
                value={String(setting.value)}
                onChange={(e) => {
                  const val = e.target.value;
                  setSettings((prev) =>
                    prev.map((s, i) => (i === idx ? { ...s, value: val } : s))
                  );
                }}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          ))
        ) : (
          <div className="p-8 text-center text-xs text-slate-500">
            No platform settings returned from backend API. Using defaults.
          </div>
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
