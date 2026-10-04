import React, { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownRight, Clock, ShieldAlert } from 'lucide-react';
import { BinaryContract } from '../types/trading.types';
import { getPipSize, getPriceDecimalPlaces } from '../utils/pricePrecision';

export interface OpenPositionsProps {
  contracts: BinaryContract[];
  currentPrices?: Record<string, number>;
  isLoading?: boolean;
}

const CountdownTimerWithProgress: React.FC<{ purchaseTime?: string; expiryTime: string }> = ({
  purchaseTime,
  expiryTime,
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [progressPct, setProgressPct] = useState<number>(100);

  useEffect(() => {
    const calculateProgress = () => {
      const expTs = new Date(expiryTime).getTime();
      const nowTs = Date.now();
      const remaining = Math.max(0, expTs - nowTs);
      setSecondsLeft(Math.ceil(remaining / 1000));

      let startTs = purchaseTime ? new Date(purchaseTime).getTime() : 0;
      if (isNaN(startTs) || startTs <= 0 || startTs >= expTs) {
        startTs = expTs - 60000;
      }
      const totalMs = Math.max(1, expTs - startTs);
      const ratio = Math.max(0, Math.min(1, remaining / totalMs));
      setProgressPct(ratio * 100);
    };

    calculateProgress();
    const timer = setInterval(calculateProgress, 250);
    return () => clearInterval(timer);
  }, [purchaseTime, expiryTime]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const formatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  return (
    <div className="flex items-center space-x-2">
      {/* Visual Expiry SVG Progress Bar */}
      <div
        data-testid="expiry-progress-bar"
        className="w-14 sm:w-20 bg-bg-light-primary dark:bg-bg-dark-primary h-2 sm:h-2.5 rounded-full overflow-hidden border border-border-light dark:border-border-dark p-0.5 shadow-inner"
        title={`Progress: ${Math.round(progressPct)}%`}
      >
        <svg className="w-full h-full" viewBox="0 0 100 8" preserveAspectRatio="none">
          <rect
            x="0"
            y="0"
            width={`${progressPct}%`}
            height="8"
            rx="4"
            className="fill-brand transition-all duration-300 ease-linear"
          />
        </svg>
      </div>

      {/* Countdown Timer Badge */}
      <span
        data-testid="countdown-timer"
        className="font-mono font-bold text-xs text-brand bg-brand/10 border border-brand/20 px-2 py-0.5 rounded-md flex items-center space-x-1"
      >
        <Clock className="h-3 w-3" />
        <span>{formatted}</span>
      </span>
    </div>
  );
};

export const OpenPositions: React.FC<OpenPositionsProps> = ({
  contracts,
  currentPrices = {},
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div
        data-testid="open-positions"
        className="w-full rounded-2xl bg-bg-light-secondary dark:bg-bg-dark-secondary border border-border-light dark:border-border-dark p-6 shadow-xl text-center text-xs text-text-light-secondary dark:text-text-dark-secondary"
      >
        Loading active positions...
      </div>
    );
  }

  if (contracts.length === 0) {
    return (
      <div
        data-testid="open-positions"
        className="w-full rounded-2xl bg-bg-light-secondary dark:bg-bg-dark-secondary border border-border-light dark:border-border-dark p-6 shadow-xl text-center text-text-light-primary dark:text-text-dark-primary"
      >
        <div className="flex flex-col items-center justify-center space-y-2 py-4">
          <ShieldAlert className="h-8 w-8 text-text-light-secondary/50 dark:text-text-dark-secondary/50" />
          <p className="text-sm font-medium text-text-light-primary dark:text-text-dark-primary">
            No Active Positions
          </p>
          <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary">
            Select an asset and place a contract to start trading.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="open-positions"
      className="w-full rounded-2xl bg-bg-light-secondary dark:bg-bg-dark-secondary border border-border-light dark:border-border-dark p-4 sm:p-5 shadow-xl text-text-light-primary dark:text-text-dark-primary space-y-4 transition-colors duration-200"
    >
      <div className="flex items-center justify-between pb-3 border-b border-border-light dark:border-border-dark">
        <h3 className="text-base font-bold text-text-light-primary dark:text-text-dark-primary flex items-center space-x-2">
          <span>Active Positions</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-brand/20 text-brand font-mono font-bold">
            {contracts.length}
          </span>
        </h3>
      </div>

      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
        {contracts.map((contract) => {
          const position = contract as typeof contract & {
            assetSymbol?: string;
            symbol?: string;
            pair?: string;
          };
          const positionSymbol =
            position?.asset_symbol ||
            position?.assetSymbol ||
            position?.symbol ||
            position?.pair ||
            'EUR/USD';
          const isHigher = contract.contract_type === 'higher';
          const strike = parseFloat(contract.strike_price);
          const normalizedPositionSymbol = positionSymbol
            .replace(/^DEMO[-_]?/i, '')
            .replace(/[^a-z0-9]/gi, '')
            .toUpperCase();
          const spot =
            currentPrices[positionSymbol] ??
            Object.entries(currentPrices).find(
              ([key]) =>
                key
                  .replace(/^DEMO[-_]?/i, '')
                  .replace(/[^a-z0-9]/gi, '')
                  .toUpperCase() === normalizedPositionSymbol
            )?.[1];
          const liveSpot =
            typeof spot === 'number' && Number.isFinite(spot) && spot > 0 ? spot : null;
          const priceAvailable = liveSpot !== null;
          const pipPlaces = getPriceDecimalPlaces(positionSymbol, undefined, liveSpot || 0);
          const isWinning = liveSpot !== null && (isHigher ? liveSpot > strike : liveSpot < strike);
          const pipDelta =
            liveSpot === null
              ? 0
              : (liveSpot - strike) / getPipSize(positionSymbol, pipPlaces, liveSpot);
          const payout = parseFloat(contract.potential_payout || '0');

          return (
            <div
              key={contract.id}
              className="p-3.5 sm:p-4 rounded-xl bg-bg-light-tertiary/60 dark:bg-bg-dark-tertiary/60 border border-border-light dark:border-border-dark/80 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm transition-all hover:border-border-light dark:hover:border-border-dark"
            >
              {/* Asset & Direction */}
              <div className="flex items-center space-x-3">
                <div
                  className={`p-2 rounded-lg ${
                    isHigher
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {isHigher ? (
                    <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 sm:h-5 sm:w-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold font-mono text-text-light-primary dark:text-text-dark-primary">
                      {positionSymbol}
                    </span>
                    <span className="text-[10px] font-bold uppercase text-text-light-secondary dark:text-text-dark-secondary bg-bg-light-primary dark:bg-bg-dark-primary px-1.5 py-0.5 rounded">
                      {contract.contract_type}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-text-light-secondary dark:text-text-dark-secondary">
                    Stake: KES {parseFloat(contract.stake).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Price Details */}
              <div className="text-right">
                <div className="text-xs text-text-light-secondary dark:text-text-dark-secondary">
                  Strike:{' '}
                  <span className="font-mono font-semibold text-text-light-primary dark:text-text-dark-primary">
                    {strike.toFixed(pipPlaces)}
                  </span>
                </div>
                <div className="text-xs text-text-light-secondary dark:text-text-dark-secondary">
                  Spot:{' '}
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    {liveSpot === null ? '--' : liveSpot.toFixed(pipPlaces)}
                  </span>
                </div>
              </div>

              {/* Live Status & Timer */}
              <div className="flex items-center space-x-2 sm:space-x-3">
                {/* Spot vs. Strike Pip Delta Pill Tag */}
                <span
                  data-testid="position-status"
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold uppercase transition-colors ${
                    !priceAvailable
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                      : isWinning
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {priceAvailable
                    ? `${pipDelta >= 0 ? '+' : ''}${pipDelta.toFixed(1)} Pips (${isWinning ? `WINNING +KES ${payout.toFixed(2)}` : 'LOSING'})`
                    : 'LIVE PRICE UNAVAILABLE'}
                </span>

                <CountdownTimerWithProgress
                  purchaseTime={contract.purchase_time}
                  expiryTime={contract.expiry_time}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
