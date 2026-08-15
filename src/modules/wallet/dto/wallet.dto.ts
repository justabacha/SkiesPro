export interface WalletResponseDto {
  balance: string;
  locked_balance: string;
  available_balance: string;
  currency: string;
}

export interface LedgerEntryDto {
  id: string;
  transaction_id: string;
  entry_type: 'credit' | 'debit';
  amount: string;
  balance_before: string;
  balance_after: string;
  reference_type: string;
  reference_id: string | null;
  description: string | null;
  created_at: string;
}

export interface LedgerListResponseDto {
  data: LedgerEntryDto[];
  meta: {
    next_cursor?: string;
    has_more: boolean;
  };
}
