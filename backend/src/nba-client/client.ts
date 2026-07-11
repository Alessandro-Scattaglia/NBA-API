import { env } from "../config/env.js";
import { NBA_SEASON, PLAYOFF_PICTURE_SEASON_ID, REGULAR_SEASON_LABEL } from "../config/season.js";

export interface NbaApiClient {
  getLiveScoreboard(): Promise<unknown>;
  getLiveBoxscore(gameId: string): Promise<unknown>;
  getScoreboardByDate(gameDateIso: string): Promise<unknown>;
  getScheduleSnapshot(): Promise<unknown>;
  getPlayerIndex(): Promise<unknown>;
  getLeagueDashPlayerStats(): Promise<unknown>;
  getLeagueLeaders?(statCategory?: string): Promise<unknown>;
  getCommonPlayerInfo(playerId: number): Promise<unknown>;
  getPlayerGameLogs(playerId: number, seasonType?: string): Promise<unknown>;
  getTeamInfoCommon(teamId: number): Promise<unknown>;
  getCommonTeamRoster(teamId: number): Promise<unknown>;
  getLeagueDashTeamStats(): Promise<unknown>;
  getTeamGameLog(teamId: number, seasonType?: string): Promise<unknown>;
  getLeagueStandings(): Promise<unknown>;
  getPlayoffPicture(): Promise<unknown>;
}

type FetchImpl = typeof fetch;

const CERTIFICATE_ERROR_CODES = new Set([
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_GET_ISSUER_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
]);

let insecureTlsApplied = false;

const STATS_HEADERS: Record<string, string> = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  Origin: "https://www.nba.com",
  Pragma: "no-cache",
  Referer: "https://www.nba.com/",
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "x-nba-stats-origin": "stats",
  "x-nba-stats-token": "true"
};

const DEFAULT_HEADERS = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Origin: "https://www.nba.com",
  Pragma: "no-cache",
  Referer: "https://www.nba.com/",
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
};

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function applyInsecureTls(reason: "env" | "cert-error", details?: { url: string; code: string | null }) {
  if (insecureTlsApplied) {
    return false;
  }

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  insecureTlsApplied = true;

  if (reason === "env") {
    console.warn(
      "[nba-client] NBA_ALLOW_INSECURE_TLS=1 attivo: la verifica TLS e disabilitata solo per sbloccare ambienti con ispezione certificati."
    );
  } else {
    console.warn(
      `[nba-client] TLS certificate verification failed for ${details?.url ?? "NBA endpoint"} (${details?.code ?? "unknown"}). ` +
        "Retrying once with certificate verification disabled for this local session."
    );
  }

  return true;
}

function ensureTlsConfig() {
  if (!env.allowInsecureTls || insecureTlsApplied) {
    return;
  }

  applyInsecureTls("env");
}

function getCertificateErrorCode(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  if ("code" in error && typeof error.code === "string") {
    return error.code;
  }

  if ("cause" in error && typeof error.cause === "object" && error.cause !== null) {
    const nestedCause = error.cause as { code?: unknown };
    if (typeof nestedCause.code === "string") {
      return nestedCause.code;
    }
  }

  return null;
}

function shouldRetryWithInsecureTls(error: unknown, url: string) {
  const certificateErrorCode = getCertificateErrorCode(error);

  if (!certificateErrorCode || !CERTIFICATE_ERROR_CODES.has(certificateErrorCode) || env.allowInsecureTls) {
    return false;
  }

  return applyInsecureTls("cert-error", {
    url,
    code: certificateErrorCode
  });
}

function normalizeRequestError(error: unknown, url: string) {
  const certificateErrorCode = getCertificateErrorCode(error);

  if (certificateErrorCode && CERTIFICATE_ERROR_CODES.has(certificateErrorCode) && !env.allowInsecureTls) {
    return new Error(
      `TLS certificate verification failed for ${url} (${certificateErrorCode}). ` +
        "If this machine uses antivirus/proxy TLS inspection, set NBA_ALLOW_INSECURE_TLS=1 for local debugging."
    );
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(`Unknown NBA API error for ${url}`);
}

function buildUrl(baseUrl: string, path: string, params?: Record<string, string | number>) {
  const url = new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

async function requestJson(fetchImpl: FetchImpl, url: string, headers: Record<string, string>) {
  ensureTlsConfig();

  let lastError: unknown = null;
  let requestAttempts = 0;

  while (requestAttempts <= env.requestRetries) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.requestTimeoutMs);

    try {
      const response = await fetchImpl(url, {
        headers,
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`NBA API ${response.status} for ${url}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;

      if (shouldRetryWithInsecureTls(error, url)) {
        continue;
      }

      if (requestAttempts < env.requestRetries) {
        requestAttempts += 1;
        await delay(300 * requestAttempts);
      } else {
        break;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw normalizeRequestError(lastError, url);
}

function buildLeagueDashPlayerStatsParams() {
  return {
    College: "",
    Conference: "",
    Country: "",
    DateFrom: "",
    DateTo: "",
    Division: "",
    DraftPick: "",
    DraftYear: "",
    GameScope: "",
    GameSegment: "",
    Height: "",
    LastNGames: 0,
    LeagueID: "00",
    Location: "",
    MeasureType: "Base",
    Month: 0,
    OpponentTeamID: 0,
    PaceAdjust: "N",
    PerMode: "PerGame",
    Period: 0,
    PlayerExperience: "",
    PlayerPosition: "",
    PlusMinus: "N",
    Rank: "N",
    Season: NBA_SEASON,
    SeasonSegment: "",
    SeasonType: REGULAR_SEASON_LABEL,
    ShotClockRange: "",
    StarterBench: "",
    TeamID: 0,
    TwoWay: "0",
    VsConference: "",
    VsDivision: "",
    Weight: ""
  };
}

function buildLeagueDashTeamStatsParams() {
  return {
    Conference: "",
    DateFrom: "",
    DateTo: "",
    Division: "",
    GameScope: "",
    GameSegment: "",
    LastNGames: 0,
    LeagueID: "00",
    Location: "",
    MeasureType: "Base",
    Month: 0,
    OpponentTeamID: 0,
    PaceAdjust: "N",
    PerMode: "PerGame",
    Period: 0,
    PlusMinus: "N",
    Rank: "N",
    Season: NBA_SEASON,
    SeasonSegment: "",
    SeasonType: REGULAR_SEASON_LABEL,
    ShotClockRange: "",
    TeamID: 0,
    TwoWay: "0",
    VsConference: "",
    VsDivision: ""
  };
}

function buildPlayerIndexParams() {
  return {
    Active: 1,
    AllStar: 0,
    College: "",
    Country: "",
    DraftPick: "",
    DraftYear: "",
    Height: "",
    Historical: 0,
    LeagueID: "00",
    Season: NBA_SEASON,
    TeamID: 0,
    Weight: ""
  };
}

function buildLeagueLeadersParams(statCategory: string) {
  return {
    LeagueID: "00",
    PerMode: "PerGame",
    Scope: "S",
    Season: NBA_SEASON,
    SeasonType: REGULAR_SEASON_LABEL,
    StatCategory: statCategory
  };
}

export function createNbaApiClient(fetchImpl: FetchImpl = fetch): NbaApiClient {
  return {
    getLiveScoreboard() {
      const url = buildUrl(env.liveBaseUrl, "scoreboard/todaysScoreboard_00.json");
      return requestJson(fetchImpl, url, DEFAULT_HEADERS);
    },

    getLiveBoxscore(gameId: string) {
      const url = buildUrl(env.liveBaseUrl, `boxscore/boxscore_${gameId}.json`);
      return requestJson(fetchImpl, url, DEFAULT_HEADERS);
    },

    getScoreboardByDate(gameDateIso: string) {
      const [year, month, day] = gameDateIso.split("-");
      const gameDate = `${month}/${day}/${year}`;
      const url = buildUrl(env.statsBaseUrl, "scoreboardv2", {
        DayOffset: 0,
        GameDate: gameDate,
        LeagueID: "00"
      });
      return requestJson(fetchImpl, url, STATS_HEADERS);
    },

    getScheduleSnapshot() {
      const url = buildUrl(env.cdnBaseUrl, "static/json/staticData/scheduleLeagueV2_1.json");
      return requestJson(fetchImpl, url, DEFAULT_HEADERS);
    },

    getPlayerIndex() {
      const url = buildUrl(env.statsBaseUrl, "playerindex", buildPlayerIndexParams());
      return requestJson(fetchImpl, url, STATS_HEADERS);
    },

    getLeagueDashPlayerStats() {
      const url = buildUrl(env.statsBaseUrl, "leaguedashplayerstats", buildLeagueDashPlayerStatsParams());
      return requestJson(fetchImpl, url, STATS_HEADERS);
    },

    getLeagueLeaders(statCategory = "PTS") {
      const url = buildUrl(env.statsBaseUrl, "leagueleaders", buildLeagueLeadersParams(statCategory));
      return requestJson(fetchImpl, url, STATS_HEADERS);
    },

    getCommonPlayerInfo(playerId: number) {
      const url = buildUrl(env.statsBaseUrl, "commonplayerinfo", {
        LeagueID: "00",
        PlayerID: playerId
      });
      return requestJson(fetchImpl, url, STATS_HEADERS);
    },

    getPlayerGameLogs(playerId: number, seasonType: string = REGULAR_SEASON_LABEL) {
      const url = buildUrl(env.statsBaseUrl, "playergamelog", {
        LeagueID: "00",
        PlayerID: playerId,
        Season: NBA_SEASON,
        SeasonType: seasonType
      });
      return requestJson(fetchImpl, url, STATS_HEADERS);
    },

    getTeamInfoCommon(teamId: number) {
      const url = buildUrl(env.statsBaseUrl, "teaminfocommon", {
        LeagueIDNullable: "00",
        SeasonNullable: NBA_SEASON,
        TeamID: teamId
      });
      return requestJson(fetchImpl, url, STATS_HEADERS);
    },

    getCommonTeamRoster(teamId: number) {
      const url = buildUrl(env.statsBaseUrl, "commonteamroster", {
        LeagueID: "00",
        Season: NBA_SEASON,
        TeamID: teamId
      });
      return requestJson(fetchImpl, url, STATS_HEADERS);
    },

    getLeagueDashTeamStats() {
      const url = buildUrl(env.statsBaseUrl, "leaguedashteamstats", buildLeagueDashTeamStatsParams());
      return requestJson(fetchImpl, url, STATS_HEADERS);
    },

    getTeamGameLog(teamId: number, seasonType: string = REGULAR_SEASON_LABEL) {
      const url = buildUrl(env.statsBaseUrl, "teamgamelog", {
        LeagueID: "00",
        Season: NBA_SEASON,
        SeasonType: seasonType,
        TeamID: teamId
      });
      return requestJson(fetchImpl, url, STATS_HEADERS);
    },

    getLeagueStandings() {
      const url = buildUrl(env.statsBaseUrl, "leaguestandings", {
        LeagueID: "00",
        Season: NBA_SEASON,
        SeasonType: REGULAR_SEASON_LABEL
      });
      return requestJson(fetchImpl, url, STATS_HEADERS);
    },

    getPlayoffPicture() {
      const url = buildUrl(env.statsBaseUrl, "playoffpicture", {
        LeagueID: "00",
        SeasonID: PLAYOFF_PICTURE_SEASON_ID
      });
      return requestJson(fetchImpl, url, STATS_HEADERS);
    }
  };
}

export const nbaApiClient = createNbaApiClient();
