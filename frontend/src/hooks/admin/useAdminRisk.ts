import { useState, useCallback, useEffect } from 'react';
import { adminApiClient, RiskMetrics, SymbolExposure, AssetConfig } from '@/services/admin/adminApiClient';

export function useAdminRisk() {
  const [metrics, setMetrics] = useState<RiskMetrics | null>(null);
  const [exposures, setExposures] = useState<SymbolExposure[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRiskData = useCallback(async (totp_code?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const [m, exp] = await Promise.all([
        adminApiClient.getRiskDashboard(totp_code).catch(() => null),
        adminApiClient.getRiskExposure(totp_code).catch(() => []),
      ]);
      setMetrics(m);
      setExposures(exp);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRiskData();
  }, [fetchRiskData]);

  const updateAssetConfig = useCallback(
    async (symbol: string, payload: Partial<AssetConfig> & { totp_code?: string }) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await adminApiClient.updateAssetConfig(symbol, payload);
        await fetchRiskData(payload.totp_code);
        return res;
      } catch (err) {
        setError((err as Error).message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchRiskData]
  );

  return {
    metrics,
    exposures,
    isLoading,
    error,
    fetchRiskData,
    updateAssetConfig,
  };
}
