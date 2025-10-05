type LogMethod = (message: string, meta?: Record<string, unknown>) => void;

const logFactory = (level: "info" | "warn" | "error" | "debug"): LogMethod => {
  return (message, meta) => {
    if (meta) console[level](`[formfiller] ${message}`, meta);
    else console[level](`[formfiller] ${message}`);
  };
};

const logger = {
  info: logFactory("info"),
  warn: logFactory("warn"),
  error: logFactory("error"),
  debug: logFactory("debug"),
};

export default logger;
