import React from 'react';
import { WithdrawalRequest } from '@/services/admin/adminApiClient';
import { safeFormatNumber, safeFormatDate } from '@/shared/utils/safeFormatters';
import { TableLoading, TableEmpty } from '@/shared/components';
import { CheckCircle2, XCircle, RefreshCw, AlertTriangle, RotateCcw } from 'lucide-react';

export type ActionVariant = 'approve' | 'reject' | 'retry' | 'force-complete' | 'force-refund';

interface PendingWithdrawalsTableProps {
  withdrawals: WithdrawalRequest[];
  isLoading: boolean;
  onSelectWithdrawal: (item: WithdrawalRequest, action: ActionVariant) => void;
}

export const PendingWithdrawalsTable: React.FC<PendingWithdrawalsTableProps> = ({
  withdrawals,
  isLoading,
  onSelectWithdrawal,
}) => {
  if (isLoading) {
    return <TableLoading message="Loading withdrawal requests..." />;
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

  const renderStatusBadge = (item: WithdrawalRequest) => {
    const status = item.status.toLowerCase();
    const isFlagged = item.needs_manual_review || item.needsManualReview;
    let badgeStyle = 'bg-slate-800 text-slate-300 border-slate-700';

    if (status === 'pending') badgeStyle = 'bg-slate-800/80 text-slate-300 border-slate-700';
    else if (status === 'approved') badgeStyle = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    else if (status === 'dispatched') badgeStyle = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    else if (status === 'completed') badgeStyle = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    else if (status === 'failed') badgeStyle = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    else if (status === 'rejected') badgeStyle = 'bg-slate-800 text-slate-400 border-slate-700';

    return (
      <div className="flex flex-col items-end gap-1">
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold uppercase border ${badgeStyle}`}>
          {status}
        </span>
        {isFlagged && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <AlertTriangle className="w-3 h-3 text-rose-400" /> Review
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-xl overflow-hidden shadow-2xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-950/60 border-b border-slate-800/80 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              <th className="py-3.5 px-4">User Details</th>
              <th className="py-3.5 px-4">M-Pesa Phone / Ref</th>
              <th className="py-3.5 px-4">Amount (KES)</th>
              <th className="py-3.5 px-4">Amount (USD)</th>
              <th className="py-3.5 px-4">Submitted At</th>
              <th className="py-3.5 px-4 text-right">Status & Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50 text-xs">
            {withdrawals.map((item) => {
              const amountVal = item.amount ?? item.amount_kes ?? item.net_amount;
              const numericAmount = Number(amountVal ?? 0);
              const usdVal = item.amount_usd != null ? item.amount_usd : numericAmount / 130;
              const status = item.status.toLowerCase();
              const refCode = item.gateway_reference || item.gatewayReference;
              const reviewReason = item.manual_review_reason || item.manualReviewReason;
              const retryCount = item.retry_count ?? item.retryCount ?? 0;

              return (
                <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-200">{item.user_display_name || item.user_email}</div>
                    <div className="text-[11px] text-slate-400">{item.user_email}</div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-300">
                    <div>{item.phone_number}</div>
                    {refCode && <div className="text-[10px] text-emerald-400/90 font-semibold">Ref: {refCode}</div>}
                    {reviewReason && <div className="text-[10px] text-rose-400 max-w-xs truncate">{reviewReason}</div>}
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
                    <div className="flex flex-col items-end gap-2">
                      {renderStatusBadge(item)}

                      {status === 'pending' && (
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
                            className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-medium transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Approve
                          </button>
                        </div>
                      )}

                      {status === 'failed' && (
                        <button
                          onClick={() => onSelectWithdrawal(item, 'retry')}
                          disabled={retryCount >= 3}
                          className="flex items-center gap-1 px-2.5 py-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title={retryCount >= 3 ? 'Max retry attempts reached (3)' : `Retry dispatch (Attempt ${retryCount + 1})`}
                        >
                          <RefreshCw className="w-3 h-3" />
                          Retry ({retryCount}/3)
                        </button>
                      )}

                      {status === 'dispatched' && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onSelectWithdrawal(item, 'force-complete')}
                            className="flex items-center gap-1 px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg text-[11px] font-medium transition-colors"
                            title="Force Complete Withdrawal"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Force Complete
                          </button>
                          <button
                            onClick={() => onSelectWithdrawal(item, 'force-refund')}
                            className="flex items-center gap-1 px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 rounded-lg text-[11px] font-medium transition-colors"
                            title="Force Refund Withdrawal"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Force Refund
                          </button>
                        </div>
                      )}
                    </div>
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
