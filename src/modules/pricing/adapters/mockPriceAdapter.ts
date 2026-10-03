import { randomBytes } from 'node:crypto';
import { logger } from '../../../shared/middleware/logger.js';

interface SymbolConfig {
  name: string;
  base: number;
  volatility: number;
  decimals: number;
  usd: number;
  risk: number;
}

interface SymbolState {
  price: number;
  anchor: number;
  logVol: number;
  drift: number;
  lastTs: number;
  timer: NodeJS.Timeout | null;
}

const TWO_53 = 9007199254740992;

function rand(): number {
  const n = randomBytes(8).readBigUInt64BE() >> 11n;
  const res = Number(n) / TWO_53;
  return res >= 1 ? 0.9999999999999999 : res;
}

function gauss(): number {
  const u = 1 - rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function fatTail(): number {
  const df = 4;
  let chi2 = 0;
  for (let i = 0; i < df; i++) {
    const g = gauss();
    chi2 += g * g;
  }
  return gauss() / Math.sqrt(chi2 / df) / Math.sqrt(df / (df - 2));
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export class MockPriceAdapter {
  private running = false;
  private state: Record<string, SymbolState> = {};
  private factors = { usd: 0, risk: 0 };
  private factorTimer: NodeJS.Timeout | null = null;

  private readonly symbols: SymbolConfig[] = [
    { name: 'EUR/USD', base: 1.085, volatility: 0.0002, decimals: 5, usd: -1.0, risk: 0.3 },
    { name: 'GBP/USD', base: 1.265, volatility: 0.0003, decimals: 5, usd: -1.0, risk: 0.4 },
    { name: 'USD/JPY', base: 150.5, volatility: 0.05, decimals: 3, usd: 0.8, risk: 0.5 },
    { name: 'XAU/USD', base: 2025.0, volatility: 0.5, decimals: 2, usd: -0.5, risk: -0.3 },
    { name: 'BTC/USD', base: 52000.0, volatility: 10.0, decimals: 2, usd: -0.1, risk: 1.0 },
    { name: 'ETH/USD', base: 2800.0, volatility: 1.0, decimals: 2, usd: -0.1, risk: 1.1 },
    { name: 'WTI/USD', base: 78.0, volatility: 0.05, decimals: 3, usd: -0.3, risk: 0.6 },
  ];

  constructor(private onTick: (symbol: string, bid: string, ask: string, time: Date) => void) {
    const now = Date.now();
    this.symbols.forEach((s) => {
      const start = s.base * (1 + gauss() * 0.003);
      this.state[s.name] = { price: start, anchor: start, logVol: 0, drift: 0, lastTs: now, timer: null };
    });
  }

  connect() {
    logger.info('Starting Mock Price Generator');
    this.stopTimers();
    this.running = true;

    const now = Date.now();
    this.symbols.forEach((s) => {
      this.state[s.name].lastTs = now;
      this.scheduleSymbol(s);
    });
    this.scheduleFactors();
  }

  disconnect() {
    this.running = false;
    this.stopTimers();
    logger.info('Stopped Mock Price Generator');
  }

  private stopTimers() {
    if (this.factorTimer) {
      clearTimeout(this.factorTimer);
      this.factorTimer = null;
    }
    Object.values(this.state).forEach((st) => {
      if (st.timer) {
        clearTimeout(st.timer);
        st.timer = null;
      }
    });
  }

  private scheduleFactors() {
    if (!this.running) return;
    this.factorTimer = setTimeout(() => {
      this.factors.usd = gauss();
      this.factors.risk = gauss();
      this.scheduleFactors();
    }, 400 + rand() * 600);
  }

  private scheduleSymbol(s: SymbolConfig) {
    if (!this.running) return;

    let delay = 250 + rand() * 1550;
    if (rand() < 0.03) delay += 2000 + rand() * 3000;

    this.state[s.name].timer = setTimeout(() => {
      this.step(s);
      this.scheduleSymbol(s);
    }, delay);
  }

  private step(s: SymbolConfig) {
    const st = this.state[s.name];
    const nowMs = Date.now();
    const dt = clamp((nowMs - st.lastTs) / 1000, 0.05, 10);
    st.lastTs = nowMs;
    const sqrtDt = Math.sqrt(dt);

    st.logVol = clamp(st.logVol - 0.05 * st.logVol * dt + 0.15 * sqrtDt * gauss(), -0.7, 1.5);
    const volMult = Math.exp(st.logVol);
    const sigma = s.volatility * 0.6 * volMult;

    st.drift = clamp(st.drift - 0.08 * st.drift * dt + 0.12 * sqrtDt * gauss(), -1.5, 1.5);

    const factorPart = (s.usd * this.factors.usd + s.risk * this.factors.risk) / 1.4;
    const z = 0.75 * fatTail() + 0.35 * factorPart;
    let change = sigma * sqrtDt * z + st.drift * sigma * 0.3 * dt;

    if (rand() < dt / 600) {
      change += sigma * (4 + rand() * 6) * (rand() < 0.5 ? -1 : 1);
      st.logVol = Math.min(1.5, st.logVol + 0.5);
    }

    st.anchor = clamp(st.anchor + s.volatility * 0.2 * sqrtDt * gauss(), s.base * 0.9, s.base * 1.1);
    change += 0.003 * (st.anchor - st.price) * dt;
    st.price = clamp(st.price + change, s.base * 0.85, s.base * 1.15);

    const tick = Math.pow(10, -s.decimals);
    const rawSpread = s.volatility * 1.5 * (0.8 + 0.4 * rand()) * Math.max(1, volMult);
    const spread = Math.max(tick, Math.round(rawSpread / tick) * tick);

    const bid = (st.price - spread / 2).toFixed(s.decimals);
    const ask = (st.price + spread / 2).toFixed(s.decimals);

    this.onTick(s.name, bid, ask, new Date(nowMs));
  }
}