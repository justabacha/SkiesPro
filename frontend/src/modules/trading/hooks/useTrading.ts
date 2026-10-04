import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '@/shared/hooks/useWallet';
import { useAuth } from '@/shared/hooks/useAuth';
import { tradingService } from '../services/tradingService';
import { useAccountMode } from '@/shared/context/AccountModeContext';
import {
  Asset,
  BinaryContract,
  ContractType,
  CreateContractDto,
  PendingOrder,
} from '../types/trading.types';

// Helper to generate UUID v4 for idempotency
const generateUuidV4 = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const isUnauthorizedError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) return false;
  return (
    ('status' in error && error.status === 401) ||
    ('message' in error &&
      typeof error.message === 'string' &&
      error.message.includes('Unauthorized'))
  );
};

export interface SettlementEvent {
  contractId: string;
  outcome: 'won' | 'lost' | 'draw';
  payoutAmount: number;
  timestamp: number;
}

export interface UseTradingReturn {
  assets: Asset[];
  selectedAsset: Asset | null;
  selectAsset: (symbol: string) => void;
  isLoadingAssets: boolean;

  activeContracts: BinaryContract[];
  isLoadingActive: boolean;
  fetchActiveContracts: () => Promise<void>;

  tradeHistory: BinaryContract[];
  isLoadingHistory: boolean;
  fetchTradeHistory: () => Promise<void>;

  isPlacingTrade: boolean;
  tradeError: string | null;
  clearTradeError: () => void;

  pendingOrder: PendingOrder | null;
  isConfirmModalOpen: boolean;
  requestTradeConfirmation: (
    contractType: ContractType,
    stake: string,
    expirySeconds: number,
    currentPrice: number
  ) => void;
  confirmPendingOrder: () => Promise<BinaryContract | null>;
  cancelPendingOrder: () => void;

  executeDirectTrade: (
    contractType: ContractType,
    stake: string,
    expirySeconds: number,
    assetSymbol: string | undefined,
    strikePrice: number
  ) => Promise<BinaryContract | null>;

  settlementEvents: SettlementEvent[];
  dismissSettlementEvent: (contractId: string) => void;
}

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

export const useTrading = (initialSymbol?: string): UseTradingReturn => {
  const activeSymbol = initialSymbol || getInitialSymbol();
  const { fetchBalance } = useWallet();
  const { isAuthenticated, user } = useAuth();
  const {
    accountMode,
    generation,
    isCurrentGeneration,
    registerModeCleanup,
    setPendingOrderActive,
  } = useAccountMode();
  const userId = user?.id || null;

  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isLoadingAssets, setIsLoadingAssets] = useState<boolean>(true);

  const [activeContracts, setActiveContracts] = useState<BinaryContract[]>([]);
  const [isLoadingActive, setIsLoadingActive] = useState<boolean>(false);

  const [tradeHistory, setTradeHistory] = useState<BinaryContract[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  const [isPlacingTrade, setIsPlacingTrade] = useState<boolean>(false);
  const [tradeError, setTradeError] = useState<string | null>(null);

  const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);

  const [settlementEvents, setSettlementEvents] = useState<SettlementEvent[]>([]);

  const previousActiveIdsRef = useRef<Set<string>>(new Set());
  const hasLoadedActiveRef = useRef<boolean>(false);
  const hasLoadedHistoryRef = useRef<boolean>(false);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRequestRef = useRef<AbortController | null>(null);
  const historyRequestRef = useRef<AbortController | null>(null);
  const tradeRequestRef = useRef<AbortController | null>(null);

  useEffect(
    () =>
      registerModeCleanup(() => {
        activeRequestRef.current?.abort();
        historyRequestRef.current?.abort();
        tradeRequestRef.current?.abort();
        activeRequestRef.current = null;
        historyRequestRef.current = null;
        tradeRequestRef.current = null;
        setActiveContracts([]);
        setTradeHistory([]);
        setSettlementEvents([]);
        setPendingOrder(null);
        setIsConfirmModalOpen(false);
        setIsPlacingTrade(false);
        setIsLoadingActive(false);
        setIsLoadingHistory(false);
        setTradeError(null);
        setPendingOrderActive(false);
        previousActiveIdsRef.current.clear();
        hasLoadedActiveRef.current = false;
        hasLoadedHistoryRef.current = false;
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      }),
    [registerModeCleanup, setPendingOrderActive]
  );

  useEffect(() => () => setPendingOrderActive(false), [setPendingOrderActive]);

  useEffect(
    () => () => {
      activeRequestRef.current?.abort();
      historyRequestRef.current?.abort();
      tradeRequestRef.current?.abort();
    },
    []
  );

  // Load assets on mount
  useEffect(() => {
    let isMounted = true;

    const loadAssets = async () => {
      setIsLoadingAssets(true);
      try {
        const list = await tradingService.getAssets();
        if (isMounted) {
          setAssets(list);
          const current = list.find((a) => a.symbol === activeSymbol) || list[0] || null;
          setSelectedAsset(current);
        }
      } catch (err) {
        console.error('Failed to load assets:', err);
      } finally {
        if (isMounted) setIsLoadingAssets(false);
      }
    };

    loadAssets();

    return () => {
      isMounted = false;
    };
  }, [activeSymbol]);

  // Select asset handler
  const selectAsset = useCallback(
    (symbol: string) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('skies_selected_symbol', symbol);
      }
      const found = assets.find((a) => a.symbol === symbol);
      if (found) {
        setSelectedAsset(found);
      } else {
        // Create dynamic asset
        setSelectedAsset({
          symbol,
          name: symbol,
          isActive: true,
          payoutRate: 0.6,
          minStake: 100,
          maxStake: 50000,
          minExpirySeconds: 60,
          maxExpirySeconds: 900,
          isOpen: true,
        });
      }
    },
    [assets]
  );

  // Fetch active contracts
  const fetchActiveContracts = useCallback(
    async (isInitial = false) => {
      if (!isAuthenticated) return;
      activeRequestRef.current?.abort();
      const controller = new AbortController();
      activeRequestRef.current = controller;
      const requestGeneration = generation;
      const requestMode = accountMode;
      const requestUser = userId;
      if (isInitial || !hasLoadedActiveRef.current) {
        setIsLoadingActive(true);
      }
      try {
        const active = await tradingService.getActiveContracts(requestMode, controller.signal);
        if (!isCurrentGeneration(requestGeneration, requestMode, requestUser)) return;
        setActiveContracts(active);
        hasLoadedActiveRef.current = true;

        const currentActiveIds = new Set(active.map((c) => c.id));
        const previousIds = previousActiveIdsRef.current;

        // Check if any previously active contract has disappeared (settled)
        if (previousIds.size > 0) {
          const settledIds = Array.from(previousIds).filter((id) => !currentActiveIds.has(id));
          if (settledIds.length > 0) {
            // Refresh trade history and wallet balance
            void fetchBalance();
            historyRequestRef.current?.abort();
            const historyController = new AbortController();
            historyRequestRef.current = historyController;
            const history = await tradingService.getContracts(
              { limit: 10 },
              requestMode,
              historyController.signal
            );
            if (!isCurrentGeneration(requestGeneration, requestMode, requestUser)) return;
            setTradeHistory(history);

            // Trigger settlement event animations
            settledIds.forEach((id) => {
              const settledContract = history.find((c) => c.id === id);
              if (settledContract) {
                const outcome =
                  settledContract.status === 'won'
                    ? 'won'
                    : settledContract.status === 'draw'
                      ? 'draw'
                      : 'lost';
                const payoutAmount = Number(settledContract.potential_payout || '0');

                setSettlementEvents((prev) => [
                  ...prev.filter((e) => e.contractId !== id),
                  {
                    contractId: id,
                    outcome,
                    payoutAmount: outcome === 'won' ? payoutAmount : 0,
                    timestamp: Date.now(),
                  },
                ]);
              }
            });
          }
        }

        previousActiveIdsRef.current = currentActiveIds;
      } catch (err: unknown) {
        if ((err as Error).name === 'AbortError') return;
        console.warn('Failed to fetch active contracts:', err);
        if (isUnauthorizedError(err)) {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
      } finally {
        if (
          activeRequestRef.current === controller &&
          isCurrentGeneration(requestGeneration, requestMode, requestUser)
        ) {
          activeRequestRef.current = null;
          setIsLoadingActive(false);
        }
      }
    },
    [accountMode, fetchBalance, generation, isAuthenticated, isCurrentGeneration, userId]
  );

  // Fetch trade history
  const fetchTradeHistory = useCallback(
    async (isInitial = false) => {
      if (!isAuthenticated) return;
      historyRequestRef.current?.abort();
      const controller = new AbortController();
      historyRequestRef.current = controller;
      const requestGeneration = generation;
      const requestMode = accountMode;
      const requestUser = userId;
      if (isInitial || !hasLoadedHistoryRef.current) {
        setIsLoadingHistory(true);
      }
      try {
        const history = await tradingService.getContracts(
          { limit: 20 },
          requestMode,
          controller.signal
        );
        if (!isCurrentGeneration(requestGeneration, requestMode, requestUser)) return;
        setTradeHistory(history);
        hasLoadedHistoryRef.current = true;
      } catch (err: unknown) {
        if ((err as Error).name === 'AbortError') return;
        console.warn('Failed to fetch trade history:', err);
        if (isUnauthorizedError(err)) {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
      } finally {
        if (
          historyRequestRef.current === controller &&
          isCurrentGeneration(requestGeneration, requestMode, requestUser)
        ) {
          historyRequestRef.current = null;
          setIsLoadingHistory(false);
        }
      }
    },
    [accountMode, generation, isAuthenticated, isCurrentGeneration, userId]
  );

  // Poll active contracts periodically when authenticated
  useEffect(() => {
    setActiveContracts([]);
    setTradeHistory([]);
    setSettlementEvents([]);
    setPendingOrder(null);
    setIsConfirmModalOpen(false);
    setPendingOrderActive(false);
    setIsPlacingTrade(false);
    setIsLoadingActive(false);
    setIsLoadingHistory(false);
    setTradeError(null);
    previousActiveIdsRef.current.clear();
    hasLoadedActiveRef.current = false;
    hasLoadedHistoryRef.current = false;
    if (!isAuthenticated) {
      setActiveContracts([]);
      setTradeHistory([]);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    fetchActiveContracts(true);
    fetchTradeHistory(true);

    pollingIntervalRef.current = setInterval(() => {
      fetchActiveContracts(false);
      fetchTradeHistory(false);
    }, 3000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [
    accountMode,
    fetchActiveContracts,
    fetchTradeHistory,
    generation,
    isAuthenticated,
    setPendingOrderActive,
    userId,
  ]);

  const clearTradeError = useCallback(() => {
    setTradeError(null);
  }, []);

  // Prepare confirmation modal
  const requestTradeConfirmation = useCallback(
    (contractType: ContractType, stake: string, expirySeconds: number, currentPrice: number) => {
      if (!selectedAsset || !Number.isFinite(currentPrice) || currentPrice <= 0) {
        setTradeError('MARKET_DATA_UNAVAILABLE');
        return;
      }

      const numericStake = parseFloat(stake);
      const payoutRate = selectedAsset.payoutRate || 0.6;
      const potentialPayout = Number((numericStake * (1 + payoutRate)).toFixed(2));

      setPendingOrder({
        assetSymbol: selectedAsset.symbol,
        contractType,
        stake,
        expirySeconds,
        strikePrice: currentPrice,
        payoutRate,
        potentialPayout,
      });
      setIsConfirmModalOpen(true);
      setPendingOrderActive(true);
    },
    [selectedAsset, setPendingOrderActive]
  );

  // Submit direct or confirmed trade
  const submitTradeInternal = async (dto: CreateContractDto): Promise<BinaryContract | null> => {
    if (isPlacingTrade) return null;
    const requestGeneration = generation;
    const requestMode = accountMode;
    const requestUser = userId;

    setIsPlacingTrade(true);
    setTradeError(null);

    const idempotencyKey = generateUuidV4();
    tradeRequestRef.current?.abort();
    const controller = new AbortController();
    tradeRequestRef.current = controller;

    try {
      const contract = await tradingService.placeTrade(
        dto,
        idempotencyKey,
        requestMode,
        controller.signal
      );
      if (!isCurrentGeneration(requestGeneration, requestMode, requestUser)) return null;

      // Refresh wallet and active contracts list
      void fetchBalance();
      await fetchActiveContracts();

      return contract;
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return null;
      const message = err instanceof Error ? err.message : 'Trade execution failed';
      if (isCurrentGeneration(requestGeneration, requestMode, requestUser)) setTradeError(message);
      return null;
    } finally {
      if (
        tradeRequestRef.current === controller &&
        isCurrentGeneration(requestGeneration, requestMode, requestUser)
      ) {
        tradeRequestRef.current = null;
        setIsPlacingTrade(false);
      }
    }
  };

  // Confirm pending order from modal
  const confirmPendingOrder = async (): Promise<BinaryContract | null> => {
    if (!pendingOrder) return null;

    const dto: CreateContractDto = {
      assetSymbol: pendingOrder.assetSymbol,
      contractType: pendingOrder.contractType,
      stake: pendingOrder.stake,
      expirySeconds: pendingOrder.expirySeconds,
      strikePrice: pendingOrder.strikePrice,
    };

    setIsConfirmModalOpen(false);
    setPendingOrderActive(false);
    const result = await submitTradeInternal(dto);
    setPendingOrder(null);
    return result;
  };

  const cancelPendingOrder = useCallback(() => {
    setIsConfirmModalOpen(false);
    setPendingOrder(null);
    setPendingOrderActive(false);
  }, [setPendingOrderActive]);

  // Direct trade without confirmation modal
  const executeDirectTrade = async (
    contractType: ContractType,
    stake: string,
    expirySeconds: number,
    assetSymbol?: string,
    strikePrice?: number
  ): Promise<BinaryContract | null> => {
    const symbolToUse = assetSymbol || selectedAsset?.symbol || activeSymbol;
    if (!symbolToUse) {
      setTradeError('MARKET_DATA_UNAVAILABLE');
      return null;
    }
    if (!Number.isFinite(strikePrice) || (strikePrice ?? 0) <= 0) {
      setTradeError('MARKET_DATA_UNAVAILABLE');
      return null;
    }

    const dto: CreateContractDto = {
      assetSymbol: symbolToUse,
      contractType,
      stake,
      expirySeconds,
      strikePrice,
    };

    return submitTradeInternal(dto);
  };

  const dismissSettlementEvent = useCallback((contractId: string) => {
    setSettlementEvents((prev) => prev.filter((e) => e.contractId !== contractId));
  }, []);

  return {
    assets,
    selectedAsset,
    selectAsset,
    isLoadingAssets,

    activeContracts,
    isLoadingActive,
    fetchActiveContracts,

    tradeHistory,
    isLoadingHistory,
    fetchTradeHistory,

    isPlacingTrade,
    tradeError,
    clearTradeError,

    pendingOrder,
    isConfirmModalOpen,
    requestTradeConfirmation,
    confirmPendingOrder,
    cancelPendingOrder,

    executeDirectTrade,

    settlementEvents,
    dismissSettlementEvent,
  };
};
