import express from "express";
import helmet from "helmet";
import cors from "cors";
import { config } from "./config.js";
import { healthRoutes } from "./routes/healthRoutes.js";
import { airportRoutes } from "./routes/airportRoutes.js";
import { telegramRoutes } from "./routes/telegramRoutes.js";
import { emailRoutes } from "./routes/emailRoutes.js";
import { notFound } from "./middlewares/notFound.js";
import { errorHandler } from "./middlewares/errorHandler.js";

export const app = express();

// Security headers and disable fingerprinting
app.use(helmet());
app.disable("x-powered-by");

// Trust proxy setting for reverse proxies (rate limiter IP detection)
if (config.trustProxy) {
  app.set("trust proxy", 1);
}

// CORS configuration based on FRONTEND_ORIGIN
const allowedOrigins = config.frontendOrigin
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        (!config.isProduction && origin.startsWith("http://localhost:"))
      ) {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "OPTIONS"],
  })
);

// Strict body limit to prevent large payload attacks
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));

// API routes
app.use("/api", healthRoutes);
app.use("/api", airportRoutes);
app.use("/api", telegramRoutes);
app.use("/api", emailRoutes);

// Catch 404 and forward to error handler
app.use(notFound);
app.use(errorHandler);
