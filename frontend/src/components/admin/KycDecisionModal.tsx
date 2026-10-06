import React, { useState } from 'react';
import { KycApplication } from '@/services/admin/adminApiClient';
import { MfaStepUpModal } from './MfaStepUpModal';
import { ShieldCheck, AlertCircle, X } from 'lucide-react';

interface KycDecisionModalProps {
  application: KycApplication | null;
  decisionStatus: 'approved' | 'rejected' | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (id: string, status: 'approved' | 'rejected', notes: string, totpCode?: string) => Promise<void>;
}

export const KycDecisionModal: React.FC<KycDecisionModalProps> = ({
  application,
  decisionStatus,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [notes, setNotes] = useState('');
  const [isMfaOpen, setIsMfaOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !application || !decisionStatus) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) {
      setError('Reviewer notes are mandatory for compliance auditing.');
      return;
    }
    setError(null);
    setIsMfaOpen(true);
  };

  const handleMfaConfirm = async (totpCode: string) => {
    await onConfirm(application.id, decisionStatus, notes, totpCode);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
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
                decisionStatus === 'approved'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                Confirm KYC {decisionStatus === 'approved' ? 'Approval' : 'Rejection'}
              </h3>
              <p className="text-xs text-slate-400">Applicant: {application.user_email}</p>
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
                Mandatory Review Notes
              </label>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  decisionStatus === 'approved'
                    ? 'State document verification status (e.g. ID card matched selfie, proof of address valid)...'
                    : 'Specify reason for rejection (e.g. Blurry ID photo, expired document)...'
                }
                className="w-full p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/80"
              />
            </div>

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
                  decisionStatus === 'approved'
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
        title="KYC Compliance Decision MFA"
        description={`Submit ${decisionStatus.toUpperCase()} decision for ${application.user_email}? TOTP authentication is required.`}
      />
    </>
  );
};
