import React, { useState } from 'react';
import { useAdminFinance } from '@/hooks/admin/useAdminFinance';
import { PendingWithdrawalsTable, ActionVariant } from '@/components/admin/PendingWithdrawalsTable';
import { WithdrawalActionModal, ActionType } from '@/components/admin/WithdrawalActionModal';
import { WalletAdjustmentModal } from '@/components/admin/WalletAdjustmentModal';
import { HasRole } from '@/components/admin/HasRole';
import { WithdrawalRequest } from '@/services/admin/adminApiClient';
import { FilterTabs } from '@/shared/components';
import { Wallet, RefreshCw, PlusCircle, AlertCircle } from 'lucide-react';

const WITHDRAWAL_TABS = [
  { id: 'pending', label: 'Pending' },
  { id: 'dispatched', label: 'Dispatched' },
  { id: 'completed', label: 'Completed' },
  { id: 'failed', label: 'Failed' },
  { id: 'needs_review', label: 'Needs Review' },
  { id: 'approved', label: 'Approved (Legacy)' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All Withdrawals' },
] as const;

export const FinanceOverviewPage: React.FC = () => {
  const {
    withdrawals,
    selectedWithdrawal,
    statusFilter,
    selectStatusFilter,
    isLoading,
    error,
    fetchWithdrawals,
    selectWithdrawal,
    clearSelectedWithdrawal,
    approveWithdrawal,
    rejectWithdrawal,
    retryWithdrawal,
    forceCompleteWithdrawal,
    forceRefundWithdrawal,
    adjustWallet,
  } = useAdminFinance();

  const [withdrawalAction, setWithdrawalAction] = useState<ActionType | null>(null);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);

  const handleSelectWithdrawal = (item: WithdrawalRequest, action: ActionVariant) => {
    selectWithdrawal(item.id);
    setWithdrawalAction(action);
  };

  const displayedWithdrawals = statusFilter === 'needs_review'
    ? withdrawals.filter(w => w.needs_manual_review || w.needsManualReview)
    : withdrawals;

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
                Manage pending M-Pesa withdrawals, monitor lifecycle dispatches, handle recovery retries, and execute manual overrides.
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
            onClick={() => fetchWithdrawals(statusFilter)}
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

      {/* Filter Tabs */}
      <FilterTabs
        tabs={WITHDRAWAL_TABS}
        activeTab={statusFilter}
        onChange={(status) => {
          selectStatusFilter(status);
          clearSelectedWithdrawal();
          setWithdrawalAction(null);
        }}
      />

      {/* Pending Withdrawals Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase text-slate-300 tracking-wider">
            M-Pesa Withdrawal Queue ({statusFilter})
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            {displayedWithdrawals.length} request(s) matching filter
          </span>
        </div>

        <PendingWithdrawalsTable
          withdrawals={displayedWithdrawals}
          isLoading={isLoading}
          onSelectWithdrawal={handleSelectWithdrawal}
        />
      </div>

      {/* Action Modal */}
      <WithdrawalActionModal
        withdrawal={selectedWithdrawal}
        actionType={withdrawalAction}
        isOpen={!!selectedWithdrawal && !!withdrawalAction}
        isLoading={isLoading}
        onClose={() => {
          clearSelectedWithdrawal();
          setWithdrawalAction(null);
        }}
        onConfirmApprove={async (id, totpCode) => {
          await approveWithdrawal(id, totpCode);
          setWithdrawalAction(null);
        }}
        onConfirmReject={async (id, reason, totpCode) => {
          await rejectWithdrawal(id, reason, totpCode);
          setWithdrawalAction(null);
        }}
        onConfirmRetry={async (id, totpCode) => {
          await retryWithdrawal(id, totpCode);
          setWithdrawalAction(null);
        }}
        onConfirmForceComplete={async (id, mpesaReceipt, note, totpCode) => {
          await forceCompleteWithdrawal(id, mpesaReceipt, note, totpCode);
          setWithdrawalAction(null);
        }}
        onConfirmForceRefund={async (id, reason, totpCode) => {
          await forceRefundWithdrawal(id, reason, totpCode);
          setWithdrawalAction(null);
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
