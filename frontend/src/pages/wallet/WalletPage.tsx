import { useEffect, useState } from 'react';
import { useWallet } from '@/shared/hooks/useWallet';
import { formatKES } from '@/shared/utils/currencyUtils';
import { useAuth } from '@/shared/hooks/useAuth';
import {
  Card,
  Container,
  Stack,
  Button,
  Badge,
  Modal,
  Spinner,
} from '@/shared/components';
import { TransactionHistory } from './components/TransactionHistory';
import { DepositForm } from './components/DepositForm';
import { WithdrawForm } from './components/WithdrawForm';
import { Wallet, ArrowUpCircle, ArrowDownCircle, ShieldCheck, RefreshCw } from 'lucide-react';

export const WalletPage = () => {
  const { user } = useAuth();
  const {
    balance,
    ledger,
    isLoading,
    isLedgerLoading,
    hasMore,
    nextCursor,
    fetchBalance,
    fetchLedger,
  } = useWallet();

  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const handleRefresh = () => {
    fetchBalance();
    fetchLedger();
  };

  const getKycBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return <Badge variant="success">Verified</Badge>;
      case 'pending':
        return <Badge variant="warning">Review Pending</Badge>;
      default:
        return <Badge variant="danger">Unverified</Badge>;
    }
  };

  return (
    <Container className="max-w-6xl py-6">
      <Stack gap="xl">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Stack gap="xs">
            <h1 className="text-3xl font-bold tracking-tight text-text-light-primary dark:text-text-dark-primary">
              My Wallet
            </h1>
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-light-tertiary uppercase font-bold tracking-wider">KYC Status:</span>
              {getKycBadge(user?.kycStatus || 'none')}
            </div>
          </Stack>
          <Button variant="ghost" size="sm" onClick={handleRefresh} isLoading={isLoading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 relative overflow-hidden">
            <div className="absolute right-[-10px] bottom-[-10px] text-brand/5 opacity-50 dark:opacity-10">
              <Wallet className="h-24 w-24" />
            </div>
            <Stack gap="sm">
              <span className="text-xs text-text-light-tertiary uppercase font-bold tracking-wider">Total Balance</span>
              <div className="text-2xl font-mono font-black text-brand">
                {isLoading && !balance ? <Spinner size="sm" /> : formatKES(balance?.balance || '0')}
              </div>
            </Stack>
          </Card>

          <Card className="p-6 border-l-4 border-l-success">
            <Stack gap="sm">
              <span className="text-xs text-text-light-tertiary uppercase font-bold tracking-wider">Available Funds</span>
              <div className="text-2xl font-mono font-black text-success">
                {isLoading && !balance ? <Spinner size="sm" /> : formatKES(balance?.available_balance || '0')}
              </div>
            </Stack>
          </Card>

          <Card className="p-6 border-l-4 border-l-warning">
            <Stack gap="sm">
              <span className="text-xs text-text-light-tertiary uppercase font-bold tracking-wider">Locked (Active Trades)</span>
              <div className="text-2xl font-mono font-black text-warning">
                {isLoading && !balance ? <Spinner size="sm" /> : formatKES(balance?.locked_balance || '0')}
              </div>
            </Stack>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button
            className="flex-1 h-14 text-lg font-bold"
            onClick={() => setIsDepositOpen(true)}
          >
            <ArrowDownCircle className="h-5 w-5 mr-2" />
            Deposit
          </Button>
          <Button
            variant="secondary"
            className="flex-1 h-14 text-lg font-bold"
            onClick={() => setIsWithdrawOpen(true)}
            disabled={user?.kycStatus !== 'verified'}
          >
            <ArrowUpCircle className="h-5 w-5 mr-2" />
            Withdraw
          </Button>
        </div>

        {/* Transaction History Section */}
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-border-light dark:border-border-dark flex items-center justify-between">
            <h2 className="text-lg font-bold">Transaction History</h2>
            <div className="flex items-center gap-2 text-xs text-text-light-tertiary">
              <ShieldCheck className="h-3 w-3" />
              <span>Immutable Ledger Records</span>
            </div>
          </div>
          <TransactionHistory
            entries={ledger}
            isLoading={isLedgerLoading}
            hasMore={hasMore}
            onLoadMore={() => fetchLedger(nextCursor)}
          />
        </Card>
      </Stack>

      {/* Modals */}
      <Modal
        isOpen={isDepositOpen}
        onClose={() => setIsDepositOpen(false)}
        title="Deposit Funds via M-Pesa"
      >
        <DepositForm onSuccess={() => {
          setIsDepositOpen(false);
          handleRefresh();
        }} />
      </Modal>

      <Modal
        isOpen={isWithdrawOpen}
        onClose={() => setIsWithdrawOpen(false)}
        title="Withdraw Funds to M-Pesa"
      >
        <WithdrawForm
          availableBalance={balance?.available_balance || '0'}
          onSuccess={() => {
            setIsWithdrawOpen(false);
            handleRefresh();
          }}
        />
      </Modal>
    </Container>
  );
};
