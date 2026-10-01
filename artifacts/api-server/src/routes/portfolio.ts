import { Router, type IRouter } from "express";
import { GetPortfolioSummaryResponse } from "@workspace/api-zod";
import { botStore } from "../lib/bot-store.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router: IRouter = Router();

// GET /portfolio/summary
router.get("/portfolio/summary", requireAuth, (_req, res): void => {
  const positions = botStore.getPositions();
  const stats = botStore.getStats();
  const totalUnrealisedPnl = positions.reduce((sum, p) => sum + p.unrealisedPnl, 0);
  const winRate =
    stats.closedTrades > 0
      ? Math.round((stats.winningTrades / stats.closedTrades) * 10000) / 100
      : null;

  const data = GetPortfolioSummaryResponse.parse({
    equity: Math.round(botStore.equity * 100) / 100,
    totalUnrealisedPnl: Math.round(totalUnrealisedPnl * 100) / 100,
    openPositions: positions.length,
    totalSignals: stats.totalSignals,
    buySignals: stats.buySignals,
    sellSignals: stats.sellSignals,
    totalCycles: stats.totalCycles,
    winRate,
  });
  res.json(data);
});

export default router;
