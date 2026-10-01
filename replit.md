# Algorithmic Trading Bot

A modular, production-ready Python trading bot that dynamically trades any list of assets using an EMA crossover + RSI filter strategy with built-in risk management.

## Run & Operate

```bash
# Dry-run (no orders placed, just signal logging)
python3 -m trading_bot.main --dry-run

# Paper trading (ccxt sandbox / Alpaca paper)
python3 -m trading_bot.main

# Override symbols and timeframe at runtime
python3 -m trading_bot.main --symbols BTC/USDT ETH/USDT --timeframe 4h --dry-run
```

## Stack

- Python 3, pure stdlib + numpy / pandas
- `ccxt` for crypto exchanges (Binance, Bybit, Kraken, Coinbase, …)
- `alpaca-trade-api` for stocks and crypto via Alpaca
- `python-dotenv` for environment variable management
- Python `logging` with a rotating file handler

## Where things live

| File | Purpose |
|---|---|
| `trading_bot/config.py` | All tunable parameters, env var loading, CLI args |
| `trading_bot/exchange.py` | Broker abstraction: ccxt + Alpaca under one interface |
| `trading_bot/strategy.py` | EMA + RSI indicator math and signal checkers |
| `trading_bot/risk.py` | Position sizing (fixed-fractional), SL/TP calculation |
| `trading_bot/portfolio.py` | In-memory position tracker with P&L |
| `trading_bot/execution.py` | High-level buy/sell/exit logic |
| `trading_bot/main.py` | Main polling loop and entry point |
| `.env.example` | Config template – copy to `.env` before running |
| `requirements.txt` | Python dependencies |
| `README.md` | Full usage guide |

## Architecture decisions

- **Config-first design** – every parameter has an env-var override so nothing needs to be changed in code for different environments or strategies.
- **Exchange abstraction** – `CcxtClient` and `AlpacaClient` expose the same interface so strategy/execution code is broker-agnostic.
- **EMA/RSI in pure numpy** – no heavy TA library required; swap in pandas_ta or TA-Lib in `strategy.py` for more indicators.
- **Fixed-fractional sizing** – position size is derived from the SL distance so that hitting stop-loss costs exactly `RISK_PER_TRADE` % of equity, not a flat lot size.
- **In-memory portfolio** – restart resets state; add JSON/SQLite persistence in `portfolio.py` for durability.

## User preferences

_Populate as you build._

## Gotchas

- Always test with `--dry-run` first, then with `CCXT_SANDBOX=true` / `ALPACA_MODE=paper` before enabling live trading.
- ccxt testnet support varies by exchange; some exchanges don't support sandbox mode (`CCXT_SANDBOX=true` will warn but fall back to live endpoint).
- Alpaca symbol format has no slash (`BTCUSD` not `BTC/USD`); the `AlpacaClient` handles the conversion automatically.
