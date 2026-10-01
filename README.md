# Algorithmic Trading Bot

A modular, production-ready Python trading bot that dynamically trades any list of assets using an EMA crossover + RSI strategy with built-in risk management.

---

## Features

| Feature | Detail |
|---|---|
| **Dynamic asset list** | Pass symbols via `.env`, env var, or CLI flag |
| **Multi-broker support** | ccxt (crypto) or Alpaca (stocks/crypto) |
| **Strategy** | EMA(20/50) crossover filtered by RSI(14) |
| **Position sizing** | Fixed-fractional – risk a fixed % of equity per trade |
| **Stop-loss / Take-profit** | Automatically attached to every opened position |
| **Max positions gate** | Hard limit on concurrent open trades |
| **Logging** | Console + rotating file (`bot.log`) via Python `logging` |
| **Dry-run mode** | Logs intended orders without placing them |
| **Graceful shutdown** | Ctrl-C / SIGTERM handled cleanly |

---

## Project Structure

```
trading_bot/
├── __init__.py      Package docstring
├── config.py        All configuration (env vars + CLI args)
├── logger.py        Logging setup (console + rotating file)
├── exchange.py      Broker abstraction (ccxt / Alpaca)
├── strategy.py      EMA + RSI indicator logic and signal checkers
├── risk.py          Position sizing, SL/TP calculation
├── portfolio.py     In-memory position tracker
├── execution.py     High-level buy/sell/exit execution
└── main.py          Main polling loop + entry point

requirements.txt     Python dependencies
.env.example         Configuration template → copy to .env
```

---

## Quick Start

### 1. Clone / set up the project

```bash
git clone <your-repo>
cd <your-repo>
```

### 2. Create a virtual environment and install dependencies

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configure your `.env`

```bash
cp .env.example .env
# Open .env and fill in your API credentials
```

Key variables to set:

| Variable | Description |
|---|---|
| `EXCHANGE_TYPE` | `ccxt` (crypto) or `alpaca` (stocks/crypto) |
| `CCXT_API_KEY` / `CCXT_API_SECRET` | ccxt exchange credentials |
| `CCXT_SANDBOX` | `true` → testnet (recommended to start) |
| `ALPACA_API_KEY` / `ALPACA_API_SECRET` | Alpaca credentials |
| `ALPACA_MODE` | `paper` → paper trading (free) |
| `SYMBOLS` | Comma-separated symbols, e.g. `BTC/USDT,ETH/USDT` |

### 4. Run in dry-run mode first (no orders placed)

```bash
python -m trading_bot.main --dry-run
```

Or target specific symbols:

```bash
python -m trading_bot.main --symbols BTC/USDT ETH/USDT --dry-run
```

### 5. Run in paper / sandbox mode (real API calls, fake money)

Make sure `CCXT_SANDBOX=true` (ccxt) or `ALPACA_MODE=paper` (Alpaca), then:

```bash
python -m trading_bot.main
```

### 6. Adjust strategy & risk parameters in `.env`

```bash
EMA_FAST=20
EMA_SLOW=50
RSI_PERIOD=14
RSI_OVERSOLD=30
RSI_OVERBOUGHT=70
RISK_PER_TRADE=0.02    # 2% of equity per trade
STOP_LOSS_PCT=0.02     # 2% stop-loss
TAKE_PROFIT_PCT=0.04   # 4% take-profit
MAX_OPEN_POSITIONS=5
POLL_INTERVAL_SECONDS=3600   # check every 1 hour
```

---

## CLI Reference

```
python -m trading_bot.main [OPTIONS]

Options:
  --symbols SYMBOL [SYMBOL ...]   Override asset symbol list
  --exchange-type {ccxt,alpaca}   Override exchange type
  --timeframe TIMEFRAME           Override OHLCV timeframe (e.g. 15m, 1h, 4h)
  --interval SECONDS              Override polling interval in seconds
  --dry-run                       Log signals only, place no real orders
```

---

## Strategy Details

### Buy signal (both conditions must be true)
1. **EMA crossover** – Fast EMA (default 20) crosses **above** slow EMA (default 50)
2. **RSI filter** – RSI is **below** the overbought threshold (default 70) – momentum not yet exhausted

### Sell signal (both conditions must be true)
1. **EMA crossunder** – Fast EMA crosses **below** slow EMA
2. **RSI filter** – RSI is **above** the oversold threshold (default 30) – not already at the bottom

### Exits (checked every cycle)
- **Stop-loss** hit → market sell immediately
- **Take-profit** hit → market sell immediately

---

## Risk Management

Position size is calculated using the **fixed-fractional** model:

```
risk_amount   = equity × RISK_PER_TRADE
risk_per_unit = |entry_price − stop_loss_price|
quantity      = risk_amount / risk_per_unit
```

This ensures that hitting the stop-loss on any single trade costs at most `RISK_PER_TRADE` (default 2%) of total equity.

---

## Customisation

| What to change | Where |
|---|---|
| Add more indicators (MACD, Bollinger Bands …) | `trading_bot/strategy.py` |
| Add short-selling support | `trading_bot/execution.py` + `trading_bot/risk.py` |
| Persist positions across restarts | `trading_bot/portfolio.py` (add JSON/SQLite) |
| Add Telegram / Discord alerts | `trading_bot/execution.py` (after order placed) |
| Add trailing stop-loss | `trading_bot/portfolio.py` + `trading_bot/execution.py` |
| Support multiple exchanges simultaneously | `trading_bot/exchange.py` |

---

## ⚠️ Disclaimer

This software is for **educational and research purposes only**. It does not constitute financial advice. Algorithmic trading carries significant risk. Always:
- Test thoroughly on paper / testnet accounts before using real money.
- Review position sizing and risk parameters carefully.
- Understand that past performance of any strategy does not guarantee future results.
- Comply with your broker's terms of service and local regulations.
