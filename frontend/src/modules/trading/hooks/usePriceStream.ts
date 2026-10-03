import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/shared/hooks/useAuth';
import { apiClient } from '@/shared/services/apiClient';
import { websocketService } from '../services/websocketService';
import { PriceTick, LatencyState } from '../types/trading.types';

const MAX_QUOTE_AGE_MS = 10_000;
const normalizeSymbol = (value: string) => value.replace(/[^a-z0-9]/gi, '').toUpperCase();

interface LatestPriceResponse {
  data?: {
    symbol?: string;
    mid?: number | string;
    price?: number | string;
    tick_time?: string;
  };
  symbol?: string;
  mid?: number | string;
  price?: number | string;
  tick_time?: string;
}

export interface UsePriceStreamReturn {
  currentPrice: number;
  isPriceAvailable: boolean;
  priceHistory: PriceTick[];
  latencyState: LatencyState;
  isConnected: boolean;
  subscribeToSymbol: (symbol: string) => void;
}

export const usePriceStream = (initialSymbol: string = 'EUR/USD'): UsePriceStreamReturn => {
  const { isAuthenticated, user } = useAuth();
  const [symbol, setSymbol] = useState<string>(initialSymbol);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [isPriceAvailable, setIsPriceAvailable] = useState(false);
  const [quoteUpdatedAt, setQuoteUpdatedAt] = useState(0);
  const [priceHistory, setPriceHistory] = useState<PriceTick[]>([]);
  const [latencyState, setLatencyState] = useState<LatencyState>({
    latencyMs: 0,
    status: 'disconnected',
    isConnected: false,
  });
  const [isConnected, setIsConnected] = useState(false);

  const historyRef = useRef<PriceTick[]>([]);
  const activeSymbolRef = useRef<string>(initialSymbol);

  const acceptTick = useCallback((tick: PriceTick) => {
    if (
      normalizeSymbol(tick.symbol) !== normalizeSymbol(activeSymbolRef.current) ||
      !Number.isFinite(tick.price) ||
      tick.price <= 0
    ) {
      return;
    }

    const timestamp = new Date(tick.tick_time).getTime();
    const now = Date.now();
    if (!Number.isFinite(timestamp) || timestamp > now + 1000 || now - timestamp > MAX_QUOTE_AGE_MS) {
      return;
    }

    const liveTick = { ...tick, timestamp };
    setCurrentPrice(liveTick.price);
    setIsPriceAvailable(true);
    setQuoteUpdatedAt(now);
    historyRef.current = [...historyRef.current.slice(-119), liveTick];
    setPriceHistory([...historyRef.current]);
  }, []);

  useEffect(() => {
    let isMounted = true;
    activeSymbolRef.current = symbol;
    historyRef.current = [];
    setPriceHistory([]);
    setCurrentPrice(0);
    setIsPriceAvailable(false);
    setQuoteUpdatedAt(0);

    const fetchLivePrice = async () => {
      try {
        const encoded = encodeURIComponent(symbol);
        const response = await apiClient.get<LatestPriceResponse>(
          `/api/v1/pricing/assets/${encoded}/price`
        );
        const quote = response.data || response;
        const price = Number(quote.mid ?? quote.price);
        const quoteSymbol = quote.symbol || symbol;
        if (!isMounted || !Number.isFinite(price) || price <= 0) return;

        acceptTick({
          symbol: quoteSymbol,
          price,
          tick_time: quote.tick_time || new Date().toISOString(),
          timestamp: Date.now(),
        });
      } catch (error) {
        console.warn('Live price is not available; waiting for the price stream.', error);
      }
    };

    void fetchLivePrice();
    return () => {
      isMounted = false;
    };
  }, [symbol, acceptTick]);

  useEffect(() => {
    if (!isAuthenticated) {
      setIsConnected(false);
      return;
    }

    websocketService.initialize(user?.id || 'session-token');
    const unsubscribePrice = websocketService.onPriceTick(acceptTick);
    const unsubscribeLatency = websocketService.onLatencyChange(setLatencyState);
    const unsubscribeConn = websocketService.onConnectionStateChange(setIsConnected);
    websocketService.subscribeSymbol(symbol);

    return () => {
      unsubscribePrice();
      unsubscribeLatency();
      unsubscribeConn();
    };
  }, [acceptTick, isAuthenticated, user?.id, symbol]);

  useEffect(() => {
    if (!isPriceAvailable || quoteUpdatedAt === 0) return;
    const interval = setInterval(() => {
      if (Date.now() - quoteUpdatedAt > MAX_QUOTE_AGE_MS) {
        setIsPriceAvailable(false);
        setCurrentPrice(0);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isPriceAvailable, quoteUpdatedAt]);

  const subscribeToSymbol = useCallback((newSymbol: string) => {
    activeSymbolRef.current = newSymbol;
    historyRef.current = [];
    setSymbol(newSymbol);
    setCurrentPrice(0);
    setIsPriceAvailable(false);
    setQuoteUpdatedAt(0);
    setPriceHistory([]);
    websocketService.subscribeSymbol(newSymbol);
  }, []);

  return {
    currentPrice,
    isPriceAvailable,
    priceHistory,
    latencyState,
    isConnected,
    subscribeToSymbol,
  };
};
