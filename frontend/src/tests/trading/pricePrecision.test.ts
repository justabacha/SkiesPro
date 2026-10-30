import { describe, expect, it } from 'vitest';
import {
  formatPriceDelta,
  isCryptoOrCommodity,
  getPipSize,
  getPriceDecimalPlaces,
} from '@/modules/trading/utils/pricePrecision';

describe('pricePrecision utils & formatting', () => {
  it('correctly identifies crypto and commodities and returns decimal places', () => {
    expect(isCryptoOrCommodity('BTC/USD')).toBe(true);
    expect(isCryptoOrCommodity('ETH/USD')).toBe(true);
    expect(isCryptoOrCommodity('XAU/USD')).toBe(true);
    expect(isCryptoOrCommodity('GOLD')).toBe(true);
    expect(isCryptoOrCommodity('EUR/USD')).toBe(false);
    expect(isCryptoOrCommodity('GBP/JPY')).toBe(false);

    expect(getPriceDecimalPlaces('USD/JPY')).toBe(3);
    expect(getPriceDecimalPlaces('XAU/USD')).toBe(2);
    expect(getPriceDecimalPlaces('BTC/USD')).toBe(2);
    expect(getPriceDecimalPlaces('EUR/USD')).toBe(5);
  });

  it('formats USD difference for BTC/USD drops and rises', () => {
    // Drop of $117.45 on BTC
    expect(formatPriceDelta('BTC/USD', -117.45, 2)).toBe('-$117.45');
    // Rise of $45.20 on BTC
    expect(formatPriceDelta('BTC/USD', 45.2, 2)).toBe('+$45.20');
  });

  it('formats standard Pips for Forex pairs', () => {
    const pipSize = getPipSize('EUR/USD', 5, 1.095); // 0.0001
    expect(pipSize).toBe(0.0001);

    // Rise of 1.5 pips (+0.00015)
    expect(formatPriceDelta('EUR/USD', 0.00015, 5)).toBe('+1.5 Pips');
    // Drop of 2.0 pips (-0.00020)
    expect(formatPriceDelta('EUR/USD', -0.0002, 5)).toBe('-2.0 Pips');
  });

  it('correctly calculates sign for CALL (Higher) and PUT (Lower) contracts', () => {
    const strike = 1000;

    // CALL (Higher): current = 1010 => winning => +10 diff
    const higherWinningDiff = 1010 - strike;
    expect(higherWinningDiff).toBe(10);
    expect(formatPriceDelta('BTC/USD', higherWinningDiff, 2)).toBe('+$10.00');

    // CALL (Higher): current = 990 => losing => -10 diff
    const higherLosingDiff = 990 - strike;
    expect(higherLosingDiff).toBe(-10);
    expect(formatPriceDelta('BTC/USD', higherLosingDiff, 2)).toBe('-$10.00');

    // PUT (Lower): current = 990 => winning => +10 diff (strike - current)
    const lowerWinningDiff = strike - 990;
    expect(lowerWinningDiff).toBe(10);
    expect(formatPriceDelta('BTC/USD', lowerWinningDiff, 2)).toBe('+$10.00');

    // PUT (Lower): current = 1010 => losing => -10 diff (strike - current)
    const lowerLosingDiff = strike - 1010;
    expect(lowerLosingDiff).toBe(-10);
    expect(formatPriceDelta('BTC/USD', lowerLosingDiff, 2)).toBe('-$10.00');
  });
});
