function formatMessage(level, message, extra) {
  const timestamp = new Date().toISOString();
  const base = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  if (extra !== undefined) {
    return `${base} ${typeof extra === "object" ? JSON.stringify(extra) : extra}`;
  }
  return base;
}

export const logger = {
  info(message, extra) {
    console.log(formatMessage("info", message, extra));
  },
  warn(message, extra) {
    console.warn(formatMessage("warn", message, extra));
  },
  error(message, extra) {
    console.error(formatMessage("error", message, extra));
  },
  debug(message, extra) {
    if (process.env.NODE_ENV !== "production") {
      console.debug(formatMessage("debug", message, extra));
    }
  },
};
