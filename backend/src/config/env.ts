function asBoolean(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
    return true;
  }

  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
    return false;
  }

  return fallback;
}

export const env = {
  port: Number(process.env.PORT ?? 4001),
  nbaSeason: process.env.NBA_SEASON ?? "2025-26",
  statsBaseUrl: process.env.NBA_STATS_BASE_URL ?? "https://stats.nba.com/stats",
  cdnBaseUrl: process.env.NBA_CDN_BASE_URL ?? "https://cdn.nba.com",
  liveBaseUrl: process.env.NBA_LIVE_BASE_URL ?? "https://cdn.nba.com/static/json/liveData",
  requestTimeoutMs: Number(process.env.NBA_REQUEST_TIMEOUT_MS ?? 2200),
  requestRetries: Number(process.env.NBA_REQUEST_RETRIES ?? 0),
  warmupEnabled: asBoolean(process.env.WARMUP_ENABLED, true),
  warmupIntervalMs: Number(process.env.WARMUP_INTERVAL_MS ?? 45_000)
} as const;
