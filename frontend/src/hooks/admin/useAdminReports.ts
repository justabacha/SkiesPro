import { useState, useCallback, useEffect } from 'react';
import {
  adminApiClient,
  RevenueDataPoint,
  VolumeDataPoint,
  RegistrationDataPoint,
  SettlementPerformancePoint,
} from '@/services/admin/adminApiClient';

export function useAdminReports() {
  const [dailyRevenue, setDailyRevenue] = useState<RevenueDataPoint[]>([]);
  const [tradeVolume, setTradeVolume] = useState<VolumeDataPoint[]>([]);
  const [userRegistrations, setUserRegistrations] = useState<RegistrationDataPoint[]>([]);
  const [settlementPerformance, setSettlementPerformance] = useState<SettlementPerformancePoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAllReports = useCallback(async (totp_code?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const [rev, vol, reg, setl] = await Promise.all([
        adminApiClient.getDailyRevenue(totp_code),
        adminApiClient.getTradeVolume(totp_code),
        adminApiClient.getUserRegistrations(totp_code),
        adminApiClient.getSettlementPerformance(totp_code),
      ]);
      setDailyRevenue(rev);
      setTradeVolume(vol);
      setUserRegistrations(reg);
      setSettlementPerformance(setl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllReports();
  }, [fetchAllReports]);

  return {
    dailyRevenue,
    tradeVolume,
    userRegistrations,
    settlementPerformance,
    isLoading,
    error,
    fetchAllReports,
  };
}
