export type ContractStatus =
  'draft' | 'active' | 'settling' | 'won' | 'lost' | 'draw' | 'cancelled' | 'archived';

export type ContractType = 'higher' | 'lower';

export interface Asset {
  symbol: string;
  name: string;
  assetType?: string;
  isActive: boolean;
  payoutRate: number; // e.g. 0.60 for 60%
  minStake: number; // e.g. 100
  maxStake: number; // e.g. 50000
  minExpirySeconds: number; // e.g. 60
  maxExpirySeconds: number; // e.g. 900
  pipDecimalPlaces?: number;
  isOpen?: boolean;
}

export interface BinaryContract {
  id: string;
  user_id: string;
  asset_symbol: string;
  contract_type: ContractType;
  stake: string;
  strike_price: string;
  expiry_price?: string;
  payout_rate: string;
  potential_payout: string;
  purchase_time: string;
  expiry_time: string;
  status: ContractStatus;
  settled_at?: string;
}

export interface CreateContractDto {
  assetSymbol: string;
  contractType: ContractType;
  stake: string;
  expirySeconds: number;
  strikePrice?: number;
}

export interface PendingOrder {
  assetSymbol: string;
  contractType: ContractType;
  stake: string;
  expirySeconds: number;
  strikePrice: number;
  payoutRate: number;
  potentialPayout: number;
}

export interface PriceTick {
  symbol: string;
  price: number;
  bid?: number;
  ask?: number;
  tick_time: string;
  timestamp: number;
  source?: 'live' | 'demo';
}

export interface Candle {
  symbol: string;
  granularity_seconds: number;
  open_time: string;
  close_time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  tick_count?: number;
}

export type LatencyStatus = 'good' | 'moderate' | 'poor' | 'disconnected';

export interface LatencyState {
  latencyMs: number;
  status: LatencyStatus;
  isConnected: boolean;
}

export interface PaginatedContracts {
  contracts: BinaryContract[];
  cursor?: string;
  hasMore?: boolean;
}
