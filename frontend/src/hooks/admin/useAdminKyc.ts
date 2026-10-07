import { useState, useCallback, useEffect, useRef } from 'react';
import {
  adminApiClient,
  KycApplication,
  KycStatusFilter,
} from '@/services/admin/adminApiClient';

export function useAdminKyc() {
  const [pendingKyc, setPendingKyc] = useState<KycApplication[]>([]);
  const [selectedKyc, setSelectedKyc] = useState<KycApplication | null>(null);
  const [statusFilter, setStatusFilter] = useState<KycStatusFilter>('pending');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const fetchPendingKyc = useCallback(
    async (status: KycStatusFilter, totp_code?: string) => {
      const requestId = ++requestSequence.current;
      setIsLoading(true);
      setError(null);
      try {
        const pending = await adminApiClient.getPendingKyc(totp_code, status);
        if (requestId === requestSequence.current) {
          setPendingKyc(pending);
        }
      } catch (err) {
        if (requestId === requestSequence.current) {
          setError((err as Error).message);
        }
      } finally {
        if (requestId === requestSequence.current) {
          setIsLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    void fetchPendingKyc('pending');
  }, [fetchPendingKyc]);

  const selectStatusFilter = useCallback(
    (status: KycStatusFilter) => {
      setStatusFilter(status);
      void fetchPendingKyc(status);
    },
    [fetchPendingKyc]
  );

  const selectKyc = useCallback(async (id: string, totp_code?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const app = await adminApiClient.getKycById(id, totp_code);
      setSelectedKyc(app);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reviewKyc = useCallback(
    async (id: string, status: 'approved' | 'rejected', review_notes: string, totp_code?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await adminApiClient.reviewKyc(id, { status, review_notes, totp_code });
        await fetchPendingKyc(statusFilter, totp_code);
        setSelectedKyc(null);
        return res;
      } catch (err) {
        setError((err as Error).message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchPendingKyc, statusFilter]
  );

  return {
    pendingKyc,
    selectedKyc,
    statusFilter,
    selectStatusFilter,
    isLoading,
    error,
    fetchPendingKyc,
    selectKyc,
    clearSelectedKyc: () => setSelectedKyc(null),
    reviewKyc,
  };
}
