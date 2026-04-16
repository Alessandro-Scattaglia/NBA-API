export const env = {
  port: Number(process.env.PORT ?? 4001),
  nbaSeason: process.env.NBA_SEASON ?? "2025-26",
  statsBaseUrl: process.env.NBA_STATS_BASE_URL ?? "https://stats.nba.com/stats",
  cdnBaseUrl: process.env.NBA_CDN_BASE_URL ?? "https://cdn.nba.com",
  liveBaseUrl: process.env.NBA_LIVE_BASE_URL ?? "https://cdn.nba.com/static/json/liveData",
  requestTimeoutMs: Number(process.env.NBA_REQUEST_TIMEOUT_MS ?? 10000),
  requestRetries: Number(process.env.NBA_REQUEST_RETRIES ?? 0)
} as const;
