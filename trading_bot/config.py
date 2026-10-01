"""
config.py
=========
Centralised configuration for the trading bot.

All sensitive values (API keys, secrets) are loaded from environment
variables via python-dotenv.  Strategy and risk parameters are set here
and can be overridden via a YAML/JSON config file if desired.
"""

import os
import argparse
from typing import List, Optional
from dotenv import load_dotenv

# Load .env file into environment (no-op if already set)
load_dotenv()


# ---------------------------------------------------------------------------
# Exchange / Broker selection
# ---------------------------------------------------------------------------
EXCHANGE_TYPE: str = os.getenv("EXCHANGE_TYPE", "ccxt").lower()
# "ccxt"    → use ccxt (crypto exchanges, e.g. Binance, Bybit, Kraken …)
# "alpaca"  → use Alpaca (stocks / crypto via Alpaca paper/live account)

# ccxt exchange ID (ignored when EXCHANGE_TYPE == "alpaca")
CCXT_EXCHANGE_ID: str = os.getenv("CCXT_EXCHANGE_ID", "binance")

# ccxt API credentials
CCXT_API_KEY: str = os.getenv("CCXT_API_KEY", "")
CCXT_API_SECRET: str = os.getenv("CCXT_API_SECRET", "")

# Use ccxt sandbox / testnet endpoint (if the exchange supports it)
CCXT_SANDBOX: bool = os.getenv("CCXT_SANDBOX", "true").lower() == "true"

# Alpaca credentials (ignored when EXCHANGE_TYPE == "ccxt")
ALPACA_API_KEY: str = os.getenv("ALPACA_API_KEY", "")
ALPACA_API_SECRET: str = os.getenv("ALPACA_API_SECRET", "")

# "paper" uses Alpaca Paper Trading endpoint; "live" uses the live endpoint
ALPACA_MODE: str = os.getenv("ALPACA_MODE", "paper").lower()

ALPACA_BASE_URLS = {
    "paper": "https://paper-api.alpaca.markets",
    "live":  "https://api.alpaca.markets",
}
ALPACA_BASE_URL: str = ALPACA_BASE_URLS.get(ALPACA_MODE, ALPACA_BASE_URLS["paper"])


# ---------------------------------------------------------------------------
# Asset list
# ---------------------------------------------------------------------------
def _default_symbols() -> List[str]:
    """Return the default symbol list from the environment, or hardcoded."""
    env_val = os.getenv("SYMBOLS", "")
    if env_val:
        return [s.strip() for s in env_val.split(",") if s.strip()]
    return ["BTC/USDT", "ETH/USDT"]


DEFAULT_SYMBOLS: List[str] = _default_symbols()


# ---------------------------------------------------------------------------
# Strategy parameters
# ---------------------------------------------------------------------------
EMA_FAST: int = int(os.getenv("EMA_FAST", "20"))    # Fast EMA period
EMA_SLOW: int = int(os.getenv("EMA_SLOW", "50"))    # Slow EMA period
RSI_PERIOD: int = int(os.getenv("RSI_PERIOD", "14")) # RSI lookback period
RSI_OVERSOLD: float = float(os.getenv("RSI_OVERSOLD", "30"))   # RSI buy threshold
RSI_OVERBOUGHT: float = float(os.getenv("RSI_OVERBOUGHT", "70"))  # RSI sell threshold
TIMEFRAME: str = os.getenv("TIMEFRAME", "1h")       # OHLCV candle timeframe
OHLCV_LIMIT: int = int(os.getenv("OHLCV_LIMIT", "200"))  # Number of candles to fetch


# ---------------------------------------------------------------------------
# Risk management
# ---------------------------------------------------------------------------
RISK_PER_TRADE: float = float(os.getenv("RISK_PER_TRADE", "0.02"))    # 2 % of equity
STOP_LOSS_PCT: float = float(os.getenv("STOP_LOSS_PCT", "0.02"))       # 2 % below entry
TAKE_PROFIT_PCT: float = float(os.getenv("TAKE_PROFIT_PCT", "0.04"))   # 4 % above entry
MAX_OPEN_POSITIONS: int = int(os.getenv("MAX_OPEN_POSITIONS", "5"))     # Max concurrent trades


# ---------------------------------------------------------------------------
# Execution loop
# ---------------------------------------------------------------------------
POLL_INTERVAL_SECONDS: int = int(os.getenv("POLL_INTERVAL_SECONDS", "60"))  # 60 s = 1 min
ORDER_TYPE: str = os.getenv("ORDER_TYPE", "market").lower()   # "market" or "limit"


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
LOG_FILE: str = os.getenv("LOG_FILE", "bot.log")
LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO").upper()


# ---------------------------------------------------------------------------
# CLI override support
# ---------------------------------------------------------------------------
def parse_args() -> argparse.Namespace:
    """Parse optional command-line arguments that override config values."""
    parser = argparse.ArgumentParser(description="Algorithmic Trading Bot")
    parser.add_argument(
        "--symbols",
        nargs="+",
        default=None,
        metavar="SYMBOL",
        help="Override asset symbol list (e.g. BTC/USDT ETH/USDT AAPL).",
    )
    parser.add_argument(
        "--exchange-type",
        choices=["ccxt", "alpaca"],
        default=None,
        help="Override exchange type.",
    )
    parser.add_argument(
        "--timeframe",
        default=None,
        help="Override OHLCV timeframe (e.g. 15m, 1h, 4h).",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=None,
        dest="poll_interval",
        help="Override polling interval in seconds.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="Log signals without placing real orders (implies paper/sandbox mode).",
    )
    return parser.parse_args()
