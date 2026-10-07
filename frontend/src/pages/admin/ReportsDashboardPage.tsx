import React, { useState } from 'react';
import { useAdminReports } from '@/hooks/admin/useAdminReports';
import { safeFormatNumber } from '@/shared/utils/safeFormatters';
import { BarChart3, RefreshCw, TrendingUp, DollarSign, Users, Activity, AlertCircle } from 'lucide-react';

export const ReportsDashboardPage: React.FC = () => {
  const {
    dailyRevenue,
    tradeVolume,
    userRegistrations,
    settlementPerformance,
    isLoading,
    error,
    fetchAllReports,
  } = useAdminReports();

  const [activeReportTab, setActiveReportTab] = useState<'revenue' | 'volume' | 'users' | 'settlement'>('revenue');

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-xl p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">Reports & Business Analytics</h1>
              <p className="text-xs text-slate-400">
                Visualize revenue metrics, trade volumes, registration growth, and worker settlement latency.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => fetchAllReports()}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors border border-slate-700 self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Metrics
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tab Controls */}
      <div className="flex border-b border-slate-800 bg-slate-900/60 rounded-xl p-1 gap-1">
        <button
          onClick={() => setActiveReportTab('revenue')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
            activeReportTab === 'revenue'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <DollarSign className="w-4 h-4" /> Daily Revenue
        </button>
        <button
          onClick={() => setActiveReportTab('volume')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
            activeReportTab === 'volume'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" /> Trade Volume
        </button>
        <button
          onClick={() => setActiveReportTab('users')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
            activeReportTab === 'users'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" /> User Registrations
        </button>
        <button
          onClick={() => setActiveReportTab('settlement')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
            activeReportTab === 'settlement'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" /> Settlement Latency
        </button>
      </div>

      {/* Analytics Card Body */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-6 shadow-2xl">
        {activeReportTab === 'revenue' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Daily Revenue Breakdown</h3>
            {dailyRevenue.length > 0 ? (
              <div className="space-y-3">
                {dailyRevenue.map((item, idx) => (
                  <div key={idx} className="p-4 bg-slate-950/60 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-400">{item.date}</span>
                    <div className="flex items-center gap-6">
                      <span className="font-bold text-emerald-400">KES {safeFormatNumber(item.revenue_kes)}</span>
                      <span className="text-slate-300 font-medium">${safeFormatNumber(item.revenue_usd)} USD</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-500">No revenue data reported.</div>
            )}
          </div>
        )}

        {activeReportTab === 'volume' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Trading Volume Analytics</h3>
            {tradeVolume.length > 0 ? (
              <div className="space-y-3">
                {tradeVolume.map((item, idx) => (
                  <div key={idx} className="p-4 bg-slate-950/60 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-400">{item.date}</span>
                    <div className="flex items-center gap-6">
                      <span className="font-bold text-blue-400">KES {safeFormatNumber(item.volume_kes)}</span>
                      <span className="text-slate-400">{safeFormatNumber(item.trade_count)} trades</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-500">No trade volume reported.</div>
            )}
          </div>
        )}

        {activeReportTab === 'users' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">User Acquisition & Growth</h3>
            {userRegistrations.length > 0 ? (
              <div className="space-y-3">
                {userRegistrations.map((item, idx) => (
                  <div key={idx} className="p-4 bg-slate-950/60 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-400">{item.date}</span>
                    <span className="font-bold text-indigo-400">+{item.count} new registrations</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-500">No registration metrics reported.</div>
            )}
          </div>
        )}

        {activeReportTab === 'settlement' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Worker Settlement Latency (ms)</h3>
            {settlementPerformance.length > 0 ? (
              <div className="space-y-3">
                {settlementPerformance.map((item, idx) => (
                  <div key={idx} className="p-4 bg-slate-950/60 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-400">{item.timestamp}</span>
                    <div className="flex items-center gap-6">
                      <span className="font-bold text-amber-400">{item.avg_latency_ms} ms avg</span>
                      <span className="text-slate-400">{item.processed_count} processed</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-500">No settlement worker metrics reported.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsDashboardPage;
