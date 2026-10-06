import React, { useState } from 'react';
import { WithdrawalRequest } from '@/services/admin/adminApiClient';
import { MfaStepUpModal } from './MfaStepUpModal';
import { Wallet, AlertCircle, X } from 'lucide-react';

interface WithdrawalActionModalProps {
  withdrawal: WithdrawalRequest | null;
  actionType: 'approve' | 'reject' | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmApprove: (id: string, totpCode?: string) => Promise<void>;
  onConfirmReject: (id: string, reason: string, totpCode?: string) => Promise<void>;
}

export const WithdrawalActionModal: React.FC<WithdrawalActionModalProps> = ({
  withdrawal,
  actionType,
  isOpen,
  onClose,
  onConfirmApprove,
  onConfirmReject,
}) => {
  const [reason, setReason] = useState('');
  const [isMfaOpen, setIsMfaOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !withdrawal || !actionType) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (actionType === 'reject' && !reason.trim()) {
      setError('Rejection reason is required.');
      return;
    }
    setError(null);
    setIsMfaOpen(true);
  };

  const handleMfaConfirm = async (totpCode: string) => {
    if (actionType === 'approve') {
      await onConfirmApprove(withdrawal.id, totpCode);
    } else {
      await onConfirmReject(withdrawal.id, reason, totpCode);
    }
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
            <div
              className={`w-10 h-10 rounded-lg border flex items-center justify-center ${
                actionType === 'approve'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              }`}
            >
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                Confirm Withdrawal {actionType === 'approve' ? 'Approval' : 'Rejection'}
              </h3>
              <p className="text-xs text-slate-400">
                Amount: KES {withdrawal.amount_kes.toLocaleString()} ({withdrawal.phone_number})
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center gap-2 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {actionType === 'reject' && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Rejection Reason / Customer Note
                </label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Specify why withdrawal is being rejected..."
                  className="w-full p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-rose-500/80"
                />
              </div>
            )}

            {actionType === 'approve' && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-300">
                Approving will dispatch M-Pesa B2C payout of KES {withdrawal.amount_kes.toLocaleString()} to recipient {withdrawal.phone_number}.
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`px-5 py-2 text-xs font-bold rounded-lg transition-colors shadow-lg ${
                  actionType === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                    : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
                }`}
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
        title="Finance Withdrawal MFA Verification"
        description={`Confirm ${actionType.toUpperCase()} request for KES ${withdrawal.amount_kes.toLocaleString()}? Enter TOTP code.`}
      />
    </>
  );
};
