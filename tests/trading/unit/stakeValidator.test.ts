import { StakeValidator } from '../../../src/modules/trading/validators/stakeValidator.js';
import { AssetConfig } from '../../../src/modules/trading/repositories/assetConfigRepository.js';

describe('StakeValidator', () => {
  let validator: StakeValidator;
  const mockConfig: AssetConfig = {
    id: '1',
    assetSymbol: 'EUR/USD',
    minStake: '100',
    maxStake: '50000',
    minDurationSeconds: 60,
    maxDurationSeconds: 3600,
    payoutRate: '0.60',
    isActive: true,
    maxExposure: '1300000',
    createdAt: new Date()
  };

  beforeEach(() => {
    validator = new StakeValidator();
  });

  describe('validateStake', () => {
    test('should return valid for stake within limits', () => {
      const result = validator.validateStake(500, mockConfig);
      expect(result.valid).toBe(true);
    });

    test('should return invalid for stake below minimum', () => {
      const result = validator.validateStake(50, mockConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('below minimum');
    });

    test('should return invalid for stake above maximum', () => {
      const result = validator.validateStake(60000, mockConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('above maximum');
    });
  });

  describe('validateDuration', () => {
    test('should return valid for duration within limits', () => {
      const result = validator.validateDuration(300, mockConfig);
      expect(result.valid).toBe(true);
    });

    test('should return invalid for duration below minimum', () => {
      const result = validator.validateDuration(30, mockConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('below minimum');
    });

    test('should return invalid for duration above maximum', () => {
      const result = validator.validateDuration(7200, mockConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('above maximum');
    });

    test('should enforce hard 60s minimum', () => {
      const configWithLowMin = { ...mockConfig, minDurationSeconds: 10 };
      const result = validator.validateDuration(30, configWithLowMin);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('60 seconds');
    });
  });
});
