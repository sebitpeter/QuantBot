"""
logger.py
=========
Configures a module-level logger that writes to both the console
and a rotating file handler.  Import ``get_logger`` in every module
to get a child logger with a consistent name.
"""

import logging
import logging.handlers
import sys
from typing import Optional


def setup_logging(log_file: str = "bot.log", level: str = "INFO") -> None:
    """
    Configure the root logger once at application startup.

    Parameters
    ----------
    log_file : str
        Path to the log file (will be created if it does not exist).
    level : str
        Logging level string, e.g. ``"DEBUG"``, ``"INFO"``, ``"WARNING"``.
    """
    numeric_level = getattr(logging, level.upper(), logging.INFO)

    fmt = logging.Formatter(
        fmt="%(asctime)s  %(levelname)-8s  %(name)-30s  %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    root = logging.getLogger()
    root.setLevel(numeric_level)

    # --- console handler ---
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(numeric_level)
    console_handler.setFormatter(fmt)

    # --- rotating file handler (10 MB max, 5 backups) ---
    file_handler = logging.handlers.RotatingFileHandler(
        log_file,
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    file_handler.setLevel(numeric_level)
    file_handler.setFormatter(fmt)

    root.addHandler(console_handler)
    root.addHandler(file_handler)


def get_logger(name: Optional[str] = None) -> logging.Logger:
    """
    Return a named child logger.

    Parameters
    ----------
    name : str, optional
        Module name, typically ``__name__``.
    """
    return logging.getLogger(name or "trading_bot")
