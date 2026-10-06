import { useState, useCallback, useEffect } from 'react';
import { adminApiClient, KycApplication } from '@/services/admin/adminApiClient';

export function useAdminKyc() {
  const [pendingKyc, setPendingKyc] = useState<KycApplication[]>([]);
  const [selectedKyc, setSelectedKyc] = useState<KycApplication | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPendingKyc = useCallback(async (totp_code?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const pending = await adminApiClient.getPendingKyc(totp_code);
      setPendingKyc(pending);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
        await fetchPendingKyc(totp_code);
        setSelectedKyc(null);
        return res;
      } catch (err) {
        setError((err as Error).message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchPendingKyc]
  );

  return {
    pendingKyc,
    selectedKyc,
    isLoading,
    error,
    fetchPendingKyc,
    selectKyc,
    clearSelectedKyc: () => setSelectedKyc(null),
    reviewKyc,
  };
}
