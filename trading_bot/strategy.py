"""
strategy.py
===========
Technical indicator calculations and signal generation.

Strategy: EMA crossover (fast / slow) filtered by RSI.

Buy signal:
  - Fast EMA crosses ABOVE slow EMA on the latest candle
  - RSI is below the overbought threshold (confirms momentum isn't exhausted)

Sell signal:
  - Fast EMA crosses BELOW slow EMA on the latest candle
  - RSI is above the oversold threshold (confirms the move isn't already oversold)

All calculations are done in pure Python / numpy for minimal dependencies.
Swap in pandas_ta or TA-Lib if you need a wider indicator library.
"""

from __future__ import annotations

from typing import List, Optional, Tuple

import numpy as np

from trading_bot import config
from trading_bot.logger import get_logger

log = get_logger(__name__)


# ---------------------------------------------------------------------------
# Low-level indicator helpers
# ---------------------------------------------------------------------------

def _ema(values: np.ndarray, period: int) -> np.ndarray:
    """
    Compute Exponential Moving Average.

    Parameters
    ----------
    values : np.ndarray  1-D array of prices (oldest first)
    period : int         EMA lookback

    Returns
    -------
    np.ndarray  same length as *values*; first (period-1) entries are NaN.
    """
    if len(values) < period:
        return np.full(len(values), np.nan)

    result = np.full(len(values), np.nan)
    k = 2.0 / (period + 1)

    # Seed with simple mean of first `period` values
    result[period - 1] = np.mean(values[:period])
    for i in range(period, len(values)):
        result[i] = values[i] * k + result[i - 1] * (1 - k)
    return result


def _rsi(values: np.ndarray, period: int = 14) -> np.ndarray:
    """
    Compute Wilder's RSI.

    Parameters
    ----------
    values : np.ndarray  1-D array of close prices (oldest first)
    period : int         RSI lookback (default 14)

    Returns
    -------
    np.ndarray  same length as *values*; first *period* entries are NaN.
    """
    if len(values) < period + 1:
        return np.full(len(values), np.nan)

    result = np.full(len(values), np.nan)
    deltas = np.diff(values)

    gains = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)

    # Initial averages
    avg_gain = np.mean(gains[:period])
    avg_loss = np.mean(losses[:period])

    if avg_loss == 0:
        result[period] = 100.0
    else:
        rs = avg_gain / avg_loss
        result[period] = 100.0 - 100.0 / (1.0 + rs)

    for i in range(period + 1, len(values)):
        avg_gain = (avg_gain * (period - 1) + gains[i - 1]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i - 1]) / period
        if avg_loss == 0:
            result[i] = 100.0
        else:
            rs = avg_gain / avg_loss
            result[i] = 100.0 - 100.0 / (1.0 + rs)

    return result


# ---------------------------------------------------------------------------
# Signal checkers
# ---------------------------------------------------------------------------

def _extract_closes(ohlcv: List[List[float]]) -> np.ndarray:
    """Pull the close column (index 4) from a ccxt-style OHLCV list."""
    return np.array([candle[4] for candle in ohlcv], dtype=float)


def check_buy_signal(
    symbol: str,
    ohlcv: List[List[float]],
    ema_fast: int = config.EMA_FAST,
    ema_slow: int = config.EMA_SLOW,
    rsi_period: int = config.RSI_PERIOD,
    rsi_overbought: float = config.RSI_OVERBOUGHT,
) -> Tuple[bool, dict]:
    """
    Determine whether a BUY signal exists for *symbol*.

    Signal conditions:
      1. Fast EMA crossed above slow EMA (previous fast < slow, current fast > slow)
      2. RSI is below the overbought level (momentum not exhausted)

    Parameters
    ----------
    symbol : str
    ohlcv : list   ccxt-style OHLCV candles [[ts, o, h, l, c, v], …]
    ema_fast : int
    ema_slow : int
    rsi_period : int
    rsi_overbought : float

    Returns
    -------
    (bool, dict)  (signal, metadata for logging)
    """
    required = max(ema_slow, rsi_period) + 2
    if len(ohlcv) < required:
        log.warning("[%s] Not enough candles (%d < %d) for buy check.", symbol, len(ohlcv), required)
        return False, {}

    closes = _extract_closes(ohlcv)
    fast = _ema(closes, ema_fast)
    slow = _ema(closes, ema_slow)
    rsi = _rsi(closes, rsi_period)

    # Latest two values
    f_prev, f_curr = fast[-2], fast[-1]
    s_prev, s_curr = slow[-2], slow[-1]
    rsi_curr = rsi[-1]
    price = closes[-1]

    # Guard: any NaN means not enough data
    if any(np.isnan(v) for v in [f_prev, f_curr, s_prev, s_curr, rsi_curr]):
        return False, {}

    crossover = (f_prev <= s_prev) and (f_curr > s_curr)
    rsi_ok = rsi_curr < rsi_overbought

    meta = {
        "price": price,
        "ema_fast": round(f_curr, 6),
        "ema_slow": round(s_curr, 6),
        "rsi": round(rsi_curr, 2),
        "crossover": crossover,
        "rsi_ok": rsi_ok,
    }

    signal = crossover and rsi_ok
    if signal:
        log.info(
            "[%s] BUY signal | price=%.6f  EMA(%d)=%.6f > EMA(%d)=%.6f  RSI=%.2f",
            symbol, price, ema_fast, f_curr, ema_slow, s_curr, rsi_curr,
        )
    else:
        log.debug("[%s] No buy signal | %s", symbol, meta)

    return signal, meta


def check_sell_signal(
    symbol: str,
    ohlcv: List[List[float]],
    ema_fast: int = config.EMA_FAST,
    ema_slow: int = config.EMA_SLOW,
    rsi_period: int = config.RSI_PERIOD,
    rsi_oversold: float = config.RSI_OVERSOLD,
) -> Tuple[bool, dict]:
    """
    Determine whether a SELL signal exists for *symbol*.

    Signal conditions:
      1. Fast EMA crossed below slow EMA (previous fast > slow, current fast < slow)
      2. RSI is above the oversold level (not already at bottom)

    Parameters
    ----------
    symbol : str
    ohlcv : list
    ema_fast : int
    ema_slow : int
    rsi_period : int
    rsi_oversold : float

    Returns
    -------
    (bool, dict)  (signal, metadata for logging)
    """
    required = max(ema_slow, rsi_period) + 2
    if len(ohlcv) < required:
        log.warning("[%s] Not enough candles (%d < %d) for sell check.", symbol, len(ohlcv), required)
        return False, {}

    closes = _extract_closes(ohlcv)
    fast = _ema(closes, ema_fast)
    slow = _ema(closes, ema_slow)
    rsi = _rsi(closes, rsi_period)

    f_prev, f_curr = fast[-2], fast[-1]
    s_prev, s_curr = slow[-2], slow[-1]
    rsi_curr = rsi[-1]
    price = closes[-1]

    if any(np.isnan(v) for v in [f_prev, f_curr, s_prev, s_curr, rsi_curr]):
        return False, {}

    crossunder = (f_prev >= s_prev) and (f_curr < s_curr)
    rsi_ok = rsi_curr > rsi_oversold

    meta = {
        "price": price,
        "ema_fast": round(f_curr, 6),
        "ema_slow": round(s_curr, 6),
        "rsi": round(rsi_curr, 2),
        "crossunder": crossunder,
        "rsi_ok": rsi_ok,
    }

    signal = crossunder and rsi_ok
    if signal:
        log.info(
            "[%s] SELL signal | price=%.6f  EMA(%d)=%.6f < EMA(%d)=%.6f  RSI=%.2f",
            symbol, price, ema_fast, f_curr, ema_slow, s_curr, rsi_curr,
        )
    else:
        log.debug("[%s] No sell signal | %s", symbol, meta)

    return signal, meta
