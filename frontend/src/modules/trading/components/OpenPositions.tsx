import React, { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownRight, Clock, ShieldAlert } from 'lucide-react';
import { BinaryContract } from '../types/trading.types';

export interface OpenPositionsProps {
  contracts: BinaryContract[];
  currentPrices?: Record<string, number>;
  isLoading?: boolean;
}

const CountdownTimer: React.FC<{ expiryTime: string }> = ({ expiryTime }) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  useEffect(() => {
    const calculateSeconds = () => {
      const expTs = new Date(expiryTime).getTime();
      const nowTs = Date.now();
      const diff = Math.max(0, Math.ceil((expTs - nowTs) / 1000));
      setSecondsLeft(diff);
    };

    calculateSeconds();
    const timer = setInterval(calculateSeconds, 1000);
    return () => clearInterval(timer);
  }, [expiryTime]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const formatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  return (
    <span
      data-testid="countdown-timer"
      className="font-mono font-bold text-xs text-brand bg-brand/10 border border-brand/20 px-2 py-0.5 rounded-md flex items-center space-x-1"
    >
      <Clock className="h-3 w-3" />
      <span>{formatted}</span>
    </span>
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
        className="w-full rounded-2xl bg-bg-light-secondary dark:bg-bg-dark-secondary border border-border-light dark:border-border-dark p-6 shadow-xl text-center text-text-light-primary dark:text-text-dark"
      >
        <div className="flex flex-col items-center justify-center space-y-2 py-4">
          <ShieldAlert className="h-8 w-8 text-text-light-secondary/50 dark:text-text-dark-secondary/50" />
          <p className="text-sm font-medium text-text-light-primary dark:text-text-dark">No Active Positions</p>
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
      className="w-full rounded-2xl bg-bg-light-secondary dark:bg-bg-dark-secondary border border-border-light dark:border-border-dark p-5 shadow-xl text-text-light-primary dark:text-text-dark space-y-4 transition-colors duration-200"
    >
      <div className="flex items-center justify-between pb-3 border-b border-border-light dark:border-border-dark">
        <h3 className="text-base font-bold text-text-light-primary dark:text-text-dark flex items-center space-x-2">
          <span>Active Positions</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-brand/20 text-brand font-mono font-bold">
            {contracts.length}
          </span>
        </h3>
      </div>

      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
        {contracts.map((contract) => {
          const isHigher = contract.contract_type === 'higher';
          const strike = parseFloat(contract.strike_price);
          const spot = currentPrices[contract.asset_symbol] || strike;
          const isWinning = isHigher ? spot > strike : spot < strike;
          const pipPlaces = spot > 100 ? 2 : 5;

          return (
            <div
              key={contract.id}
              className="p-4 rounded-xl bg-bg-light-tertiary/60 dark:bg-bg-dark-tertiary/60 border border-border-light dark:border-border-dark/80 flex flex-wrap items-center justify-between gap-3 text-sm transition-all hover:border-border-light dark:hover:border-border-dark"
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
                  {isHigher ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold font-mono text-text-light-primary dark:text-text-dark">{contract.asset_symbol}</span>
                    <span className="text-[10px] font-bold uppercase text-text-light-secondary dark:text-text-dark-secondary bg-bg-light-primary dark:bg-bg-dark px-1.5 py-0.5 rounded">
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
                  Strike: <span className="font-mono font-semibold text-text-light-primary dark:text-text-dark">{strike.toFixed(pipPlaces)}</span>
                </div>
                <div className="text-xs text-text-light-secondary dark:text-text-dark-secondary">
                  Spot: <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{spot.toFixed(pipPlaces)}</span>
                </div>
              </div>

              {/* Live Status & Timer */}
              <div className="flex items-center space-x-3">
                <span
                  data-testid="position-status"
                  className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                    isWinning
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {isWinning ? 'Winning' : 'Losing'}
                </span>

                <CountdownTimer expiryTime={contract.expiry_time} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
