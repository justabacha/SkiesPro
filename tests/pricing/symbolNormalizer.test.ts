import { normalizeSymbol } from '../../src/modules/pricing/utils/symbolNormalizer.js';

describe('Symbol Normalizer', () => {
  describe('normalizeSymbol', () => {
    test('should return as-is if symbol already contains slash', () => {
      expect(normalizeSymbol('EUR/USD')).toBe('EUR/USD');
      expect(normalizeSymbol('GBP/USD')).toBe('GBP/USD');
      expect(normalizeSymbol('BTC/USD')).toBe('BTC/USD');
    });

    test('should convert 6-character forex/crypto pairs to slash format', () => {
      expect(normalizeSymbol('EURUSD')).toBe('EUR/USD');
      expect(normalizeSymbol('GBPUSD')).toBe('GBP/USD');
      expect(normalizeSymbol('USDJPY')).toBe('USD/JPY');
      expect(normalizeSymbol('BTCUSD')).toBe('BTC/USD');
      expect(normalizeSymbol('ETHUSD')).toBe('ETH/USD');
    });

    test('should handle lowercase input', () => {
      expect(normalizeSymbol('eurusd')).toBe('EUR/USD');
      expect(normalizeSymbol('gbpusd')).toBe('GBP/USD');
      expect(normalizeSymbol('btcusd')).toBe('BTC/USD');
    });

    test('should handle mixed case input', () => {
      expect(normalizeSymbol('EurUsd')).toBe('EUR/USD');
      expect(normalizeSymbol('GbpUsd')).toBe('GBP/USD');
    });

    test('should return uppercase for non-6-character symbols', () => {
      expect(normalizeSymbol('XAU/USD')).toBe('XAU/USD');
      expect(normalizeSymbol('WTI/USD')).toBe('WTI/USD');
      expect(normalizeSymbol('xau/usd')).toBe('XAU/USD');
    });

    test('should handle edge cases', () => {
      // Empty string
      expect(normalizeSymbol('')).toBe('');
      
      // Less than 6 characters
      expect(normalizeSymbol('USD')).toBe('USD');
      
      // More than 6 characters
      expect(normalizeSymbol('EURUSDT')).toBe('EURUSDT');
    });
  });
});
