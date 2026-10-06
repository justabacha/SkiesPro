import React, { useState } from 'react';
import { SymbolExposure, AssetConfig } from '@/services/admin/adminApiClient';
import { MfaStepUpModal } from './MfaStepUpModal';
import { TrendingUp, AlertCircle, X } from 'lucide-react';

interface AssetConfigModalProps {
  asset: SymbolExposure | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (symbol: string, payload: Partial<AssetConfig> & { totp_code?: string }) => Promise<void>;
}

export const AssetConfigModal: React.FC<AssetConfigModalProps> = ({
  asset,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [payoutRate, setPayoutRate] = useState<number>(85);
  const [minStake, setMinStake] = useState<number>(100);
  const [maxStake, setMaxStake] = useState<number>(50000);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isMfaOpen, setIsMfaOpen] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (asset) {
      setPayoutRate(asset.payout_rate || 85);
      setMinStake(asset.min_stake || 100);
      setMaxStake(asset.max_stake || 50000);
      setIsActive(asset.is_active !== undefined ? asset.is_active : true);
      setError(null);
    }
  }, [asset]);

  if (!isOpen || !asset) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (payoutRate < 50 || payoutRate > 95) {
      setError('Payout rate must be between 50% and 95%.');
      return;
    }
    if (minStake >= maxStake) {
      setError('Minimum stake must be strictly less than maximum stake.');
      return;
    }
    setError(null);
    setIsMfaOpen(true);
  };

  const handleMfaConfirm = async (totpCode: string) => {
    await onConfirm(asset.symbol, {
      payout_rate: payoutRate,
      min_stake: minStake,
      max_stake: maxStake,
      is_active: isActive,
      totp_code: totpCode,
    });
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">Update Asset Risk Config</h3>
              <p className="text-xs text-slate-400">Target Asset: {asset.display_name || asset.symbol}</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center gap-2 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Payout Rate (%)
              </label>
              <input
                type="number"
                min={50}
                max={95}
                value={payoutRate}
                onChange={(e) => setPayoutRate(parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-100 font-bold focus:outline-none focus:border-rose-500/80"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Min Stake (KES)
                </label>
                <input
                  type="number"
                  value={minStake}
                  onChange={(e) => setMinStake(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono focus:outline-none focus:border-rose-500/80"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Max Stake (KES)
                </label>
                <input
                  type="number"
                  value={maxStake}
                  onChange={(e) => setMaxStake(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono focus:outline-none focus:border-rose-500/80"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                id="is_active_check"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-rose-500 focus:ring-0"
              />
              <label htmlFor="is_active_check" className="text-xs text-slate-300 font-semibold cursor-pointer">
                Enable Asset Trading (Active)
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors shadow-lg shadow-rose-600/20"
              >
                Proceed to MFA Confirmation
              </button>
            </div>
          </form>
        </div>
      </div>

      <MfaStepUpModal
        isOpen={isMfaOpen}
        onClose={() => setIsMfaOpen(false)}
        onConfirm={handleMfaConfirm}
        title="Asset Config Update MFA"
        description={`Update payout rate to ${payoutRate}% for ${asset.symbol}? Enter TOTP code.`}
      />
    </>
  );
};
