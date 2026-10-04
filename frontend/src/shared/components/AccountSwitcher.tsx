import { useAccountMode, type AccountMode } from '@/shared/context/AccountModeContext';

export const AccountSwitcher = () => {
  const { accountMode, isDemoEnabled, setAccountMode } = useAccountMode();

  const renderButton = (mode: AccountMode, label: string) => {
    const selected = accountMode === mode;
    const unavailable = mode === 'demo' && !isDemoEnabled;
    return (
      <button
        key={mode}
        type="button"
        aria-pressed={selected}
        aria-label={unavailable ? 'Demo account unavailable' : `${label} account`}
        title={unavailable ? 'Demo trading is currently unavailable' : undefined}
        disabled={unavailable}
        onClick={() => setAccountMode(mode)}
        className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
          selected
            ? mode === 'demo'
              ? 'bg-amber-500 text-white'
              : 'bg-brand text-white'
            : 'text-text-light-secondary hover:bg-bg-light-primary dark:text-text-dark-secondary dark:hover:bg-bg-dark-primary'
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      role="group"
      aria-label="Trading account"
      className="flex items-center rounded-full border border-border-light bg-bg-light-tertiary p-0.5 dark:border-border-dark dark:bg-bg-dark-tertiary"
    >
      {renderButton('real', 'Real')}
      {renderButton('demo', 'Demo')}
    </div>
  );
};
