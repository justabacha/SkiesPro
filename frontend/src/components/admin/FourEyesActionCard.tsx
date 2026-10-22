import React, { useState } from 'react';
import { adminApiClient, PendingAction } from '@/services/admin/adminApiClient';
import { safeFormatNumber, safeFormatDate } from '@/shared/utils/safeFormatters';
import { MfaStepUpModal } from './MfaStepUpModal';
import {
  CheckSquare,
  ShieldCheck,
  User,
  Calendar,
  AlertTriangle,
  XCircle,
  AlertCircle,
  X,
  Lock,
} from 'lucide-react';

interface FourEyesActionCardProps {
  action: PendingAction;
  onApprove: (id: string, totpCode?: string) => Promise<void>;
  onReject?: (id: string, payload: { reason: string; totpCode?: string }) => Promise<void>;
  onActionResolved?: () => void;
}

export const FourEyesActionCard: React.FC<FourEyesActionCardProps> = ({
  action,
  onApprove,
  onReject,
  onActionResolved,
}) => {
  const [isMfaOpen, setIsMfaOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  const handleMfaConfirm = async (code: string) => {
    setIsSubmitting(true);
    try {
      await onApprove(action.id, code);
      if (onActionResolved) onActionResolved();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmRejection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      setRejectError('Reason for rejection is required.');
      return;
    }

    setIsSubmitting(true);
    setRejectError(null);
    try {
      if (onReject) {
        await onReject(action.id, { reason: rejectionReason.trim(), totpCode });
      } else {
        await adminApiClient.rejectAction(action.id, {
          reason: rejectionReason.trim(),
          totp_code: totpCode || undefined,
        });
      }
      setIsRejectModalOpen(false);
      setRejectionReason('');
      setTotpCode('');
      if (onActionResolved) onActionResolved();
    } catch (err: any) {
      setRejectError(err.message || 'Failed to reject action.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center">
              <CheckSquare className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <span className="text-xs uppercase font-extrabold tracking-wider text-purple-400 block">
                {action.action_type || 'HIGH_VALUE_WALLET_ADJUSTMENT'}
              </span>
              <h3 className="text-sm font-bold text-slate-100 mt-0.5">
                Target Entity: {action.target_entity} ({action.target_id})
              </h3>
            </div>
          </div>

          <span className="px-2.5 py-1 text-[10px] font-bold uppercase rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Awaiting 2nd Approval
          </span>
        </div>

        {/* Details breakdown */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 space-y-2 text-xs">
          <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
            <span className="text-slate-400 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-500" /> Initializing Actor
            </span>
            <span className="text-slate-200 font-medium font-mono">{action.actor_email || action.actor_id}</span>
          </div>

          <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
            <span className="text-slate-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Threshold Exposure
            </span>
            <span className="text-amber-400 font-bold">
              ${action.amount_usd != null ? safeFormatNumber(action.amount_usd, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '500+'} USD
            </span>
          </div>

          <div className="flex justify-between pb-1">
            <span className="text-slate-400 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" /> Initiated At
            </span>
            <span className="text-slate-400">{safeFormatDate(action.created_at)}</span>
          </div>

          {action.details && (
            <div className="pt-2 border-t border-slate-800/60 text-[11px] font-mono text-slate-400 bg-slate-900/60 p-2 rounded">
              <pre className="whitespace-pre-wrap overflow-x-auto">{JSON.stringify(action.details, null, 2)}</pre>
            </div>
          )}
        </div>

        {/* Action controls */}
        <div className="flex justify-end items-center gap-3 pt-1">
          <button
            onClick={() => {
              setRejectError(null);
              setIsRejectModalOpen(true);
            }}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-4 py-2 border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <XCircle className="w-4 h-4" />
            Reject Action
          </button>
          <button
            onClick={() => setIsMfaOpen(true)}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-colors shadow-lg shadow-purple-600/20 disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4" />
            {isSubmitting ? 'Approving...' : 'Authorize Action (Super Admin MFA)'}
          </button>
        </div>
      </div>

      <MfaStepUpModal
        isOpen={isMfaOpen}
        onClose={() => setIsMfaOpen(false)}
        onConfirm={handleMfaConfirm}
        title="4-Eyes Action Authorization"
        description="Executing 2nd Super Admin authorization. Enter TOTP code to confirm."
      />

      {/* Reject Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-6 relative">
            <button
              onClick={() => setIsRejectModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center justify-center">
                <XCircle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">Reject Action</h3>
                <p className="text-xs text-rose-400 font-medium">Cancellation Enforcement</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-4 bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg">
              Are you sure you want to reject this adjustment? This will cancel the requested action.
            </p>

            {rejectError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center gap-2 text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{rejectError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmRejection} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Reason for rejection <span className="text-rose-400">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Specify mandatory rejection justification..."
                  rows={3}
                  required
                  className="w-full p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-rose-500/80 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  TOTP / MFA Code (Required for Super Admin)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-rose-500/80 text-center font-mono tracking-widest text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !rejectionReason.trim()}
                  className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors shadow-lg shadow-rose-600/20"
                >
                  {isSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
