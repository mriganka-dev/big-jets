import { app } from "./app.js";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";
import { saveNow } from "./store/store.js";
import { startPoller, stopPoller } from "./services/poller.js";

const server = app.listen(config.port, () => {
  logger.info(`Big Jets server running on port ${config.port} (${config.env})`);
  startPoller();
});

// Protect against slowloris and stalled connections
server.setTimeout(30000);
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

let isShuttingDown = false;

export function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal}, shutting down gracefully...`);

  // Stop background poller
  stopPoller();

  // Ensure store data is flushed to disk
  saveNow();

  server.close((err) => {
    if (err) {
      logger.error("Error while closing HTTP server", err.message);
      process.exit(1);
    }
    logger.info("HTTP server closed cleanly.");
    process.exit(0);
  });

  // Force exit after 10 seconds if hanging
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

process.on("uncaughtException", (error) => {
  logger.error(`Uncaught exception: ${error.message}`);
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  logger.error(`Unhandled rejection: ${message}`);
  gracefulShutdown("unhandledRejection");
});
