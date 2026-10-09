import crypto from "crypto";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

/**
 * Validates the X-Telegram-Bot-Api-Secret-Token header on webhook requests
 * using constant-time comparison to prevent timing attacks.
 */
export function telegramSecretMiddleware(req, res, next) {
  const secretHeader = req.headers["x-telegram-bot-api-secret-token"];
  const expectedSecret = config.telegram.webhookSecret;

  if (!expectedSecret) {
    logger.warn("Telegram webhook secret is not configured on the server");
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!secretHeader || typeof secretHeader !== "string") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const headerBuf = Buffer.from(secretHeader, "utf8");
  const expectedBuf = Buffer.from(expectedSecret, "utf8");

  if (headerBuf.length !== expectedBuf.length) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!crypto.timingSafeEqual(headerBuf, expectedBuf)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
}
