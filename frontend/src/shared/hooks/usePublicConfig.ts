import { useEffect, useState } from 'react';
import { apiClient } from '@/shared/services/apiClient';

export interface PublicConfig {
  minDeposit: number;
  maxDeposit: number;
  minWithdrawal: number;
  maxWithdrawal: number;
  kycRequiredForTrading: boolean;
  kycRequiredForWithdrawal: boolean;
  minDuration: number;
  maxDuration: number;
  defaultPayoutRatio: number;
  withdrawalFeePercentage: number;
}

interface PublicConfigResponse {
  data: {
    deposit: { min_amount: number; max_amount: number };
    withdrawal: { min_amount: number; max_amount: number; fee_percentage: number };
    kyc: { required_for_trading: boolean; required_for_withdrawal: boolean };
    trade: {
      min_duration_seconds: number;
      max_duration_seconds: number;
      default_payout_ratio: number;
    };
  };
}

const DEFAULT_PUBLIC_CONFIG: PublicConfig = {
  minDeposit: 500,
  maxDeposit: 100000,
  minWithdrawal: 500,
  maxWithdrawal: 60000,
  kycRequiredForTrading: false,
  kycRequiredForWithdrawal: true,
  minDuration: 60,
  maxDuration: 3600,
  defaultPayoutRatio: 0.6,
  withdrawalFeePercentage: 0.02,
};

const CACHE_TTL_MS = 5000;
let cachedConfig: { config: PublicConfig; expiresAt: number } | null = null;
let inFlightRequest: Promise<PublicConfig> | null = null;

async function fetchPublicConfig(): Promise<PublicConfig> {
  if (cachedConfig && cachedConfig.expiresAt > Date.now()) return cachedConfig.config;
  if (!inFlightRequest) {
    inFlightRequest = apiClient
      .get<PublicConfigResponse>('/api/v1/config/public')
      .then(({ data }) => {
        const config: PublicConfig = {
          minDeposit: Number(data.deposit.min_amount),
          maxDeposit: Number(data.deposit.max_amount),
          minWithdrawal: Number(data.withdrawal.min_amount),
          maxWithdrawal: Number(data.withdrawal.max_amount),
          kycRequiredForTrading: data.kyc.required_for_trading,
          kycRequiredForWithdrawal: data.kyc.required_for_withdrawal,
          minDuration: Number(data.trade.min_duration_seconds),
          maxDuration: Number(data.trade.max_duration_seconds),
          defaultPayoutRatio: Number(data.trade.default_payout_ratio),
          withdrawalFeePercentage: Number(data.withdrawal.fee_percentage),
        };
        cachedConfig = { config, expiresAt: Date.now() + CACHE_TTL_MS };
        return config;
      })
      .finally(() => {
        inFlightRequest = null;
      });
  }
  return inFlightRequest;
}

export function usePublicConfig(): PublicConfig & {
  isLoading: boolean;
  error: string | null;
} {
  const [config, setConfig] = useState<PublicConfig>(
    () => cachedConfig?.config ?? DEFAULT_PUBLIC_CONFIG
  );
  const [isLoading, setIsLoading] = useState<boolean>(
    () => !cachedConfig || cachedConfig.expiresAt <= Date.now()
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (cachedConfig && cachedConfig.expiresAt > Date.now()) {
      setConfig(cachedConfig.config);
      setIsLoading(false);
      return () => {
        active = false;
      };
    }

    setIsLoading(true);
    fetchPublicConfig()
      .then((nextConfig) => {
        if (active) {
          setConfig(nextConfig);
          setError(null);
        }
      })
      .catch((requestError: unknown) => {
        if (active) setError((requestError as Error).message || 'Unable to load platform settings.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { ...config, isLoading, error };
}
