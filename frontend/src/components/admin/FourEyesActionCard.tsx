import React, { useState } from 'react';
import { PendingAction } from '@/services/admin/adminApiClient';
import { safeFormatNumber, safeFormatDate } from '@/shared/utils/safeFormatters';
import { MfaStepUpModal } from './MfaStepUpModal';
import { CheckSquare, ShieldCheck, User, Calendar, AlertTriangle } from 'lucide-react';

interface FourEyesActionCardProps {
  action: PendingAction;
  onApprove: (id: string, totpCode?: string) => Promise<void>;
}

export const FourEyesActionCard: React.FC<FourEyesActionCardProps> = ({ action, onApprove }) => {
  const [isMfaOpen, setIsMfaOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleMfaConfirm = async (totpCode: string) => {
    setIsSubmitting(true);
    try {
      await onApprove(action.id, totpCode);
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
        <div className="flex justify-end pt-1">
          <button
            onClick={() => setIsMfaOpen(true)}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-colors shadow-lg shadow-purple-600/20"
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
    </>
  );
};
