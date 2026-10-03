import React, { useState, useMemo } from 'react';
import { ArrowUpRight, ArrowDownRight, Lock, Clock, DollarSign, AlertCircle } from 'lucide-react';
import { Asset, ContractType } from '../types/trading.types';

export interface OrderFormProps {
  asset: Asset | null;
  currentPrice: number;
  userBalance: number;
  isPlacingTrade: boolean;
  onPlaceTrade: (contractType: ContractType, stake: string, expirySeconds: number) => void;
  tradeError: string | null;
  onClearError: () => void;
}

const QUICK_STAKES = ['100', '250', '500', '1000', '5000'];
const DURATION_OPTIONS = [
  { label: '60s (1m)', value: 60 },
  { label: '300s (5m)', value: 300 },
  { label: '900s (15m)', value: 900 },
];

export const OrderForm: React.FC<OrderFormProps> = ({
  asset,
  currentPrice,
  userBalance,
  isPlacingTrade,
  onPlaceTrade,
  tradeError,
  onClearError,
}) => {
  const [stake, setStake] = useState<string>('100');
  const [expirySeconds, setExpirySeconds] = useState<number>(60);

  const payoutRate = asset?.payoutRate || 0.60;
  const minStake = asset?.minStake || 100;
  const maxStake = asset?.maxStake || 50000;
  const isMarketOpen = asset?.isOpen !== false && asset?.isActive !== false;

  const numericStake = parseFloat(stake) || 0;

  // Expected payout calculation (Stake + Stake * PayoutRate)
  const expectedPayout = useMemo(() => {
    if (isNaN(numericStake) || numericStake <= 0) return 0;
    return Number((numericStake * (1 + payoutRate)).toFixed(2));
  }, [numericStake, payoutRate]);

  // Stake validation
  const validationError = useMemo(() => {
    if (!stake || isNaN(numericStake)) return 'Please enter a valid stake amount';
    if (numericStake < minStake) return `Minimum stake is KES ${minStake}`;
    if (numericStake > maxStake) return `Maximum stake is KES ${maxStake}`;
    if (numericStake > userBalance) return 'Insufficient wallet balance';
    return null;
  }, [stake, numericStake, minStake, maxStake, userBalance]);

  const isDisabled = !isMarketOpen || isPlacingTrade || Boolean(validationError);

  const handleHigher = () => {
    if (isDisabled) return;
    onPlaceTrade('higher', stake, expirySeconds);
  };

  const handleLower = () => {
    if (isDisabled) return;
    onPlaceTrade('lower', stake, expirySeconds);
  };

  return (
    <div
      data-testid="order-form"
      className="w-full rounded-2xl bg-bg-light-secondary dark:bg-bg-dark-secondary border border-border-light dark:border-border-dark p-4 sm:p-5 shadow-xl flex flex-col justify-between text-text-light-primary dark:text-text-dark-primary transition-colors duration-200"
    >
      <div className="space-y-4 sm:space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border-light dark:border-border-dark">
          <div>
            <h3 className="text-base font-bold text-text-light-primary dark:text-text-dark-primary">Place Binary Contract</h3>
            {currentPrice > 0 && (
              <span className="text-xs font-mono text-text-light-secondary dark:text-text-dark-secondary">
                Spot: {currentPrice.toFixed(currentPrice > 100 ? 2 : 5)}
              </span>
            )}
          </div>
          <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            Payout +{(payoutRate * 100).toFixed(0)}%
          </span>
        </div>

        {/* Market Closed Badge Tooltip */}
        {!isMarketOpen && (
          <div
            data-testid="market-closed-badge"
            className="flex items-center space-x-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-medium"
          >
            <Lock className="h-4 w-4 flex-shrink-0" />
            <span>Market is currently closed for {asset?.symbol || 'this asset'}. Orders suspended.</span>
          </div>
        )}

        {/* Trade Error Banner */}
        {tradeError && (
          <div className="flex items-start justify-between p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-600 dark:text-rose-400 text-xs">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{tradeError}</span>
            </div>
            <button
              type="button"
              onClick={onClearError}
              className="text-text-light-secondary dark:text-text-dark-secondary hover:text-text-light-primary dark:hover:text-text-dark-primary font-bold ml-2"
            >
              ×
            </button>
          </div>
        )}

        {/* Duration Selection */}
        <div>
          <label className="block text-xs font-semibold text-text-light-secondary dark:text-text-dark-secondary mb-2 flex items-center space-x-1">
            <Clock className="h-3.5 w-3.5" />
            <span>Duration / Expiry</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setExpirySeconds(opt.value)}
                className={`py-2 px-2 sm:px-3 text-xs font-mono font-semibold rounded-xl border transition-all ${
                  expirySeconds === opt.value
                    ? 'bg-brand text-white border-brand shadow-md shadow-brand/20'
                    : 'bg-bg-light-tertiary dark:bg-bg-dark-tertiary text-text-light-secondary dark:text-text-dark-secondary border-border-light dark:border-border-dark hover:border-text-light-secondary dark:hover:border-text-dark-secondary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stake Input */}
        <div>
          <label className="block text-xs font-semibold text-text-light-secondary dark:text-text-dark-secondary mb-2 flex items-center justify-between">
            <span className="flex items-center space-x-1">
              <DollarSign className="h-3.5 w-3.5" />
              <span>Stake Amount (KES)</span>
            </span>
            <span className="font-mono text-[11px] text-text-light-secondary dark:text-text-dark-secondary">
              Balance: KES {userBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </label>

          <div className="relative">
            <input
              type="number"
              data-testid="stake-input"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              min={minStake}
              max={maxStake}
              step="10"
              placeholder={`Min ${minStake}`}
              className="w-full pl-4 pr-16 py-2.5 bg-bg-light-primary dark:bg-bg-dark-primary font-mono text-base font-bold text-text-light-primary dark:text-text-dark-primary rounded-xl border border-border-light dark:border-border-dark focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
            <span className="absolute right-4 top-3 text-xs font-bold text-text-light-secondary dark:text-text-dark-secondary">
              KES
            </span>
          </div>

          {/* Quick Stake Adjust Buttons (UI-TRADE-002) */}
          <div className="grid grid-cols-5 gap-1 sm:gap-1.5 mt-2">
            {QUICK_STAKES.map((amt) => (
              <button
                key={amt}
                type="button"
                data-testid={`quick-stake-${amt}`}
                onClick={() => setStake(amt)}
                className="py-1 px-1 sm:px-2 text-[10px] sm:text-[11px] font-mono font-medium bg-bg-light-tertiary dark:bg-bg-dark-tertiary hover:bg-bg-light-primary dark:hover:bg-bg-dark-primary rounded-lg border border-border-light dark:border-border-dark/60 text-text-light-secondary dark:text-text-dark-secondary hover:text-text-light-primary dark:hover:text-text-dark-primary transition-colors"
              >
                +{amt}
              </button>
            ))}
          </div>

          {/* Stake Validation Error */}
          {validationError && (
            <p className="mt-1.5 text-[11px] text-rose-500 dark:text-rose-400 font-medium">{validationError}</p>
          )}
        </div>

        {/* Expected Payout Display (UI-TRADE-003) */}
        <div className="p-3.5 bg-bg-light-tertiary/70 dark:bg-bg-dark-tertiary/70 rounded-xl border border-border-light dark:border-border-dark flex items-center justify-between">
          <span className="text-xs text-text-light-secondary dark:text-text-dark-secondary font-medium">Expected Payout:</span>
          <div className="text-right">
            <span
              data-testid="payout-amount"
              className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400"
            >
              KES {expectedPayout.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <p className="text-[10px] text-text-light-secondary dark:text-text-dark-secondary">
              (Return includes KES {stake || '0'} stake)
            </p>
          </div>
        </div>
      </div>

      {/* Action Direction Buttons (UI-TRADE-004 & Anti-Double-Click) */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 mt-5 sm:mt-6">
        <button
          type="button"
          data-testid="btn-higher"
          onClick={handleHigher}
          disabled={isDisabled}
          className="flex flex-col items-center justify-center py-3 sm:py-3.5 px-3 sm:px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold transition-all shadow-lg shadow-emerald-950/20 dark:shadow-emerald-950/40 disabled:opacity-40 disabled:cursor-not-allowed group"
        >
          <div className="flex items-center space-x-1 text-xs sm:text-sm uppercase tracking-wide">
            <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5 transition-transform group-hover:-translate-y-0.5" />
            <span>Higher</span>
          </div>
          <span className="text-[10px] sm:text-[11px] font-normal opacity-90 mt-0.5">Spot &gt; Strike</span>
        </button>

        <button
          type="button"
          data-testid="btn-lower"
          onClick={handleLower}
          disabled={isDisabled}
          className="flex flex-col items-center justify-center py-3 sm:py-3.5 px-3 sm:px-4 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold transition-all shadow-lg shadow-rose-950/20 dark:shadow-rose-950/40 disabled:opacity-40 disabled:cursor-not-allowed group"
        >
          <div className="flex items-center space-x-1 text-xs sm:text-sm uppercase tracking-wide">
            <ArrowDownRight className="h-4 w-4 sm:h-5 sm:w-5 transition-transform group-hover:translate-y-0.5" />
            <span>Lower</span>
          </div>
          <span className="text-[10px] sm:text-[11px] font-normal opacity-90 mt-0.5">Spot &lt; Strike</span>
        </button>
      </div>
    </div>
  );
};
