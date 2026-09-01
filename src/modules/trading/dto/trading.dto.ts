export interface PlaceTradeRequest {
  assetSymbol: string;
  contractType: 'higher' | 'lower';
  stake: string;
  expirySeconds: number;
}

export interface ListTradesRequest {
  status?: string;
  assetSymbol?: string;
  limit?: number;
  cursor?: string;
}

export interface TradeResponse {
  id: string;
  user_id: string;
  asset_symbol: string;
  stake: string;
  contract_type: 'higher' | 'lower';
  strike_price: string;
  expiry_price?: string;
  payout_rate: string;
  potential_payout: string;
  purchase_time: string;
  expiry_time: string;
  status: string;
  settled_at?: string;
}
