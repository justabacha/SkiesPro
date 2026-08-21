export interface PriceResponseDto {
  symbol: string;
  bid: string;
  ask: string;
  mid: string;
  tick_time: string;
}

export interface CandleResponseDto {
  symbol: string;
  granularity_seconds: number;
  open_time: string;
  close_time: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

export interface AssetResponseDto {
  symbol: string;
  name: string;
  asset_type: string;
  is_active: boolean;
}

export interface MarketStatusResponseDto {
  symbol: string;
  is_open: boolean;
  opens_at: string;
  closes_at: string;
  timezone: string;
}

export interface CandleRequestDto {
  symbol: string;
  granularity?: number;
  from?: string;
  to?: string;
  limit?: number;
}
