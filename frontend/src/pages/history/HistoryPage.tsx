import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { FilterTabs, TableEmpty, TableLoading, ToastContainer } from '@/shared/components';
import type { ToastProps } from '@/shared/components/Toast';
import { useAccountMode } from '@/shared/context/AccountModeContext';
import { useTrading } from '@/modules/trading/hooks/useTrading';
import { TradeHistory } from '@/modules/trading/components/TradeHistory';
import type { BinaryContract } from '@/modules/trading/types/trading.types';
import { exportToCsv } from '@/shared/utils/csvExporter';

const PAGE_SIZE = 20;
const EXPORT_MAX_PAGES = 20;
const ALL_ASSETS = 'all';

type StatusFilter = 'all' | 'active' | 'won' | 'lost' | 'draw' | 'cancelled';

const STATUS_TABS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
  { id: 'draw', label: 'Draw' },
  { id: 'cancelled', label: 'Cancelled' },
] as const;

const CSV_COLUMNS: {
  key: keyof BinaryContract;
  header: string;
}[] = [
  { key: 'id', header: 'id' },
  { key: 'asset_symbol', header: 'asset_symbol' },
  { key: 'contract_type', header: 'contract_type' },
  { key: 'stake', header: 'stake' },
  { key: 'strike_price', header: 'strike_price' },
  { key: 'expiry_price', header: 'expiry_price' },
  { key: 'payout_rate', header: 'payout_rate' },
  { key: 'potential_payout', header: 'potential_payout' },
  { key: 'purchase_time', header: 'purchase_time' },
  { key: 'expiry_time', header: 'expiry_time' },
  { key: 'status', header: 'status' },
  { key: 'settled_at', header: 'settled_at' },
];

const matchesFilters = (
  contract: BinaryContract,
  status: StatusFilter,
  assetSymbol: string
): boolean =>
  (status === 'all' || contract.status === status) &&
  (assetSymbol === ALL_ASSETS || contract.asset_symbol === assetSymbol);

export const HistoryPage: React.FC = () => {
  const { accountMode } = useAccountMode();
  const { tradeHistory, getContracts } = useTrading();
  const [contracts, setContracts] = useState<BinaryContract[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [assetFilter, setAssetFilter] = useState(ALL_ASSETS);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [pageCursor, setPageCursor] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState<{ cursor?: string; append: boolean }>();
  const [newCount, setNewCount] = useState(0);
  const [isAtTop, setIsAtTop] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [toasts, setToasts] = useState<Omit<ToastProps, 'onClose'>[]>([]);
  const requestSequence = useRef(0);
  const requestController = useRef<AbortController | null>(null);
  const previousLiveContracts = useRef<Map<string, BinaryContract> | null>(null);
  const liveContracts = useRef(tradeHistory);
  const liveMode = useRef(accountMode);
  const filtersRef = useRef({ status: statusFilter, assetSymbol: assetFilter });
  filtersRef.current = { status: statusFilter, assetSymbol: assetFilter };
  liveContracts.current = tradeHistory;

  const addToast = useCallback((message: string, type: ToastProps['type']) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((current) => [...current, { id, message, type }]);
  }, []);

  const loadPage = useCallback(
    async (cursor: string | undefined, append: boolean) => {
      const sequence = ++requestSequence.current;
      requestController.current?.abort();
      const controller = new AbortController();
      requestController.current = controller;
      if (append) setIsLoadingMore(true);
      else setIsLoading(true);
      setError(null);
      setRetry(undefined);

      try {
        const result = await getContracts(
          {
            status: statusFilter === 'all' ? undefined : statusFilter,
            asset_symbol: assetFilter === ALL_ASSETS ? undefined : assetFilter,
            limit: PAGE_SIZE,
            cursor,
          },
          controller.signal
        );
        if (sequence !== requestSequence.current) return;

        const liveMatches = liveContracts.current.filter((contract) =>
          matchesFilters(contract, statusFilter, assetFilter)
        );
        setContracts((current) => {
          const merged = append ? [...current, ...result] : [...liveMatches, ...result];
          const unique = new Map<string, BinaryContract>();
          merged.forEach((contract) => unique.set(contract.id, contract));
          return Array.from(unique.values()).sort(
            (left, right) =>
              new Date(right.purchase_time).getTime() - new Date(left.purchase_time).getTime()
          );
        });
        const lastContract = result[result.length - 1];
        setPageCursor(lastContract?.purchase_time);
        setHasMore(result.length === PAGE_SIZE);
      } catch (loadError) {
        if (sequence !== requestSequence.current) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load trade history.');
        setRetry({ cursor, append });
      } finally {
        if (sequence === requestSequence.current) {
          requestController.current = null;
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [assetFilter, getContracts, statusFilter]
  );

  useEffect(() => {
    requestSequence.current += 1;
    requestController.current?.abort();
    requestController.current = null;
    setContracts([]);
    setPageCursor(undefined);
    setHasMore(false);
    setNewCount(0);
    void loadPage(undefined, false);
    return () => {
      requestSequence.current += 1;
      requestController.current?.abort();
    };
  }, [accountMode, loadPage]);

  useEffect(() => {
    const handleScroll = () => setIsAtTop(window.scrollY <= 0);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (liveMode.current !== accountMode) {
      liveMode.current = accountMode;
      previousLiveContracts.current = null;
      return;
    }

    const previousContracts = previousLiveContracts.current;
    const currentContracts = new Map(tradeHistory.map((contract) => [contract.id, contract]));
    previousLiveContracts.current = currentContracts;
    const { status, assetSymbol } = filtersRef.current;
    const matchingLive = tradeHistory.filter((contract) =>
      matchesFilters(contract, status, assetSymbol)
    );

    if (previousContracts === null) {
      setContracts((current) => {
        const merged = [...matchingLive, ...current];
        const unique = new Map<string, BinaryContract>();
        merged.forEach((contract) => unique.set(contract.id, contract));
        return Array.from(unique.values()).sort(
          (left, right) =>
            new Date(right.purchase_time).getTime() - new Date(left.purchase_time).getTime()
        );
      });
      return;
    }

    const newContracts = matchingLive.filter((contract) => {
      const previous = previousContracts.get(contract.id);
      return !previous || (previous.status === 'active' && contract.status !== 'active');
    });
    const liveById = currentContracts;
    setContracts((current) => {
      const updated = current
        .map((contract) => liveById.get(contract.id) || contract)
        .filter((contract) => {
          const liveContract = liveById.get(contract.id);
          return !liveContract || matchesFilters(liveContract, status, assetSymbol);
        });
      const currentIds = new Set(updated.map((contract) => contract.id));
      const additions = newContracts.filter(
        (contract) => !currentIds.has(contract.id)
      );
      updated.unshift(...additions);
      return updated.sort(
        (left, right) =>
          new Date(right.purchase_time).getTime() - new Date(left.purchase_time).getTime()
      );
    });

    const unseenCount = newContracts.length;
    if (unseenCount > 0 && !isAtTop) {
      setNewCount((count) => count + unseenCount);
    }
  }, [accountMode, isAtTop, tradeHistory]);

  const assetSymbols = useMemo(
    () =>
      Array.from(
        new Set([...tradeHistory, ...contracts].map((contract) => contract.asset_symbol))
      ).sort((left, right) => left.localeCompare(right)),
    [contracts, tradeHistory]
  );

  const loadMore = () => {
    if (pageCursor) void loadPage(pageCursor, true);
  };

  const retryLoad = () => {
    if (retry) void loadPage(retry.cursor, retry.append);
  };

  const exportHistory = async () => {
    setIsExporting(true);
    try {
      const rows: BinaryContract[] = [];
      let cursor: string | undefined;
      let reachedCap = false;

      for (let page = 0; page < EXPORT_MAX_PAGES; page += 1) {
        const batch = await getContracts({
          status: statusFilter === 'all' ? undefined : statusFilter,
          asset_symbol: assetFilter === ALL_ASSETS ? undefined : assetFilter,
          limit: PAGE_SIZE,
          cursor,
        });
        rows.push(...batch);
        if (batch.length < PAGE_SIZE) break;
        cursor = batch[batch.length - 1]?.purchase_time;
        if (page === EXPORT_MAX_PAGES - 1) {
          const probe = await getContracts({
            status: statusFilter === 'all' ? undefined : statusFilter,
            asset_symbol: assetFilter === ALL_ASSETS ? undefined : assetFilter,
            limit: 1,
            cursor,
          });
          reachedCap = probe.length > 0;
        }
      }

      const date = new Date().toISOString().slice(0, 10);
      exportToCsv(rows, CSV_COLUMNS, `trade-history-${accountMode}-${date}.csv`);
      if (reachedCap) {
        addToast(
          `Exported first ${rows.length} trades. Narrow filters for a complete export.`,
          'warning'
        );
      }
    } catch (exportError) {
      addToast(
        exportError instanceof Error ? exportError.message : 'Unable to export trade history.',
        'danger'
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 text-text-light-primary dark:text-text-dark-primary sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Trade History</h1>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                accountMode === 'demo'
                  ? 'bg-bg-light-tertiary dark:bg-bg-dark-tertiary text-text-light-secondary dark:text-text-dark-secondary'
                  : 'bg-bg-light-secondary dark:bg-bg-dark-secondary text-text-light-primary dark:text-text-dark-primary'
              }`}
            >
              {accountMode === 'demo' ? 'Demo' : 'Real'}
            </span>
          </div>
          <p className="mt-1 text-sm text-text-light-secondary dark:text-text-dark-secondary">
            Review your trades and settlement outcomes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void exportHistory()}
          disabled={isExporting}
          className="inline-flex items-center gap-2 rounded-lg border border-border-light dark:border-border-dark bg-bg-light-secondary dark:bg-bg-dark-secondary text-text-light-primary dark:text-text-dark-primary px-4 py-2 text-sm font-semibold hover:bg-bg-light-tertiary dark:hover:bg-bg-dark-tertiary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {isExporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </header>

      <section className="space-y-4 rounded-xl border border-border-light dark:border-border-dark bg-bg-light-secondary dark:bg-bg-dark-secondary p-4">
        <FilterTabs
          tabs={STATUS_TABS}
          activeTab={statusFilter}
          onChange={(tab) => setStatusFilter(tab as StatusFilter)}
          variant="pills"
          className="flex-wrap"
        />
        <label className="flex flex-wrap items-center gap-3 text-sm text-text-light-secondary dark:text-text-dark-secondary">
          Asset
          <select
            aria-label="Filter by asset"
            value={assetFilter}
            onChange={(event) => setAssetFilter(event.target.value)}
            className="min-w-48 rounded-lg border border-border-light dark:border-border-dark bg-bg-light-primary dark:bg-bg-dark-primary px-3 py-2 text-text-light-primary dark:text-text-dark-primary"
          >
            <option value={ALL_ASSETS}>All assets</option>
            {assetSymbols.map((symbol) => (
              <option key={symbol} value={symbol}>
                {symbol}
              </option>
            ))}
          </select>
        </label>
      </section>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-light dark:border-border-dark bg-bg-light-secondary dark:bg-bg-dark-secondary p-4 text-sm text-text-light-secondary dark:text-text-dark-secondary"
        >
          <span>Unable to load trade history: {error}</span>
          <button
            type="button"
            onClick={retryLoad}
            className="inline-flex items-center gap-2 rounded-md border border-border-light dark:border-border-dark px-3 py-1.5 font-semibold hover:bg-bg-light-tertiary dark:hover:bg-bg-dark-tertiary"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      )}

      {newCount > 0 && !isAtTop && (
        <button
          type="button"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setNewCount(0);
          }}
          className="rounded-full bg-bg-light-tertiary dark:bg-bg-dark-tertiary px-4 py-2 text-sm font-semibold text-text-light-primary dark:text-text-dark-primary shadow-lg"
        >
          {newCount} new
        </button>
      )}

      {isLoading ? (
        <TableLoading message="Loading trade history..." />
      ) : contracts.length === 0 ? (
        <TableEmpty title="No trades in this mode yet." />
      ) : (
        <>
          <TradeHistory contracts={contracts} isLoading={false} />
          {isLoadingMore && <TableLoading message="Loading more trades..." />}
          {hasMore && !isLoadingMore && (
            <div className="text-center">
              <button
                type="button"
                onClick={loadMore}
                className="rounded-lg border border-border-light dark:border-border-dark bg-bg-light-secondary dark:bg-bg-dark-secondary text-text-light-primary dark:text-text-dark-primary px-5 py-2.5 text-sm font-semibold hover:bg-bg-light-tertiary dark:hover:bg-bg-dark-tertiary"
              >
                Load more
              </button>
            </div>
          )}
        </>
      )}

      <ToastContainer toasts={toasts} setToasts={setToasts} />
    </main>
  );
};
