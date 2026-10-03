import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  IPriceLine,
  ISeriesApi,
  LineSeries,
  LineStyle,
  UTCTimestamp,
} from 'lightweight-charts';
import { PriceTick, BinaryContract } from '../types/trading.types';
import { tradingService } from '../services/tradingService';
import { getPipSize, getPriceDecimalPlaces } from '../utils/pricePrecision';

export interface TradingChartProps {
  symbol: string;
  priceHistory: PriceTick[];
  currentPrice: number;
  activeContracts?: BinaryContract[];
  pipDecimalPlaces?: number;
}

type Time = UTCTimestamp;
type PriceLineSeries = ISeriesApi<'Candlestick'> | ISeriesApi<'Line'>;

const TIMEFRAMES: Record<string, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1H': 3600,
  '4H': 14400,
  '1D': 86400,
};

const cacheSymbol = (symbol: string) => symbol.replace(/[^a-z0-9]/gi, '').toUpperCase();
const toTime = (time: string): Time => Math.floor(new Date(time).getTime() / 1000) as Time;
export const TradingChart: React.FC<TradingChartProps> = ({
  symbol,
  priceHistory,
  currentPrice,
  activeContracts = [],
  pipDecimalPlaces,
}) => {
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
  const lineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const currentCandleRef = useRef<{ time: Time; open: number; high: number; low: number; close: number } | null>(null);
  const lastAppliedTickRef = useRef<string>('');
  const priceLinesRef = useRef<Array<{ series: PriceLineSeries; line: IPriceLine }>>([]);
  const priceHistoryRef = useRef(priceHistory);
  const activeContractsRef = useRef(activeContracts);
  const symbolRef = useRef(symbol);
  priceHistoryRef.current = priceHistory;
  activeContractsRef.current = activeContracts;
  symbolRef.current = symbol;
  const granularity = TIMEFRAMES[selectedTimeframe] || TIMEFRAMES['1m'];

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
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.12)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.12)' },
      },
      rightPriceScale: { borderColor: 'rgba(148, 163, 184, 0.2)' },
      timeScale: { borderColor: 'rgba(148, 163, 184, 0.2)', timeVisible: true },
      crosshair: { mode: 1 },
    });
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10B981',
      downColor: '#EF4444',
      borderVisible: false,
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
      visible: false,
    });
    const lineSeries = chart.addSeries(LineSeries, {
      color: '#10B981',
      lineWidth: 2,
      visible: false,
    });
    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    lineSeriesRef.current = lineSeries;

    const resizeObserver = new ResizeObserver(([entry]) => {
      chart.applyOptions({
        width: Math.floor(entry.contentRect.width),
        height: Math.floor(entry.contentRect.height),
      });
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      priceLinesRef.current.forEach(({ series, line }) => series.removePriceLine(line));
      priceLinesRef.current = [];
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      lineSeriesRef.current = null;
      currentCandleRef.current = null;
      lastAppliedTickRef.current = '';
    };
  }, []);

  useEffect(() => {
    candleSeriesRef.current?.applyOptions({ visible: chartType === 'candle' });
    lineSeriesRef.current?.applyOptions({ visible: chartType === 'line' });
  }, [chartType]);

  const activeContractsKey = useMemo(
    () =>
      activeContracts
        .filter((contract) => cacheSymbol(contract.asset_symbol) === cacheSymbol(symbol))
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
        (contract) => cacheSymbol(contract.asset_symbol) === cacheSymbol(symbolRef.current)
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
  const pipDelta = latestContract && Number.isFinite(strike) ? (currentPrice - strike) / pipSize : 0;
  const payout = latestContract ? Number(latestContract.potential_payout || 0) : 0;

  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const lineSeries = lineSeriesRef.current;
    const chart = chartRef.current;
    if (!candleSeries || !lineSeries || !chart) return;

    let isCurrent = true;
    currentCandleRef.current = null;
    lastAppliedTickRef.current = '';
    candleSeries.setData([]);
    lineSeries.setData([]);

    const applyTick = (price: number, timestamp: number) => {
      if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(timestamp)) return;
      const time = Math.floor(timestamp / 1000) as Time;
      const tickKey = `${time}:${price}`;
      if (lastAppliedTickRef.current === tickKey) return;
      lastAppliedTickRef.current = tickKey;

      const candleStart = (Math.floor(Number(time) / granularity) * granularity) as Time;
      const current = currentCandleRef.current;
      if (current && Number(candleStart) < Number(current.time)) return;

      if (current && candleStart === current.time) {
        current.high = Math.max(current.high, price);
        current.low = Math.min(current.low, price);
        current.close = price;
        candleSeries.update({ ...current });
      } else {
        const next = { time: candleStart, open: price, high: price, low: price, close: price };
        currentCandleRef.current = next;
        candleSeries.update(next);
      }
      lineSeries.update({ time, value: price });
    };

    tradingService.getCandles(symbol, granularity, 200).then((data) => {
      if (!isCurrent) return;
      const candles = data
        .map((candle) => ({
          time: toTime(candle.open_time),
          open: Number(candle.open),
          high: Number(candle.high),
          low: Number(candle.low),
          close: Number(candle.close),
        }))
        .filter(
          (candle) =>
            Number.isFinite(Number(candle.time)) &&
            [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite)
        )
        .sort((a, b) => Number(a.time) - Number(b.time));

      lastAppliedTickRef.current = '';
      candleSeries.setData(candles);
      lineSeries.setData(candles.map(({ time, close }) => ({ time, value: close })));
      const last = candles[candles.length - 1];
      currentCandleRef.current = last ? { ...last } : null;

      const lastTick = [...priceHistoryRef.current]
        .reverse()
        .find((tick) => cacheSymbol(tick.symbol) === cacheSymbol(symbol));
      if (lastTick) {
        const timestamp = new Date(lastTick.tick_time).getTime();
        applyTick(lastTick.price, timestamp);
      }
      chart.timeScale().fitContent();
    });

    return () => {
      isCurrent = false;
    };
  }, [symbol, granularity]);

  useEffect(() => {
    const lastTick = [...priceHistory]
      .reverse()
      .find((tick) => cacheSymbol(tick.symbol) === cacheSymbol(symbol));
    if (!lastTick) return;
    const timestamp = new Date(lastTick.tick_time).getTime();
    if (!Number.isFinite(timestamp)) return;

    const candleSeries = candleSeriesRef.current;
    const lineSeries = lineSeriesRef.current;
    if (!candleSeries || !lineSeries || lastAppliedTickRef.current === `${Math.floor(timestamp / 1000)}:${lastTick.price}`) {
      return;
    }

    const time = Math.floor(timestamp / 1000) as Time;
    const tickKey = `${time}:${lastTick.price}`;
    lastAppliedTickRef.current = tickKey;
    const candleStart = (Math.floor(Number(time) / granularity) * granularity) as Time;
    const current = currentCandleRef.current;
    if (current && Number(candleStart) < Number(current.time)) return;

    if (current && candleStart === current.time) {
      current.high = Math.max(current.high, lastTick.price);
      current.low = Math.min(current.low, lastTick.price);
      current.close = lastTick.price;
      candleSeries.update({ ...current });
    } else {
      const next = {
        time: candleStart,
        open: lastTick.price,
        high: lastTick.price,
        low: lastTick.price,
        close: lastTick.price,
      };
      currentCandleRef.current = next;
      candleSeries.update(next);
    }
    lineSeries.update({ time, value: lastTick.price });
  }, [priceHistory, symbol, granularity]);

  useEffect(() => {
    const series: PriceLineSeries | null =
      chartType === 'candle' ? candleSeriesRef.current : lineSeriesRef.current;
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
          color: higher ? '#10B981' : '#EF4444',
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `${higher ? 'CALL' : 'PUT'} ${contract.asset_symbol}`,
        });
        return { series, line };
      })
      .filter((entry): entry is { series: PriceLineSeries; line: IPriceLine } => entry !== null);
  }, [activeContractsKey, chartType, symbol, symbolContracts]);

  return (
    <div
      data-testid="trading-chart"
      className="relative w-full rounded-2xl bg-bg-light-secondary dark:bg-bg-dark-secondary border border-border-light dark:border-border-dark p-3 sm:p-4 shadow-xl flex flex-col justify-between overflow-hidden min-h-[320px] sm:min-h-[380px] transition-colors duration-200"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 z-10 pb-2 border-b border-border-light dark:border-border-dark/50">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <span className="font-bold text-sm sm:text-base text-text-light-primary dark:text-text-dark-primary font-mono">{symbol}</span>
          <span className="font-mono text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400">
            {currentPrice > 0 ? currentPrice.toFixed(pipPlaces) : '--'}
          </span>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          <div data-testid="chart-type-toggle" className="flex items-center space-x-0.5 sm:space-x-1 bg-bg-light-tertiary dark:bg-bg-dark-tertiary p-0.5 sm:p-1 rounded-lg border border-border-light dark:border-border-dark">
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

          <div data-testid="timeframe-selector" className="flex items-center space-x-1 bg-bg-light-tertiary dark:bg-bg-dark-tertiary p-0.5 sm:p-1 rounded-lg border border-border-light dark:border-border-dark">
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
              <span>{pipDelta >= 0 ? '+' : ''}{pipDelta.toFixed(1)} Pips</span>
              <span>({isWinning ? `WINNING +KES ${payout.toFixed(2)}` : 'LOSING'})</span>
            </div>
          ) : <div />}
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
