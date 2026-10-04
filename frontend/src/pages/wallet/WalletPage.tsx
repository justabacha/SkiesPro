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
    generation,
    fetchBalance,
    fetchLedger,
  } = useWallet({ accountMode: 'real', pollBalance: true });

  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger, generation]);

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
    <Container className="max-w-6xl min-w-0 py-4 sm:py-6">
      <Stack gap="lg">
        {/* Header Section */}
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Stack gap="xs">
            <h1 className="text-2xl font-bold tracking-tight text-text-light-primary dark:text-text-dark-primary sm:text-3xl">
              My Wallet
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-text-light-tertiary uppercase font-bold tracking-wider">KYC Status:</span>
              {getKycBadge(user?.kycStatus || 'none')}
            </div>
          </Stack>
          <Button variant="ghost" size="sm" onClick={handleRefresh} isLoading={isLoading} className="w-full sm:w-auto">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Balance Cards */}
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3 xl:gap-6">
          <Card className="relative min-w-0 overflow-hidden p-4 sm:p-6">
            <div className="absolute right-[-10px] bottom-[-10px] text-brand/5 opacity-50 dark:opacity-10">
              <Wallet className="h-20 w-20 sm:h-24 sm:w-24" />
            </div>
            <Stack gap="sm">
              <span className="text-xs text-text-light-tertiary uppercase font-bold tracking-wider">Total Balance</span>
              <div className="break-words text-xl font-mono font-black tracking-tight text-brand sm:text-2xl">
                {isLoading && !balance ? <Spinner size="sm" /> : formatKES(balance?.balance || '0')}
              </div>
            </Stack>
          </Card>

          <Card className="min-w-0 border-l-4 border-l-success p-4 sm:p-6">
            <Stack gap="sm">
              <span className="text-xs text-text-light-tertiary uppercase font-bold tracking-wider">Available Funds</span>
              <div className="break-words text-xl font-mono font-black tracking-tight text-success sm:text-2xl">
                {isLoading && !balance ? <Spinner size="sm" /> : formatKES(balance?.available_balance || '0')}
              </div>
            </Stack>
          </Card>

          <Card className="min-w-0 border-l-4 border-l-warning p-4 sm:p-6 sm:col-span-2 xl:col-span-1">
            <Stack gap="sm">
              <span className="text-xs text-text-light-tertiary uppercase font-bold tracking-wider">Locked <span className="normal-case">(Active Trades)</span></span>
              <div className="break-words text-xl font-mono font-black tracking-tight text-warning sm:text-2xl">
                {isLoading && !balance ? <Spinner size="sm" /> : formatKES(balance?.locked_balance || '0')}
              </div>
            </Stack>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Button
            className="h-12 w-full text-base font-bold sm:h-14 sm:flex-1 sm:text-lg"
            onClick={() => setIsDepositOpen(true)}
          >
            <ArrowDownCircle className="h-5 w-5 mr-2" />
            Deposit
          </Button>
          <Button
            variant="secondary"
            className="h-12 w-full text-base font-bold sm:h-14 sm:flex-1 sm:text-lg"
            onClick={() => setIsWithdrawOpen(true)}
            disabled={user?.kycStatus !== 'verified'}
          >
            <ArrowUpCircle className="h-5 w-5 mr-2" />
            Withdraw
          </Button>
        </div>

        {/* Transaction History Section */}
        <Card className="p-0 overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-border-light p-4 dark:border-border-dark sm:flex-row sm:items-center sm:justify-between">
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
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:p-6"
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
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:p-6"
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
