/**
 * market-simulator.ts
 * Generates realistic OHLCV candle history using a geometric Brownian motion
 * model and advances it on each poll tick.
 */

import { logger } from "./logger.js";

export interface Candle {
  timestamp: number; // ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Ticker {
  symbol: string;
  price: number;
  change24h: number | null;
  high24h: number | null;
  low24h: number | null;
  volume24h: number | null;
  timestamp: string;
}

// Seed prices per symbol (realistic starting points)
const SEED_PRICES: Record<string, number> = {
  "BTC/USDT": 65000,
  "ETH/USDT": 3400,
  "BNB/USDT": 580,
  "SOL/USDT": 160,
  "AAPL":     185,
  "TSLA":     250,
  "NVDA":     880,
};

const DEFAULT_SEED = 100;

// Per-symbol volatility (annualised std dev fraction, scaled to per-candle)
const VOLATILITY: Record<string, number> = {
  "BTC/USDT": 0.012,
  "ETH/USDT": 0.015,
  "BNB/USDT": 0.014,
  "SOL/USDT": 0.018,
  "AAPL":     0.008,
  "TSLA":     0.016,
  "NVDA":     0.014,
};
const DEFAULT_VOL = 0.013;

function seed(sym: string): number {
  return SEED_PRICES[sym] ?? DEFAULT_SEED;
}
function vol(sym: string): number {
  return VOLATILITY[sym] ?? DEFAULT_VOL;
}

/** Box-Muller normal sample */
function randn(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Generate a single new candle following the last close */
function nextCandle(prevClose: number, sigma: number, tsMs: number): Candle {
  const drift = 0.0001 * (Math.random() - 0.48); // tiny upward drift
  const ret = drift + sigma * randn();
  const close = Math.max(prevClose * Math.exp(ret), 0.0001);
  const range = close * sigma * (0.5 + Math.random());
  const open = prevClose;
  const high = Math.max(open, close) + range * Math.random();
  const low = Math.min(open, close) - range * Math.random();
  const volume = close * (100 + Math.random() * 500);
  return { timestamp: tsMs, open, high, low: Math.max(low, 0.0001), close, volume };
}

class MarketSimulator {
  private history: Map<string, Candle[]> = new Map();
  private HISTORY_SIZE = 300; // candles kept per symbol

  /** Seed initial history for a symbol (called lazily on first access) */
  private ensureHistory(symbol: string): void {
    if (this.history.has(symbol)) return;
    const candles: Candle[] = [];
    let price = seed(symbol);
    const sigma = vol(symbol);
    const now = Date.now();
    const interval = 3600_000; // 1-hour candles for history
    for (let i = this.HISTORY_SIZE; i >= 0; i--) {
      const ts = now - i * interval;
      const c = nextCandle(price, sigma, ts);
      candles.push(c);
      price = c.close;
    }
    this.history.set(symbol, candles);
    logger.info({ symbol, candles: candles.length }, "Market simulator seeded");
  }

  /** Get OHLCV candle array for a symbol */
  getCandles(symbol: string): Candle[] {
    this.ensureHistory(symbol);
    return this.history.get(symbol)!;
  }

  /** Advance all tracked symbols by one candle tick */
  tick(symbols: string[]): void {
    const now = Date.now();
    for (const sym of symbols) {
      this.ensureHistory(sym);
      const hist = this.history.get(sym)!;
      const last = hist[hist.length - 1];
      const c = nextCandle(last.close, vol(sym), now);
      hist.push(c);
      if (hist.length > this.HISTORY_SIZE) hist.shift();
    }
  }

  /** Get current ticker data for a symbol */
  getTicker(symbol: string): Ticker {
    this.ensureHistory(symbol);
    const hist = this.history.get(symbol)!;
    const last = hist[hist.length - 1];
    const price24hAgo = hist.length >= 24 ? hist[hist.length - 24].close : null;
    const last24 = hist.slice(-24);
    const high24h = last24.length ? Math.max(...last24.map((c) => c.high)) : null;
    const low24h = last24.length ? Math.min(...last24.map((c) => c.low)) : null;
    const volume24h = last24.length ? last24.reduce((s, c) => s + c.volume, 0) : null;
    const change24h = price24hAgo ? ((last.close - price24hAgo) / price24hAgo) * 100 : null;
    return {
      symbol,
      price: last.close,
      change24h,
      high24h,
      low24h,
      volume24h,
      timestamp: new Date(last.timestamp).toISOString(),
    };
  }

  /** Latest close price */
  getPrice(symbol: string): number {
    this.ensureHistory(symbol);
    const hist = this.history.get(symbol)!;
    return hist[hist.length - 1].close;
  }
}

export const marketSim = new MarketSimulator();
