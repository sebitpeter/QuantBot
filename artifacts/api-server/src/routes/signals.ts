import { Router, type IRouter } from "express";
import { GetSignalsQueryParams, GetSignalsResponse } from "@workspace/api-zod";
import { botStore } from "../lib/bot-store.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router: IRouter = Router();

// GET /signals
router.get("/signals", requireAuth, (req, res): void => {
  const params = GetSignalsQueryParams.safeParse(req.query);
  const limit = params.success ? (params.data.limit ?? 50) : 50;
  const symbol = params.success ? params.data.symbol ?? undefined : undefined;
  const data = GetSignalsResponse.parse(botStore.getSignals(limit, symbol));
  res.json(data);
});

export default router;
