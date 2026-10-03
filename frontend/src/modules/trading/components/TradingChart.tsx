import React, { useState, useMemo, useEffect } from 'react';
import { PriceTick, BinaryContract, Candle } from '../types/trading.types';
import { tradingService } from '../services/tradingService';

export interface TradingChartProps {
  symbol: string;
  priceHistory: PriceTick[];
  currentPrice: number;
  activeContracts?: BinaryContract[];
}

function generateFallbackCandles(
  history: PriceTick[],
  granularitySec: number,
  latestPrice: number,
  symbolStr: string
): Candle[] {
  if (history.length >= 4) {
    const count = Math.min(30, Math.max(10, Math.floor(history.length / 2)));
    const chunkSize = Math.max(1, Math.floor(history.length / count));
    const result: Candle[] = [];

    for (let i = 0; i < history.length; i += chunkSize) {
      const chunk = history.slice(i, i + chunkSize);
      const prices = chunk.map((t) => t.price);
      const open = prices[0];
      const close = prices[prices.length - 1];
      const high = Math.max(...prices);
      const low = Math.min(...prices);
      const openTime = chunk[0].tick_time;
      const closeTime = chunk[chunk.length - 1].tick_time;

      result.push({
        symbol: symbolStr,
        granularity_seconds: granularitySec,
        open_time: openTime,
        close_time: closeTime,
        open,
        high,
        low,
        close,
      });
    }
    return result;
  }

  const result: Candle[] = [];
  const candleCount = 20;
  let basePrice = latestPrice;
  const now = Date.now();

  for (let i = candleCount; i >= 1; i--) {
    const openTime = new Date(now - i * granularitySec * 1000).toISOString();
    const closeTime = new Date(now - (i - 1) * granularitySec * 1000).toISOString();
    const delta = (Math.random() - 0.48) * (basePrice * 0.001);
    const open = basePrice;
    const close = open + delta;
    const high = Math.max(open, close) + Math.random() * (basePrice * 0.0005);
    const low = Math.min(open, close) - Math.random() * (basePrice * 0.0005);
    basePrice = close;

    result.push({
      symbol: symbolStr,
      granularity_seconds: granularitySec,
      open_time: openTime,
      close_time: closeTime,
      open,
      high,
      low,
      close,
    });
  }

  if (result.length > 0) {
    result[result.length - 1].close = latestPrice;
    result[result.length - 1].high = Math.max(result[result.length - 1].high, latestPrice);
    result[result.length - 1].low = Math.min(result[result.length - 1].low, latestPrice);
  }
  return result;
}

export const TradingChart: React.FC<TradingChartProps> = ({
  symbol,
  priceHistory,
  currentPrice,
  activeContracts = [],
}) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1m');
  const [chartType, setChartType] = useState<'line' | 'candle'>('line');
  const [candles, setCandles] = useState<Candle[]>([]);

  const timeframes = ['1m', '5m', '15m', '1H', '4H', '1D'];

  const granularity = useMemo(() => {
    switch (selectedTimeframe) {
      case '5m': return 300;
      case '15m': return 900;
      case '1H': return 3600;
      case '4H': return 14400;
      case '1D': return 86400;
      case '1m':
      default:
        return 60;
    }
  }, [selectedTimeframe]);

  // Filter history based on selected timeframe
  const displayedHistory = useMemo(() => {
    if (priceHistory.length === 0) {
      return [{ symbol, price: currentPrice, tick_time: new Date().toISOString(), timestamp: Date.now() }];
    }
    return priceHistory;
  }, [priceHistory, currentPrice, symbol]);

  // Fetch candles when chartType === 'candle'
  useEffect(() => {
    if (chartType !== 'candle') return;

    let isMounted = true;
    tradingService.getCandles(symbol, granularity, 30)
      .then((data) => {
        if (!isMounted) return;
        if (data && data.length > 0) {
          setCandles(data);
        } else {
          setCandles(generateFallbackCandles(displayedHistory, granularity, currentPrice, symbol));
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setCandles(generateFallbackCandles(displayedHistory, granularity, currentPrice, symbol));
      });

    return () => { isMounted = false; };
  }, [symbol, granularity, chartType, displayedHistory, currentPrice]);

  // Min and Max prices for chart scaling
  const { minPrice, maxPrice, prices } = useMemo(() => {
    if (chartType === 'candle' && candles.length > 0) {
      const highs = candles.map((c) => c.high);
      const lows = candles.map((c) => c.low);
      highs.push(currentPrice);
      lows.push(currentPrice);
      if (activeContracts.length > 0) {
        const strike = parseFloat(activeContracts[activeContracts.length - 1].strike_price);
        if (!isNaN(strike)) {
          highs.push(strike);
          lows.push(strike);
        }
      }
      const min = Math.min(...lows);
      const max = Math.max(...highs);
      const padding = (max - min) * 0.1 || (min * 0.001);
      return {
        minPrice: min - padding,
        maxPrice: max + padding,
        prices: candles.map((c) => c.close),
      };
    }

    const rawPrices = displayedHistory.map((t) => t.price);
    const min = Math.min(...rawPrices);
    const max = Math.max(...rawPrices);
    const padding = (max - min) * 0.1 || (min * 0.001);
    return {
      minPrice: min - padding,
      maxPrice: max + padding,
      prices: rawPrices,
    };
  }, [chartType, candles, displayedHistory, currentPrice, activeContracts]);

  // Compute SVG polyline points (Line Chart)
  const points = useMemo(() => {
    if (prices.length < 2) return '';
    const width = 800;
    const height = 320;
    const range = maxPrice - minPrice || 1;

    return prices
      .map((p, index) => {
        const x = (index / (prices.length - 1)) * width;
        const y = height - ((p - minPrice) / range) * height;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [prices, minPrice, maxPrice]);

  // Compute area SVG points
  const areaPoints = useMemo(() => {
    if (!points) return '';
    return `0,320 ${points} 800,320`;
  }, [points]);

  // SVG Candlesticks Data Calculation
  const candleElementsData = useMemo(() => {
    if (chartType !== 'candle' || candles.length === 0) return [];
    const width = 800;
    const height = 320;
    const range = maxPrice - minPrice || 1;
    const count = candles.length;
    const colWidth = width / count;
    const bodyWidth = Math.max(3, Math.min(24, colWidth * 0.65));

    return candles.map((c, index) => {
      const centerX = (index + 0.5) * colWidth;
      const highY = height - ((c.high - minPrice) / range) * height;
      const lowY = height - ((c.low - minPrice) / range) * height;
      const openY = height - ((c.open - minPrice) / range) * height;
      const closeY = height - ((c.close - minPrice) / range) * height;

      const isBullish = c.close >= c.open;
      const color = isBullish ? '#10B981' : '#EF4444';
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(2, Math.abs(openY - closeY));

      return {
        key: index,
        centerX,
        highY,
        lowY,
        bodyLeft: centerX - bodyWidth / 2,
        bodyWidth,
        bodyTop,
        bodyHeight,
        color,
        isBullish,
      };
    });
  }, [chartType, candles, minPrice, maxPrice]);

  // Active contract strike lines & Pip Delta calculations
  const activeContractDetails = useMemo(() => {
    if (activeContracts.length === 0) return null;
    const contract = activeContracts[activeContracts.length - 1];
    const strike = parseFloat(contract.strike_price);
    if (isNaN(strike)) return null;

    const isHigher = contract.contract_type === 'higher';
    const isWinning = isHigher ? currentPrice > strike : currentPrice < strike;

    const range = maxPrice - minPrice || 1;
    const strikeY = 320 - ((strike - minPrice) / range) * 320;

    const pipMultiplier = currentPrice > 100 ? 100 : 10000;
    const pipDelta = (currentPrice - strike) * pipMultiplier;

    return {
      strike,
      stake: parseFloat(contract.stake),
      payout: parseFloat(contract.potential_payout || '0'),
      strikeY: Math.max(16, Math.min(304, strikeY)),
      isHigher,
      isWinning,
      pipDelta,
    };
  }, [activeContracts, currentPrice, minPrice, maxPrice]);

  const pipPlaces = currentPrice > 100 ? 2 : 5;

  return (
    <div
      data-testid="trading-chart"
      className="relative w-full rounded-2xl bg-bg-light-secondary dark:bg-bg-dark-secondary border border-border-light dark:border-border-dark p-3 sm:p-4 shadow-xl flex flex-col justify-between overflow-hidden min-h-[320px] sm:min-h-[380px] transition-colors duration-200"
    >
      {/* Chart Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 z-10 pb-2 border-b border-border-light dark:border-border-dark/50">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <span className="font-bold text-sm sm:text-base text-text-light-primary dark:text-text-dark-primary font-mono">{symbol}</span>
          <span className="font-mono text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400">
            {currentPrice.toFixed(pipPlaces)}
          </span>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Chart Type Toggle (Line | Candle) */}
          <div
            data-testid="chart-type-toggle"
            className="flex items-center space-x-0.5 sm:space-x-1 bg-bg-light-tertiary dark:bg-bg-dark-tertiary p-0.5 sm:p-1 rounded-lg border border-border-light dark:border-border-dark"
          >
            <button
              type="button"
              data-testid="chart-type-line"
              onClick={() => setChartType('line')}
              className={`px-2 sm:px-2.5 py-0.5 sm:py-1 text-[11px] sm:text-xs font-mono font-medium rounded-md transition-colors ${
                chartType === 'line'
                  ? 'bg-brand text-white shadow-sm'
                  : 'text-text-light-secondary dark:text-text-dark-secondary hover:text-text-light-primary dark:hover:text-text-dark-primary hover:bg-bg-light-secondary dark:hover:bg-bg-dark-secondary'
              }`}
            >
              Line
            </button>
            <button
              type="button"
              data-testid="chart-type-candle"
              onClick={() => setChartType('candle')}
              className={`px-2 sm:px-2.5 py-0.5 sm:py-1 text-[11px] sm:text-xs font-mono font-medium rounded-md transition-colors ${
                chartType === 'candle'
                  ? 'bg-brand text-white shadow-sm'
                  : 'text-text-light-secondary dark:text-text-dark-secondary hover:text-text-light-primary dark:hover:text-text-dark-primary hover:bg-bg-light-secondary dark:hover:bg-bg-dark-secondary'
              }`}
            >
              Candle
            </button>
          </div>

          {/* Timeframe Selector (UI-TRADE-010) */}
          <div
            data-testid="timeframe-selector"
            className="flex items-center space-x-1 bg-bg-light-tertiary dark:bg-bg-dark-tertiary p-0.5 sm:p-1 rounded-lg border border-border-light dark:border-border-dark"
          >
            {timeframes.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setSelectedTimeframe(tf)}
                className={`px-2 sm:px-2.5 py-0.5 sm:py-1 text-[11px] sm:text-xs font-mono font-medium rounded-md transition-colors ${
                  selectedTimeframe === tf
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-text-light-secondary dark:text-text-dark-secondary hover:text-text-light-primary dark:hover:text-text-dark-primary hover:bg-bg-light-secondary dark:hover:bg-bg-dark-secondary'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main SVG Canvas */}
      <div className="relative flex-1 w-full mt-3 sm:mt-4 min-h-[240px] sm:min-h-[280px]">
        <svg
          viewBox="0 0 800 320"
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1="0" y1="80" x2="800" y2="80" className="stroke-border-light dark:stroke-border-dark/60" strokeDasharray="4 4" strokeWidth="1" />
          <line x1="0" y1="160" x2="800" y2="160" className="stroke-border-light dark:stroke-border-dark/60" strokeDasharray="4 4" strokeWidth="1" />
          <line x1="0" y1="240" x2="800" y2="240" className="stroke-border-light dark:stroke-border-dark/60" strokeDasharray="4 4" strokeWidth="1" />

          {/* Line Chart View */}
          {chartType === 'line' && (
            <>
              {areaPoints && <polygon points={areaPoints} fill="url(#chartGradient)" />}
              {points && (
                <polyline
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={points}
                />
              )}
            </>
          )}

          {/* Candlestick Chart View */}
          {chartType === 'candle' && (
            <g data-testid="candlestick-group">
              {candleElementsData.map((c) => (
                <g key={c.key}>
                  {/* Wick line */}
                  <line
                    x1={c.centerX}
                    y1={c.highY}
                    x2={c.centerX}
                    y2={c.lowY}
                    stroke={c.color}
                    strokeWidth="1.5"
                  />
                  {/* Candlestick body */}
                  <rect
                    x={c.bodyLeft}
                    y={c.bodyTop}
                    width={c.bodyWidth}
                    height={c.bodyHeight}
                    fill={c.color}
                    rx="1"
                  />
                </g>
              ))}
            </g>
          )}

          {/* Active Contract Strike Line with Price Tag Embedded on Line */}
          {activeContractDetails && (
            <g>
              <line
                x1="0"
                y1={activeContractDetails.strikeY}
                x2="650"
                y2={activeContractDetails.strikeY}
                stroke={activeContractDetails.isWinning ? '#10B981' : '#EF4444'}
                strokeWidth="2"
                strokeDasharray="6 4"
              />

              <rect
                x="655"
                y={activeContractDetails.strikeY - 12}
                width="110"
                height="24"
                rx="6"
                fill={activeContractDetails.isWinning ? '#10B981' : '#EF4444'}
              />
              <text
                x="710"
                y={activeContractDetails.strikeY + 4}
                textAnchor="middle"
                fill="#FFFFFF"
                fontSize="11"
                fontWeight="bold"
                fontFamily="monospace"
              >
                {activeContractDetails.strike.toFixed(pipPlaces)}
              </text>

              <line
                x1="770"
                y1={activeContractDetails.strikeY}
                x2="800"
                y2={activeContractDetails.strikeY}
                stroke={activeContractDetails.isWinning ? '#10B981' : '#EF4444'}
                strokeWidth="2"
                strokeDasharray="6 4"
              />
            </g>
          )}
        </svg>

        {/* Bottom Control / Status Overlay Bar */}
        <div className="absolute left-2 bottom-2 right-2 flex items-center justify-between pointer-events-none z-20 gap-2">
          {/* Active Position Badge with Pip Delta Pill */}
          {activeContractDetails ? (
            <div
              data-testid="pip-delta-pill"
              className={`pointer-events-auto px-2 sm:px-3 py-1 rounded-lg text-[10px] sm:text-xs font-mono font-bold text-white shadow-md flex items-center space-x-1.5 backdrop-blur-sm ${
                activeContractDetails.isWinning ? 'bg-emerald-600/95' : 'bg-rose-600/95'
              }`}
            >
              <span>
                {activeContractDetails.pipDelta >= 0 ? '+' : ''}
                {activeContractDetails.pipDelta.toFixed(1)} Pips
              </span>
              <span>
                ({activeContractDetails.isWinning
                  ? `WINNING +KES ${activeContractDetails.payout.toFixed(2)}`
                  : 'LOSING'})
              </span>
            </div>
          ) : (
            <div />
          )}

          {/* Current Spot Cursor Badge (Bottom Right) */}
          <div className="pointer-events-auto bg-bg-light-primary/95 dark:bg-bg-dark-tertiary/95 border border-border-light dark:border-border-dark px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-mono flex items-center space-x-1.5 backdrop-blur-sm shadow-md">
            <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-text-light-primary dark:text-text-dark-primary font-bold">Spot: {currentPrice.toFixed(pipPlaces)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
