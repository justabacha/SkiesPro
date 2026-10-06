import React from 'react';
import { ShieldCheck, ShieldAlert, RefreshCw, CheckCircle2 } from 'lucide-react';

interface AuditChainStatusBannerProps {
  result: {
    valid: boolean;
    broken_at_id?: string;
    total_verified?: number;
  } | null;
  isVerifying: boolean;
  onVerify: () => void;
}

export const AuditChainStatusBanner: React.FC<AuditChainStatusBannerProps> = ({
  result,
  isVerifying,
  onVerify,
}) => {
  return (
    <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-xl p-5 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        {result ? (
          result.valid ? (
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500">
              <ShieldAlert className="w-6 h-6" />
            </div>
          )
        ) : (
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
        )}

        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-100">Cryptographic Hash-Chain Integrity</h3>
            {result && (
              <span
                className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded-full border ${
                  result.valid
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                }`}
              >
                {result.valid ? 'Chain Intact: 100% Verified' : 'TAMPER ALERT: CHAIN BROKEN'}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {result
              ? result.valid
                ? `Cryptographic SHA-256 validation passed for ${result.total_verified || 'all'} audit log entries.`
                : `Hash mismatch detected at audit record ID: ${result.broken_at_id}. Immediate compliance audit required.`
              : 'Execute SHA-256 verification across all log blocks to detect any database tampering.'}
          </p>
        </div>
      </div>

      <button
        onClick={onVerify}
        disabled={isVerifying}
        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg text-xs transition-colors shadow-lg shadow-blue-600/20 shrink-0"
      >
        <RefreshCw className={`w-4 h-4 ${isVerifying ? 'animate-spin' : ''}`} />
        {isVerifying ? 'Verifying Chain...' : 'Verify Audit Chain Integrity'}
      </button>
    </div>
  );
};
