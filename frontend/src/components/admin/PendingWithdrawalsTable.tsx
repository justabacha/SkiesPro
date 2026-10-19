import React from 'react';
import { WithdrawalRequest } from '@/services/admin/adminApiClient';
import { safeFormatNumber, safeFormatDate } from '@/shared/utils/safeFormatters';
import { TableLoading, TableEmpty } from '@/shared/components';
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
    return <TableLoading message="Loading pending withdrawal requests..." />;
  }

  if (withdrawals.length === 0) {
    return (
      <TableEmpty
        icon={CheckCircle2}
        iconClassName="w-10 h-10 text-emerald-500/80 mx-auto mb-3"
        title="No Withdrawals Found"
        description="There are no payout transactions matching the current status filter."
      />
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
            {withdrawals.map((item) => {
              const amountVal = item.amount ?? item.amount_kes ?? item.net_amount;
              const numericAmount = Number(amountVal ?? 0);
              const usdVal = item.amount_usd != null ? item.amount_usd : numericAmount / 130;

              return (
                <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-200">{item.user_display_name || item.user_email}</div>
                    <div className="text-[11px] text-slate-400">{item.user_email}</div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-300">
                    {item.phone_number}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-emerald-400">
                    KES {safeFormatNumber(amountVal)}
                  </td>
                  <td className="py-3.5 px-4 text-slate-300 font-medium">
                    ${safeFormatNumber(usdVal, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3.5 px-4 text-slate-400">
                    {safeFormatDate(item.created_at)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {item.status.toLowerCase() === 'pending' ? (
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
                    ) : (
                      <span className="text-xs text-slate-400 font-semibold uppercase px-2 py-1 bg-slate-800 rounded">
                        {item.status}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
