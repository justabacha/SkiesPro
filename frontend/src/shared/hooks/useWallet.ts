import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '@/shared/services/apiClient';

interface Balance {
  balance: string;
  locked_balance: string;
  available_balance: string;
  currency: string;
}

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

export const useWallet = () => {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLedgerLoading, setIsLedgerLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);

  const fetchBalance = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<{ data: Balance }>('/api/v1/wallets/balance');
      setBalance(response.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchLedger = useCallback(async (cursor?: string) => {
    setIsLedgerLoading(true);
    try {
      const query = cursor ? `?cursor=${cursor}` : '';
      const response = await apiClient.get<LedgerResponse>(`/api/v1/wallets/ledger${query}`);

      if (cursor) {
        setLedger((prev) => [...prev, ...response.data]);
      } else {
        setLedger(response.data);
      }

      setNextCursor(response.meta.next_cursor);
      setHasMore(response.meta.has_more);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLedgerLoading(false);
    }
  }, []);

  const initiateDeposit = async (data: { amount: string; phone: string }) => {
    try {
      // Ensure amount is sent as string and other fields are correctly named
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
      // Ensure amount is sent as string and other fields are correctly named
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

  // Auto-refresh balance on mount and periodically
  useEffect(() => {
    fetchBalance();
    const interval = setInterval(fetchBalance, 30000); // 30s polling
    return () => clearInterval(interval);
  }, [fetchBalance]);

  return {
    balance,
    ledger,
    isLoading,
    isLedgerLoading,
    error,
    hasMore,
    nextCursor,
    fetchBalance,
    fetchLedger,
    initiateDeposit,
    requestWithdrawal
  };
};
