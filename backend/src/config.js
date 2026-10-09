import dotenv from "dotenv";
import { z } from "zod";
import { logger } from "./utils/logger.js";

dotenv.config();

const envSchema = z
  .object({
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
  })
  .refine(
    (data) => {
      if (
        data.TELEGRAM_BOT_TOKEN &&
        data.TELEGRAM_BOT_TOKEN.trim().length > 0
      ) {
        return data.TELEGRAM_ALLOWED_USER_IDS.length > 0;
      }
      return true;
    },
    {
      message:
        "TELEGRAM_ALLOWED_USER_IDS must contain at least one user ID when TELEGRAM_BOT_TOKEN is set",
      path: ["TELEGRAM_ALLOWED_USER_IDS"],
    }
  )
  .refine(
    (data) => {
      if (
        data.TELEGRAM_MODE === "webhook" &&
        data.TELEGRAM_BOT_TOKEN &&
        data.TELEGRAM_BOT_TOKEN.trim().length > 0
      ) {
        return (
          typeof data.TELEGRAM_WEBHOOK_SECRET === "string" &&
          data.TELEGRAM_WEBHOOK_SECRET.trim().length >= 32
        );
      }
      return true;
    },
    {
      message:
        "TELEGRAM_WEBHOOK_SECRET must be at least 32 characters long when TELEGRAM_MODE is webhook",
      path: ["TELEGRAM_WEBHOOK_SECRET"],
    }
  )
  .refine(
    (data) => {
      if (data.NODE_ENV === "production") {
        return data.ADSB_API.startsWith("https://");
      }
      return true;
    },
    {
      message: "ADSB_API must start with https:// in production mode",
      path: ["ADSB_API"],
    }
  )
  .refine(
    (data) => {
      if (data.NODE_ENV === "production") {
        return data.PUBLIC_URL.startsWith("https://");
      }
      return true;
    },
    {
      message: "PUBLIC_URL must start with https:// in production mode",
      path: ["PUBLIC_URL"],
    }
  );

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
