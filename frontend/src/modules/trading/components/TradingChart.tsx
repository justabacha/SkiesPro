import React, { useState, useMemo } from 'react';
import { PriceTick, BinaryContract } from '../types/trading.types';

export interface TradingChartProps {
  symbol: string;
  priceHistory: PriceTick[];
  currentPrice: number;
  activeContracts?: BinaryContract[];
}

export const TradingChart: React.FC<TradingChartProps> = ({
  symbol,
  priceHistory,
  currentPrice,
  activeContracts = [],
}) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1m');

  const timeframes = ['1m', '5m', '15m', '1H', '4H', '1D'];

  // Filter history based on selected timeframe
  const displayedHistory = useMemo(() => {
    if (priceHistory.length === 0) {
      return [{ symbol, price: currentPrice, tick_time: new Date().toISOString(), timestamp: Date.now() }];
    }
    return priceHistory;
  }, [priceHistory, currentPrice, symbol]);

  // Min and Max prices for chart scaling
  const { minPrice, maxPrice, prices } = useMemo(() => {
    const rawPrices = displayedHistory.map((t) => t.price);
    const min = Math.min(...rawPrices);
    const max = Math.max(...rawPrices);
    const padding = (max - min) * 0.1 || (min * 0.001);
    return {
      minPrice: min - padding,
      maxPrice: max + padding,
      prices: rawPrices,
    };
  }, [displayedHistory]);

  // Compute SVG polyline points
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

  // Active contract strike lines & status evaluation
  const activeContractDetails = useMemo(() => {
    if (activeContracts.length === 0) return null;
    const contract = activeContracts[activeContracts.length - 1];
    const strike = parseFloat(contract.strike_price);
    if (isNaN(strike)) return null;

    const isHigher = contract.contract_type === 'higher';
    const isWinning = isHigher ? currentPrice > strike : currentPrice < strike;

    const range = maxPrice - minPrice || 1;
    const strikeY = 320 - ((strike - minPrice) / range) * 320;

    return {
      strike,
      stake: parseFloat(contract.stake),
      payout: parseFloat(contract.potential_payout || '0'),
      strikeY: Math.max(16, Math.min(304, strikeY)),
      isHigher,
      isWinning,
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

          {/* Fill Area under chart line */}
          {areaPoints && <polygon points={areaPoints} fill="url(#chartGradient)" />}

          {/* Price Line */}
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

          {/* Active Contract Strike Line with Price Tag Embedded on Line */}
          {activeContractDetails && (
            <g>
              {/* First segment of dashed line */}
              <line
                x1="0"
                y1={activeContractDetails.strikeY}
                x2="650"
                y2={activeContractDetails.strikeY}
                stroke={activeContractDetails.isWinning ? '#10B981' : '#EF4444'}
                strokeWidth="2"
                strokeDasharray="6 4"
              />

              {/* Price Pill Tag on Line: ------------------- 1.08752 --- */}
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

              {/* Final segment of line */}
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
          {/* Active Position Badge (Screen-Sensitive, Bottom Left) */}
          {activeContractDetails ? (
            <div
              className={`pointer-events-auto px-2 sm:px-3 py-1 rounded-lg text-[10px] sm:text-xs font-mono font-bold text-white shadow-md flex items-center space-x-1.5 backdrop-blur-sm ${
                activeContractDetails.isWinning ? 'bg-emerald-600/95' : 'bg-rose-600/95'
              }`}
            >
              <span className="hidden sm:inline">Strike: {activeContractDetails.strike.toFixed(pipPlaces)}</span>
              <span className="bg-black/20 px-1 py-0.5 rounded uppercase text-[9px] sm:text-[10px]">
                {activeContractDetails.isHigher ? '▲' : '▼'}
              </span>
              <span className="font-extrabold truncate">
                {activeContractDetails.isWinning
                  ? `WIN +KES ${activeContractDetails.payout.toFixed(2)}`
                  : 'LOSING'}
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
