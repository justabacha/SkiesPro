import React, { useState } from 'react';
import { UserSummary } from '@/services/admin/adminApiClient';
import { MfaStepUpModal } from './MfaStepUpModal';
import { UserX, AlertCircle, X } from 'lucide-react';

interface UserStatusModalProps {
  user: UserSummary | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (userId: string, newStatus: string, reason: string, totpCode?: string) => Promise<void>;
}

export const UserStatusModal: React.FC<UserStatusModalProps> = ({
  user,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [status, setStatus] = useState<string>('suspended');
  const [reason, setReason] = useState<string>('');
  const [isMfaOpen, setIsMfaOpen] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (user) {
      setStatus(user.status === 'active' ? 'suspended' : 'active');
      setReason('');
      setError(null);
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Mandatory audit reason is required to change user status.');
      return;
    }
    setError(null);
    setIsMfaOpen(true);
  };

  const handleMfaConfirm = async (totpCode: string) => {
    await onConfirm(user.id, status, reason, totpCode);
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
            <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-center">
              <UserX className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">Update User Status</h3>
              <p className="text-xs text-slate-400">Target User: {user.email}</p>
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
                Select New Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-500/80"
              >
                <option value="active">Active (Full Access)</option>
                <option value="suspended">Suspended (Trading Gated)</option>
                <option value="banned">Banned (Account Locked)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Mandatory Reason / Compliance Note
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Specify administrative rationale for status modification..."
                className="w-full p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/80"
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
                className="px-5 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors shadow-lg shadow-amber-500/20"
              >
                Proceed to MFA Verification
              </button>
            </div>
          </form>
        </div>
      </div>

      <MfaStepUpModal
        isOpen={isMfaOpen}
        onClose={() => setIsMfaOpen(false)}
        onConfirm={handleMfaConfirm}
        title="Confirm Status Modification"
        description={`Set status of ${user.email} to ${status.toUpperCase()}? This action requires TOTP MFA confirmation.`}
      />
    </>
  );
};
