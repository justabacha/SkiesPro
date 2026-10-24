import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoryPage } from '@/pages/history/HistoryPage';
import type { BinaryContract } from '@/modules/trading/types/trading.types';

const mocks = vi.hoisted(() => ({
  useTrading: vi.fn(),
  useAccountMode: vi.fn(),
  getContracts: vi.fn(),
}));

vi.mock('@/modules/trading/hooks/useTrading', () => ({
  useTrading: mocks.useTrading,
}));

vi.mock('@/shared/context/AccountModeContext', () => ({
  useAccountMode: mocks.useAccountMode,
}));

const makeContract = (
  id: string,
  assetSymbol = 'EUR/USD',
  status: BinaryContract['status'] = 'active',
  purchaseTime = '2026-10-24T10:00:00.000Z',
  settledAt?: string
): BinaryContract => ({
  id,
  user_id: 'user-1',
  asset_symbol: assetSymbol,
  contract_type: 'higher',
  stake: '100',
  strike_price: '1.10000',
  expiry_price: '1.10100',
  payout_rate: '0.8',
  potential_payout: '180',
  purchase_time: purchaseTime,
  expiry_time: '2026-10-24T10:01:00.000Z',
  status,
  settled_at: settledAt,
});

let accountMode: 'real' | 'demo';
let liveHistory: BinaryContract[];

const renderPage = () => render(<HistoryPage />);

const findTradeSymbol = (symbol: string) =>
  waitFor(() => within(screen.getByTestId('trade-history')).getByText(symbol));

describe('HistoryPage', () => {
  beforeEach(() => {
    accountMode = 'real';
    liveHistory = [];
    mocks.getContracts.mockReset().mockResolvedValue([]);
    mocks.useAccountMode.mockImplementation(() => ({ accountMode }));
    mocks.useTrading.mockImplementation(() => ({
      tradeHistory: liveHistory,
      getContracts: mocks.getContracts,
    }));
  });

  afterEach(() => cleanup());

  it('renders loading state initially', () => {
    mocks.getContracts.mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByText('Loading trade history...')).toBeTruthy();
  });

  it('renders empty state when contracts are empty', async () => {
    renderPage();
    expect(await screen.findByText('No trades in this mode yet.')).toBeTruthy();
  });

  it('renders rows from useTrading tradeHistory', async () => {
    liveHistory = [makeContract('live-1', 'GBP/USD')];
    renderPage();
    expect(await findTradeSymbol('GBP/USD')).toBeTruthy();
  });

  it('filters by status using getContracts', async () => {
    const won = makeContract('won-1', 'EUR/USD', 'won');
    mocks.getContracts.mockImplementation(async (params?: { status?: string }) =>
      params?.status === 'won' ? [won] : []
    );
    renderPage();
    await screen.findByText('No trades in this mode yet.');

    fireEvent.click(screen.getByRole('button', { name: 'Won' }));

    await waitFor(() => {
      expect(mocks.getContracts).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'won' }),
        expect.any(AbortSignal)
      );
    });
    expect(await findTradeSymbol('EUR/USD')).toBeTruthy();
  });

  it('filters by asset symbol', async () => {
    liveHistory = [makeContract('eur-1'), makeContract('gbp-1', 'GBP/USD')];
    mocks.getContracts.mockImplementation(async (params?: { asset_symbol?: string }) =>
      params?.asset_symbol ? [makeContract('gbp-1', params.asset_symbol)] : liveHistory
    );
    renderPage();
    await findTradeSymbol('GBP/USD');

    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by asset' }), {
      target: { value: 'GBP/USD' },
    });

    await waitFor(() => {
      expect(mocks.getContracts).toHaveBeenLastCalledWith(
        expect.objectContaining({ asset_symbol: 'GBP/USD' }),
        expect.any(AbortSignal)
      );
    });
    expect(await findTradeSymbol('GBP/USD')).toBeTruthy();
    expect(within(screen.getByTestId('trade-history')).queryByText('EUR/USD')).toBeNull();
  });

  it('loads the next page using the last purchase-time cursor', async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) =>
      makeContract(
        `page-1-${index}`,
        `Asset ${index}`,
        'active',
        new Date(Date.UTC(2026, 9, 24, 12, 0, 0) - index * 60_000).toISOString()
      )
    );
    const nextPage = [makeContract('page-2-1', 'NEXT/USD', 'won', '2026-10-23T00:00:00Z')];
    mocks.getContracts.mockImplementation(async (params?: { cursor?: string }) =>
      params?.cursor ? nextPage : firstPage
    );
    renderPage();
    await findTradeSymbol('Asset 0');

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));

    await waitFor(() => {
      expect(mocks.getContracts).toHaveBeenLastCalledWith(
        expect.objectContaining({ cursor: firstPage[19].purchase_time }),
        expect.any(AbortSignal)
      );
    });
    expect(await findTradeSymbol('NEXT/USD')).toBeTruthy();
  });

  it('clears rows and fetches page one when account mode changes', async () => {
    mocks.getContracts.mockImplementation(async (_params, signal) => {
      return signal ? [makeContract(accountMode, 'MODE/USD')] : [];
    });
    const view = renderPage();
    expect(await findTradeSymbol('MODE/USD')).toBeTruthy();
    expect(screen.getByText('Real')).toBeTruthy();

    accountMode = 'demo';
    view.rerender(<HistoryPage />);

    await waitFor(() => expect(screen.getByText('Demo')).toBeTruthy());
    expect(await findTradeSymbol('MODE/USD')).toBeTruthy();
    expect(mocks.getContracts).toHaveBeenLastCalledWith(
      expect.objectContaining({ limit: 20, cursor: undefined }),
      expect.any(AbortSignal)
    );
  });

  it('exports all pulled pages as a CSV download', async () => {
    const settledAt = '2026-10-24T10:02:03.456Z';
    const trade = makeContract('csv-1', 'EUR/USD', 'won', undefined, settledAt);
    mocks.getContracts.mockResolvedValue([trade]);
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:trade-history');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    let downloadedText = '';
    createObjectURL.mockImplementation((blob: Blob) => {
      const reader = new FileReader();
      reader.onload = () => {
        downloadedText = String(reader.result);
      };
      reader.readAsText(blob);
      return 'blob:trade-history';
    });

    renderPage();
    await findTradeSymbol('EUR/USD');
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    await waitFor(() => expect(click).toHaveBeenCalled());
    await waitFor(() => expect(downloadedText).toContain('id,asset_symbol'));
    expect(downloadedText.split('\r\n')).toHaveLength(2);
    expect(downloadedText).toContain('csv-1');
    expect(downloadedText.split('\r\n')[0]).toContain('settled_at');
    expect(downloadedText.split('\r\n')[1]).toContain(settledAt);
    expect(createObjectURL).toHaveBeenCalledOnce();
  });

  it('shows an error and retries the failed fetch', async () => {
    mocks.getContracts
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce([makeContract('retried-1')]);
    renderPage();

    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await findTradeSymbol('EUR/USD')).toBeTruthy();
    expect(mocks.getContracts).toHaveBeenCalledTimes(2);
  });
});
