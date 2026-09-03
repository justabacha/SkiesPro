import { Decimal } from 'decimal.js';
import { BinaryContract } from '../repositories/contractRepository.js';

export type SettlementOutcome = 'won' | 'lost' | 'draw' | 'cancelled';

export interface PayoutResult {
  outcome: SettlementOutcome;
  payoutAmount: Decimal;
  description: string;
}

export class PayoutService {
  /**
   * Calculates the outcome and payout amount for a contract based on the settlement price.
   * Implements the 60% payout ratio and Pip-Tolerance Draw Rule (DDS §18.4).
   */
  calculatePayout(contract: BinaryContract, settlementPrice: Decimal): PayoutResult {
    const strikePrice = new Decimal(contract.strikePrice);
    const stake = new Decimal(contract.stake);
    const potentialPayout = new Decimal(contract.potentialPayout);

    // Pip-Tolerance Draw Rule: A Draw is declared if ABS(expiry - strike) < 0.00001
    const diff = settlementPrice.minus(strikePrice).abs();
    const DRAW_TOLERANCE = new Decimal('0.00001');

    if (diff.lt(DRAW_TOLERANCE)) {
      return {
        outcome: 'draw',
        payoutAmount: stake, // Refund stake
        description: `Trade draw: ${contract.assetSymbol} ${contract.contractType} (Price within tolerance)`
      };
    }

    if (contract.contractType === 'higher') {
      if (settlementPrice.gt(strikePrice)) {
        return {
          outcome: 'won',
          payoutAmount: potentialPayout,
          description: `Trade won: ${contract.assetSymbol} Higher at ${settlementPrice.toString()}`
        };
      } else {
        return {
          outcome: 'lost',
          payoutAmount: new Decimal(0),
          description: `Trade lost: ${contract.assetSymbol} Higher at ${settlementPrice.toString()}`
        };
      }
    } else { // contractType === 'lower'
      if (settlementPrice.lt(strikePrice)) {
        return {
          outcome: 'won',
          payoutAmount: potentialPayout,
          description: `Trade won: ${contract.assetSymbol} Lower at ${settlementPrice.toString()}`
        };
      } else {
        return {
          outcome: 'lost',
          payoutAmount: new Decimal(0),
          description: `Trade lost: ${contract.assetSymbol} Lower at ${settlementPrice.toString()}`
        };
      }
    }
  }

  /**
   * Generates a result for a cancelled trade (e.g., due to Oracle Gap).
   */
  getCancelResult(contract: BinaryContract, reason: string): PayoutResult {
    return {
      outcome: 'cancelled',
      payoutAmount: new Decimal(contract.stake),
      description: `Trade cancelled: ${reason}. Stake refunded.`
    };
  }
}
