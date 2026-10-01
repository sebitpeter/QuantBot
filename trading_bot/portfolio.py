"""
portfolio.py
============
In-memory portfolio tracker.

Keeps track of open positions, their entry prices, stop-loss and
take-profit levels, and calculates unrealised P&L.

Does NOT interact with the exchange – it mirrors what the bot has
done.  On restart the state is reset (add persistence to a JSON/DB
file if you need durability across restarts).
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from trading_bot.logger import get_logger

log = get_logger(__name__)


@dataclass
class Position:
    """Represents a single open position."""

    symbol: str
    side: str               # "buy" | "sell"
    entry_price: float
    quantity: float
    stop_loss: float
    take_profit: float
    order_id: Optional[str] = None
    opened_at: float = field(default_factory=time.time)

    def unrealised_pnl(self, current_price: float) -> float:
        """
        Calculate unrealised P&L in quote currency.

        For a long (buy) position: (current - entry) * qty
        For a short (sell) position: (entry - current) * qty
        """
        if self.side == "buy":
            return (current_price - self.entry_price) * self.quantity
        return (self.entry_price - current_price) * self.quantity

    def is_stop_hit(self, current_price: float) -> bool:
        """Return True if the current price has hit the stop-loss level."""
        if self.side == "buy":
            return current_price <= self.stop_loss
        return current_price >= self.stop_loss

    def is_target_hit(self, current_price: float) -> bool:
        """Return True if the current price has reached the take-profit level."""
        if self.side == "buy":
            return current_price >= self.take_profit
        return current_price <= self.take_profit


class PortfolioTracker:
    """
    Thread-safe (single-threaded) in-memory position store.

    Methods
    -------
    open_position(...)           Record a new open position.
    close_position(symbol)       Remove a position and return it.
    get_position(symbol)         Retrieve a position (or None).
    has_position(symbol)         Check if a position exists.
    all_positions()              Return all positions as a dict.
    log_portfolio_state(prices)  Log a summary with live prices.
    """

    def __init__(self) -> None:
        self._positions: Dict[str, Position] = {}

    # ------------------------------------------------------------------
    def open_position(
        self,
        symbol: str,
        side: str,
        entry_price: float,
        quantity: float,
        stop_loss: float,
        take_profit: float,
        order_id: Optional[str] = None,
    ) -> Position:
        """
        Record a newly opened position.

        Parameters
        ----------
        symbol : str
        side : str          "buy" or "sell"
        entry_price : float
        quantity : float    base-currency units
        stop_loss : float
        take_profit : float
        order_id : str, optional

        Returns
        -------
        Position
        """
        if symbol in self._positions:
            log.warning("[%s] Overwriting existing position – close it first.", symbol)

        pos = Position(
            symbol=symbol,
            side=side,
            entry_price=entry_price,
            quantity=quantity,
            stop_loss=stop_loss,
            take_profit=take_profit,
            order_id=order_id,
        )
        self._positions[symbol] = pos
        log.info(
            "[%s] Position OPENED | side=%s  entry=%.6f  qty=%.6f  SL=%.6f  TP=%.6f",
            symbol, side, entry_price, quantity, stop_loss, take_profit,
        )
        return pos

    def close_position(self, symbol: str) -> Optional[Position]:
        """
        Remove and return a position.

        Returns ``None`` if no position exists for *symbol*.
        """
        pos = self._positions.pop(symbol, None)
        if pos:
            log.info("[%s] Position CLOSED | was entry=%.6f  qty=%.6f", symbol, pos.entry_price, pos.quantity)
        return pos

    def get_position(self, symbol: str) -> Optional[Position]:
        """Return the Position for *symbol*, or None."""
        return self._positions.get(symbol)

    def has_position(self, symbol: str) -> bool:
        """Return True if an open position exists for *symbol*."""
        return symbol in self._positions

    def all_positions(self) -> Dict[str, Position]:
        """Return a shallow copy of all open positions."""
        return dict(self._positions)

    def log_portfolio_state(self, prices: Dict[str, float]) -> None:
        """
        Log a summary table of all open positions with live prices.

        Parameters
        ----------
        prices : dict  {symbol: current_price}
        """
        if not self._positions:
            log.info("Portfolio: no open positions.")
            return

        log.info("=" * 70)
        log.info("PORTFOLIO STATE  (%d open positions)", len(self._positions))
        log.info("%-12s  %-5s  %10s  %10s  %10s  %10s  %10s",
                 "Symbol", "Side", "Entry", "Current", "SL", "TP", "Unreal P&L")
        log.info("-" * 70)
        for sym, pos in self._positions.items():
            price = prices.get(sym, 0.0)
            pnl = pos.unrealised_pnl(price)
            log.info(
                "%-12s  %-5s  %10.4f  %10.4f  %10.4f  %10.4f  %+10.4f",
                sym, pos.side, pos.entry_price, price,
                pos.stop_loss, pos.take_profit, pnl,
            )
        log.info("=" * 70)
