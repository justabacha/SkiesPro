import { useState, useCallback, useEffect, useRef } from 'react';
import { apiClient } from '@/shared/services/apiClient';
import { useAuth } from '@/shared/hooks/useAuth';
import { useAccountMode, type AccountMode } from '@/shared/context/AccountModeContext';

interface LedgerEntry {
  id: number;
  transaction_id: string;
  entry_type: 'credit' | 'debit';
  amount: string;
  balance_before: string;
  balance_after: string;
  reference_type: string;
  reference_id: string;
  description: string;
  created_at: string;
}

interface LedgerResponse {
  data: LedgerEntry[];
  meta: {
    next_cursor?: string;
    has_more: boolean;
  };
}

export const useWallet = (options: { accountMode?: AccountMode; pollBalance?: boolean } = {}) => {
  const { isAuthenticated } = useAuth();
  const {
    accountMode,
    generation,
    getWalletBalance,
    fetchWalletBalance,
    registerModeCleanup,
  } = useAccountMode();
  const selectedMode = options.accountMode || accountMode;
  const pollBalance = options.pollBalance === true;
  const balance = getWalletBalance(selectedMode);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLedgerLoading, setIsLedgerLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);

  const requestVersionRef = useRef(0);
  const ledgerControllerRef = useRef<AbortController | null>(null);

  useEffect(() => registerModeCleanup(() => {
    requestVersionRef.current += 1;
    ledgerControllerRef.current?.abort();
    ledgerControllerRef.current = null;
    setLedger([]);
    setNextCursor(undefined);
    setHasMore(false);
    setIsLedgerLoading(false);
    setError(null);
  }), [registerModeCleanup]);

  const fetchBalance = useCallback(async () => {
    if (!isAuthenticated) return null;
    const version = requestVersionRef.current;
    setIsLoading(true);
    setError(null);
    try {
      return await fetchWalletBalance(selectedMode);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load wallet balance');
      return null;
    } finally {
      if (version === requestVersionRef.current) setIsLoading(false);
    }
  }, [fetchWalletBalance, isAuthenticated, selectedMode]);

  const fetchLedger = useCallback(async (cursor?: string) => {
    if (!isAuthenticated) return;
    const version = requestVersionRef.current;
    ledgerControllerRef.current?.abort();
    const controller = new AbortController();
    ledgerControllerRef.current = controller;
    setIsLedgerLoading(true);
    try {
      const query = cursor ? `?cursor=${cursor}` : '';
      const path = selectedMode === 'demo'
        ? `/api/v1/demo/wallet/ledger${query}`
        : `/api/v1/wallets/ledger${query}`;
      const response = await apiClient.get<LedgerResponse>(path, { signal: controller.signal });
      if (version !== requestVersionRef.current) return;

      if (cursor) {
        setLedger((prev) => [...prev, ...response.data]);
      } else {
        setLedger(response.data);
      }

      setNextCursor(response.meta.next_cursor);
      setHasMore(response.meta.has_more);
    } catch (err) {
      if (version === requestVersionRef.current && (err as Error).name !== 'AbortError') {
        setError((err as Error).message);
      }
    } finally {
      if (version === requestVersionRef.current) setIsLedgerLoading(false);
    }
  }, [isAuthenticated, selectedMode]);

  const initiateDeposit = async (data: { amount: string; phone: string }) => {
    try {
      return await apiClient.post('/api/v1/payments/deposit/initiate', {
        amount: data.amount.toString(),
        phone: data.phone,
        gateway_id: 1, // M-Pesa
        currency: 'KES'
      }, {
        headers: {
          'Idempotency-Key': window.crypto.randomUUID()
        }
      });
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      throw new Error(message);
    }
  };

  const requestWithdrawal = async (data: { amount: string; phone: string }) => {
    try {
      return await apiClient.post('/api/v1/payments/withdraw/request', {
        amount: data.amount.toString(),
        phone: data.phone,
        gateway_id: 1, // M-Pesa
        currency: 'KES'
      }, {
        headers: {
          'Idempotency-Key': window.crypto.randomUUID()
        }
      });
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      throw new Error(message);
    }
  };

  // Auto-refresh balance on mount and periodically when authenticated
  useEffect(() => {
    requestVersionRef.current += 1;
    setLedger([]);
    setNextCursor(undefined);
    setHasMore(false);
    setError(null);
    if (!isAuthenticated) {
      return;
    }
    fetchBalance();
    if (!pollBalance) return;
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [fetchBalance, generation, isAuthenticated, pollBalance]);

  return {
    balance,
    ledger,
    isLoading,
    isLedgerLoading,
    error,
    hasMore,
    nextCursor,
    generation,
    fetchBalance,
    fetchLedger,
    initiateDeposit,
    requestWithdrawal
  };
};
