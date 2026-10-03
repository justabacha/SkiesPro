import React from 'react';
import { CheckCircle2, XCircle, MinusCircle, History, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { BinaryContract } from '../types/trading.types';

export interface TradeHistoryProps {
  contracts: BinaryContract[];
  isLoading?: boolean;
}

export const TradeHistory: React.FC<TradeHistoryProps> = ({ contracts, isLoading = false }) => {
  if (isLoading) {
    return (
      <div
        data-testid="trade-history"
        className="w-full rounded-2xl bg-bg-light-secondary dark:bg-bg-dark-secondary border border-border-light dark:border-border-dark p-6 shadow-xl text-center text-xs text-text-light-secondary dark:text-text-dark-secondary"
      >
        Loading trade history...
      </div>
    );
  }

  if (contracts.length === 0) {
    return (
      <div
        data-testid="trade-history"
        className="w-full rounded-2xl bg-bg-light-secondary dark:bg-bg-dark-secondary border border-border-light dark:border-border-dark p-6 shadow-xl text-center text-text-light-primary dark:text-text-dark-primary"
      >
        <div className="flex flex-col items-center justify-center space-y-2 py-4">
          <History className="h-8 w-8 text-text-light-secondary/50 dark:text-text-dark-secondary/50" />
          <p className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">No Settled Trades</p>
          <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary">
            Settled trading history will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="trade-history"
      className="w-full rounded-2xl bg-bg-light-secondary dark:bg-bg-dark-secondary border border-border-light dark:border-border-dark p-4 sm:p-5 shadow-xl text-text-light-primary dark:text-text-dark-primary space-y-4 transition-colors duration-200"
    >
      <div className="flex items-center justify-between pb-3 border-b border-border-light dark:border-border-dark">
        <h3 className="text-base font-bold text-text-light-primary dark:text-text-dark-primary flex items-center space-x-2">
          <span>Settled Trade History</span>
        </h3>
      </div>

      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
        {contracts.map((contract) => {
          const isWon = contract.status === 'won';
          const isDraw = contract.status === 'draw';
          const isHigher = contract.contract_type === 'higher';
          const stakeNum = parseFloat(contract.stake);
          const payoutNum = parseFloat(contract.potential_payout || '0');
          const returnAmount = isWon ? payoutNum : isDraw ? stakeNum : 0;

          const strike = parseFloat(contract.strike_price);
          const expiry = contract.expiry_price ? parseFloat(contract.expiry_price) : null;
          const pipPlaces = strike > 100 ? 2 : 5;

          return (
            <div
              key={contract.id}
              className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                isWon
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : isDraw
                  ? 'bg-amber-500/5 border-amber-500/20'
                  : 'bg-rose-500/5 border-rose-500/20'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
                {/* Symbol & Direction */}
                <div className="flex items-center space-x-3">
                  <div
                    className={`p-1.5 rounded-md ${
                      isHigher ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {isHigher ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold font-mono text-text-light-primary dark:text-text-dark-primary">{contract.asset_symbol}</span>
                      <span className="text-[10px] font-bold uppercase text-text-light-secondary dark:text-text-dark-secondary bg-bg-light-primary dark:bg-bg-dark-primary px-1.5 py-0.5 rounded">
                        {contract.contract_type}
                      </span>
                    </div>
                    <span className="text-[11px] text-text-light-secondary dark:text-text-dark-secondary font-mono">
                      {new Date(contract.expiry_time).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                {/* Strike & Expiry Prices */}
                <div className="text-right text-xs">
                  <div>
                    Strike: <span className="font-mono font-semibold text-text-light-primary dark:text-text-dark-primary">{strike.toFixed(pipPlaces)}</span>
                  </div>
                  {expiry !== null && (
                    <div>
                      Expiry: <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{expiry.toFixed(pipPlaces)}</span>
                    </div>
                  )}
                </div>

                {/* Outcome Badge & Return */}
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <div className="text-right">
                    <span className="text-xs text-text-light-secondary dark:text-text-dark-secondary block">Stake: KES {stakeNum}</span>
                    <span
                      className={`text-xs sm:text-sm font-bold font-mono ${
                        isWon ? 'text-emerald-600 dark:text-emerald-400' : isDraw ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {isWon ? `+KES ${returnAmount.toFixed(2)}` : isDraw ? `KES ${returnAmount.toFixed(2)}` : 'KES 0.00'}
                    </span>
                  </div>

                  <span
                    data-testid="settlement-badge"
                    className={`flex items-center space-x-1 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase border ${
                      isWon
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : isDraw
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                    }`}
                  >
                    {isWon ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : isDraw ? (
                      <MinusCircle className="h-3.5 w-3.5" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5" />
                    )}
                    <span>{contract.status}</span>
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
