import React from 'react';
import { ArrowUpRight, ArrowDownRight, AlertTriangle } from 'lucide-react';
import { PendingOrder } from '../types/trading.types';
import { getPriceDecimalPlaces } from '../utils/pricePrecision';

export interface ContractConfirmationModalProps {
  accountMode?: 'real' | 'demo';
  isOpen: boolean;
  pendingOrder: PendingOrder | null;
  isPlacing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ContractConfirmationModal: React.FC<ContractConfirmationModalProps> = ({
  accountMode = 'real',
  isOpen,
  pendingOrder,
  isPlacing,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen || !pendingOrder) return null;

  const isHigher = pendingOrder.contractType === 'higher';
  const formattedPayout = pendingOrder.potentialPayout.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div
      data-testid="confirmation-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/70 backdrop-blur-sm animate-fade-in"
    >
      <div className="w-full max-w-md rounded-2xl bg-bg-light-primary dark:bg-bg-dark-secondary border border-border-light dark:border-border-dark p-6 shadow-2xl text-text-light-primary dark:text-text-dark-primary">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border-light dark:border-border-dark">
          <h3 className="text-lg font-bold text-text-light-primary dark:text-text-dark-primary">
            {accountMode === 'demo' ? 'Confirm DEMO Contract' : 'Confirm Contract Order'}
          </h3>
          <span
            className={`flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold uppercase ${
              isHigher
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
            }`}
          >
            {isHigher ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            <span>{isHigher ? 'HIGHER (CALL)' : 'LOWER (PUT)'}</span>
          </span>
        </div>

        {/* Details Grid */}
        <div className="my-5 space-y-3 bg-bg-light-tertiary/60 dark:bg-bg-dark-tertiary/60 p-4 rounded-xl border border-border-light dark:border-border-dark/60 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-text-light-secondary dark:text-text-dark-secondary">Asset Symbol:</span>
            <span className="font-bold font-mono text-text-light-primary dark:text-text-dark-primary">{pendingOrder.assetSymbol}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-text-light-secondary dark:text-text-dark-secondary">Strike Price:</span>
            <span className="font-semibold font-mono text-emerald-600 dark:text-emerald-400">
              {pendingOrder.strikePrice.toFixed(
                getPriceDecimalPlaces(pendingOrder.assetSymbol, undefined, pendingOrder.strikePrice)
              )}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-text-light-secondary dark:text-text-dark-secondary">Stake Amount:</span>
            <span className="font-semibold font-mono text-text-light-primary dark:text-text-dark-primary">KES {pendingOrder.stake}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-text-light-secondary dark:text-text-dark-secondary">Contract Duration:</span>
            <span className="font-semibold font-mono text-text-light-primary dark:text-text-dark-primary">{pendingOrder.expirySeconds}s</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-text-light-secondary dark:text-text-dark-secondary">Payout Rate:</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              +{(pendingOrder.payoutRate * 100).toFixed(0)}%
            </span>
          </div>

          <div className="pt-2 border-t border-border-light dark:border-border-dark flex justify-between items-center text-base">
            <span className="font-medium text-text-light-primary dark:text-text-dark-primary">Potential Return:</span>
            <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">KES {formattedPayout}</span>
          </div>
        </div>

        {/* Warning Note */}
        <div className="flex items-start space-x-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-700 dark:text-amber-300 text-xs mb-6">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>
            {accountMode === 'demo'
              ? 'This order uses virtual demo funds only. No real money is at risk.'
              : 'Capital at risk. Payouts are granted only if the asset price strictly adheres to your chosen direction at expiry time.'}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            data-testid="cancel-btn"
            onClick={onCancel}
            disabled={isPlacing}
            className="flex-1 py-3 px-4 rounded-xl border border-border-light dark:border-border-dark bg-bg-light-tertiary dark:bg-bg-dark-tertiary hover:bg-bg-light-secondary dark:hover:bg-bg-dark-primary text-text-light-primary dark:text-text-dark-primary font-medium text-sm transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="confirm-btn"
            onClick={onConfirm}
            disabled={isPlacing}
            className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm text-white transition-all shadow-lg ${
              isHigher
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/30'
                : 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/30'
            } disabled:opacity-50`}
          >
            {isPlacing ? 'Placing Order...' : accountMode === 'demo' ? 'Confirm Demo Order' : 'Confirm Order'}
          </button>
        </div>
      </div>
    </div>
  );
};
