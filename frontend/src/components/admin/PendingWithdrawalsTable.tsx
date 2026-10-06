import React from 'react';
import { WithdrawalRequest } from '@/services/admin/adminApiClient';
import { CheckCircle2, XCircle } from 'lucide-react';

interface PendingWithdrawalsTableProps {
  withdrawals: WithdrawalRequest[];
  isLoading: boolean;
  onSelectWithdrawal: (item: WithdrawalRequest, action: 'approve' | 'reject') => void;
}

export const PendingWithdrawalsTable: React.FC<PendingWithdrawalsTableProps> = ({
  withdrawals,
  isLoading,
  onSelectWithdrawal,
}) => {
  if (isLoading) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-8 text-center text-slate-400">
        <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
        Loading pending withdrawal requests...
      </div>
    );
  }

  if (withdrawals.length === 0) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-12 text-center text-slate-400">
        <CheckCircle2 className="w-10 h-10 text-emerald-500/80 mx-auto mb-3" />
        <p className="text-base font-semibold text-slate-200">No Pending Withdrawals</p>
        <p className="text-xs text-slate-500 mt-1">All payout transactions have been processed.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-xl overflow-hidden shadow-2xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-950/60 border-b border-slate-800/80 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              <th className="py-3.5 px-4">User Details</th>
              <th className="py-3.5 px-4">M-Pesa Phone</th>
              <th className="py-3.5 px-4">Amount (KES)</th>
              <th className="py-3.5 px-4">Amount (USD)</th>
              <th className="py-3.5 px-4">Submitted At</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50 text-xs">
            {withdrawals.map((item) => (
              <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="py-3.5 px-4">
                  <div className="font-semibold text-slate-200">{item.user_display_name || item.user_email}</div>
                  <div className="text-[11px] text-slate-400">{item.user_email}</div>
                </td>
                <td className="py-3.5 px-4 font-mono text-slate-300">
                  {item.phone_number}
                </td>
                <td className="py-3.5 px-4 font-bold text-emerald-400">
                  KES {item.amount_kes.toLocaleString()}
                </td>
                <td className="py-3.5 px-4 text-slate-300 font-medium">
                  ${item.amount_usd ? item.amount_usd.toFixed(2) : 'N/A'}
                </td>
                <td className="py-3.5 px-4 text-slate-400">
                  {item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A'}
                </td>
                <td className="py-3.5 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onSelectWithdrawal(item, 'reject')}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                      title="Reject Withdrawal"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onSelectWithdrawal(item, 'approve')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-medium transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approve Payout
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
