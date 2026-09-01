import { AssetConfig } from '../repositories/assetConfigRepository.js';
import { Decimal } from 'decimal.js';

export class StakeValidator {
  /**
   * Validates if a stake is within asset-specific and platform-wide limits.
   */
  validateStake(
    amount: string | number | Decimal,
    config: AssetConfig
  ): { valid: boolean; error?: string } {
    const stake = new Decimal(amount);
    const minStake = new Decimal(config.minStake);
    const maxStake = new Decimal(config.maxStake);

    if (stake.lt(minStake)) {
      return {
        valid: false,
        error: `Stake amount below minimum for asset (${minStake.toString()})`,
      };
    }
    if (stake.gt(maxStake)) {
      return {
        valid: false,
        error: `Stake amount above maximum for asset (${maxStake.toString()})`,
      };
    }
    return { valid: true };
  }

  /**
   * Validates if the trade duration is within limits.
   */
  validateDuration(seconds: number, config: AssetConfig): { valid: boolean; error?: string } {
    if (seconds < config.minDurationSeconds) {
      return {
        valid: false,
        error: `Duration below minimum for asset (${config.minDurationSeconds}s)`,
      };
    }
    if (seconds > config.maxDurationSeconds) {
      return {
        valid: false,
        error: `Duration above maximum for asset (${config.maxDurationSeconds}s)`,
      };
    }

    // Hard limit per TRADING_007
    if (seconds < 60) {
      return { valid: false, error: 'Minimum trade duration is 60 seconds' };
    }
    if (seconds > 86400) {
      return { valid: false, error: 'Maximum trade duration is 24 hours (86400 seconds)' };
    }

    return { valid: true };
  }
}
