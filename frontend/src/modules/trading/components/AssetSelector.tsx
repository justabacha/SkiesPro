import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Lock, TrendingUp } from 'lucide-react';
import { Asset } from '../types/trading.types';

export interface AssetSelectorProps {
  assets: Asset[];
  selectedAsset: Asset | null;
  onSelectAsset: (symbol: string) => void;
  currentPrice?: number;
}

export const AssetSelector: React.FC<AssetSelectorProps> = ({
  assets,
  selectedAsset,
  onSelectAsset,
  currentPrice,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredAssets = assets.filter(
    (asset) =>
      asset.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isMarketOpen = selectedAsset?.isOpen !== false && selectedAsset?.isActive !== false;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef} data-testid="asset-selector">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between space-x-3 px-4 py-2.5 rounded-lg bg-bg-light-secondary dark:bg-bg-dark-secondary hover:bg-bg-light-tertiary dark:hover:bg-bg-dark-tertiary border border-border-light dark:border-border-dark text-text-light-primary dark:text-text-dark transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand shadow-sm"
        aria-expanded={isOpen}
      >
        <div className="flex items-center space-x-3">
          <div className="p-1.5 rounded-md bg-brand/10 text-brand">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div className="text-left">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm text-text-light-primary dark:text-text-dark">{selectedAsset?.symbol || 'Select Asset'}</span>
              <span
                data-testid="market-status-badge"
                className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  isMarketOpen
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                }`}
              >
                {isMarketOpen ? 'Open' : 'Closed'}
              </span>
            </div>
            <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary truncate max-w-[140px]">
              {selectedAsset?.name || 'Binary Market'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 pl-2 border-l border-border-light dark:border-border-dark">
          <div className="text-right">
            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              +{((selectedAsset?.payoutRate || 0.60) * 100).toFixed(0)}%
            </div>
            {currentPrice !== undefined && (
              <div className="text-[11px] font-mono text-text-light-secondary dark:text-text-dark-secondary">
                {currentPrice.toFixed(selectedAsset?.pipDecimalPlaces || (currentPrice > 100 ? 2 : 5))}
              </div>
            )}
          </div>
          <ChevronDown className={`h-4 w-4 text-text-light-secondary dark:text-text-dark-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-72 rounded-xl bg-bg-light-primary dark:bg-bg-dark-secondary border border-border-light dark:border-border-dark shadow-2xl z-50 overflow-hidden">
          {/* Search Header */}
          <div className="p-2.5 border-b border-border-light dark:border-border-dark bg-bg-light-tertiary/50 dark:bg-bg-dark-tertiary/50">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-text-light-secondary dark:text-text-dark-secondary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search symbol..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-bg-light-secondary dark:bg-bg-dark rounded-md border border-border-light dark:border-border-dark text-text-light-primary dark:text-text-dark focus:outline-none focus:border-brand"
                autoFocus
              />
            </div>
          </div>

          {/* Asset List */}
          <div className="max-h-64 overflow-y-auto divide-y divide-border-light dark:divide-border-dark/50">
            {filteredAssets.length === 0 ? (
              <div className="p-4 text-center text-xs text-text-light-secondary dark:text-text-dark-secondary">No matching assets</div>
            ) : (
              filteredAssets.map((asset) => {
                const isOpenAsset = asset.isOpen !== false && asset.isActive !== false;
                const isSelected = selectedAsset?.symbol === asset.symbol;

                return (
                  <button
                    key={asset.symbol}
                    type="button"
                    onClick={() => {
                      onSelectAsset(asset.symbol);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 text-left hover:bg-bg-light-tertiary dark:hover:bg-bg-dark-tertiary transition-colors ${
                      isSelected ? 'bg-brand/10 border-l-2 border-brand' : ''
                    }`}
                  >
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-semibold text-xs text-text-light-primary dark:text-text-dark">{asset.symbol}</span>
                        {!isOpenAsset && <Lock className="h-3 w-3 text-rose-500 dark:text-rose-400" />}
                      </div>
                      <span className="text-[11px] text-text-light-secondary dark:text-text-dark-secondary">{asset.name}</span>
                    </div>

                    <div className="text-right">
                      <span className="inline-block px-1.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded">
                        +{((asset.payoutRate || 0.60) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
