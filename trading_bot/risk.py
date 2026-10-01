"""
risk.py
=======
Position sizing and risk calculation helpers.

Key functions
-------------
- ``calculate_position_size``  – how many units to buy given equity and risk %
- ``calculate_stop_loss``      – stop-loss price below entry
- ``calculate_take_profit``    – take-profit price above entry
- ``can_open_position``        – enforce max-open-positions gate
"""

from __future__ import annotations

from trading_bot import config
from trading_bot.logger import get_logger

log = get_logger(__name__)


def calculate_position_size(
    equity: float,
    entry_price: float,
    stop_loss_price: float,
    risk_pct: float = config.RISK_PER_TRADE,
) -> float:
    """
    Calculate order quantity using the fixed-fractional risk model.

    The position size is chosen so that if the trade hits stop-loss the loss
    equals exactly *risk_pct* × *equity*.

    Formula:
        risk_amount = equity * risk_pct
        risk_per_unit = |entry_price - stop_loss_price|
        qty = risk_amount / risk_per_unit

    Parameters
    ----------
    equity : float           Total account equity in quote currency.
    entry_price : float      Expected fill price.
    stop_loss_price : float  Stop-loss price.
    risk_pct : float         Fraction of equity to risk (e.g. 0.02 = 2 %).

    Returns
    -------
    float  Quantity in base currency (rounded to 6 dp).
    """
    if entry_price <= 0 or stop_loss_price <= 0:
        raise ValueError("entry_price and stop_loss_price must be positive.")
    if not (0 < risk_pct <= 1):
        raise ValueError("risk_pct must be in (0, 1].")

    risk_amount = equity * risk_pct
    risk_per_unit = abs(entry_price - stop_loss_price)

    if risk_per_unit == 0:
        log.warning("risk_per_unit is zero – entry equals stop loss; returning 0.")
        return 0.0

    qty = risk_amount / risk_per_unit
    qty = round(qty, 6)
    log.debug(
        "Position size | equity=%.2f  risk_pct=%.2f%%  entry=%.6f  sl=%.6f  qty=%.6f",
        equity, risk_pct * 100, entry_price, stop_loss_price, qty,
    )
    return qty


def calculate_stop_loss(
    entry_price: float,
    side: str = "buy",
    sl_pct: float = config.STOP_LOSS_PCT,
) -> float:
    """
    Compute stop-loss price.

    Parameters
    ----------
    entry_price : float
    side : str     "buy"  → SL is *below* entry
                   "sell" → SL is *above* entry  (for short positions)
    sl_pct : float  Distance as a fraction of entry price (e.g. 0.02 = 2 %).

    Returns
    -------
    float  Stop-loss price.
    """
    if side == "buy":
        sl = entry_price * (1.0 - sl_pct)
    else:
        sl = entry_price * (1.0 + sl_pct)
    log.debug("Stop-loss  | entry=%.6f  side=%s  sl_pct=%.2f%%  sl=%.6f", entry_price, side, sl_pct * 100, sl)
    return round(sl, 8)


def calculate_take_profit(
    entry_price: float,
    side: str = "buy",
    tp_pct: float = config.TAKE_PROFIT_PCT,
) -> float:
    """
    Compute take-profit price.

    Parameters
    ----------
    entry_price : float
    side : str     "buy"  → TP is *above* entry
                   "sell" → TP is *below* entry
    tp_pct : float  Distance as a fraction of entry price (e.g. 0.04 = 4 %).

    Returns
    -------
    float  Take-profit price.
    """
    if side == "buy":
        tp = entry_price * (1.0 + tp_pct)
    else:
        tp = entry_price * (1.0 - tp_pct)
    log.debug("Take-profit | entry=%.6f  side=%s  tp_pct=%.2f%%  tp=%.6f", entry_price, side, tp_pct * 100, tp)
    return round(tp, 8)


def can_open_position(
    open_positions: dict,
    max_positions: int = config.MAX_OPEN_POSITIONS,
) -> bool:
    """
    Return ``True`` if a new position can be opened.

    Parameters
    ----------
    open_positions : dict  Mapping of symbol → position data (from PortfolioTracker).
    max_positions : int    Maximum allowed concurrent open positions.
    """
    current = len(open_positions)
    allowed = current < max_positions
    if not allowed:
        log.info(
            "Max open positions reached (%d/%d) – skipping new entry.",
            current, max_positions,
        )
    return allowed
