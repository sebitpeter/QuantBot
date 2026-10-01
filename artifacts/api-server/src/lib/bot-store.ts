/**
 * bot-store.ts
 * Single in-memory store for all bot state.
 * Exported as a singleton so routes and the engine share the same object.
 */

import { randomUUID } from "crypto";

export interface BotConfig {
  symbols: string[];
  timeframe: string;
  emaFast: number;
  emaSlow: number;
  rsiPeriod: number;
  rsiOversold: number;
  rsiOverbought: number;
  riskPerTrade: number;
  stopLossPct: number;
  takeProfitPct: number;
  maxOpenPositions: number;
  pollIntervalSeconds: number;
  orderType: string;
  mode: string;
}

export interface Position {
  symbol: string;
  side: string;
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  stopLoss: number;
  takeProfit: number;
  unrealisedPnl: number;
  pnlPct: number;
  openedAt: string;
}

export interface Signal {
  id: string;
  symbol: string;
  type: string; // "buy" | "sell"
  price: number;
  emaFast: number;
  emaSlow: number;
  rsi: number;
  action: string; // "opened" | "closed" | "skipped_max_pos" | "no_position"
  reason: string | null;
  timestamp: string;
}

export interface LogEntry {
  id: string;
  level: string;
  message: string;
  timestamp: string;
  symbol: string | null;
}

interface Stats {
  totalCycles: number;
  totalSignals: number;
  buySignals: number;
  sellSignals: number;
  closedTrades: number;
  winningTrades: number;
}

const DEFAULT_CONFIG: BotConfig = {
  symbols: ["BTC/USDT", "ETH/USDT", "BNB/USDT"],
  timeframe: "1h",
  emaFast: 5,
  emaSlow: 20,
  rsiPeriod: 14,
  rsiOversold: 35,
  rsiOverbought: 65,
  riskPerTrade: 0.02,
  stopLossPct: 0.02,
  takeProfitPct: 0.04,
  maxOpenPositions: 5,
  pollIntervalSeconds: 10,
  orderType: "market",
  mode: "paper",
};

const MAX_SIGNALS = 200;
const MAX_LOGS = 500;

class BotStore {
  running = false;
  startedAt: Date | null = null;
  currentCycle = 0;
  config: BotConfig = { ...DEFAULT_CONFIG };
  equity = 10_000; // simulated starting equity in USDT

  private positions: Map<string, Position> = new Map();
  private signals: Signal[] = [];
  private logs: LogEntry[] = [];
  private stats: Stats = {
    totalCycles: 0,
    totalSignals: 0,
    buySignals: 0,
    sellSignals: 0,
    closedTrades: 0,
    winningTrades: 0,
  };

  // ── Positions ──────────────────────────────────────────────────────────
  getPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  openPosition(pos: Omit<Position, "unrealisedPnl" | "pnlPct">): void {
    const p: Position = {
      ...pos,
      unrealisedPnl: 0,
      pnlPct: 0,
    };
    this.positions.set(pos.symbol, p);
  }

  updatePositionPrice(symbol: string, currentPrice: number): void {
    const p = this.positions.get(symbol);
    if (!p) return;
    const pnl =
      p.side === "buy"
        ? (currentPrice - p.entryPrice) * p.quantity
        : (p.entryPrice - currentPrice) * p.quantity;
    const pnlPct = ((currentPrice - p.entryPrice) / p.entryPrice) * 100 * (p.side === "buy" ? 1 : -1);
    p.currentPrice = currentPrice;
    p.unrealisedPnl = pnl;
    p.pnlPct = pnlPct;
  }

  closePosition(symbol: string): Position | null {
    const p = this.positions.get(symbol);
    if (!p) return null;
    this.positions.delete(symbol);
    // Update stats
    this.stats.closedTrades++;
    if (p.unrealisedPnl > 0) this.stats.winningTrades++;
    // Realise P&L into equity
    this.equity += p.unrealisedPnl;
    return p;
  }

  hasPosition(symbol: string): boolean {
    return this.positions.has(symbol);
  }

  openPositionCount(): number {
    return this.positions.size;
  }

  // ── Signals ─────────────────────────────────────────────────────────────
  getSignals(limit = 50, symbol?: string): Signal[] {
    let list = [...this.signals].reverse();
    if (symbol) list = list.filter((s) => s.symbol === symbol);
    return list.slice(0, limit);
  }

  addSignal(sig: Omit<Signal, "id" | "timestamp">): void {
    const entry: Signal = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      ...sig,
    };
    this.signals.push(entry);
    if (this.signals.length > MAX_SIGNALS) this.signals.shift();
    this.stats.totalSignals++;
    if (sig.type === "buy") this.stats.buySignals++;
    else this.stats.sellSignals++;
  }

  // ── Logs ─────────────────────────────────────────────────────────────────
  getLogs(limit = 100): LogEntry[] {
    return [...this.logs].reverse().slice(0, limit);
  }

  addLog(level: string, message: string, symbol: string | null = null): void {
    const entry: LogEntry = {
      id: randomUUID(),
      level,
      message,
      timestamp: new Date().toISOString(),
      symbol,
    };
    this.logs.push(entry);
    if (this.logs.length > MAX_LOGS) this.logs.shift();
  }

  // ── Stats / Summary ───────────────────────────────────────────────────────
  getStats(): Stats {
    return { ...this.stats };
  }

  incrementCycle(): void {
    this.stats.totalCycles++;
    this.currentCycle++;
  }

  // ── Config ────────────────────────────────────────────────────────────────
  updateConfig(patch: Partial<BotConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  // ── Uptime ────────────────────────────────────────────────────────────────
  getUptimeSeconds(): number {
    if (!this.startedAt) return 0;
    return Math.floor((Date.now() - this.startedAt.getTime()) / 1000);
  }
}

export const botStore = new BotStore();
