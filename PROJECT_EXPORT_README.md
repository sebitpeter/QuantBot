# QuantBot project source

This archive contains the QuantBot dashboard, Express API server, standalone Python bot reference, generated API contract/client, workspace manifests, and original specification input.

## Contents

- `artifacts/trading-bot/` — React/Vite dashboard and Clerk sign-in/sign-up UI
- `artifacts/api-server/` — Express API, paper-trading engine, and authentication middleware
- `trading_bot/` — standalone Python trading bot and its `requirements.txt`
- `lib/api-spec/`, `lib/api-zod/`, `lib/api-client-react/`, `lib/db/` — shared workspace packages
- Root pnpm, TypeScript, Replit, and project documentation files
- `attached_assets/` — original project specification input

## Install and build

Requires Node.js and pnpm. From the extracted project directory:

```sh
pnpm install
pnpm --filter @workspace/api-server run build
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/trading-bot run build
```

The dashboard's API service needs to run alongside it. In Replit, use the configured API Server and web workflows. Outside Replit, start them in separate terminals with the environment required by each package. Authentication uses Clerk; no credentials are included in this archive. Configure Clerk keys in your deployment environment before using sign-in or sign-up.

## Python reference bot

```sh
python -m pip install -r trading_bot/requirements.txt
cp .env.example .env
python -m trading_bot.main --dry-run
```

Fill in any exchange credentials locally only if you choose to run the standalone bot. Never commit `.env` or share API credentials.

The dashboard's market feed is simulated paper-trading data. It does not place live trades. Review the trading and risk code carefully before connecting any real brokerage account.
