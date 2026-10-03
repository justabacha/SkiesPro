import { apiClient } from '@/shared/services/apiClient';
import {
  Asset,
  BinaryContract,
  CreateContractDto,
  Candle,
} from '../types/trading.types';

interface ApiResponse<T> {
  status: string;
  data: T;
  message?: string;
}

const DEFAULT_ASSETS: Asset[] = [
  {
    symbol: 'EUR/USD',
    name: 'Euro / US Dollar',
    assetType: 'forex',
    isActive: true,
    payoutRate: 0.60,
    minStake: 100,
    maxStake: 50000,
    minExpirySeconds: 60,
    maxExpirySeconds: 900,
    pipDecimalPlaces: 5,
    isOpen: true,
  },
  {
    symbol: 'GBP/USD',
    name: 'British Pound / US Dollar',
    assetType: 'forex',
    isActive: true,
    payoutRate: 0.60,
    minStake: 100,
    maxStake: 50000,
    minExpirySeconds: 60,
    maxExpirySeconds: 900,
    pipDecimalPlaces: 5,
    isOpen: true,
  },
  {
    symbol: 'USD/JPY',
    name: 'US Dollar / Japanese Yen',
    assetType: 'forex',
    isActive: true,
    payoutRate: 0.60,
    minStake: 100,
    maxStake: 50000,
    minExpirySeconds: 60,
    maxExpirySeconds: 900,
    pipDecimalPlaces: 3,
    isOpen: true,
  },
  {
    symbol: 'Gold',
    name: 'Gold / US Dollar',
    assetType: 'commodity',
    isActive: true,
    payoutRate: 0.60,
    minStake: 100,
    maxStake: 50000,
    minExpirySeconds: 60,
    maxExpirySeconds: 900,
    pipDecimalPlaces: 2,
    isOpen: true,
  },
];

class TradingService {
  /**
   * Fetch all active trading assets
   */
  async getAssets(): Promise<Asset[]> {
    try {
      const response = await apiClient.get<ApiResponse<Asset[]> | Asset[]>('/api/v1/trading/assets');
      let rawAssets: Asset[] = [];

      if (Array.isArray(response)) {
        rawAssets = response;
      } else if (response && response.data && Array.isArray(response.data)) {
        rawAssets = response.data;
      }

      if (rawAssets.length === 0) {
        return DEFAULT_ASSETS;
      }

      return rawAssets
        .filter((asset) => asset.symbol !== 'Oil' && asset.symbol !== 'WTI/USD')
        .map((asset) => ({
          symbol: asset.symbol,
          name: asset.name || asset.symbol,
          assetType: asset.assetType || 'forex',
          isActive: asset.isActive !== false,
          payoutRate: Number(asset.payoutRate) || 0.60,
          minStake: Number(asset.minStake) || 100,
          maxStake: Number(asset.maxStake) || 50000,
          minExpirySeconds: Number(asset.minExpirySeconds) || 60,
          maxExpirySeconds: Number(asset.maxExpirySeconds) || 900,
          pipDecimalPlaces: Number(asset.pipDecimalPlaces) || 5,
          isOpen: asset.isOpen !== false,
        }));
    } catch (error) {
      console.warn('Falling back to default assets:', error);
      return DEFAULT_ASSETS;
    }
  }

  /**
   * Fetch details for a specific asset by symbol
   */
  async getAssetDetail(symbol: string): Promise<Asset> {
    try {
      const encoded = encodeURIComponent(symbol);
      const response = await apiClient.get<ApiResponse<Asset> | Asset>(`/api/v1/trading/assets/${encoded}`);
      const assetData = ('data' in response && response.data) ? response.data : (response as Asset);

      return {
        symbol: assetData.symbol || symbol,
        name: assetData.name || symbol,
        assetType: assetData.assetType || 'forex',
        isActive: assetData.isActive !== false,
        payoutRate: Number(assetData.payoutRate) || 0.60,
        minStake: Number(assetData.minStake) || 100,
        maxStake: Number(assetData.maxStake) || 50000,
        minExpirySeconds: Number(assetData.minExpirySeconds) || 60,
        maxExpirySeconds: Number(assetData.maxExpirySeconds) || 900,
        pipDecimalPlaces: Number(assetData.pipDecimalPlaces) || 5,
        isOpen: assetData.isOpen !== false,
      };
    } catch {
      const fallback = DEFAULT_ASSETS.find((a) => a.symbol === symbol) || {
        symbol,
        name: symbol,
        assetType: 'forex',
        isActive: true,
        payoutRate: 0.60,
        minStake: 100,
        maxStake: 50000,
        minExpirySeconds: 60,
        maxExpirySeconds: 900,
        pipDecimalPlaces: 5,
        isOpen: true,
      };
      return fallback;
    }
  }

  /**
   * Place a new binary contract with idempotency protection
   */
  async placeTrade(dto: CreateContractDto, idempotencyKey: string): Promise<BinaryContract> {
    const payload = {
      asset_symbol: dto.assetSymbol,
      direction: dto.contractType === 'higher' ? 'CALL' : 'PUT',
      amount: dto.stake,
      strike_price: dto.strikePrice,
      expiry_seconds: dto.expirySeconds,
    };

    const response = await apiClient.post<ApiResponse<BinaryContract> | BinaryContract>(
      '/api/v1/trading/contracts',
      payload,
      {
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      }
    );

    if (response && typeof response === 'object' && 'data' in response && response.data) {
      return response.data;
    }
    return response as BinaryContract;
  }

  /**
   * Fetch active unsettled trades for current user
   */
  async getActiveContracts(): Promise<BinaryContract[]> {
    const response = await apiClient.get<ApiResponse<BinaryContract[]> | BinaryContract[]>(
      '/api/v1/trading/contracts/active'
    );

    if (Array.isArray(response)) {
      return response;
    }
    if (response && response.data && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  }

  /**
   * Fetch trade history with optional filters
   */
  async getContracts(params?: {
    status?: string;
    asset_symbol?: string;
    limit?: number;
    cursor?: string;
  }): Promise<BinaryContract[]> {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.asset_symbol) query.append('asset_symbol', params.asset_symbol);
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.cursor) query.append('cursor', params.cursor);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    const response = await apiClient.get<ApiResponse<BinaryContract[]> | BinaryContract[]>(
      `/api/v1/trading/contracts${queryString}`
    );

    if (Array.isArray(response)) {
      return response;
    }
    if (response && response.data && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  }

  /**
   * Fetch single contract details by ID
   */
  async getContractById(id: string): Promise<BinaryContract> {
    const response = await apiClient.get<ApiResponse<BinaryContract> | BinaryContract>(
      `/api/v1/trading/contracts/${id}`
    );

    if (response && typeof response === 'object' && 'data' in response && response.data) {
      return response.data;
    }
    return response as BinaryContract;
  }

  /**
   * Fetch historical OHLC candles for specified asset symbol
   */
  async getCandles(
    symbol: string,
    granularity = 60,
    limit = 60
  ): Promise<Candle[]> {
    try {
      const encodedSymbol = encodeURIComponent(symbol);
      const response = await apiClient.get<ApiResponse<Candle[]> | Candle[]>(
        `/api/v1/pricing/assets/${encodedSymbol}/candles?granularity=${granularity}&limit=${limit}`
      );

      if (Array.isArray(response)) {
        return response;
      }
      if (response && typeof response === 'object' && 'data' in response && Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    } catch (error) {
      console.warn('Failed to fetch candles from server:', error);
      return [];
    }
  }
}

export const tradingService = new TradingService();
