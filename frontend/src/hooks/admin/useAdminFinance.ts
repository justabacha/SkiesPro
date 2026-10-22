import { useState, useCallback, useEffect } from 'react';
import { adminApiClient, WithdrawalRequest, PendingAction } from '@/services/admin/adminApiClient';

export function useAdminFinance() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRequest | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<PendingAction[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWithdrawals = useCallback(async (status: string = statusFilter, totp_code?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await adminApiClient.getWithdrawals(totp_code, status);
      setWithdrawals(list);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchWithdrawals(statusFilter);
  }, [fetchWithdrawals, statusFilter]);

  const selectStatusFilter = useCallback((status: string) => {
    setStatusFilter(status);
  }, []);

  const selectWithdrawal = useCallback(async (id: string, totp_code?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const item = await adminApiClient.getWithdrawalById(id, totp_code);
      setSelectedWithdrawal(item);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const approveWithdrawal = useCallback(
    async (id: string, totp_code?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await adminApiClient.approveWithdrawal(id, { totp_code });
        await fetchWithdrawals(statusFilter, totp_code);
        setSelectedWithdrawal(null);
        return res;
      } catch (err) {
        setError((err as Error).message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchWithdrawals, statusFilter]
  );

  const rejectWithdrawal = useCallback(
    async (id: string, reason: string, totp_code?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await adminApiClient.rejectWithdrawal(id, { reason, totp_code });
        await fetchWithdrawals(statusFilter, totp_code);
        setSelectedWithdrawal(null);
        return res;
      } catch (err) {
        setError((err as Error).message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchWithdrawals, statusFilter]
  );

  const retryWithdrawal = useCallback(
    async (id: string, totp_code?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await adminApiClient.retryWithdrawal(id, totp_code);
        await fetchWithdrawals(statusFilter, totp_code);
        setSelectedWithdrawal(null);
        return res;
      } catch (err) {
        setError((err as Error).message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchWithdrawals, statusFilter]
  );

  const forceCompleteWithdrawal = useCallback(
    async (id: string, mpesaReceipt: string, note?: string, totp_code?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await adminApiClient.forceCompleteWithdrawal(id, mpesaReceipt, note, totp_code);
        await fetchWithdrawals(statusFilter, totp_code);
        setSelectedWithdrawal(null);
        return res;
      } catch (err) {
        setError((err as Error).message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchWithdrawals, statusFilter]
  );

  const forceRefundWithdrawal = useCallback(
    async (id: string, reason: string, totp_code?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await adminApiClient.forceRefundWithdrawal(id, reason, totp_code);
        await fetchWithdrawals(statusFilter, totp_code);
        setSelectedWithdrawal(null);
        return res;
      } catch (err) {
        setError((err as Error).message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchWithdrawals, statusFilter]
  );

  const adjustWallet = useCallback(
    async (payload: {
      user_id: string;
      amount: number;
      currency: string;
      direction: 'credit' | 'debit';
      reason: string;
      idempotency_key?: string;
      totp_code?: string;
    }) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await adminApiClient.adjustWallet(payload);
        return res;
      } catch (err) {
        setError((err as Error).message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const approveAction = useCallback(async (id: string, totp_code?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminApiClient.approveAction(id, { totp_code });
      setPendingApprovals((prev) => prev.filter((a) => a.id !== id));
      return res;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    withdrawals,
    selectedWithdrawal,
    pendingApprovals,
    statusFilter,
    selectStatusFilter,
    isLoading,
    error,
    fetchWithdrawals,
    selectWithdrawal,
    clearSelectedWithdrawal: () => setSelectedWithdrawal(null),
    approveWithdrawal,
    rejectWithdrawal,
    retryWithdrawal,
    forceCompleteWithdrawal,
    forceRefundWithdrawal,
    adjustWallet,
    approveAction,
    setPendingApprovals,
  };
}
