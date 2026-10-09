import { Router } from "express";
import { healthLimiter } from "../middlewares/rateLimiters.js";

export const healthRoutes = Router();

healthRoutes.get("/health", healthLimiter, (_req, res) => {
  res.json({ ok: true });
});
