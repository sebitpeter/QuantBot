import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import botRouter from "./bot.js";
import positionsRouter from "./positions.js";
import signalsRouter from "./signals.js";
import marketRouter from "./market.js";
import portfolioRouter from "./portfolio.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(botRouter);
router.use(positionsRouter);
router.use(signalsRouter);
router.use(marketRouter);
router.use(portfolioRouter);

export default router;
