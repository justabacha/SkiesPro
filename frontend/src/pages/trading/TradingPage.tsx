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
import { useAccountMode } from '@/shared/context/AccountModeContext';
import { DemoModeBanner } from '@/modules/trading/components/DemoModeBanner';

const getInitialSymbol = (): string => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const urlSymbol = params.get('symbol');
    if (urlSymbol) return urlSymbol;
    const storedSymbol = localStorage.getItem('skies_selected_symbol');
    if (storedSymbol) return storedSymbol;
  }
  return 'EUR/USD';
};

export const TradingPage: React.FC = () => {
  const { balance } = useWallet();
  const { accountMode } = useAccountMode();
  const [activeBottomTab, setActiveBottomTab] = useState<'positions' | 'history'>('positions');

  const initialSymbol = useMemo(() => getInitialSymbol(), []);

  const { currentPrice, isPriceAvailable, priceHistory, latencyState, subscribeToSymbol } =
    usePriceStream(initialSymbol);

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
    requestTradeConfirmation,
    settlementEvents,
    dismissSettlementEvent,
  } = useTrading(initialSymbol);

  const handleSelectAsset = (symbol: string) => {
    selectAsset(symbol);
    subscribeToSymbol(symbol);
    if (typeof window !== 'undefined') {
      localStorage.setItem('skies_selected_symbol', symbol);
      const url = new URL(window.location.href);
      url.searchParams.set('symbol', symbol);
      window.history.replaceState({}, '', url.toString());
    }
  };

  const numericBalance = useMemo(() => {
    if (!balance) return 0;
    if (typeof balance === 'object' && balance !== null) {
      const bObj = balance as { available_balance?: string; balance?: string };
      const val = bObj.available_balance || bObj.balance;
      return parseFloat(val || '0') || 0;
    }
    if (typeof balance === 'number') return balance;
    if (typeof balance === 'string') return parseFloat(balance) || 0;
    return 0;
  }, [balance]);

  const currentPricesMap = useMemo(() => {
    if (!selectedAsset) return {};
    return { [selectedAsset.symbol]: currentPrice };
  }, [selectedAsset, currentPrice]);
  const tradingAssets = useMemo(
    () =>
      accountMode === 'demo'
        ? assets.map((asset) => ({ ...asset, isOpen: true, isActive: true }))
        : assets,
    [accountMode, assets]
  );
  const tradingAsset = useMemo(
    () =>
      selectedAsset && accountMode === 'demo'
        ? { ...selectedAsset, isOpen: true, isActive: true }
        : selectedAsset,
    [accountMode, selectedAsset]
  );

  return (
    <div className="min-h-screen w-full min-w-0 bg-bg-light-primary dark:bg-bg-dark-primary text-text-light-primary dark:text-text-dark-primary p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-6 transition-colors duration-200">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border-light dark:border-border-dark">
        <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-4">
          <AssetSelector
            assets={tradingAssets}
            selectedAsset={tradingAsset}
            onSelectAsset={handleSelectAsset}
            currentPrice={currentPrice}
          />
          <LatencyIndicator latencyState={latencyState} />
        </div>

        <div className="flex w-fit max-w-full items-center space-x-4 bg-bg-light-secondary dark:bg-bg-dark-secondary px-4 py-2.5 rounded-xl border border-border-light dark:border-border-dark shadow-sm">
          <Wallet className="h-5 w-5 text-brand" />
          <div>
            <span className="text-[11px] text-text-light-secondary dark:text-text-dark-secondary uppercase font-semibold block">
              {accountMode === 'demo' ? 'Demo Available Balance' : 'Available Balance'}
            </span>
            <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
              KES{' '}
              {numericBalance.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>
      </div>

      {accountMode === 'demo' && <DemoModeBanner />}

      {/* Settlement Flash Banner Event Notifications */}
      {settlementEvents.length > 0 && (
        <div className="space-y-2">
          {settlementEvents.map((event) => (
            <div
              key={event.contractId}
              className={`flex items-center justify-between p-3.5 rounded-xl border text-sm font-semibold animate-bounce ${
                event.outcome === 'won'
                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                  : event.outcome === 'draw'
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40'
                    : 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40'
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
                className="text-xs px-2 py-1 bg-black/10 dark:bg-black/30 rounded hover:bg-black/20 dark:hover:bg-black/50"
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Trading Terminal Grid */}
      <div className="flex min-w-0 flex-col gap-4 lg:grid lg:grid-cols-3 lg:gap-6">
        {/* Chart Column (2 Spans) */}
        <div className="min-w-0 lg:col-span-2">
          <TradingChart
            symbol={selectedAsset?.symbol || 'EUR/USD'}
            priceHistory={priceHistory}
            currentPrice={currentPrice}
            activeContracts={activeContracts}
            pipDecimalPlaces={selectedAsset?.pipDecimalPlaces}
          />
        </div>

        {/* Order Placement Form Column (1 Span) */}
        <div className="min-w-0 lg:col-span-1">
          <OrderForm
            accountMode={accountMode}
            asset={tradingAsset}
            selectedSymbol={selectedAsset?.symbol || initialSymbol}
            currentPrice={currentPrice}
            isPriceAvailable={isPriceAvailable}
            userBalance={numericBalance}
            isPlacingTrade={isPlacingTrade}
            onPlaceTrade={(contractType, stake, expirySeconds, _symbol, strikePrice) => {
              requestTradeConfirmation(contractType, stake, expirySeconds, strikePrice);
            }}
            tradeError={tradeError}
            onClearError={clearTradeError}
          />
        </div>
      </div>

      {/* Bottom Positions & History Section */}
      <div className="space-y-4 pt-4 border-t border-border-light dark:border-border-dark">
        <div className="flex max-w-full items-center space-x-2 overflow-x-auto border-b border-border-light dark:border-border-dark pb-2">
          <button
            type="button"
            onClick={() => setActiveBottomTab('positions')}
            className={`flex shrink-0 items-center space-x-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              activeBottomTab === 'positions'
                ? 'bg-brand text-white shadow-md shadow-brand/20'
                : 'text-text-light-secondary dark:text-text-dark-secondary hover:bg-bg-light-tertiary dark:hover:bg-bg-dark-tertiary'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Active Positions ({activeContracts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveBottomTab('history')}
            className={`flex shrink-0 items-center space-x-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              activeBottomTab === 'history'
                ? 'bg-brand text-white shadow-md shadow-brand/20'
                : 'text-text-light-secondary dark:text-text-dark-secondary hover:bg-bg-light-tertiary dark:hover:bg-bg-dark-tertiary'
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
        accountMode={accountMode}
        isOpen={isConfirmModalOpen}
        pendingOrder={pendingOrder}
        isPlacing={isPlacingTrade}
        onConfirm={confirmPendingOrder}
        onCancel={cancelPendingOrder}
      />

      <footer className="pt-2 text-right text-[10px] text-text-light-secondary dark:text-text-dark-secondary">
        Lightweight Charts™ by{' '}
        <a
          className="hover:underline"
          href="https://www.tradingview.com/"
          target="_blank"
          rel="noreferrer"
        >
          TradingView
        </a>
      </footer>
    </div>
  );
};
