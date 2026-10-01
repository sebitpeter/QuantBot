"""
main.py
=======
Main execution loop for the trading bot.

Flow per cycle
--------------
1.  Fetch OHLCV candles for every symbol.
2.  Check SL/TP exits on existing positions.
3.  For each symbol without a position, check buy signal.
4.  For each symbol with a long position, check sell signal.
5.  Log portfolio state.
6.  Sleep until next cycle.

Run modes
---------
- Paper / sandbox (default):  CCXT_SANDBOX=true  or  ALPACA_MODE=paper
- Dry-run:                     pass ``--dry-run`` flag; no orders are placed.
- Live:                        set CCXT_SANDBOX=false  or  ALPACA_MODE=live
                                (REVIEW CAREFULLY BEFORE ENABLING)
"""

from __future__ import annotations

import signal
import sys
import time
from typing import Dict, List, Optional

from trading_bot import config
from trading_bot.exchange import create_exchange_client
from trading_bot.execution import check_exits, execute_buy, execute_sell
from trading_bot.logger import get_logger, setup_logging
from trading_bot.portfolio import PortfolioTracker
from trading_bot.strategy import check_buy_signal, check_sell_signal

log = get_logger(__name__)

# Sentinel for graceful shutdown
_RUNNING = True


def _handle_sigterm(signum, frame) -> None:
    """Handle SIGTERM / Ctrl-C for a clean shutdown."""
    global _RUNNING
    log.info("Shutdown signal received – finishing current cycle then exiting …")
    _RUNNING = False


def _register_signal_handlers() -> None:
    signal.signal(signal.SIGINT, _handle_sigterm)
    signal.signal(signal.SIGTERM, _handle_sigterm)


# ---------------------------------------------------------------------------
# Core loop helpers
# ---------------------------------------------------------------------------

def _fetch_all_ohlcv(exchange, symbols: List[str], timeframe: str, limit: int) -> Dict[str, list]:
    """
    Fetch OHLCV candles for every symbol, returning only successful results.

    Parameters
    ----------
    exchange : CcxtClient | AlpacaClient
    symbols : list[str]
    timeframe : str
    limit : int

    Returns
    -------
    dict  {symbol: ohlcv_list}
    """
    ohlcv_data: Dict[str, list] = {}
    for sym in symbols:
        try:
            candles = exchange.fetch_ohlcv(sym, timeframe=timeframe, limit=limit)
            if candles:
                ohlcv_data[sym] = candles
                log.debug("[%s] Fetched %d candles.", sym, len(candles))
            else:
                log.warning("[%s] fetch_ohlcv returned empty list.", sym)
        except Exception as exc:
            log.error("[%s] fetch_ohlcv failed: %s", sym, exc, exc_info=False)
    return ohlcv_data


def _fetch_prices(exchange, symbols: List[str]) -> Dict[str, float]:
    """
    Fetch the latest price for each symbol.

    Parameters
    ----------
    exchange : CcxtClient | AlpacaClient
    symbols : list[str]

    Returns
    -------
    dict  {symbol: price}
    """
    prices: Dict[str, float] = {}
    for sym in symbols:
        try:
            price = exchange.get_price(sym)
            if price > 0:
                prices[sym] = price
        except Exception as exc:
            log.error("[%s] get_price failed: %s", sym, exc, exc_info=False)
    return prices


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def run_loop(symbols: List[str], dry_run: bool = False) -> None:
    """
    Execute the main trading loop until a shutdown signal is received.

    Parameters
    ----------
    symbols : list[str]  Asset symbols to trade.
    dry_run : bool       If True, log signals but place no real orders.
    """
    log.info("=" * 70)
    log.info("Trading Bot starting")
    log.info("Exchange type : %s", config.EXCHANGE_TYPE.upper())
    log.info("Symbols       : %s", symbols)
    log.info("Timeframe     : %s", config.TIMEFRAME)
    log.info("Strategy      : EMA(%d/%d) + RSI(%d)", config.EMA_FAST, config.EMA_SLOW, config.RSI_PERIOD)
    log.info("Risk/trade    : %.1f%%", config.RISK_PER_TRADE * 100)
    log.info("Stop-loss     : %.1f%%", config.STOP_LOSS_PCT * 100)
    log.info("Take-profit   : %.1f%%", config.TAKE_PROFIT_PCT * 100)
    log.info("Max positions : %d", config.MAX_OPEN_POSITIONS)
    log.info("Poll interval : %d s", config.POLL_INTERVAL_SECONDS)
    log.info("Dry-run mode  : %s", dry_run)
    log.info("=" * 70)

    exchange = create_exchange_client()
    portfolio = PortfolioTracker()

    cycle = 0
    while _RUNNING:
        cycle += 1
        log.info("--- Cycle %d ---", cycle)

        # ------------------------------------------------------------------
        # 1. Fetch candles
        # ------------------------------------------------------------------
        ohlcv_data = _fetch_all_ohlcv(
            exchange, symbols,
            timeframe=config.TIMEFRAME,
            limit=config.OHLCV_LIMIT,
        )

        # ------------------------------------------------------------------
        # 2. Fetch current prices (reuse from ohlcv close where possible)
        # ------------------------------------------------------------------
        prices: Dict[str, float] = {}
        for sym, candles in ohlcv_data.items():
            if candles:
                prices[sym] = candles[-1][4]  # close of last candle

        # ------------------------------------------------------------------
        # 3. Check SL / TP exits on existing positions
        # ------------------------------------------------------------------
        check_exits(exchange, portfolio, prices, dry_run=dry_run)

        # ------------------------------------------------------------------
        # 4. Evaluate signals for each symbol
        # ------------------------------------------------------------------
        open_positions = portfolio.all_positions()
        n_open = len(open_positions)

        for sym in symbols:
            if not _RUNNING:
                break

            candles = ohlcv_data.get(sym)
            if not candles:
                continue

            has_pos = portfolio.has_position(sym)

            if has_pos:
                # --- Check sell / exit signal ---
                sell_signal, _ = check_sell_signal(sym, candles)
                if sell_signal:
                    execute_sell(sym, exchange, portfolio, reason="signal", dry_run=dry_run)
            else:
                # --- Check buy / entry signal (only if room for new positions) ---
                if n_open >= config.MAX_OPEN_POSITIONS:
                    log.debug("[%s] Skipping – max positions (%d) reached.", sym, config.MAX_OPEN_POSITIONS)
                    continue

                buy_signal, _ = check_buy_signal(sym, candles)
                if buy_signal:
                    opened = execute_buy(
                        sym, exchange, portfolio,
                        current_price=prices.get(sym),
                        dry_run=dry_run,
                    )
                    if opened:
                        n_open += 1

        # ------------------------------------------------------------------
        # 5. Log portfolio state
        # ------------------------------------------------------------------
        portfolio.log_portfolio_state(prices)

        # ------------------------------------------------------------------
        # 6. Sleep
        # ------------------------------------------------------------------
        if _RUNNING:
            log.info("Sleeping %d s until next cycle …", config.POLL_INTERVAL_SECONDS)
            # Use short sleeps so Ctrl-C is responsive
            for _ in range(config.POLL_INTERVAL_SECONDS):
                if not _RUNNING:
                    break
                time.sleep(1)

    # Teardown
    log.info("Shutting down – closing exchange connection …")
    try:
        exchange.close()
    except Exception as exc:
        log.warning("Error during exchange close: %s", exc)
    log.info("Bot stopped cleanly.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    """Parse args, configure logging, and start the main loop."""
    args = config.parse_args()

    # Apply CLI overrides
    if args.exchange_type:
        config.EXCHANGE_TYPE = args.exchange_type
    if args.timeframe:
        config.TIMEFRAME = args.timeframe
    if args.poll_interval:
        config.POLL_INTERVAL_SECONDS = args.poll_interval

    symbols: List[str] = args.symbols or config.DEFAULT_SYMBOLS
    dry_run: bool = args.dry_run

    # Logging setup (must come before first log call)
    setup_logging(log_file=config.LOG_FILE, level=config.LOG_LEVEL)

    _register_signal_handlers()
    run_loop(symbols=symbols, dry_run=dry_run)


if __name__ == "__main__":
    main()
