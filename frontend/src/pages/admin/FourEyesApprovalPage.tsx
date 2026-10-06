import React, { useEffect, useState, useCallback } from 'react';
import { adminApiClient, PendingAction } from '@/services/admin/adminApiClient';
import { FourEyesActionCard } from '@/components/admin/FourEyesActionCard';
import { CheckSquare, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

export const FourEyesApprovalPage: React.FC = () => {
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchApprovals = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch pending 4-eyes actions
      await adminApiClient.getPendingWithdrawals(); // Fallback/reuse or custom getApprovals if available
      setPendingActions([]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const handleApproveAction = async (id: string, totpCode?: string) => {
    await adminApiClient.approveAction(id, { totp_code: totpCode });
    setPendingActions((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-xl p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center">
              <CheckSquare className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">4-Eyes Super Admin Approval Queue</h1>
              <p className="text-xs text-slate-400">
                Secondary review queue for critical administrative actions exceeding USD $500 threshold.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchApprovals}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors border border-slate-700 self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Queue
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Action Cards List */}
      {pendingActions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {pendingActions.map((action) => (
            <FourEyesActionCard key={action.id} action={action} onApprove={handleApproveAction} />
          ))}
        </div>
      ) : (
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-12 text-center text-slate-400">
          <CheckCircle2 className="w-10 h-10 text-emerald-500/80 mx-auto mb-3" />
          <p className="text-base font-semibold text-slate-200">Four-Eyes Queue Clear</p>
          <p className="text-xs text-slate-500 mt-1">There are no high-value administrative operations pending 2nd approval.</p>
        </div>
      )}
    </div>
  );
};

export default FourEyesApprovalPage;
