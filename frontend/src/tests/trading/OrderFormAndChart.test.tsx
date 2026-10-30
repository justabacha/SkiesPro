import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderForm } from '@/modules/trading/components/OrderForm';
import { TradingChart } from '@/modules/trading/components/TradingChart';
import { Asset } from '@/modules/trading/types/trading.types';

vi.mock('@/shared/hooks/useAuth', () => ({
  useAuth: () => ({ user: { kycStatus: 'verified' } }),
}));

vi.mock('@/shared/hooks/usePublicConfig', () => ({
  usePublicConfig: () => ({
    minDuration: 60,
    maxDuration: 3600,
    defaultPayoutRatio: 0.6,
    kycRequiredForTrading: false,
    isLoading: false,
  }),
}));

vi.mock('@/shared/context/AccountModeContext', () => ({
  useAccountMode: () => ({ accountMode: 'real' }),
}));

vi.mock('lightweight-charts', () => ({
  createChart: () => ({
    addSeries: () => ({
      setData: vi.fn(),
      update: vi.fn(),
      applyOptions: vi.fn(),
      createPriceLine: vi.fn(() => ({})),
      removePriceLine: vi.fn(),
    }),
    applyOptions: vi.fn(),
    priceScale: () => ({ applyOptions: vi.fn() }),
    timeScale: () => ({ setVisibleLogicalRange: vi.fn(), applyOptions: vi.fn() }),
    remove: vi.fn(),
  }),
  ColorType: { Solid: 'solid' },
  PriceScaleMode: { Normal: 0 },
  CandlestickSeries: 'CandlestickSeries',
  AreaSeries: 'AreaSeries',
  LineStyle: { Dashed: 2 },
}));

vi.mock('@/modules/trading/services/tradingService', () => ({
  tradingService: {
    getCandles: vi.fn().mockResolvedValue([]),
  },
}));

const mockAsset: Asset = {
  symbol: 'EUR/USD',
  name: 'Euro / US Dollar',
  assetType: 'forex',
  isActive: true,
  payoutRate: 0.60,
  minStake: 100,
  maxStake: 50000,
  minExpirySeconds: 60,
  maxExpirySeconds: 900,
  pipDecimalPlaces: 5,
  isOpen: true,
};

describe('OrderForm Trade Button Resilience', () => {
  afterEach(() => cleanup());

  it('keeps Higher / Lower buttons enabled when isStale is true but isConnected is true', () => {
    render(
      <OrderForm
        asset={mockAsset}
        selectedSymbol="EUR/USD"
        currentPrice={1.0950}
        isPriceAvailable={true}
        isStale={true}
        isConnected={true}
        userBalance={10000}
        isPlacingTrade={false}
        onPlaceTrade={vi.fn()}
        tradeError={null}
        onClearError={vi.fn()}
      />
    );

    const higherBtn = screen.getByTestId('btn-higher') as HTMLButtonElement;
    const lowerBtn = screen.getByTestId('btn-lower') as HTMLButtonElement;

    expect(higherBtn.disabled).toBe(false);
    expect(lowerBtn.disabled).toBe(false);
  });

  it('disables Higher / Lower buttons when isStale is true AND isConnected is false', () => {
    render(
      <OrderForm
        asset={mockAsset}
        selectedSymbol="EUR/USD"
        currentPrice={1.0950}
        isPriceAvailable={true}
        isStale={true}
        isConnected={false}
        userBalance={10000}
        isPlacingTrade={false}
        onPlaceTrade={vi.fn()}
        tradeError={null}
        onClearError={vi.fn()}
      />
    );

    const higherBtn = screen.getByTestId('btn-higher') as HTMLButtonElement;
    const lowerBtn = screen.getByTestId('btn-lower') as HTMLButtonElement;

    expect(higherBtn.disabled).toBe(true);
    expect(lowerBtn.disabled).toBe(true);
  });

  it('triggers onRefreshQuote when clicking trade button while price is stale', () => {
    const onRefreshQuote = vi.fn();
    const onPlaceTrade = vi.fn();

    render(
      <OrderForm
        asset={mockAsset}
        selectedSymbol="EUR/USD"
        currentPrice={1.0950}
        isPriceAvailable={true}
        isStale={true}
        isConnected={true}
        userBalance={10000}
        isPlacingTrade={false}
        onPlaceTrade={onPlaceTrade}
        tradeError={null}
        onClearError={vi.fn()}
        onRefreshQuote={onRefreshQuote}
      />
    );

    const higherBtn = screen.getByTestId('btn-higher');
    fireEvent.click(higherBtn);

    expect(onRefreshQuote).toHaveBeenCalledTimes(1);
    expect(onPlaceTrade).not.toHaveBeenCalled();
    expect(screen.getAllByText(/Price feed delayed. Refreshing quote.../i).length).toBeGreaterThan(0);
  });
});

describe('TradingChart Empty History Resilience', () => {
  beforeEach(() => {
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  afterEach(() => cleanup());

  it('renders TradingChart with empty [] history array without throwing a React error', () => {
    expect(() => {
      render(
        <TradingChart
          symbol="EUR/USD"
          priceHistory={[]}
          currentPrice={0}
          activeContracts={[]}
        />
      );
    }).not.toThrow();

    expect(screen.getByTestId('trading-chart')).toBeTruthy();
    expect(screen.getByTestId('chart-empty-overlay')).toBeTruthy();
  });

  it('renders TradingChart successfully when getCandles returns gapped candles', async () => {
    const { tradingService } = await import('@/modules/trading/services/tradingService');
    vi.mocked(tradingService.getCandles).mockResolvedValue([
      {
        symbol: 'EUR/USD',
        granularity_seconds: 60,
        open_time: new Date(Date.now() - 300000).toISOString(),
        close_time: new Date(Date.now() - 240000).toISOString(),
        open: 1.1000,
        high: 1.1010,
        low: 1.0990,
        close: 1.1005,
        volume: 100,
      },
      {
        symbol: 'EUR/USD',
        granularity_seconds: 60,
        open_time: new Date(Date.now()).toISOString(),
        close_time: new Date(Date.now() + 60000).toISOString(),
        open: 1.1005,
        high: 1.1020,
        low: 1.1000,
        close: 1.1015,
        volume: 150,
      },
    ]);

    render(
      <TradingChart
        symbol="EUR/USD"
        priceHistory={[]}
        currentPrice={1.1015}
        activeContracts={[]}
      />
    );

    expect(screen.getByTestId('trading-chart')).toBeTruthy();
  });
});
