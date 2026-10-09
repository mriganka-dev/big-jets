import { Router } from "express";
import { telegramWebhookLimiter } from "../middlewares/rateLimiters.js";
import { telegramSecretMiddleware } from "../middlewares/telegramSecret.js";
import { handleWebhookUpdate } from "../controllers/telegramController.js";

export const telegramRoutes = Router();

telegramRoutes.post(
  "/telegram/webhook",
  telegramWebhookLimiter,
  telegramSecretMiddleware,
  handleWebhookUpdate
);
