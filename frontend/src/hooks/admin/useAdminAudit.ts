import { useState, useCallback, useEffect } from 'react';
import { adminApiClient, AuditLogItem } from '@/services/admin/adminApiClient';

export function useAdminAudit() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [verificationResult, setVerificationResult] = useState<{
    valid: boolean;
    broken_at_id?: string;
    total_verified?: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAuditLogs = useCallback(
    async (params?: { actor_id?: string; action?: string; limit?: number; offset?: number }, totp_code?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await adminApiClient.getAuditLogs(params || { limit: 50 }, totp_code);
        setLogs(res.logs || []);
        setTotal(res.total || 0);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const verifyChain = useCallback(async (totp_code?: string) => {
    setIsVerifying(true);
    setError(null);
    try {
      const result = await adminApiClient.verifyAuditChain(totp_code);
      setVerificationResult(result);
      return result;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setIsVerifying(false);
    }
  }, []);

  return {
    logs,
    total,
    verificationResult,
    isLoading,
    isVerifying,
    error,
    fetchAuditLogs,
    verifyChain,
  };
}
