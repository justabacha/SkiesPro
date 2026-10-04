import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from '@/shared/hooks/useAuth';
import { apiClient } from '@/shared/services/apiClient';

export type AccountMode = 'real' | 'demo';

export interface WalletBalance {
  balance: string;
  locked_balance: string;
  available_balance: string;
  currency: string;
}

interface AccountModeContextValue {
  accountMode: AccountMode;
  isDemoEnabled: boolean;
  generation: number;
  switchAccountMode: (mode: AccountMode) => boolean;
  registerModeCleanup: (cleanup: () => void) => () => void;
  setPendingOrderActive: (active: boolean) => void;
  getWalletBalance: (mode: AccountMode) => WalletBalance | null;
  fetchWalletBalance: (mode: AccountMode) => Promise<WalletBalance | null>;
  isCurrentGeneration: (generation: number, mode: AccountMode, userId: string | null) => boolean;
}

const AccountModeContext = createContext<AccountModeContextValue | undefined>(undefined);
const STORAGE_KEY = 'skies_account_mode';
const isDemoEnabled = import.meta.env.VITE_DEMO_ENABLED === 'true';

const readInitialMode = (): AccountMode => {
  if (!isDemoEnabled || typeof window === 'undefined') return 'real';
  return window.localStorage.getItem(STORAGE_KEY) === 'demo' ? 'demo' : 'real';
};

export const AccountModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [accountMode, setAccountMode] = useState<AccountMode>(readInitialMode);
  const [generation, setGeneration] = useState(0);
  const [walletBalances, setWalletBalances] = useState<Record<string, WalletBalance>>({});
  const modeRef = useRef(accountMode);
  const userIdRef = useRef<string | null>(user?.id || null);
  const generationRef = useRef(0);
  const pendingOrderRef = useRef(false);
  const cleanupCallbacks = useRef(new Set<() => void>());
  const requests = useRef(new Map<string, { controller: AbortController; promise: Promise<WalletBalance | null> }>());

  modeRef.current = accountMode;
  userIdRef.current = user?.id || null;

  const abortRequests = useCallback(() => {
    requests.current.forEach(({ controller }) => controller.abort());
    requests.current.clear();
  }, []);

  const registerModeCleanup = useCallback((cleanup: () => void) => {
    cleanupCallbacks.current.add(cleanup);
    return () => cleanupCallbacks.current.delete(cleanup);
  }, []);

  const setPendingOrderActive = useCallback((active: boolean) => {
    pendingOrderRef.current = active;
  }, []);

  const switchAccountMode = useCallback((nextMode: AccountMode) => {
    if (nextMode === modeRef.current || (nextMode === 'demo' && !isDemoEnabled)) return false;
    if (pendingOrderRef.current && !window.confirm('You have a pending order. Switching accounts will discard it. Continue?')) {
      return false;
    }

    generationRef.current += 1;
    modeRef.current = nextMode;
    abortRequests();
    cleanupCallbacks.current.forEach((cleanup) => cleanup());
    setGeneration(generationRef.current);
    setWalletBalances({});
    setAccountMode(nextMode);
    if (isDemoEnabled) window.localStorage.setItem(STORAGE_KEY, nextMode);
    return true;
  }, [abortRequests]);

  const isCurrentGeneration = useCallback((
    requestedGeneration: number,
    requestedMode: AccountMode,
    requestedUserId: string | null
  ) => generationRef.current === requestedGeneration
    && modeRef.current === requestedMode
    && userIdRef.current === requestedUserId, []);

  const getWalletBalance = useCallback((mode: AccountMode) => {
    const key = user?.id ? `${user.id}:${mode}` : '';
    return walletBalances[key] || null;
  }, [user?.id, walletBalances]);

  const fetchWalletBalance = useCallback((mode: AccountMode): Promise<WalletBalance | null> => {
    if (!isAuthenticated || !user?.id) return Promise.resolve(null);
    const generationAtStart = generationRef.current;
    const userIdAtStart = user.id;
    const key = `${userIdAtStart}:${mode}`;
    const activeRequest = requests.current.get(key);
    if (activeRequest) return activeRequest.promise;

    const controller = new AbortController();
    const path = mode === 'demo' ? '/api/v1/demo/wallet' : '/api/v1/wallets/balance';
    const promise = apiClient.get<{ data?: WalletBalance } & Partial<WalletBalance>>(
      path,
      { signal: controller.signal }
    ).then((response) => {
      const balance = response.data || response as WalletBalance;
      if (generationRef.current === generationAtStart && userIdRef.current === userIdAtStart) {
        setWalletBalances((current) => ({ ...current, [key]: balance }));
      }
      return balance;
    }).catch((error: unknown) => {
      if ((error as Error)?.name !== 'AbortError') throw error;
      return null;
    }).finally(() => {
      if (requests.current.get(key)?.promise === promise) requests.current.delete(key);
    });
    requests.current.set(key, { controller, promise });
    return promise;
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      generationRef.current += 1;
      setGeneration(generationRef.current);
      abortRequests();
      setWalletBalances({});
      return;
    }
    void fetchWalletBalance(accountMode).catch(() => undefined);
    const interval = setInterval(() => {
      void fetchWalletBalance(accountMode).catch(() => undefined);
    }, 30000);
    return () => clearInterval(interval);
  }, [accountMode, abortRequests, fetchWalletBalance, isAuthenticated, user?.id]);

  useEffect(() => {
    const callbacks = cleanupCallbacks.current;
    return () => {
      abortRequests();
      callbacks.clear();
    };
  }, [abortRequests]);

  const value = useMemo(() => ({
    accountMode,
    isDemoEnabled,
    generation,
    switchAccountMode,
    registerModeCleanup,
    setPendingOrderActive,
    getWalletBalance,
    fetchWalletBalance,
    isCurrentGeneration,
  }), [
    accountMode,
    generation,
    switchAccountMode,
    registerModeCleanup,
    setPendingOrderActive,
    getWalletBalance,
    fetchWalletBalance,
    isCurrentGeneration,
  ]);

  return <AccountModeContext.Provider value={value}>{children}</AccountModeContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAccountMode = (): AccountModeContextValue => {
  const context = useContext(AccountModeContext);
  if (!context) throw new Error('useAccountMode must be used within AccountModeProvider');
  return context;
};
