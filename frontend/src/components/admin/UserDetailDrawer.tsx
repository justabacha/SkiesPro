import React from 'react';
import { UserDetail, UserLedgerEntry } from '@/services/admin/adminApiClient';
import { safeFormatNumber, safeFormatDate } from '@/shared/utils/safeFormatters';
import { RoleBadge } from './UserTable';
import { X, Wallet, Award } from 'lucide-react';

interface UserDetailDrawerProps {
  user: UserDetail | null;
  ledger?: UserLedgerEntry[];
  isOpen: boolean;
  isDrawerLoading?: boolean;
  isLedgerLoading?: boolean;
  onClose: () => void;
  onFetchLedger?: (userId: string) => void;
}

export const UserDetailDrawer: React.FC<UserDetailDrawerProps> = ({
  user,
  ledger = [],
  isOpen,
  isDrawerLoading = false,
  isLedgerLoading = false,
  onClose,
  onFetchLedger,
}) => {
  const [activeTab, setActiveTab] = React.useState<'overview' | 'ledger'>('overview');

  if (!isOpen) return null;

  const displayName =
    user?.display_name ||
    (user as any)?.name ||
    (user as any)?.full_name ||
    user?.email ||
    'N/A';

  const kesBalance =
    user?.wallet_balance_kes ??
    (user as any)?.balance ??
    (user as any)?.wallet?.balance ??
    (user as any)?.wallet_balance ??
    (user as any)?.kes_balance ??
    0;

  const winRateRaw =
    user?.win_rate_pct ??
    (user as any)?.win_rate ??
    (user as any)?.stats?.win_rate_pct ??
    (user as any)?.stats?.win_rate;

  const winRateStr =
    winRateRaw !== undefined && winRateRaw !== null
      ? `${Number(winRateRaw).toFixed(1)}%`
      : 'N/A';

  const totalTrades =
    user?.total_trades ??
    (user as any)?.stats?.total_trades ??
    (user as any)?.trades_count ??
    (user as any)?.total_trades_count ??
    0;

  const kycStatus =
    user?.kyc_status ||
    (user as any)?.kyc_level ||
    (user as any)?.kyc_state ||
    'Unverified';

  const recentTrades =
    user?.recent_trades ||
    (user as any)?.trades ||
    (user as any)?.recentTrades ||
    [];
  const tradeDirectionLabel = (direction: string) => {
    const normalized = direction.toLowerCase();
    if (normalized === 'higher') return 'HIGH';
    if (normalized === 'lower') return 'LOW';
    return direction.toUpperCase();
  };
  const tradeOutcomeLabel = (trade: (typeof recentTrades)[number]) =>
    String(trade.result || trade.status || 'pending').toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/60">
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              {user ? displayName : 'User Profile'}
            </h2>
            {user && <p className="text-xs text-slate-400 font-mono">User ID: {user.id}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Profile Overview
          </button>
          <button
            onClick={() => {
              setActiveTab('ledger');
              if (onFetchLedger && user?.id) onFetchLedger(user.id);
            }}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'ledger'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Wallet Ledger History
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isDrawerLoading && !user ? (
            <div className="p-12 text-center text-slate-400">
              <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
              Loading profile details...
            </div>
          ) : user && activeTab === 'overview' ? (
            <>
              {/* Stat Cards Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1">
                    <Wallet className="w-4 h-4 text-emerald-400" />
                    KES Balance
                  </div>
                  <div className="text-xl font-bold text-slate-100">
                    KES {safeFormatNumber(kesBalance)}
                  </div>
                </div>

                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1">
                    <Award className="w-4 h-4 text-blue-400" />
                    Win Rate
                  </div>
                  <div className="text-xl font-bold text-slate-100">
                    {winRateStr}
                  </div>
                </div>
              </div>

              {/* Account Meta List */}
              <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
                <div className="flex justify-between border-b border-slate-800/60 pb-2">
                  <span className="text-slate-400">Email Address</span>
                  <span className="text-slate-200 font-medium">{user.email}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/60 pb-2">
                  <span className="text-slate-400">Account Role</span>
                  <RoleBadge user={user} />
                </div>
                <div className="flex justify-between border-b border-slate-800/60 pb-2">
                  <span className="text-slate-400">Account Status</span>
                  <span className="capitalize text-slate-200 font-medium">{user.status || 'active'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/60 pb-2">
                  <span className="text-slate-400">KYC Status</span>
                  <span className="text-emerald-400 font-semibold">{kycStatus}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Executed Trades</span>
                  <span className="text-slate-200 font-medium">{totalTrades}</span>
                </div>
              </div>

              {/* Recent Trades */}
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-3">Recent Trade Activity</h4>
                {recentTrades.length > 0 ? (
                  <div className="space-y-2">
                    {recentTrades.map((trade: (typeof recentTrades)[number]) => {
                      const outcome = tradeOutcomeLabel(trade);
                      const outcomeStyle =
                        outcome === 'WON' || outcome === 'WIN'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : outcome === 'LOST' || outcome === 'LOSS'
                            ? 'bg-rose-500/10 text-rose-400'
                            : 'bg-slate-700/50 text-slate-300';

                      return (
                        <div key={trade.id} className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-xs space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-slate-200">
                                {trade.asset_pair || trade.symbol || 'Unknown asset'}
                              </div>
                              <div className="text-[10px] text-slate-500 uppercase">
                                {tradeDirectionLabel(trade.direction)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-slate-200">
                                KES {safeFormatNumber(trade.amount)}
                              </div>
                              <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${outcomeStyle}`}>
                                {outcome}
                              </span>
                            </div>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {safeFormatDate(trade.created_at)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-lg text-center text-xs text-slate-500">
                    No recent trade history.
                  </div>
                )}
              </div>
            </>
          ) : activeTab === 'ledger' ? (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Wallet Audit Ledger</h4>
              {isLedgerLoading ? (
                <div className="p-8 text-center text-slate-400">
                  <div className="w-6 h-6 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-2" />
                  Loading ledger history...
                </div>
              ) : ledger.length > 0 ? (
                <div className="space-y-2">
                  {ledger.map((entry) => {
                    const entryId = entry.id || (entry as any)._id || Math.random().toString();
                    const amount = Number(entry.amount ?? (entry as any).val ?? 0);
                    const entryType = entry.type || (entry as any).transaction_type || 'TRANSACTION';
                    const description = entry.description || (entry as any).memo || 'N/A';
                    const currency = entry.currency || 'KES';
                    const balanceAfter = entry.balance_after ?? (entry as any).balance ?? 0;
                    const createdAt = entry.created_at || (entry as any).timestamp;

                    return (
                      <div key={entryId} className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-xs space-y-1">
                        <div className="flex justify-between font-semibold">
                          <span className="text-slate-200 uppercase">{entryType}</span>
                          <span className={amount >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                            {amount >= 0 ? '+' : ''}{safeFormatNumber(amount)} {currency}
                          </span>
                        </div>
                        <p className="text-slate-400 text-[11px]">{description}</p>
                        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                          <span>Balance after: {safeFormatNumber(balanceAfter)}</span>
                          <span>{safeFormatDate(createdAt)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 bg-slate-950/40 border border-slate-800 rounded-lg text-center text-xs text-slate-500">
                  No ledger entries found.
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
