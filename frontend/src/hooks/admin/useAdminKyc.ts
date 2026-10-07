import { useState, useCallback, useEffect } from 'react';
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

  const fetchPendingKyc = useCallback(
    async (totp_code?: string, status: KycStatusFilter = statusFilter) => {
      setIsLoading(true);
      setError(null);
      try {
        const pending = await adminApiClient.getPendingKyc(totp_code, status);
        setPendingKyc(pending);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    },
    [statusFilter]
  );

  useEffect(() => {
    fetchPendingKyc();
  }, [fetchPendingKyc]);

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
        await fetchPendingKyc(totp_code, statusFilter);
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
    setStatusFilter,
    isLoading,
    error,
    fetchPendingKyc,
    selectKyc,
    clearSelectedKyc: () => setSelectedKyc(null),
    reviewKyc,
  };
}
