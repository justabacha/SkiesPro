import React from 'react';
import { UserDetail, UserLedgerEntry } from '@/services/admin/adminApiClient';
import { X, Wallet, Award } from 'lucide-react';

interface UserDetailDrawerProps {
  user: UserDetail | null;
  ledger?: UserLedgerEntry[];
  isOpen: boolean;
  onClose: () => void;
  onFetchLedger?: (userId: string) => void;
}

export const UserDetailDrawer: React.FC<UserDetailDrawerProps> = ({
  user,
  ledger = [],
  isOpen,
  onClose,
  onFetchLedger,
}) => {
  const [activeTab, setActiveTab] = React.useState<'overview' | 'ledger'>('overview');

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/60">
          <div>
            <h2 className="text-lg font-bold text-slate-100">{user.display_name || user.email}</h2>
            <p className="text-xs text-slate-400 font-mono">User ID: {user.id}</p>
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
              if (onFetchLedger) onFetchLedger(user.id);
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
          {activeTab === 'overview' && (
            <>
              {/* Stat Cards Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1">
                    <Wallet className="w-4 h-4 text-emerald-400" />
                    KES Balance
                  </div>
                  <div className="text-xl font-bold text-slate-100">
                    KES {(user.wallet_balance_kes || 0).toLocaleString()}
                  </div>
                </div>

                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1">
                    <Award className="w-4 h-4 text-blue-400" />
                    Win Rate
                  </div>
                  <div className="text-xl font-bold text-slate-100">
                    {user.win_rate_pct !== undefined ? `${user.win_rate_pct}%` : 'N/A'}
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
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">
                    {user.role}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-800/60 pb-2">
                  <span className="text-slate-400">Account Status</span>
                  <span className="capitalize text-slate-200 font-medium">{user.status}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/60 pb-2">
                  <span className="text-slate-400">KYC Status</span>
                  <span className="text-emerald-400 font-semibold">{user.kyc_status || 'Unverified'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Executed Trades</span>
                  <span className="text-slate-200 font-medium">{user.total_trades || 0}</span>
                </div>
              </div>

              {/* Recent Trades */}
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-3">Recent Trade Activity</h4>
                {user.recent_trades && user.recent_trades.length > 0 ? (
                  <div className="space-y-2">
                    {user.recent_trades.map((trade) => (
                      <div key={trade.id} className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
                        <div>
                          <div className="font-semibold text-slate-200">{trade.symbol}</div>
                          <div className="text-[10px] text-slate-500 uppercase">{trade.direction}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-slate-200">KES {trade.amount.toLocaleString()}</div>
                          <div className={`text-[10px] font-semibold uppercase ${trade.status === 'won' ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {trade.status}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-lg text-center text-xs text-slate-500">
                    No recent trade history.
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'ledger' && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Wallet Audit Ledger</h4>
              {ledger.length > 0 ? (
                <div className="space-y-2">
                  {ledger.map((entry) => (
                    <div key={entry.id} className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-xs space-y-1">
                      <div className="flex justify-between font-semibold">
                        <span className="text-slate-200 uppercase">{entry.type}</span>
                        <span className={entry.amount >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                          {entry.amount >= 0 ? '+' : ''}{entry.amount.toLocaleString()} {entry.currency}
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px]">{entry.description}</p>
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span>Balance after: {entry.balance_after.toLocaleString()}</span>
                        <span>{new Date(entry.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 bg-slate-950/40 border border-slate-800 rounded-lg text-center text-xs text-slate-500">
                  No ledger entries found.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
