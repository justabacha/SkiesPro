import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '@/shared/hooks/useWallet';
import { useAuth } from '@/shared/hooks/useAuth';
import { tradingService } from '../services/tradingService';
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
    expirySeconds: number
  ) => Promise<BinaryContract | null>;

  settlementEvents: SettlementEvent[];
  dismissSettlementEvent: (contractId: string) => void;
}

export const useTrading = (initialSymbol: string = 'EUR/USD'): UseTradingReturn => {
  const { fetchBalance } = useWallet();
  const { isAuthenticated } = useAuth();

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

  // Load assets on mount
  useEffect(() => {
    let isMounted = true;

    const loadAssets = async () => {
      setIsLoadingAssets(true);
      try {
        const list = await tradingService.getAssets();
        if (isMounted) {
          setAssets(list);
          const current = list.find((a) => a.symbol === initialSymbol) || list[0] || null;
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
  }, [initialSymbol]);

  // Select asset handler
  const selectAsset = useCallback(
    (symbol: string) => {
      const found = assets.find((a) => a.symbol === symbol);
      if (found) {
        setSelectedAsset(found);
      } else {
        // Create dynamic asset
        setSelectedAsset({
          symbol,
          name: symbol,
          isActive: true,
          payoutRate: 0.60,
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
  const fetchActiveContracts = useCallback(async (isInitial = false) => {
    if (!isAuthenticated) return;
    if (isInitial || !hasLoadedActiveRef.current) {
      setIsLoadingActive(true);
    }
    try {
      const active = await tradingService.getActiveContracts();
      setActiveContracts(active);
      hasLoadedActiveRef.current = true;

      const currentActiveIds = new Set(active.map((c) => c.id));
      const previousIds = previousActiveIdsRef.current;

      // Check if any previously active contract has disappeared (settled)
      if (previousIds.size > 0) {
        const settledIds = Array.from(previousIds).filter((id) => !currentActiveIds.has(id));
        if (settledIds.length > 0) {
          // Refresh trade history and wallet balance
          fetchBalance();
          const history = await tradingService.getContracts({ limit: 10 });
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
    } catch (err) {
      console.warn('Failed to fetch active contracts:', err);
    } finally {
      setIsLoadingActive(false);
    }
  }, [fetchBalance, isAuthenticated]);

  // Fetch trade history
  const fetchTradeHistory = useCallback(async (isInitial = false) => {
    if (!isAuthenticated) return;
    if (isInitial || !hasLoadedHistoryRef.current) {
      setIsLoadingHistory(true);
    }
    try {
      const history = await tradingService.getContracts({ limit: 20 });
      setTradeHistory(history);
      hasLoadedHistoryRef.current = true;
    } catch (err) {
      console.warn('Failed to fetch trade history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [isAuthenticated]);

  // Poll active contracts periodically when authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setActiveContracts([]);
      setTradeHistory([]);
      return;
    }

    fetchActiveContracts(true);
    fetchTradeHistory(true);

    const interval = setInterval(() => {
      fetchActiveContracts(false);
      fetchTradeHistory(false);
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchActiveContracts, fetchTradeHistory, isAuthenticated]);

  const clearTradeError = useCallback(() => {
    setTradeError(null);
  }, []);

  // Prepare confirmation modal
  const requestTradeConfirmation = useCallback(
    (
      contractType: ContractType,
      stake: string,
      expirySeconds: number,
      currentPrice: number
    ) => {
      if (!selectedAsset) return;

      const numericStake = parseFloat(stake);
      const payoutRate = selectedAsset.payoutRate || 0.60;
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
    },
    [selectedAsset]
  );

  // Submit direct or confirmed trade
  const submitTradeInternal = async (
    dto: CreateContractDto
  ): Promise<BinaryContract | null> => {
    if (isPlacingTrade) return null;

    setIsPlacingTrade(true);
    setTradeError(null);

    const idempotencyKey = generateUuidV4();

    try {
      const contract = await tradingService.placeTrade(dto, idempotencyKey);

      // Refresh wallet and active contracts list
      fetchBalance();
      await fetchActiveContracts();

      return contract;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Trade execution failed';
      setTradeError(message);
      return null;
    } finally {
      setIsPlacingTrade(false);
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
    };

    setIsConfirmModalOpen(false);
    const result = await submitTradeInternal(dto);
    setPendingOrder(null);
    return result;
  };

  const cancelPendingOrder = useCallback(() => {
    setIsConfirmModalOpen(false);
    setPendingOrder(null);
  }, []);

  // Direct trade without confirmation modal
  const executeDirectTrade = async (
    contractType: ContractType,
    stake: string,
    expirySeconds: number
  ): Promise<BinaryContract | null> => {
    if (!selectedAsset) return null;

    const dto: CreateContractDto = {
      assetSymbol: selectedAsset.symbol,
      contractType,
      stake,
      expirySeconds,
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
