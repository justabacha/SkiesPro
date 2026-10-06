import React, { useState } from 'react';
import { useAdminRisk } from '@/hooks/admin/useAdminRisk';
import { AssetConfigModal } from '@/components/admin/AssetConfigModal';
import { SymbolExposure } from '@/services/admin/adminApiClient';
import { TrendingUp, RefreshCw, Sliders, AlertCircle } from 'lucide-react';

export const RiskDashboardPage: React.FC = () => {
  const { metrics, exposures, isLoading, error, fetchRiskData, updateAssetConfig } = useAdminRisk();
  const [selectedAsset, setSelectedAsset] = useState<SymbolExposure | null>(null);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-xl p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">Risk Oversight & Asset Configuration</h1>
              <p className="text-xs text-slate-400">
                Monitor live exposure, aggregate open positions, and adjust asset payout structures in real-time.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => fetchRiskData()}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors border border-slate-700 self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Exposure
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Aggregate Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl">
          <div className="text-xs text-slate-400 font-medium mb-1">Open Positions</div>
          <div className="text-2xl font-extrabold text-slate-100">
            {metrics ? metrics.total_open_positions : 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Live active trades across all pairs</div>
        </div>

        <div className="p-5 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl">
          <div className="text-xs text-slate-400 font-medium mb-1">Payout Exposure</div>
          <div className="text-2xl font-extrabold text-rose-400">
            KES {metrics ? metrics.total_payout_exposure_kes.toLocaleString() : '0'}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Aggregate potential payout liability</div>
        </div>

        <div className="p-5 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl">
          <div className="text-xs text-slate-400 font-medium mb-1">Trader Win Ratio</div>
          <div className="text-2xl font-extrabold text-amber-400">
            {metrics ? `${(metrics.platform_win_loss_ratio * 100).toFixed(1)}%` : '0%'}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Platform win vs loss percentage</div>
        </div>

        <div className="p-5 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl">
          <div className="text-xs text-slate-400 font-medium mb-1">24h Volume</div>
          <div className="text-2xl font-extrabold text-emerald-400">
            KES {metrics ? metrics.daily_volume_kes.toLocaleString() : '0'}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Total stake volume in last 24h</div>
        </div>
      </div>

      {/* Asset Exposure Table */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold uppercase text-slate-300 tracking-wider">
          Symbol Exposure & Payout Rates
        </h2>

        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-800/80 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                  <th className="py-3.5 px-4">Asset Pair</th>
                  <th className="py-3.5 px-4">Payout Rate</th>
                  <th className="py-3.5 px-4">Call / Put Volume</th>
                  <th className="py-3.5 px-4">Net Exposure</th>
                  <th className="py-3.5 px-4">Min / Max Stake</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-xs">
                {exposures.map((item) => (
                  <tr key={item.symbol} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-100">{item.display_name || item.symbol}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{item.symbol}</div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-blue-400">
                      {item.payout_rate}%
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-semibold">C: KES {item.open_call_volume.toLocaleString()}</span>
                        <span className="text-slate-600">|</span>
                        <span className="text-rose-400 font-semibold">P: KES {item.open_put_volume.toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-200">
                      KES {item.net_exposure.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 font-mono">
                      {item.min_stake} / {item.max_stake}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${
                          item.is_active
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {item.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedAsset(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors"
                      >
                        <Sliders className="w-3.5 h-3.5 text-blue-400" />
                        Configure
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Asset Config Modal */}
      <AssetConfigModal
        asset={selectedAsset}
        isOpen={!!selectedAsset}
        onClose={() => setSelectedAsset(null)}
        onConfirm={async (symbol, payload) => {
          await updateAssetConfig(symbol, payload);
        }}
      />
    </div>
  );
};

export default RiskDashboardPage;
