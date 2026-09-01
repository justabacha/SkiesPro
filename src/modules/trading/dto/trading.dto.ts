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
  userId: string;
  assetSymbol: string;
  stake: string;
  contractType: 'higher' | 'lower';
  strikePrice: string;
  payoutRate: string;
  potentialPayout: string;
  purchaseTime: string;
  expiryTime: string;
  status: string;
}
