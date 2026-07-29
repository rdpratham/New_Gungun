/**
 * Minimal logger that redacts anything that looks like a credential before it
 * ever reaches stdout — tokens, passwords, JWTs, and API keys must never be
 * printed to logs.
 */

const SECRET_KEY_PATTERN = /(password|jwt|token|secret|apikey|api_key|private_key|authorization)/i;

function redact(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    return value.length > 0 ? "[redacted]" : value;
  }
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET_KEY_PATTERN.test(key) ? "[redacted]" : redact(val);
    }
    return out;
  }
  return value;
}

function safeArg(arg: unknown): unknown {
  if (typeof arg === "object" && arg !== null) return redact(arg);
  return arg;
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    console.log(`[info] ${message}`, meta ? safeArg(meta) : "");
  },
  warn(message: string, meta?: Record<string, unknown>) {
    console.warn(`[warn] ${message}`, meta ? safeArg(meta) : "");
  },
  error(message: string, meta?: Record<string, unknown>) {
    console.error(`[error] ${message}`, meta ? safeArg(meta) : "");
  },
};
