/**
 * Test Specifications: TSQS UI-TRADE-001 through UI-TRADE-010
 * Trading Interface Component & Logic Verification Functions
 */

import { Asset, BinaryContract, PendingOrder, LatencyState } from '../types/trading.types';

export const mockAsset: Asset = {
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
};

// UI-TRADE-001: Asset selector search filter logic
export const testUiTrade001 = (assets: Asset[], query: string) => {
  return assets.filter(
    (a) => a.symbol.toLowerCase().includes(query) || a.name.toLowerCase().includes(query)
  );
};

// UI-TRADE-002: Stake input validation
export const testUiTrade002 = (stake: number, minStake = 100, maxStake = 50000, userBalance = 10000) => {
  if (isNaN(stake)) return 'Invalid';
  if (stake < minStake) return 'Below Min';
  if (stake > maxStake) return 'Above Max';
  if (stake > userBalance) return 'Insufficient Balance';
  return 'Valid';
};

// UI-TRADE-003: Live expected payout calculation
export const testUiTrade003 = (stake: number, payoutRate = 0.60) => {
  return Number((stake * (1 + payoutRate)).toFixed(2));
};

// UI-TRADE-004: Direction button class selection
export const testUiTrade004 = (contractType: 'higher' | 'lower') => {
  return contractType === 'higher'
    ? 'bg-emerald-600 hover:bg-emerald-500'
    : 'bg-rose-600 hover:bg-rose-500';
};

// UI-TRADE-005: Market closed validation
export const testUiTrade005 = (asset: Asset, isPlacing: boolean) => {
  return asset.isOpen !== false && asset.isActive !== false && !isPlacing;
};

// UI-TRADE-006: Countdown seconds calculator
export const testUiTrade006 = (expiryTimeIso: string, nowMs = Date.now()) => {
  const expTs = new Date(expiryTimeIso).getTime();
  return Math.max(0, Math.ceil((expTs - nowMs) / 1000));
};

// UI-TRADE-007: Settlement outcome color mapping
export const testUiTrade007 = (status: BinaryContract['status']) => {
  if (status === 'won') return 'emerald-400';
  if (status === 'draw') return 'amber-400';
  return 'rose-400';
};

// UI-TRADE-008: Network latency status threshold rules
export const testUiTrade008 = (latencyMs: number, isConnected: boolean): LatencyState['status'] => {
  if (!isConnected) return 'disconnected';
  if (latencyMs <= 100) return 'good';
  if (latencyMs <= 300) return 'moderate';
  return 'poor';
};

// UI-TRADE-009: Pending order modal details validator
export const testUiTrade009 = (order: PendingOrder) => {
  return Boolean(
    order.assetSymbol &&
      order.contractType &&
      order.stake &&
      order.expirySeconds > 0 &&
      order.potentialPayout > 0
  );
};

// UI-TRADE-010: Timeframe selector array validator
export const testUiTrade010 = () => {
  return ['1m', '5m', '15m', '1H', '4H', '1D'];
};
