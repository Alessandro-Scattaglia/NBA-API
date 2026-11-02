function asBoolean(value: string | undefined) {
  return value === "1" || value === "true";
}

export interface WorkerEnv {
  NBA_SEASON?: string;
  NBA_STATS_BASE_URL?: string;
  NBA_CDN_BASE_URL?: string;
  NBA_LIVE_BASE_URL?: string;
  NBA_REQUEST_TIMEOUT_MS?: string;
  NBA_REQUEST_RETRIES?: string;
  NBA_ALLOW_INSECURE_TLS?: string;
  FRONTEND_ORIGIN?: string;
}

function getDefaultNbaSeason(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const seasonStartYear = month >= 9 ? year : year - 1;
  return `${seasonStartYear}-${String((seasonStartYear + 1) % 100).padStart(2, "0")}`;
}

export interface RuntimeEnv {
  nbaSeason: string;
  statsBaseUrl: string;
  cdnBaseUrl: string;
  liveBaseUrl: string;
  requestTimeoutMs: number;
  requestRetries: number;
  allowInsecureTls: boolean;
}

export function createRuntimeEnv(bindings: WorkerEnv = {}): RuntimeEnv {
  return {
    nbaSeason: bindings.NBA_SEASON ?? getDefaultNbaSeason(),
    statsBaseUrl: bindings.NBA_STATS_BASE_URL ?? "https://stats.nba.com/stats",
    cdnBaseUrl: bindings.NBA_CDN_BASE_URL ?? "https://cdn.nba.com",
    liveBaseUrl: bindings.NBA_LIVE_BASE_URL ?? "https://cdn.nba.com/static/json/liveData",
    requestTimeoutMs: Number(bindings.NBA_REQUEST_TIMEOUT_MS ?? 6000),
    requestRetries: Number(bindings.NBA_REQUEST_RETRIES ?? 1),
    allowInsecureTls: asBoolean(bindings.NBA_ALLOW_INSECURE_TLS)
  };
}

export const env = createRuntimeEnv();
