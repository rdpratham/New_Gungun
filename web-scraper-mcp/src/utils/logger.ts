import winston from "winston";

/**
 * Enterprise logging via Winston.
 *
 * IMPORTANT: An MCP server communicates with the host over stdio (stdout/stdin)
 * using JSON-RPC. Writing anything that is not a protocol message to stdout will
 * corrupt the stream. Therefore ALL logs are emitted on stderr (and optionally a
 * file), never stdout.
 */

const logLevel = process.env.LOG_LEVEL || "info";
const logFile = process.env.LOG_FILE; // optional path to a log file

const transports: winston.transport[] = [
  new winston.transports.Console({
    stderrLevels: ["error", "warn", "info", "http", "verbose", "debug", "silly"],
  }),
];

if (logFile) {
  transports.push(
    new winston.transports.File({
      filename: logFile,
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 3,
    })
  );
}

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
      return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
    })
  ),
  transports,
});

/**
 * Structured request logger. Records timestamp, URL, status and duration for
 * every fetch performed by the scraping engine.
 */
export function logRequest(params: {
  url: string;
  status: number | string;
  durationMs: number;
  method: string;
  note?: string;
}): void {
  logger.info("scrape_request", {
    url: params.url,
    status: params.status,
    duration_ms: params.durationMs,
    method: params.method,
    ...(params.note ? { note: params.note } : {}),
  });
}
