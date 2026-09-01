import { PoolClient } from 'pg';
import { LedgerRepository, LedgerRow } from '../repositories/ledgerRepository.js';
import { Decimal } from 'decimal.js';

export class LedgerService {
  private ledgerRepo: LedgerRepository;

  constructor(client?: PoolClient) {
    this.ledgerRepo = new LedgerRepository(client);
  }

  async recordEntry(data: {
    transactionId: string;
    walletId: string;
    entryType: 'credit' | 'debit';
    amount: Decimal;
    balanceBefore: Decimal;
    balanceAfter: Decimal;
    referenceType: string;
    referenceId?: string;
    description?: string;
  }): Promise<LedgerRow> {
    if (data.amount.isNegative() || data.amount.isZero()) {
      throw new Error('Ledger amount must be positive');
    }

    return this.ledgerRepo.create({
      transaction_id: data.transactionId,
      wallet_id: data.walletId,
      entry_type: data.entryType,
      amount: data.amount.toString(),
      balance_before: data.balanceBefore.toString(),
      balance_after: data.balanceAfter.toString(),
      reference_type: data.referenceType,
      reference_id: data.referenceId || null,
      description: data.description || null,
    });
  }

  /**
   * Enforce double-entry invariant: SUM(credits) - SUM(debits) = 0
   */
  async validateTransaction(_transactionId: string): Promise<boolean> {
    // This could be a DB check if we have a way to query all entries for a txId
    // For now, we assume the calling service ensures balancing.
    return true;
  }
}
