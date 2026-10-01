"""
execution.py
============
High-level trade execution functions that wire together the exchange
client, risk module, and portfolio tracker.

Public API
----------
- ``execute_buy``   – size up, place order, attach SL/TP, record position
- ``execute_sell``  – place closing order, remove position from tracker
- ``check_exits``   – scan open positions for SL/TP hits and close them
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Dict, Optional

from trading_bot import config
from trading_bot.logger import get_logger
from trading_bot import risk as risk_module

if TYPE_CHECKING:
    from trading_bot.exchange import CcxtClient, AlpacaClient
    from trading_bot.portfolio import PortfolioTracker

log = get_logger(__name__)


def execute_buy(
    symbol: str,
    exchange,
    portfolio: "PortfolioTracker",
    current_price: Optional[float] = None,
    dry_run: bool = False,
) -> bool:
    """
    Execute a buy trade for *symbol*.

    Steps:
      1. Fetch current price (or use provided price).
      2. Calculate stop-loss and take-profit.
      3. Calculate position size (fixed-fractional risk).
      4. Place the order (or log only if dry_run).
      5. Record the position in the portfolio tracker.

    Parameters
    ----------
    symbol : str
    exchange : CcxtClient | AlpacaClient
    portfolio : PortfolioTracker
    current_price : float, optional  Use a price already fetched this loop cycle.
    dry_run : bool  If True, log the intended order but don't place it.

    Returns
    -------
    bool  True if the trade was (or would be) executed.
    """
    try:
        price = current_price or exchange.get_price(symbol)
        if price <= 0:
            log.error("[%s] Cannot execute buy – invalid price %.6f", symbol, price)
            return False

        sl = risk_module.calculate_stop_loss(price, side="buy")
        tp = risk_module.calculate_take_profit(price, side="buy")

        equity = exchange.get_balance()
        qty = risk_module.calculate_position_size(equity, price, sl)
        if qty <= 0:
            log.error("[%s] Calculated qty is zero – skipping buy.", symbol)
            return False

        if dry_run:
            log.info(
                "[DRY-RUN] BUY %s | price=%.6f  qty=%.6f  SL=%.6f  TP=%.6f",
                symbol, price, qty, sl, tp,
            )
            order_id = "DRY_RUN"
        else:
            order = exchange.place_order(
                symbol=symbol,
                side="buy",
                amount=qty,
                order_type=config.ORDER_TYPE,
                price=price if config.ORDER_TYPE == "limit" else None,
            )
            order_id = order.get("id")
            fill_price = order.get("price") or price
            price = fill_price  # Use actual fill price for risk records

        portfolio.open_position(
            symbol=symbol,
            side="buy",
            entry_price=price,
            quantity=qty,
            stop_loss=sl,
            take_profit=tp,
            order_id=order_id,
        )
        return True

    except Exception as exc:
        log.error("[%s] execute_buy failed: %s", symbol, exc, exc_info=True)
        return False


def execute_sell(
    symbol: str,
    exchange,
    portfolio: "PortfolioTracker",
    reason: str = "signal",
    dry_run: bool = False,
) -> bool:
    """
    Close an existing long position for *symbol*.

    Parameters
    ----------
    symbol : str
    exchange : CcxtClient | AlpacaClient
    portfolio : PortfolioTracker
    reason : str   Human-readable reason (e.g. "signal", "stop_loss", "take_profit").
    dry_run : bool

    Returns
    -------
    bool  True if the trade was (or would be) executed.
    """
    pos = portfolio.get_position(symbol)
    if pos is None:
        log.warning("[%s] execute_sell called but no open position found.", symbol)
        return False

    try:
        if dry_run:
            price = exchange.get_price(symbol)
            pnl = pos.unrealised_pnl(price)
            log.info(
                "[DRY-RUN] SELL %s | reason=%s  qty=%.6f  entry=%.6f  current=%.6f  P&L=%.4f",
                symbol, reason, pos.quantity, pos.entry_price, price, pnl,
            )
        else:
            order = exchange.place_order(
                symbol=symbol,
                side="sell",
                amount=pos.quantity,
                order_type="market",   # Always use market for exits
            )
            price = order.get("price") or exchange.get_price(symbol)
            pnl = pos.unrealised_pnl(price)
            log.info(
                "[%s] SELL executed | reason=%s  qty=%.6f  fill=%.6f  P&L=%.4f",
                symbol, reason, pos.quantity, price, pnl,
            )

        portfolio.close_position(symbol)
        return True

    except Exception as exc:
        log.error("[%s] execute_sell failed: %s", symbol, exc, exc_info=True)
        return False


def check_exits(
    exchange,
    portfolio: "PortfolioTracker",
    prices: Dict[str, float],
    dry_run: bool = False,
) -> None:
    """
    Scan all open positions and close any that have hit SL or TP.

    Parameters
    ----------
    exchange : CcxtClient | AlpacaClient
    portfolio : PortfolioTracker
    prices : dict  {symbol: current_price}  Pre-fetched prices for this cycle.
    dry_run : bool
    """
    for symbol, pos in list(portfolio.all_positions().items()):
        price = prices.get(symbol)
        if price is None:
            try:
                price = exchange.get_price(symbol)
                prices[symbol] = price
            except Exception as exc:
                log.error("[%s] Failed to fetch price for exit check: %s", symbol, exc)
                continue

        if pos.is_stop_hit(price):
            log.warning("[%s] Stop-loss hit at %.6f (SL=%.6f)", symbol, price, pos.stop_loss)
            execute_sell(symbol, exchange, portfolio, reason="stop_loss", dry_run=dry_run)

        elif pos.is_target_hit(price):
            log.info("[%s] Take-profit hit at %.6f (TP=%.6f)", symbol, price, pos.take_profit)
            execute_sell(symbol, exchange, portfolio, reason="take_profit", dry_run=dry_run)
