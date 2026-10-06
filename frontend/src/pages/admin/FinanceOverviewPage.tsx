import React, { useState } from 'react';
import { useAdminFinance } from '@/hooks/admin/useAdminFinance';
import { PendingWithdrawalsTable } from '@/components/admin/PendingWithdrawalsTable';
import { WithdrawalActionModal } from '@/components/admin/WithdrawalActionModal';
import { WalletAdjustmentModal } from '@/components/admin/WalletAdjustmentModal';
import { HasRole } from '@/components/admin/HasRole';
import { WithdrawalRequest } from '@/services/admin/adminApiClient';
import { Wallet, RefreshCw, PlusCircle, AlertCircle } from 'lucide-react';

export const FinanceOverviewPage: React.FC = () => {
  const {
    withdrawals,
    selectedWithdrawal,
    isLoading,
    error,
    fetchWithdrawals,
    selectWithdrawal,
    clearSelectedWithdrawal,
    approveWithdrawal,
    rejectWithdrawal,
    adjustWallet,
  } = useAdminFinance();

  const [withdrawalAction, setWithdrawalAction] = useState<'approve' | 'reject' | null>(null);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);

  const handleSelectWithdrawal = (item: WithdrawalRequest, action: 'approve' | 'reject') => {
    selectWithdrawal(item.id);
    setWithdrawalAction(action);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-xl p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center">
              <Wallet className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">Finance & Wallet Operations</h1>
              <p className="text-xs text-slate-400">
                Manage pending M-Pesa withdrawals, monitor liquidity, and execute manual balance adjustments.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <HasRole roles={['super_admin']}>
            <button
              onClick={() => setIsAdjustModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-lg shadow-blue-600/20"
            >
              <PlusCircle className="w-4 h-4" />
              Manual Wallet Adjustment
            </button>
          </HasRole>

          <button
            onClick={() => fetchWithdrawals()}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors border border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Queue
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Pending Withdrawals Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase text-slate-300 tracking-wider">
            Pending M-Pesa Withdrawal Queue
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            {withdrawals.length} request(s) awaiting approval
          </span>
        </div>

        <PendingWithdrawalsTable
          withdrawals={withdrawals}
          isLoading={isLoading}
          onSelectWithdrawal={handleSelectWithdrawal}
        />
      </div>

      {/* Action Modal */}
      <WithdrawalActionModal
        withdrawal={selectedWithdrawal}
        actionType={withdrawalAction}
        isOpen={!!selectedWithdrawal && !!withdrawalAction}
        onClose={() => {
          clearSelectedWithdrawal();
          setWithdrawalAction(null);
        }}
        onConfirmApprove={async (id, totpCode) => {
          await approveWithdrawal(id, totpCode);
        }}
        onConfirmReject={async (id, reason, totpCode) => {
          await rejectWithdrawal(id, reason, totpCode);
        }}
      />

      {/* Manual Wallet Adjustment Modal */}
      <WalletAdjustmentModal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        onConfirm={async (payload) => {
          return await adjustWallet(payload);
        }}
      />
    </div>
  );
};

export default FinanceOverviewPage;
