import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  createChart,
  IPriceLine,
  PriceScaleMode,
  ISeriesApi,
  LineStyle,
  UTCTimestamp,
} from 'lightweight-charts';
import { PriceTick, BinaryContract } from '../types/trading.types';
import { tradingService } from '../services/tradingService';
import { getPipSize, getPriceDecimalPlaces } from '../utils/pricePrecision';
import { useAccountMode } from '@/shared/context/AccountModeContext';

export interface TradingChartProps {
  symbol: string;
  priceHistory: PriceTick[];
  currentPrice: number;
  activeContracts?: BinaryContract[];
  pipDecimalPlaces?: number;
}

type Time = UTCTimestamp;
type PriceLineSeries = ISeriesApi<'Candlestick'> | ISeriesApi<'Area'>;

const TIMEFRAMES: Record<string, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1H': 3600,
  '4H': 14400,
  '1D': 86400,
};

const cacheSymbol = (symbol: string | null | undefined) =>
  (symbol ?? '')
    .replace(/^DEMO[-_]?/i, '')
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase();
const contractSymbol = (contract: BinaryContract) => {
  const payload = contract as BinaryContract & {
    assetSymbol?: string;
    symbol?: string;
    pair?: string;
  };
  return payload.asset_symbol || payload.assetSymbol || payload.symbol || payload.pair || 'EUR/USD';
};
const toUnixSeconds = (value: unknown): number | null => {
  let timestamp: number;
  if (value instanceof Date) {
    timestamp = value.getTime();
  } else if (typeof value === 'number') {
    timestamp = value;
  } else if (typeof value === 'string') {
    const numericValue = Number(value);
    timestamp = Number.isFinite(numericValue) ? numericValue : Date.parse(value);
  } else {
    return null;
  }

  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  const seconds =
    timestamp > 1_000_000_000_000 ? Math.floor(timestamp / 1000) : Math.floor(timestamp);
  return Number.isSafeInteger(seconds) ? seconds : null;
};

const normalizeCandles = (
  candles: Awaited<ReturnType<typeof tradingService.getCandles>>
): Array<{ time: Time; open: number; high: number; low: number; close: number }> => {
  const byTime = new Map<
    number,
    { time: Time; open: number; high: number; low: number; close: number }
  >();

  for (const candle of candles) {
    const time = toUnixSeconds(candle.open_time);
    const values = [
      Number(candle.open),
      Number(candle.high),
      Number(candle.low),
      Number(candle.close),
    ];
    if (time === null || !values.every((v) => Number.isFinite(v) && v > 0)) continue;
    if (values[1] < values[2] || values[1] < values[0] || values[1] < values[3]) continue;
    byTime.set(time, {
      time: time as Time,
      open: values[0],
      high: values[1],
      low: values[2],
      close: values[3],
    });
  }

  return [...byTime.values()].sort((a, b) => Number(a.time) - Number(b.time));
};

export const TradingChart: React.FC<TradingChartProps> = ({
  symbol,
  priceHistory,
  currentPrice,
  activeContracts = [],
  pipDecimalPlaces,
}) => {
  const { accountMode } = useAccountMode();
  const displaySymbol = typeof symbol === 'string' && symbol.trim() ? symbol : 'EUR/USD';
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>(() => {
    return localStorage.getItem('skies_timeframe') || '1m';
  });
  const [chartType, setChartType] = useState<'line' | 'candle'>(() => {
    const saved = localStorage.getItem('skies_chart_type');
    return saved === 'candle' || saved === 'line' ? saved : 'line';
  });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const areaSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const currentCandleRef = useRef<{
    time: Time;
    open: number;
    high: number;
    low: number;
    close: number;
  } | null>(null);
  const dataLengthRef = useRef(0);
  const lastAppliedTickRef = useRef<string>('');
  const latestCandleTimeRef = useRef<number | null>(null);
  const latestAreaTimeRef = useRef<number | null>(null);
  const candleHistoryReadyRef = useRef(false);
  const pendingTicksRef = useRef<PriceTick[]>([]);
  const priceLinesRef = useRef<Array<{ series: PriceLineSeries; line: IPriceLine }>>([]);
  const activeContractsRef = useRef(activeContracts);
  const symbolRef = useRef(symbol);
  const lastAppliedPipPlacesRef = useRef<number | null>(null);

  activeContractsRef.current = activeContracts;
  symbolRef.current = symbol;
  const granularity = TIMEFRAMES[selectedTimeframe] || TIMEFRAMES['1m'];

  const applyTick = React.useCallback(
    (tick: PriceTick) => {
      if (!candleHistoryReadyRef.current) {
        pendingTicksRef.current.push(tick);
        return;
      }
      if (!Number.isFinite(tick.price) || tick.price <= 0) return;

      const seconds = toUnixSeconds(tick.tick_time || tick.timestamp);
      if (seconds === null) return;
      if (
        (latestCandleTimeRef.current !== null && seconds <= latestCandleTimeRef.current) ||
        (latestAreaTimeRef.current !== null && seconds <= latestAreaTimeRef.current)
      ) {
        return;
      }

      const candleSeries = candleSeriesRef.current;
      const areaSeries = areaSeriesRef.current;
      if (!candleSeries || !areaSeries) return;

      const time = seconds as Time;
      const tickKey = `${seconds}:${tick.price}`;
      if (lastAppliedTickRef.current === tickKey) return;

      const candleStart = (Math.floor(seconds / granularity) * granularity) as Time;
      const current = currentCandleRef.current;
      if (current && Number(candleStart) < Number(current.time)) return;

      if (current && candleStart === current.time) {
        current.high = Math.max(current.high, tick.price);
        current.low = Math.min(current.low, tick.price);
        current.close = tick.price;
        candleSeries.update({ ...current, time: Number(current.time) as Time });
      } else {
        const next = {
          time: Number(candleStart) as Time,
          open: tick.price,
          high: tick.price,
          low: tick.price,
          close: tick.price,
        };
        currentCandleRef.current = next;
        candleSeries.update(next);
        dataLengthRef.current = Math.max(1, dataLengthRef.current + (current ? 1 : 0));
      }
      areaSeries.update({ time: Number(time) as Time, value: tick.price });
      latestCandleTimeRef.current = Math.max(
        latestCandleTimeRef.current ?? Number(candleStart),
        Number(candleStart)
      );
      latestAreaTimeRef.current = seconds;
      lastAppliedTickRef.current = tickKey;
    },
    [granularity]
  );

  const applyTickRef = useRef(applyTick);
  applyTickRef.current = applyTick;

  useEffect(() => {
    localStorage.setItem('skies_timeframe', selectedTimeframe);
  }, [selectedTimeframe]);

  useEffect(() => {
    localStorage.setItem('skies_chart_type', chartType);
  }, [chartType]);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.12)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.12)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(148, 163, 184, 0.2)',
        autoScale: true,
        mode: PriceScaleMode.Normal,
        alignLabels: true,
        borderVisible: false,
        scaleMargins: {
          top: 0.2,    // 20% margin top
          bottom: 0.2, // 20% margin bottom
        },
      },
      timeScale: {
        borderColor: 'rgba(148, 163, 184, 0.2)',
        timeVisible: true,
        barSpacing: window.innerWidth < 640 ? 16 : 10,
        rightOffset: 10,
      },
      crosshair: { mode: 1 },
    });

    chart.priceScale('right').applyOptions({
      autoScale: true,
      mode: PriceScaleMode.Normal,
      alignLabels: true,
      borderVisible: false,
      scaleMargins: {
        top: 0.2,
        bottom: 0.2,
      },
    });

    const setResponsiveViewport = () => {
      chart.applyOptions({
        timeScale: {
          barSpacing: window.innerWidth < 640 ? 16 : 10,
          rightOffset: 10,
        },
      });
    };

    const initialPipPlaces = getPriceDecimalPlaces(symbol, pipDecimalPlaces, currentPrice);
    const initialMinMove = Number((10 ** -initialPipPlaces).toFixed(initialPipPlaces));
    const initialPriceFormat = {
      type: 'price' as const,
      precision: initialPipPlaces,
      minMove: initialMinMove,
    };

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#00E676',
      downColor: '#FF5252',
      borderVisible: false,
      wickUpColor: '#00E676',
      wickDownColor: '#FF5252',
      visible: false,
      priceFormat: initialPriceFormat,
    });
    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: '#00E676',
      topColor: 'rgba(0, 230, 118, 0.45)',
      bottomColor: 'rgba(0, 230, 118, 0.0)',
      lineWidth: 2,
      visible: false,
      priceFormat: initialPriceFormat,
    });
    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    areaSeriesRef.current = areaSeries;

    const resizeObserver = new ResizeObserver(([entry]) => {
      const width = Math.floor(entry.contentRect.width);
      chart.applyOptions({
        width,
        height: Math.floor(entry.contentRect.height),
      });
      setResponsiveViewport();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      priceLinesRef.current.forEach(({ series, line }) => series.removePriceLine(line));
      priceLinesRef.current = [];
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      areaSeriesRef.current = null;
      currentCandleRef.current = null;
      dataLengthRef.current = 0;
      lastAppliedTickRef.current = '';
      latestCandleTimeRef.current = null;
      latestAreaTimeRef.current = null;
      candleHistoryReadyRef.current = false;
      pendingTicksRef.current = [];
      lastAppliedPipPlacesRef.current = null;
    };
  }, []);

  useEffect(() => {
    candleSeriesRef.current?.applyOptions({ visible: chartType === 'candle' });
    areaSeriesRef.current?.applyOptions({ visible: chartType === 'line' });
  }, [chartType]);

  useEffect(() => {
    const pipPlaces = getPriceDecimalPlaces(symbol, pipDecimalPlaces, currentPrice);
    if (lastAppliedPipPlacesRef.current === pipPlaces) return;
    lastAppliedPipPlacesRef.current = pipPlaces;

    const minMove = Number((10 ** -pipPlaces).toFixed(pipPlaces));
    const priceFormat = {
      type: 'price' as const,
      precision: pipPlaces,
      minMove,
    };
    candleSeriesRef.current?.applyOptions({ priceFormat });
    areaSeriesRef.current?.applyOptions({ priceFormat });
    chartRef.current?.applyOptions({
      localization: { priceFormatter: (p: number) => p.toFixed(pipPlaces) },
    });
  }, [symbol, pipDecimalPlaces, currentPrice]);

  const activeContractsKey = useMemo(
    () =>
      activeContracts
        .filter((contract) => cacheSymbol(contractSymbol(contract)) === cacheSymbol(symbol))
        .map((contract) =>
          [
            contract.id,
            contract.contract_type,
            contract.strike_price,
            contract.stake,
            contract.potential_payout,
          ].join(':')
        )
        .join('|'),
    [activeContracts, symbol]
  );

  const symbolContracts = useMemo(
    () => {
      if (!activeContractsKey) return [];
      return activeContractsRef.current.filter(
        (contract) => cacheSymbol(contractSymbol(contract)) === cacheSymbol(symbolRef.current)
      );
    },
    // The key intentionally keeps the same result reference during identical polling responses.
    [activeContractsKey]
  );

  const latestContract = symbolContracts[symbolContracts.length - 1];
  const pipPlaces = getPriceDecimalPlaces(symbol, pipDecimalPlaces, currentPrice);
  const pipSize = getPipSize(symbol, pipPlaces, currentPrice);
  const strike = latestContract ? Number(latestContract.strike_price) : NaN;
  const isHigher = latestContract?.contract_type === 'higher';
  const isWinning =
    currentPrice > 0 &&
    latestContract !== undefined &&
    (isHigher ? currentPrice > strike : currentPrice < strike);
  const pipDelta =
    latestContract && Number.isFinite(strike) ? (currentPrice - strike) / pipSize : 0;
  const payout = latestContract ? Number(latestContract.potential_payout || 0) : 0;

  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const areaSeries = areaSeriesRef.current;
    const chart = chartRef.current;
    if (!candleSeries || !areaSeries || !chart) return;

    let isCurrent = true;
    candleHistoryReadyRef.current = false;
    currentCandleRef.current = null;
    dataLengthRef.current = 0;
    lastAppliedTickRef.current = '';
    latestCandleTimeRef.current = null;
    latestAreaTimeRef.current = null;
    pendingTicksRef.current = [];
    priceLinesRef.current.forEach(({ series, line }) => series.removePriceLine(line));
    priceLinesRef.current = [];
    candleSeries.setData([]);
    areaSeries.setData([]);

    const loadHistory =
      accountMode === 'demo'
        ? Promise.resolve([])
        : tradingService.getCandles(symbol, granularity, 200);
    void loadHistory
      .then((data) => {
        if (!isCurrent) return;
        const candles = normalizeCandles(data);
        candleSeries.setData(candles);
        areaSeries.setData(candles.map(({ time, close }) => ({ time, value: close })));
        dataLengthRef.current = candles.length;
        const last = candles[candles.length - 1];
        currentCandleRef.current = last ? { ...last } : null;
        latestCandleTimeRef.current = last ? Number(last.time) : null;
        latestAreaTimeRef.current = latestCandleTimeRef.current;
        candleHistoryReadyRef.current = true;

        const ticks = [...pendingTicksRef.current].sort(
          (a, b) =>
            (toUnixSeconds(a.tick_time || a.timestamp) ?? 0) -
            (toUnixSeconds(b.tick_time || b.timestamp) ?? 0)
        );
        pendingTicksRef.current = [];
        for (const tick of ticks) applyTickRef.current(tick);

        const totalBars = candles.length;
        if (totalBars > 0) {
          chart.timeScale().setVisibleLogicalRange({
            from: Math.max(0, totalBars - 50),
            to: totalBars + 3, // Right-hand margin for incoming ticks
          });
        }
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        console.error('Failed to load chart candle history', error);
        candleSeries.setData([]);
        areaSeries.setData([]);
        currentCandleRef.current = null;
        dataLengthRef.current = 0;
        latestCandleTimeRef.current = null;
        latestAreaTimeRef.current = null;
        candleHistoryReadyRef.current = true;
        const pendingTicks = [...pendingTicksRef.current];
        pendingTicksRef.current = [];
        for (const tick of pendingTicks) applyTickRef.current(tick);
      });

    return () => {
      isCurrent = false;
    };
  }, [accountMode, symbol, granularity]);

  useEffect(() => {
    const matchingTicks = priceHistory
      .filter((tick) => tick.source === (accountMode === 'demo' ? 'demo' : 'live'))
      .filter((tick) => cacheSymbol(tick.symbol) === cacheSymbol(symbol))
      .filter((tick) => toUnixSeconds(tick.tick_time || tick.timestamp) !== null)
      .sort(
        (a, b) =>
          (toUnixSeconds(a.tick_time || a.timestamp) ?? 0) -
          (toUnixSeconds(b.tick_time || b.timestamp) ?? 0)
      );

    if (!candleHistoryReadyRef.current) {
      pendingTicksRef.current = matchingTicks;
      return;
    }

    for (const tick of matchingTicks) applyTickRef.current(tick);
  }, [accountMode, priceHistory, symbol]);

  useEffect(() => {
    const series: PriceLineSeries | null =
      chartType === 'candle' ? candleSeriesRef.current : areaSeriesRef.current;
    if (!series) return;

    priceLinesRef.current.forEach(({ series: previousSeries, line }) =>
      previousSeries.removePriceLine(line)
    );
    priceLinesRef.current = symbolContracts
      .map((contract) => {
        const price = Number(contract.strike_price);
        if (!Number.isFinite(price)) return null;
        const higher = contract.contract_type === 'higher';
        const line = series.createPriceLine({
          price,
          color: higher ? '#00E676' : '#FF5252',
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `${higher ? 'CALL' : 'PUT'} ${contractSymbol(contract)}`,
        });
        return { series, line };
      })
      .filter((entry): entry is { series: PriceLineSeries; line: IPriceLine } => entry !== null);
  }, [activeContractsKey, chartType, symbol, symbolContracts]);

  return (
    <div
      data-testid="trading-chart"
      className="relative min-w-0 w-full rounded-2xl bg-bg-light-secondary dark:bg-bg-dark-secondary border border-border-light dark:border-border-dark p-3 sm:p-4 shadow-xl flex flex-col justify-between overflow-hidden min-h-[320px] sm:min-h-[380px] transition-colors duration-200"
    >
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2 z-10 pb-2 border-b border-border-light dark:border-border-dark/50">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <span className="font-bold text-sm sm:text-base text-text-light-primary dark:text-text-dark-primary font-mono">
            {displaySymbol}
          </span>
          <span className="font-mono text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400">
            {currentPrice > 0 ? currentPrice.toFixed(pipPlaces) : '--'}
          </span>
        </div>

        <div className="flex min-w-0 max-w-full items-center gap-2 overflow-x-auto pb-1 sm:space-x-3 sm:overflow-visible sm:pb-0">
          <div
            data-testid="chart-type-toggle"
            className="flex shrink-0 items-center space-x-0.5 sm:space-x-1 bg-bg-light-tertiary dark:bg-bg-dark-tertiary p-0.5 sm:p-1 rounded-lg border border-border-light dark:border-border-dark"
          >
            {(['line', 'candle'] as const).map((type) => (
              <button
                key={type}
                type="button"
                data-testid={`chart-type-${type}`}
                onClick={() => setChartType(type)}
                className={`px-2 sm:px-2.5 py-0.5 sm:py-1 text-[11px] sm:text-xs font-mono font-medium rounded-md transition-colors ${
                  chartType === type
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-text-light-secondary dark:text-text-dark-secondary hover:text-text-light-primary dark:hover:text-text-dark-primary hover:bg-bg-light-secondary dark:hover:bg-bg-dark-secondary'
                }`}
              >
                {type === 'line' ? 'Line' : 'Candle'}
              </button>
            ))}
          </div>

          <div
            data-testid="timeframe-selector"
            className="flex shrink-0 items-center space-x-1 bg-bg-light-tertiary dark:bg-bg-dark-tertiary p-0.5 sm:p-1 rounded-lg border border-border-light dark:border-border-dark"
          >
            {Object.keys(TIMEFRAMES).map((timeframe) => (
              <button
                key={timeframe}
                type="button"
                onClick={() => setSelectedTimeframe(timeframe)}
                className={`px-2 sm:px-2.5 py-0.5 sm:py-1 text-[11px] sm:text-xs font-mono font-medium rounded-md transition-colors ${
                  selectedTimeframe === timeframe
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-text-light-secondary dark:text-text-dark-secondary hover:text-text-light-primary dark:hover:text-text-dark-primary hover:bg-bg-light-secondary dark:hover:bg-bg-dark-secondary'
                }`}
              >
                {timeframe}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative flex-1 w-full mt-3 sm:mt-4 min-h-[240px] sm:min-h-[280px]">
        <div ref={containerRef} className="absolute inset-0" data-testid="chart-canvas" />
        <div className="absolute left-2 bottom-2 right-2 flex items-center justify-between pointer-events-none z-20 gap-2">
          {latestContract && currentPrice > 0 ? (
            <div
              data-testid="pip-delta-pill"
              className={`pointer-events-auto px-2 sm:px-3 py-1 rounded-lg text-[10px] sm:text-xs font-mono font-bold text-white shadow-md flex items-center space-x-1.5 backdrop-blur-sm ${
                isWinning ? 'bg-emerald-600/95' : 'bg-rose-600/95'
              }`}
            >
              <span>
                {pipDelta >= 0 ? '+' : ''}
                {pipDelta.toFixed(1)} Pips
              </span>
              <span>({isWinning ? `WINNING +KES ${payout.toFixed(2)}` : 'LOSING'})</span>
            </div>
          ) : (
            <div />
          )}
          <div className="pointer-events-auto bg-bg-light-primary/95 dark:bg-bg-dark-tertiary/95 border border-border-light dark:border-border-dark px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-mono flex items-center space-x-1.5 backdrop-blur-sm shadow-md">
            <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-text-light-primary dark:text-text-dark-primary font-bold">
              Spot: {currentPrice > 0 ? currentPrice.toFixed(pipPlaces) : '--'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
