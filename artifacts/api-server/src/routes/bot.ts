import { Router, type IRouter } from "express";
import {
  GetBotStatusResponse,
  StartBotResponse,
  StopBotResponse,
  GetBotConfigResponse,
  UpdateBotConfigBody,
  UpdateBotConfigResponse,
  GetBotLogsQueryParams,
  GetBotLogsResponse,
} from "@workspace/api-zod";
import { botStore } from "../lib/bot-store.js";
import { startEngine, stopEngine } from "../lib/bot-engine.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router: IRouter = Router();

// GET /bot/status
router.get("/bot/status", requireAuth, (_req, res): void => {
  const data = GetBotStatusResponse.parse({
    running: botStore.running,
    mode: botStore.config.mode,
    exchange: botStore.config.mode === "paper" ? "Paper Trading" : "Live",
    uptime: botStore.getUptimeSeconds(),
    currentCycle: botStore.currentCycle,
    startedAt: botStore.startedAt?.toISOString() ?? null,
  });
  res.json(data);
});

// POST /bot/start
router.post("/bot/start", requireAuth, (_req, res): void => {
  startEngine();
  const data = StartBotResponse.parse({
    running: botStore.running,
    mode: botStore.config.mode,
    exchange: botStore.config.mode === "paper" ? "Paper Trading" : "Live",
    uptime: botStore.getUptimeSeconds(),
    currentCycle: botStore.currentCycle,
    startedAt: botStore.startedAt?.toISOString() ?? null,
  });
  res.json(data);
});

// POST /bot/stop
router.post("/bot/stop", requireAuth, (_req, res): void => {
  stopEngine();
  const data = StopBotResponse.parse({
    running: botStore.running,
    mode: botStore.config.mode,
    exchange: botStore.config.mode === "paper" ? "Paper Trading" : "Live",
    uptime: botStore.getUptimeSeconds(),
    currentCycle: botStore.currentCycle,
    startedAt: botStore.startedAt?.toISOString() ?? null,
  });
  res.json(data);
});

// GET /bot/config
router.get("/bot/config", requireAuth, (_req, res): void => {
  const data = GetBotConfigResponse.parse(botStore.config);
  res.json(data);
});

// PUT /bot/config
router.put("/bot/config", requireAuth, (req, res): void => {
  const parsed = UpdateBotConfigBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  botStore.updateConfig(parsed.data as Partial<typeof botStore.config>);
  const data = UpdateBotConfigResponse.parse(botStore.config);
  res.json(data);
});

// GET /bot/logs
router.get("/bot/logs", requireAuth, (req, res): void => {
  const params = GetBotLogsQueryParams.safeParse(req.query);
  const limit = params.success ? (params.data.limit ?? 100) : 100;
  const logs = botStore.getLogs(limit);
  const data = GetBotLogsResponse.parse(logs);
  res.json(data);
});

export default router;
