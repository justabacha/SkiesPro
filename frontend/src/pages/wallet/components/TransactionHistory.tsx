import React, { useState } from 'react';
import { formatKES } from '@/shared/utils/currencyUtils';
import { Badge, Button, Modal, Stack } from '@/shared/components';
import { Eye, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';

interface LedgerEntry {
  id: number;
  transaction_id: string;
  entry_type: 'credit' | 'debit';
  amount: string;
  balance_before: string;
  balance_after: string;
  reference_type: string;
  reference_id: string;
  description: string;
  created_at: string;
}

interface TransactionHistoryProps {
  entries: LedgerEntry[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  entries,
  isLoading,
  hasMore,
  onLoadMore,
}) => {
  const [selectedTx, setSelectedTx] = useState<LedgerEntry | null>(null);

  const getEntryIcon = (type: string) => {
    return type === 'credit' ? (
      <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center text-success">
        <ArrowDownRight className="h-4 w-4" />
      </div>
    ) : (
      <div className="h-8 w-8 rounded-full bg-danger/10 flex items-center justify-center text-danger">
        <ArrowUpRight className="h-4 w-4" />
      </div>
    );
  };

  const getStatusBadge = (_type: string) => {
    // In current ledger, entries are immutable, so they are effectively "Completed"
    return <Badge variant="success">Completed</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-border-light dark:border-border-dark">
        <table className="w-full text-left border-collapse">
          <thead className="bg-bg-light-secondary dark:bg-bg-dark-secondary text-xs uppercase text-text-light-tertiary font-bold tracking-wider">
            <tr>
              <th className="px-4 py-3">Transaction</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light dark:divide-border-dark">
            {entries.length === 0 && !isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-light-tertiary">
                  No transactions found.
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-bg-light-tertiary dark:hover:bg-bg-dark-tertiary transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {getEntryIcon(entry.entry_type)}
                      <div>
                        <p className="text-sm font-semibold capitalize">
                          {entry.reference_type.replace('_', ' ')}
                        </p>
                        <p className="text-[10px] text-text-light-tertiary truncate max-w-[120px]">
                          {entry.description}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm font-bold">
                    <span className={entry.entry_type === 'credit' ? 'text-success' : 'text-danger'}>
                      {entry.entry_type === 'credit' ? '+' : '-'}{formatKES(entry.amount)}
                    </span>
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(entry.entry_type)}</td>
                  <td className="px-4 py-3 text-xs text-text-light-secondary">
                    {new Date(entry.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedTx(entry)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            onClick={onLoadMore}
            isLoading={isLoading}
            className="w-full sm:w-auto"
          >
            Load More Transactions
          </Button>
        </div>
      )}

      <Modal
        isOpen={!!selectedTx}
        onClose={() => setSelectedTx(null)}
        title="Transaction Details"
      >
        {selectedTx && (
          <Stack gap="lg">
            <div className="p-4 rounded bg-bg-light-tertiary dark:bg-bg-dark-tertiary border border-border-light dark:border-border-dark space-y-3">
              <div className="flex justify-between">
                <span className="text-xs text-text-light-tertiary uppercase font-bold">Reference ID</span>
                <span className="text-xs font-mono">{selectedTx.reference_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-text-light-tertiary uppercase font-bold">Type</span>
                <span className="text-xs font-medium capitalize">{selectedTx.reference_type.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between border-t border-border-light dark:border-border-dark pt-3">
                <span className="text-xs text-text-light-tertiary uppercase font-bold">Balance Before</span>
                <span className="text-xs font-mono">{formatKES(selectedTx.balance_before)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-text-light-tertiary uppercase font-bold">Balance After</span>
                <span className="text-xs font-mono font-bold">{formatKES(selectedTx.balance_after)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-text-light-tertiary">
              <Clock className="h-3 w-3" />
              <span>Processed at {new Date(selectedTx.created_at).toLocaleString()}</span>
            </div>
          </Stack>
        )}
      </Modal>
    </div>
  );
};
