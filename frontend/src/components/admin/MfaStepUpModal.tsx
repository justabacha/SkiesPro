import React, { useState } from 'react';
import { ShieldCheck, Lock, AlertCircle, X } from 'lucide-react';

interface MfaStepUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (totpCode: string) => Promise<void>;
  closeOnSuccess?: boolean;
  title?: string;
  description?: string;
}

export const MfaStepUpModal: React.FC<MfaStepUpModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  closeOnSuccess = true,
  title = 'MFA Verification Required',
  description = 'Please enter your 6-digit TOTP code to execute this protected administrative action.',
}) => {
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 6) {
      setError('Please enter a 6-digit authenticator code.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    console.info('[MFA_TRACE] Step-Up Attempt:', { codeLength: code.length });
    try {
      await onConfirm(code);
      console.info('[MFA_TRACE] Step-Up verification completed');
      setCode('');
      if (closeOnSuccess) onClose();
    } catch (err) {
      const error = err as Error & { status?: number; code?: string };
      const reason = error.status
        ? `Step-Up verification returned ${error.status}: ${error.message}`
        : error.message || 'Invalid MFA code. Please try again.';
      console.error('[MFA_TRACE] Step-Up verification failed:', {
        status: error.status,
        code: error.code,
        reason,
      });
      setError(reason);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-xl shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">{title}</h3>
            <p className="text-xs text-slate-400">Security Step-Up Enforcement</p>
          </div>
        </div>

        <p className="text-sm text-slate-300 mb-6">{description}</p>

        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center gap-2 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Authenticator Code
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                autoFocus
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/80 text-center font-mono tracking-widest text-lg"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || code.length < 6}
              className="px-5 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 rounded-lg transition-colors font-semibold shadow-lg shadow-amber-500/20"
            >
              {isSubmitting ? 'Verifying...' : 'Verify & Execute'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
