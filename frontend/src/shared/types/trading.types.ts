export type ContractStatus = 'draft' | 'active' | 'settling' | 'won' | 'lost' | 'draw' | 'cancelled' | 'archived';
export type ContractType = 'higher' | 'lower';

export interface BinaryContract {
  id: string;
  user_id: string;
  asset_symbol: string;
  stake: string; // Precision-safe string
  contract_type: ContractType;
  strike_price: string; // Precision-safe string
  expiry_price?: string; // Precision-safe string
  payout_rate: string; // Precision-safe string
  potential_payout: string; // Precision-safe string
  purchase_time: string;
  expiry_time: string;
  status: ContractStatus;
  lock_tx_id?: string;
  payout_tx_id?: string;
  settled_at?: string;
}

export interface PlaceTradeRequest {
  assetSymbol: string;
  contractType: ContractType;
  stake: string;
  expirySeconds: number;
}
