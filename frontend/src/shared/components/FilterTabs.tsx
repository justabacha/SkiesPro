import React from 'react';

export interface TabOption<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ElementType;
  badge?: string | number;
}

export interface FilterTabsProps<T extends string = string> {
  tabs: readonly TabOption<T>[] | TabOption<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  variant?: 'underline' | 'pills' | 'pills-themed';
  className?: string;
}

export function FilterTabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  variant = 'underline',
  className = '',
}: FilterTabsProps<T>) {
  if (variant === 'pills-themed') {
    return (
      <div className={`flex border border-border-light dark:border-border-dark bg-bg-light-secondary dark:bg-bg-dark-secondary rounded-xl p-1 gap-1 ${className}`}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              aria-pressed={isActive}
              className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-text-light-secondary dark:text-text-dark-secondary hover:text-text-light-primary dark:hover:text-text-dark-primary'
              }`}
            >
              {Icon && <Icon className="w-4 h-4" />}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] rounded-full ${
                    isActive
                      ? 'bg-blue-500 text-white'
                      : 'bg-bg-light-tertiary dark:bg-bg-dark-tertiary text-text-light-secondary dark:text-text-dark-secondary'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === 'pills') {
    return (
      <div className={`flex border-b border-slate-800 bg-slate-900/60 rounded-xl p-1 gap-1 ${className}`}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              aria-pressed={isActive}
              className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {Icon && <Icon className="w-4 h-4" />}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] rounded-full ${
                    isActive ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap gap-2 border-b border-slate-800 ${className}`}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            aria-pressed={isActive}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              isActive
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {Icon && <Icon className="w-4 h-4" />}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`px-1.5 py-0.5 text-[10px] rounded-full ${
                  isActive ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
