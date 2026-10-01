import { Router, type IRouter } from "express";
import { GetMarketPricesResponse } from "@workspace/api-zod";
import { botStore } from "../lib/bot-store.js";
import { marketSim } from "../lib/market-simulator.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router: IRouter = Router();

// GET /market/prices
router.get("/market/prices", requireAuth, (_req, res): void => {
  const symbols = botStore.config.symbols;
  const prices = symbols.map((sym) => marketSim.getTicker(sym));
  const data = GetMarketPricesResponse.parse(prices);
  res.json(data);
});

export default router;
