import { Router, type IRouter } from "express";
import {
  GetPositionsResponse,
  ClosePositionResponse,
} from "@workspace/api-zod";
import { botStore } from "../lib/bot-store.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router: IRouter = Router();

// GET /positions
router.get("/positions", requireAuth, (_req, res): void => {
  const data = GetPositionsResponse.parse(botStore.getPositions());
  res.json(data);
});

// DELETE /positions/:symbol  — symbol may contain "/" (e.g. "BTC/USDT")
router.delete("/positions/{*symbol}", requireAuth, (req, res): void => {
  const raw = Array.isArray(req.params.symbol) ? req.params.symbol[0] : req.params.symbol;
  const symbol = decodeURIComponent(raw ?? "");

  if (!symbol) {
    res.status(400).json({ error: "Symbol is required" });
    return;
  }

  if (!botStore.hasPosition(symbol)) {
    res.status(404).json({ error: `No open position for ${symbol}` });
    return;
  }

  const closed = botStore.closePosition(symbol);
  botStore.addLog("INFO", `Position manually closed | ${symbol}`, symbol);

  const data = ClosePositionResponse.parse({
    success: true,
    symbol,
    message: `Position closed. P&L: ${closed?.unrealisedPnl?.toFixed(4) ?? "0"}`,
  });
  res.json(data);
});

export default router;
