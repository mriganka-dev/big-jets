import dotenv from "dotenv";
import { z } from "zod";
import { logger } from "./utils/logger.js";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  FRONTEND_ORIGIN: z.string().default("http://localhost:3000"),
  TRUST_PROXY: z
    .string()
    .optional()
    .default("false")
    .transform((val) => val === "true" || val === "1"),
  ADSB_API: z.string().url().default("https://api.adsb.lol/v2"),
  POLL_MS: z.coerce.number().int().min(1000).default(20000),
  STORE_PATH: z.string().default("./src/data/store.json"),
  TELEGRAM_BOT_TOKEN: z.string().optional().default(""),
  TELEGRAM_MODE: z.enum(["polling", "webhook"]).default("polling"),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional().default(""),
  TELEGRAM_ALLOWED_USER_IDS: z
    .string()
    .optional()
    .default("")
    .transform((val) =>
      val
        ? val
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean)
        : []
    ),
  PUBLIC_URL: z.string().url().default("http://localhost:4000"),
  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: z
    .string()
    .optional()
    .default("false")
    .transform((val) => val === "true" || val === "1"),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  EMAIL_FROM: z.string().optional().default(""),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  logger.error("Environment configuration validation failed:");
  for (const issue of parsed.error.issues) {
    logger.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

const rawConfig = parsed.data;

export const config = {
  env: rawConfig.NODE_ENV,
  isProduction: rawConfig.NODE_ENV === "production",
  port: rawConfig.PORT,
  frontendOrigin: rawConfig.FRONTEND_ORIGIN,
  trustProxy: rawConfig.TRUST_PROXY,
  adsbApi: rawConfig.ADSB_API.replace(/\/+$/, ""),
  pollMs: rawConfig.POLL_MS,
  storePath: rawConfig.STORE_PATH,
  publicUrl: rawConfig.PUBLIC_URL.replace(/\/+$/, ""),
  telegram: {
    botToken: rawConfig.TELEGRAM_BOT_TOKEN,
    mode: rawConfig.TELEGRAM_MODE,
    webhookSecret: rawConfig.TELEGRAM_WEBHOOK_SECRET,
    allowedUserIds: rawConfig.TELEGRAM_ALLOWED_USER_IDS,
    isEnabled: Boolean(rawConfig.TELEGRAM_BOT_TOKEN),
  },
  smtp: {
    host: rawConfig.SMTP_HOST,
    port: rawConfig.SMTP_PORT,
    secure: rawConfig.SMTP_SECURE,
    user: rawConfig.SMTP_USER,
    pass: rawConfig.SMTP_PASS,
    from: rawConfig.EMAIL_FROM,
    isEnabled: Boolean(rawConfig.SMTP_HOST && rawConfig.EMAIL_FROM),
  },
};
