import { config } from "../config.js";
import { logger } from "../utils/logger.js";

// Central error handler
export function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || err.status || 500;

  // Log the real error on the server without request query parameters or secrets
  logger.error(`${req.method} ${req.path || "/"} failed: ${err.message}`, {
    statusCode,
    name: err.name,
  });

  const response = {
    error:
      config.isProduction && statusCode === 500
        ? "Internal server error"
        : err.message || "Internal server error",
  };

  res.status(statusCode).json(response);
}
