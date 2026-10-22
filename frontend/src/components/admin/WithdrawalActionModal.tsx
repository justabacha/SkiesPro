import React, { useState } from 'react';
import { WithdrawalRequest } from '@/services/admin/adminApiClient';
import { safeFormatNumber } from '@/shared/utils/safeFormatters';
import { MfaStepUpModal } from './MfaStepUpModal';
import { Wallet, AlertCircle, X, RefreshCw, CheckCircle2, RotateCcw } from 'lucide-react';

export type ActionType = 'approve' | 'reject' | 'retry' | 'force-complete' | 'force-refund';

interface WithdrawalActionModalProps {
  withdrawal: WithdrawalRequest | null;
  actionType: ActionType | null;
  isOpen: boolean;
  isLoading?: boolean;
  onClose: () => void;
  onConfirmApprove?: (id: string, totpCode?: string) => Promise<void>;
  onConfirmReject?: (id: string, reason: string, totpCode?: string) => Promise<void>;
  onConfirmRetry?: (id: string, totpCode?: string) => Promise<void>;
  onConfirmForceComplete?: (id: string, mpesaReceipt: string, note?: string, totpCode?: string) => Promise<void>;
  onConfirmForceRefund?: (id: string, reason: string, totpCode?: string) => Promise<void>;
}

export const WithdrawalActionModal: React.FC<WithdrawalActionModalProps> = ({
  withdrawal,
  actionType,
  isOpen,
  isLoading = false,
  onClose,
  onConfirmApprove,
  onConfirmReject,
  onConfirmRetry,
  onConfirmForceComplete,
  onConfirmForceRefund,
}) => {
  const [reason, setReason] = useState('');
  const [mpesaReceipt, setMpesaReceipt] = useState('');
  const [note, setNote] = useState('');
  const [isMfaOpen, setIsMfaOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !withdrawal || !actionType) return null;

  const amountVal = withdrawal.amount ?? withdrawal.amount_kes ?? withdrawal.net_amount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (actionType === 'reject' && !reason.trim()) {
      setError('Rejection reason is required.');
      return;
    }
    if (actionType === 'force-complete' && (!mpesaReceipt.trim() || mpesaReceipt.trim().length < 10)) {
      setError('Valid M-Pesa Receipt Code (10-16 characters) is required.');
      return;
    }
    if (actionType === 'force-refund' && !reason.trim()) {
      setError('Reason for force refund is required.');
      return;
    }
    setError(null);
    setIsMfaOpen(true);
  };

  const handleMfaConfirm = async (totpCode: string) => {
    try {
      if (actionType === 'approve' && onConfirmApprove) {
        await onConfirmApprove(withdrawal.id, totpCode);
      } else if (actionType === 'reject' && onConfirmReject) {
        await onConfirmReject(withdrawal.id, reason, totpCode);
      } else if (actionType === 'retry' && onConfirmRetry) {
        await onConfirmRetry(withdrawal.id, totpCode);
      } else if (actionType === 'force-complete' && onConfirmForceComplete) {
        await onConfirmForceComplete(withdrawal.id, mpesaReceipt.trim(), note.trim(), totpCode);
      } else if (actionType === 'force-refund' && onConfirmForceRefund) {
        await onConfirmForceRefund(withdrawal.id, reason.trim(), totpCode);
      }
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Withdrawal action failed.');
      setIsMfaOpen(false);
    }
  };

  const getTitle = () => {
    switch (actionType) {
      case 'approve':
        return 'Approve & Dispatch Payout';
      case 'reject':
        return 'Reject Withdrawal Request';
      case 'retry':
        return 'Retry Failed Withdrawal';
      case 'force-complete':
        return 'Force Complete Withdrawal';
      case 'force-refund':
        return 'Force Refund Withdrawal';
      default:
        return 'Confirm Action';
    }
  };

  const getIcon = () => {
    switch (actionType) {
      case 'approve':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case 'retry':
        return <RefreshCw className="w-5 h-5 text-amber-400" />;
      case 'force-complete':
        return <CheckCircle2 className="w-5 h-5 text-blue-400" />;
      case 'force-refund':
        return <RotateCcw className="w-5 h-5 text-rose-400" />;
      default:
        return <Wallet className="w-5 h-5 text-rose-400" />;
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-6 relative">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg border border-slate-700/80 bg-slate-800/80 flex items-center justify-center">
              {getIcon()}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">{getTitle()}</h3>
              <p className="text-xs text-slate-400">
                Amount: KES {safeFormatNumber(amountVal)} ({withdrawal.phone_number})
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
            {actionType === 'approve' && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-300">
                Approving will dispatch M-Pesa B2C payout of KES {safeFormatNumber(amountVal)} to recipient {withdrawal.phone_number}. Locked funds remain committed until Daraja confirms.
              </div>
            )}

            {actionType === 'retry' && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300">
                Retry will re-lock KES {safeFormatNumber(amountVal)} and re-dispatch to {withdrawal.phone_number}. Limit: 3 retries max.
              </div>
            )}

            {actionType === 'force-complete' && (
              <div className="space-y-3">
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300">
                  Confirm with Daraja that this payout actually completed, then enter the M-Pesa receipt code. This will finalize wallet debit.
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    M-Pesa Receipt Code <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={mpesaReceipt}
                    onChange={(e) => setMpesaReceipt(e.target.value.toUpperCase())}
                    placeholder="e.g. QGH782103K"
                    maxLength={16}
                    className="w-full p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:border-blue-500/80"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Ops Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Reference ticket or justification..."
                    className="w-full p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/80"
                  />
                </div>
              </div>
            )}

            {actionType === 'force-refund' && (
              <div className="space-y-3">
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-300">
                  Confirm with Daraja that this payout definitively failed. This will refund the locked funds. Do NOT use if payout may have succeeded.
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Reason for Force Refund <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Specify why ops is force-refunding this dispatch..."
                    className="w-full p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-rose-500/80"
                  />
                </div>
              </div>
            )}

            {actionType === 'reject' && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Rejection Reason / Customer Note <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={3}
                  value={reason}
                  disabled={isLoading}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Specify why withdrawal is being rejected..."
                  className="w-full p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-rose-500/80 disabled:opacity-50"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-5 py-2 text-xs font-bold rounded-lg transition-colors bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 flex items-center gap-2 disabled:opacity-50"
              >
                {isLoading && (
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                )}
                {isLoading ? 'Processing...' : 'Proceed to MFA Confirmation'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <MfaStepUpModal
        isOpen={isMfaOpen}
        onClose={() => setIsMfaOpen(false)}
        onConfirm={handleMfaConfirm}
        title="Ops Recovery MFA Verification"
        description={`Confirm ${actionType?.toUpperCase()} request for KES ${safeFormatNumber(amountVal)}? Enter TOTP code.`}
      />
    </>
  );
};
