/**
 * bot-engine.ts
 * Core trading loop: computes EMA/RSI indicators on simulated candle data,
 * generates buy/sell signals, manages paper positions, and handles SL/TP exits.
 */

import { botStore } from "./bot-store.js";
import { marketSim } from "./market-simulator.js";
import { logger } from "./logger.js";

// ── Indicator helpers ──────────────────────────────────────────────────────

function ema(values: number[], period: number): number[] {
  const result: number[] = new Array(values.length).fill(NaN);
  if (values.length < period) return result;
  const k = 2 / (period + 1);
  result[period - 1] = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    result[i] = values[i] * k + result[i - 1] * (1 - k);
  }
  return result;
}

function rsi(closes: number[], period: number): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return result;
  const deltas = closes.slice(1).map((v, i) => v - closes[i]);
  const gains = deltas.map((d) => (d > 0 ? d : 0));
  const losses = deltas.map((d) => (d < 0 ? -d : 0));
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i - 1]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i - 1]) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

// ── Position sizing ────────────────────────────────────────────────────────

function positionSize(equity: number, entry: number, sl: number, riskPct: number): number {
  const riskAmt = equity * riskPct;
  const riskPerUnit = Math.abs(entry - sl);
  if (riskPerUnit === 0) return 0;
  return Math.round((riskAmt / riskPerUnit) * 1e6) / 1e6;
}

// ── Main loop ──────────────────────────────────────────────────────────────

let _timer: ReturnType<typeof setInterval> | null = null;

function runCycle(): void {
  const cfg = botStore.config;
  botStore.incrementCycle();

  // Advance market prices
  marketSim.tick(cfg.symbols);

  // Update unrealised P&L for all open positions and check SL/TP
  for (const sym of cfg.symbols) {
    const price = marketSim.getPrice(sym);
    botStore.updatePositionPrice(sym, price);

    const pos = botStore.hasPosition(sym);
    if (!pos) continue;

    const positions = botStore.getPositions();
    const p = positions.find((x) => x.symbol === sym);
    if (!p) continue;

    // Check stop-loss
    if (p.side === "buy" && price <= p.stopLoss) {
      botStore.addLog("WARN", `Stop-loss triggered for ${sym} at ${price.toFixed(4)}`, sym);
      botStore.closePosition(sym);
      botStore.addLog("INFO", `Position CLOSED (stop-loss) | ${sym} | P&L: ${p.unrealisedPnl.toFixed(2)}`, sym);
      continue;
    }

    // Check take-profit
    if (p.side === "buy" && price >= p.takeProfit) {
      botStore.addLog("INFO", `Take-profit hit for ${sym} at ${price.toFixed(4)}`, sym);
      botStore.closePosition(sym);
      botStore.addLog("INFO", `Position CLOSED (take-profit) | ${sym} | P&L: ${p.unrealisedPnl.toFixed(2)}`, sym);
      continue;
    }
  }

  // Check entry/exit signals
  const needed = Math.max(cfg.emaSlow, cfg.rsiPeriod) + 3;

  for (const sym of cfg.symbols) {
    const candles = marketSim.getCandles(sym);
    if (candles.length < needed) continue;

    const closes = candles.map((c) => c.close);
    const fastArr = ema(closes, cfg.emaFast);
    const slowArr = ema(closes, cfg.emaSlow);
    const rsiArr = rsi(closes, cfg.rsiPeriod);

    const n = closes.length;
    const fPrev = fastArr[n - 2], fCurr = fastArr[n - 1];
    const sPrev = slowArr[n - 2], sCurr = slowArr[n - 1];
    const rsiCurr = rsiArr[n - 1];
    const price = closes[n - 1];

    if ([fPrev, fCurr, sPrev, sCurr, rsiCurr].some(isNaN)) continue;

    const hasPos = botStore.hasPosition(sym);

    // ── Buy signal ────────────────────────────────────────────────────
    const crossover = fPrev <= sPrev && fCurr > sCurr;
    const rsiOk = rsiCurr < cfg.rsiOverbought;

    if (crossover && rsiOk && !hasPos) {
      const sl = price * (1 - cfg.stopLossPct);
      const tp = price * (1 + cfg.takeProfitPct);
      const qty = positionSize(botStore.equity, price, sl, cfg.riskPerTrade);
      const action =
        botStore.openPositionCount() >= cfg.maxOpenPositions
          ? "skipped_max_pos"
          : "opened";

      botStore.addSignal({
        symbol: sym,
        type: "buy",
        price,
        emaFast: fCurr,
        emaSlow: sCurr,
        rsi: rsiCurr,
        action,
        reason: action === "skipped_max_pos" ? "Max open positions reached" : null,
      });

      if (action === "opened" && qty > 0) {
        botStore.openPosition({
          symbol: sym,
          side: "buy",
          entryPrice: price,
          currentPrice: price,
          quantity: qty,
          stopLoss: sl,
          takeProfit: tp,
          openedAt: new Date().toISOString(),
        });
        botStore.addLog(
          "INFO",
          `BUY ${sym} | price=${price.toFixed(4)}  EMA(${cfg.emaFast})=${fCurr.toFixed(4)}  EMA(${cfg.emaSlow})=${sCurr.toFixed(4)}  RSI=${rsiCurr.toFixed(2)}  qty=${qty}`,
          sym
        );
      }
    }

    // ── Sell signal ───────────────────────────────────────────────────
    const crossunder = fPrev >= sPrev && fCurr < sCurr;
    const rsiSellOk = rsiCurr > cfg.rsiOversold;

    if (crossunder && rsiSellOk && hasPos) {
      botStore.addSignal({
        symbol: sym,
        type: "sell",
        price,
        emaFast: fCurr,
        emaSlow: sCurr,
        rsi: rsiCurr,
        action: "closed",
        reason: "EMA crossunder",
      });
      const pos = botStore.getPositions().find((p) => p.symbol === sym);
      botStore.closePosition(sym);
      botStore.addLog(
        "INFO",
        `SELL ${sym} | price=${price.toFixed(4)}  EMA(${cfg.emaFast})=${fCurr.toFixed(4)}  RSI=${rsiCurr.toFixed(2)}  P&L=${pos?.unrealisedPnl?.toFixed(2) ?? "?"}`,
        sym
      );
    }
  }
}

// ── Public start / stop ────────────────────────────────────────────────────

export function startEngine(): void {
  if (_timer) return;
  botStore.running = true;
  botStore.startedAt = new Date();
  botStore.addLog("INFO", `Bot started | mode=${botStore.config.mode}  symbols=${botStore.config.symbols.join(", ")}`);
  logger.info("Bot engine started");
  // Run first cycle immediately
  runCycle();
  _timer = setInterval(() => {
    try {
      runCycle();
    } catch (err) {
      botStore.addLog("ERROR", `Engine error: ${(err as Error).message}`);
      logger.error({ err }, "Bot engine cycle error");
    }
  }, botStore.config.pollIntervalSeconds * 1000);
}

export function stopEngine(): void {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
  botStore.running = false;
  botStore.addLog("INFO", "Bot stopped by user");
  logger.info("Bot engine stopped");
}

export function restartEngine(): void {
  stopEngine();
  startEngine();
}
