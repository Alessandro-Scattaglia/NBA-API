function asBoolean(value: string | undefined) {
  return value === "1" || value === "true";
}

function getDefaultNbaSeason(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const seasonStartYear = month >= 9 ? year : year - 1;
  return `${seasonStartYear}-${String((seasonStartYear + 1) % 100).padStart(2, "0")}`;
}

export const env = {
  port: Number(process.env.PORT ?? 4001),
  nbaSeason: process.env.NBA_SEASON ?? getDefaultNbaSeason(),
  statsBaseUrl: process.env.NBA_STATS_BASE_URL ?? "https://stats.nba.com/stats",
  cdnBaseUrl: process.env.NBA_CDN_BASE_URL ?? "https://cdn.nba.com",
  liveBaseUrl: process.env.NBA_LIVE_BASE_URL ?? "https://cdn.nba.com/static/json/liveData",
  requestTimeoutMs: Number(process.env.NBA_REQUEST_TIMEOUT_MS ?? 6000),
  requestRetries: Number(process.env.NBA_REQUEST_RETRIES ?? 1),
  allowInsecureTls: asBoolean(process.env.NBA_ALLOW_INSECURE_TLS)
} as const;
