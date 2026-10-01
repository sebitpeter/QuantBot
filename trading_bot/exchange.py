"""
exchange.py
===========
Abstraction layer over ccxt and Alpaca so the rest of the bot
never has to care which broker is in use.

Public API
----------
- ``ExchangeClient.get_balance() -> float``          total equity in quote currency
- ``ExchangeClient.get_price(symbol) -> float``      latest mid / last price
- ``ExchangeClient.fetch_ohlcv(symbol, tf, limit)``  list of [ts, O, H, L, C, V]
- ``ExchangeClient.place_order(...)``                 unified order response dict
- ``ExchangeClient.close()``                          graceful teardown
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, Tuple

from trading_bot import config
from trading_bot.logger import get_logger

log = get_logger(__name__)


# ---------------------------------------------------------------------------
# Unified order response schema (subset we actually use)
# ---------------------------------------------------------------------------
OrderResult = Dict[str, Any]
# Keys guaranteed in every returned dict:
#   id         – broker order id
#   symbol     – asset symbol
#   side       – "buy" | "sell"
#   type       – "market" | "limit"
#   price      – fill price (may be None for market until filled)
#   amount     – requested quantity
#   status     – "open" | "closed" | "canceled"
#   raw        – the full original response for debugging


# ---------------------------------------------------------------------------
# Helper: lazy imports (ccxt / alpaca are optional depending on mode)
# ---------------------------------------------------------------------------
def _import_ccxt():
    try:
        import ccxt
        return ccxt
    except ImportError as exc:
        raise ImportError(
            "ccxt is not installed.  Run: pip install ccxt"
        ) from exc


def _import_alpaca():
    try:
        import alpaca_trade_api as tradeapi
        return tradeapi
    except ImportError as exc:
        raise ImportError(
            "alpaca-trade-api is not installed.  Run: pip install alpaca-trade-api"
        ) from exc


# ---------------------------------------------------------------------------
# ccxt-backed client
# ---------------------------------------------------------------------------
class CcxtClient:
    """
    Wraps a single ccxt exchange instance.

    Parameters
    ----------
    exchange_id : str
        ccxt exchange identifier, e.g. ``"binance"``, ``"bybit"``.
    api_key : str
    api_secret : str
    sandbox : bool
        If ``True``, use the exchange's testnet endpoint.
    """

    def __init__(
        self,
        exchange_id: str = config.CCXT_EXCHANGE_ID,
        api_key: str = config.CCXT_API_KEY,
        api_secret: str = config.CCXT_API_SECRET,
        sandbox: bool = config.CCXT_SANDBOX,
    ) -> None:
        ccxt = _import_ccxt()
        ExchangeClass = getattr(ccxt, exchange_id, None)
        if ExchangeClass is None:
            raise ValueError(f"ccxt has no exchange named '{exchange_id}'")

        self._ex = ExchangeClass(
            {
                "apiKey": api_key,
                "secret": api_secret,
                "enableRateLimit": True,
            }
        )
        if sandbox:
            if self._ex.has.get("sandbox"):
                self._ex.set_sandbox_mode(True)
                log.info("ccxt sandbox/testnet mode ENABLED for %s", exchange_id)
            else:
                log.warning(
                    "%s does not support sandbox mode – running against live endpoint.",
                    exchange_id,
                )
        self._ex.load_markets()
        log.info("ccxt exchange '%s' initialised.", exchange_id)

    # ------------------------------------------------------------------
    def get_balance(self) -> float:
        """Return total USDT (or quote currency) balance."""
        bal = self._ex.fetch_balance()
        quote = "USDT"
        total = bal.get("total", {}).get(quote, 0.0) or 0.0
        log.debug("Balance: %.4f %s", total, quote)
        return float(total)

    def get_price(self, symbol: str) -> float:
        """Return the latest ticker price for *symbol*."""
        ticker = self._ex.fetch_ticker(symbol)
        price = ticker.get("last") or ticker.get("bid") or 0.0
        return float(price)

    def fetch_ohlcv(
        self, symbol: str, timeframe: str = "1h", limit: int = 200
    ) -> List[List[float]]:
        """
        Fetch OHLCV candles.

        Returns
        -------
        list of [timestamp_ms, open, high, low, close, volume]
        """
        return self._ex.fetch_ohlcv(symbol, timeframe=timeframe, limit=limit)

    def place_order(
        self,
        symbol: str,
        side: str,          # "buy" | "sell"
        amount: float,      # quantity in base currency
        order_type: str = "market",
        price: Optional[float] = None,
        params: Optional[Dict] = None,
    ) -> OrderResult:
        """
        Place a market or limit order.

        Parameters
        ----------
        symbol : str
        side : str      "buy" | "sell"
        amount : float  quantity in base currency
        order_type : str "market" | "limit"
        price : float   required for limit orders
        params : dict   extra ccxt params (e.g. stopPrice, takeProfitPrice)
        """
        if order_type not in ("market", "limit"):
            raise ValueError(f"order_type must be 'market' or 'limit', got '{order_type}'")
        if order_type == "limit" and price is None:
            raise ValueError("price is required for limit orders")

        extra = params or {}
        log.info(
            "Placing %s %s %s | qty=%.6f price=%s",
            order_type.upper(), side.upper(), symbol, amount, price
        )
        raw = self._ex.create_order(symbol, order_type, side, amount, price, extra)
        return {
            "id":     raw.get("id"),
            "symbol": raw.get("symbol", symbol),
            "side":   raw.get("side", side),
            "type":   raw.get("type", order_type),
            "price":  raw.get("price") or raw.get("average"),
            "amount": raw.get("amount", amount),
            "status": raw.get("status", "unknown"),
            "raw":    raw,
        }

    def close(self) -> None:
        """Tear down connections (ccxt handles this automatically)."""
        log.info("ccxt client closed.")


# ---------------------------------------------------------------------------
# Alpaca-backed client
# ---------------------------------------------------------------------------
class AlpacaClient:
    """
    Wraps the Alpaca REST client for paper and live trading.

    Parameters
    ----------
    api_key : str
    api_secret : str
    base_url : str   Alpaca REST base URL (paper or live).
    """

    def __init__(
        self,
        api_key: str = config.ALPACA_API_KEY,
        api_secret: str = config.ALPACA_API_SECRET,
        base_url: str = config.ALPACA_BASE_URL,
    ) -> None:
        tradeapi = _import_alpaca()
        self._api = tradeapi.REST(api_key, api_secret, base_url, api_version="v2")
        mode = "PAPER" if "paper" in base_url else "LIVE"
        log.info("Alpaca client initialised (%s).", mode)

    # ------------------------------------------------------------------
    def get_balance(self) -> float:
        """Return portfolio equity."""
        account = self._api.get_account()
        equity = float(account.equity)
        log.debug("Alpaca equity: %.4f USD", equity)
        return equity

    def get_price(self, symbol: str) -> float:
        """Return the latest trade price for *symbol*."""
        # Alpaca symbols use no slash (BTCUSD not BTC/USD)
        clean = symbol.replace("/", "")
        try:
            trade = self._api.get_latest_trade(clean)
            return float(trade.price)
        except Exception:
            # Fallback: last bar close
            bars = self._api.get_bars(clean, "1Min", limit=1).df
            if not bars.empty:
                return float(bars["close"].iloc[-1])
            return 0.0

    def fetch_ohlcv(
        self, symbol: str, timeframe: str = "1Hour", limit: int = 200
    ) -> List[List[float]]:
        """
        Fetch OHLCV data and convert to ccxt-compatible list format.

        Alpaca timeframe strings differ from ccxt:
        ``"1h"`` → ``"1Hour"``, ``"15m"`` → ``"15Min"``, etc.
        """
        _tf_map = {
            "1m": "1Min", "5m": "5Min", "15m": "15Min",
            "30m": "30Min", "1h": "1Hour", "4h": "4Hour",
            "1d": "1Day",
        }
        tf = _tf_map.get(timeframe.lower(), timeframe)
        clean = symbol.replace("/", "")
        bars = self._api.get_bars(clean, tf, limit=limit).df
        result: List[List[float]] = []
        for ts, row in bars.iterrows():
            ms = int(ts.timestamp() * 1000)
            result.append([ms, row["open"], row["high"], row["low"], row["close"], row["volume"]])
        return result

    def place_order(
        self,
        symbol: str,
        side: str,
        amount: float,
        order_type: str = "market",
        price: Optional[float] = None,
        params: Optional[Dict] = None,
    ) -> OrderResult:
        """Place a market or limit order via Alpaca."""
        if order_type not in ("market", "limit"):
            raise ValueError(f"order_type must be 'market' or 'limit', got '{order_type}'")
        if order_type == "limit" and price is None:
            raise ValueError("price is required for limit orders")

        clean = symbol.replace("/", "")
        log.info(
            "Placing %s %s %s | qty=%.6f price=%s",
            order_type.upper(), side.upper(), symbol, amount, price,
        )
        kwargs: Dict[str, Any] = {
            "symbol": clean,
            "qty": str(amount),
            "side": side,
            "type": order_type,
            "time_in_force": "gtc" if order_type == "limit" else "day",
        }
        if order_type == "limit":
            kwargs["limit_price"] = str(price)

        raw = self._api.submit_order(**kwargs)
        return {
            "id":     raw.id,
            "symbol": raw.symbol,
            "side":   raw.side,
            "type":   raw.order_type,
            "price":  float(raw.limit_price) if raw.limit_price else None,
            "amount": float(raw.qty),
            "status": raw.status,
            "raw":    raw,
        }

    def close(self) -> None:
        """No persistent connection to close for Alpaca REST."""
        log.info("Alpaca client closed.")


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------
def create_exchange_client() -> "CcxtClient | AlpacaClient":
    """
    Instantiate the correct exchange client based on ``config.EXCHANGE_TYPE``.

    Returns
    -------
    CcxtClient or AlpacaClient
    """
    if config.EXCHANGE_TYPE == "alpaca":
        return AlpacaClient()
    return CcxtClient()
