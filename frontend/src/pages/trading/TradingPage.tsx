import React, { useState, useMemo } from 'react';
import { useWallet } from '@/shared/hooks/useWallet';
import { usePriceStream } from '@/modules/trading/hooks/usePriceStream';
import { useTrading } from '@/modules/trading/hooks/useTrading';
import { AssetSelector } from '@/modules/trading/components/AssetSelector';
import { LatencyIndicator } from '@/modules/trading/components/LatencyIndicator';
import { TradingChart } from '@/modules/trading/components/TradingChart';
import { OrderForm } from '@/modules/trading/components/OrderForm';
import { OpenPositions } from '@/modules/trading/components/OpenPositions';
import { TradeHistory } from '@/modules/trading/components/TradeHistory';
import { ContractConfirmationModal } from '@/modules/trading/components/ContractConfirmationModal';
import { CheckCircle2, Wallet, Layers, History } from 'lucide-react';

export const TradingPage: React.FC = () => {
  const { balance } = useWallet();
  const [activeBottomTab, setActiveBottomTab] = useState<'positions' | 'history'>('positions');

  const {
    currentPrice,
    priceHistory,
    latencyState,
    subscribeToSymbol,
  } = usePriceStream('EUR/USD');

  const {
    assets,
    selectedAsset,
    selectAsset,
    activeContracts,
    isLoadingActive,
    tradeHistory,
    isLoadingHistory,
    isPlacingTrade,
    tradeError,
    clearTradeError,
    pendingOrder,
    isConfirmModalOpen,
    confirmPendingOrder,
    cancelPendingOrder,
    executeDirectTrade,
    settlementEvents,
    dismissSettlementEvent,
  } = useTrading('EUR/USD');

  const handleSelectAsset = (symbol: string) => {
    selectAsset(symbol);
    subscribeToSymbol(symbol);
  };

  const numericBalance = useMemo(() => {
    if (typeof balance === 'number') return balance;
    if (typeof balance === 'string') return parseFloat(balance) || 0;
    return 0;
  }, [balance]);

  const currentPricesMap = useMemo(() => {
    if (!selectedAsset) return {};
    return { [selectedAsset.symbol]: currentPrice };
  }, [selectedAsset, currentPrice]);

  return (
    <div className="min-h-screen bg-[#0F1117] text-text-dark p-4 md:p-6 lg:p-8 space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border-dark">
        <div className="flex items-center space-x-4">
          <AssetSelector
            assets={assets}
            selectedAsset={selectedAsset}
            onSelectAsset={handleSelectAsset}
            currentPrice={currentPrice}
          />
          <LatencyIndicator latencyState={latencyState} />
        </div>

        <div className="flex items-center space-x-4 bg-bg-dark-secondary px-4 py-2.5 rounded-xl border border-border-dark">
          <Wallet className="h-5 w-5 text-brand" />
          <div>
            <span className="text-[11px] text-text-dark-secondary uppercase font-semibold block">
              Available Balance
            </span>
            <span className="text-base font-bold font-mono text-emerald-400">
              KES {numericBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Settlement Flash Banner Event Notifications */}
      {settlementEvents.length > 0 && (
        <div className="space-y-2">
          {settlementEvents.map((event) => (
            <div
              key={event.contractId}
              className={`flex items-center justify-between p-3.5 rounded-xl border text-sm font-semibold animate-bounce ${
                event.outcome === 'won'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : event.outcome === 'draw'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              }`}
            >
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="h-5 w-5" />
                <span>
                  Trade Settled: Contract #{event.contractId.slice(0, 8)} ended as{' '}
                  <strong className="uppercase">{event.outcome}</strong>
                  {event.payoutAmount > 0 ? ` (+KES ${event.payoutAmount.toFixed(2)})` : ''}!
                </span>
              </div>
              <button
                type="button"
                onClick={() => dismissSettlementEvent(event.contractId)}
                className="text-xs px-2 py-1 bg-black/30 rounded hover:bg-black/50"
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Trading Terminal Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Column (2 Spans) */}
        <div className="lg:col-span-2">
          <TradingChart
            symbol={selectedAsset?.symbol || 'EUR/USD'}
            priceHistory={priceHistory}
            currentPrice={currentPrice}
            activeContracts={activeContracts}
          />
        </div>

        {/* Order Placement Form Column (1 Span) */}
        <div className="lg:col-span-1">
          <OrderForm
            asset={selectedAsset}
            currentPrice={currentPrice}
            userBalance={numericBalance}
            isPlacingTrade={isPlacingTrade}
            onPlaceTrade={(contractType, stake, expirySeconds) => {
              executeDirectTrade(contractType, stake, expirySeconds);
            }}
            tradeError={tradeError}
            onClearError={clearTradeError}
          />
        </div>
      </div>

      {/* Bottom Positions & History Section */}
      <div className="space-y-4 pt-4 border-t border-border-dark">
        <div className="flex items-center space-x-2 border-b border-border-dark pb-2">
          <button
            type="button"
            onClick={() => setActiveBottomTab('positions')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              activeBottomTab === 'positions'
                ? 'bg-brand text-white shadow-md shadow-brand/20'
                : 'text-text-dark-secondary hover:bg-bg-dark-tertiary'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Active Positions ({activeContracts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveBottomTab('history')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              activeBottomTab === 'history'
                ? 'bg-brand text-white shadow-md shadow-brand/20'
                : 'text-text-dark-secondary hover:bg-bg-dark-tertiary'
            }`}
          >
            <History className="h-4 w-4" />
            <span>Trade History ({tradeHistory.length})</span>
          </button>
        </div>

        {activeBottomTab === 'positions' ? (
          <OpenPositions
            contracts={activeContracts}
            currentPrices={currentPricesMap}
            isLoading={isLoadingActive}
          />
        ) : (
          <TradeHistory contracts={tradeHistory} isLoading={isLoadingHistory} />
        )}
      </div>

      {/* Trade Order Confirmation Modal */}
      <ContractConfirmationModal
        isOpen={isConfirmModalOpen}
        pendingOrder={pendingOrder}
        isPlacing={isPlacingTrade}
        onConfirm={confirmPendingOrder}
        onCancel={cancelPendingOrder}
      />
    </div>
  );
};
