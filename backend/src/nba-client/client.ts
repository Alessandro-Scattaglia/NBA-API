import { createRuntimeEnv, type RuntimeEnv } from "../config/env.js";
import { getCurrentSeason, REGULAR_SEASON_LABEL } from "../config/season.js";

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
  getEspnScoreboardByDate?(gameDateIso: string): Promise<unknown>;
  getEspnRoster?(teamId: number): Promise<unknown>;
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

const ESPN_TEAM_IDS: Record<string, number> = {
  ATL: 1,
  BOS: 2,
  BKN: 17,
  CHA: 30,
  CHI: 4,
  CLE: 5,
  DAL: 6,
  DEN: 7,
  DET: 8,
  GSW: 9,
  HOU: 10,
  IND: 11,
  LAC: 12,
  LAL: 13,
  MEM: 29,
  MIA: 14,
  MIL: 15,
  MIN: 16,
  NOP: 3,
  NYK: 18,
  OKC: 25,
  ORL: 19,
  PHI: 20,
  PHX: 21,
  POR: 22,
  SAC: 23,
  SAS: 24,
  TOR: 28,
  UTA: 26,
  WAS: 27
};

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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

function shouldRetryWithInsecureTls(error: unknown, url: string, runtimeEnv: RuntimeEnv) {
  const certificateErrorCode = getCertificateErrorCode(error);

  if (!certificateErrorCode || !CERTIFICATE_ERROR_CODES.has(certificateErrorCode) || runtimeEnv.allowInsecureTls) {
    return false;
  }

  console.warn(`[nba-client] TLS certificate verification failed for ${url} (${certificateErrorCode}).`);
  return false;
}

function normalizeRequestError(error: unknown, url: string, runtimeEnv: RuntimeEnv) {
  const certificateErrorCode = getCertificateErrorCode(error);

  if (certificateErrorCode && CERTIFICATE_ERROR_CODES.has(certificateErrorCode) && !runtimeEnv.allowInsecureTls) {
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

async function requestJson(
  fetchImpl: FetchImpl,
  url: string,
  headers: Record<string, string>,
  runtimeEnv: RuntimeEnv,
  timeoutMs = runtimeEnv.requestTimeoutMs
) {
  let lastError: unknown = null;
  let requestAttempts = 0;

  while (requestAttempts <= runtimeEnv.requestRetries) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

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

      if (shouldRetryWithInsecureTls(error, url, runtimeEnv)) {
        continue;
      }

      if (requestAttempts < runtimeEnv.requestRetries) {
        requestAttempts += 1;
        await delay(300 * requestAttempts);
      } else {
        break;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw normalizeRequestError(lastError, url, runtimeEnv);
}

function buildLeagueDashPlayerStatsParams(season: string) {
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
    Season: season,
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

function buildLeagueDashTeamStatsParams(season: string) {
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
    Season: season,
    SeasonSegment: "",
    SeasonType: REGULAR_SEASON_LABEL,
    ShotClockRange: "",
    TeamID: 0,
    TwoWay: "0",
    VsConference: "",
    VsDivision: ""
  };
}

function buildPlayerIndexParams(season: string) {
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
    Season: season,
    TeamID: 0,
    Weight: ""
  };
}

function buildLeagueLeadersParams(statCategory: string, season: string) {
  return {
    LeagueID: "00",
    PerMode: "PerGame",
    Scope: "S",
    Season: season,
    SeasonType: REGULAR_SEASON_LABEL,
    StatCategory: statCategory
  };
}

export function createNbaApiClient(fetchImpl: FetchImpl = fetch, runtimeEnv = createRuntimeEnv()): NbaApiClient {
  return {
    getLiveScoreboard() {
      const url = buildUrl(runtimeEnv.liveBaseUrl, "scoreboard/todaysScoreboard_00.json");
      return requestJson(fetchImpl, url, DEFAULT_HEADERS, runtimeEnv);
    },

    getLiveBoxscore(gameId: string) {
      const url = buildUrl(runtimeEnv.liveBaseUrl, `boxscore/boxscore_${gameId}.json`);
      return requestJson(fetchImpl, url, DEFAULT_HEADERS, runtimeEnv);
    },

    getScoreboardByDate(gameDateIso: string) {
      const [year, month, day] = gameDateIso.split("-");
      const gameDate = `${month}/${day}/${year}`;
      const url = buildUrl(runtimeEnv.statsBaseUrl, "scoreboardv2", {
        DayOffset: 0,
        GameDate: gameDate,
        LeagueID: "00"
      });
      return requestJson(fetchImpl, url, STATS_HEADERS, runtimeEnv);
    },

    getScheduleSnapshot() {
      const url = buildUrl(runtimeEnv.statsBaseUrl, "scheduleleaguev2", {
        LeagueID: "00",
        Season: getCurrentSeason()
      });
      return requestJson(fetchImpl, url, STATS_HEADERS, runtimeEnv);
    },

    getPlayerIndex() {
      const url = buildUrl(runtimeEnv.statsBaseUrl, "playerindex", buildPlayerIndexParams(runtimeEnv.nbaSeason));
      return requestJson(fetchImpl, url, STATS_HEADERS, runtimeEnv);
    },

    getLeagueDashPlayerStats() {
      const url = buildUrl(runtimeEnv.statsBaseUrl, "leaguedashplayerstats", buildLeagueDashPlayerStatsParams(runtimeEnv.nbaSeason));
      return requestJson(fetchImpl, url, STATS_HEADERS, runtimeEnv);
    },

    getLeagueLeaders(statCategory = "PTS") {
      const url = buildUrl(runtimeEnv.statsBaseUrl, "leagueleaders", buildLeagueLeadersParams(statCategory, runtimeEnv.nbaSeason));
      return requestJson(fetchImpl, url, STATS_HEADERS, runtimeEnv);
    },

    getCommonPlayerInfo(playerId: number) {
      const url = buildUrl(runtimeEnv.statsBaseUrl, "commonplayerinfo", {
        LeagueID: "00",
        PlayerID: playerId
      });
      return requestJson(fetchImpl, url, STATS_HEADERS, runtimeEnv);
    },

    getPlayerGameLogs(playerId: number, seasonType: string = REGULAR_SEASON_LABEL) {
      const url = buildUrl(runtimeEnv.statsBaseUrl, "playergamelog", {
        LeagueID: "00",
        PlayerID: playerId,
        Season: runtimeEnv.nbaSeason,
        SeasonType: seasonType
      });
      return requestJson(fetchImpl, url, STATS_HEADERS, runtimeEnv);
    },

    getTeamInfoCommon(teamId: number) {
      const url = buildUrl(runtimeEnv.statsBaseUrl, "teaminfocommon", {
        LeagueIDNullable: "00",
        SeasonNullable: runtimeEnv.nbaSeason,
        TeamID: teamId
      });
      return requestJson(fetchImpl, url, STATS_HEADERS, runtimeEnv);
    },

    getCommonTeamRoster(teamId: number) {
      const url = buildUrl(runtimeEnv.statsBaseUrl, "commonteamroster", {
        LeagueID: "00",
        Season: runtimeEnv.nbaSeason,
        TeamID: teamId
      });
      return requestJson(fetchImpl, url, STATS_HEADERS, runtimeEnv);
    },

    getLeagueDashTeamStats() {
      const url = buildUrl(runtimeEnv.statsBaseUrl, "leaguedashteamstats", buildLeagueDashTeamStatsParams(runtimeEnv.nbaSeason));
      return requestJson(fetchImpl, url, STATS_HEADERS, runtimeEnv);
    },

    getTeamGameLog(teamId: number, seasonType: string = REGULAR_SEASON_LABEL) {
      const url = buildUrl(runtimeEnv.statsBaseUrl, "teamgamelog", {
        LeagueID: "00",
        Season: runtimeEnv.nbaSeason,
        SeasonType: seasonType,
        TeamID: teamId
      });
      return requestJson(fetchImpl, url, STATS_HEADERS, runtimeEnv);
    },

    getLeagueStandings() {
      const url = buildUrl(runtimeEnv.statsBaseUrl, "leaguestandings", {
        LeagueID: "00",
        Season: runtimeEnv.nbaSeason,
        SeasonType: REGULAR_SEASON_LABEL
      });
      return requestJson(fetchImpl, url, STATS_HEADERS, runtimeEnv);
    },

    getPlayoffPicture() {
      const url = buildUrl(runtimeEnv.statsBaseUrl, "playoffpicture", {
        LeagueID: "00",
        SeasonID: `2${runtimeEnv.nbaSeason.slice(0, 4)}`
      });
      return requestJson(fetchImpl, url, STATS_HEADERS, runtimeEnv);
    },

    getEspnScoreboardByDate(gameDateIso: string) {
      const url = buildUrl("https://site.api.espn.com/apis/site/v2/sports/basketball/nba", "scoreboard", {
        dates: gameDateIso.replaceAll("-", "")
      });
      return requestJson(fetchImpl, url, DEFAULT_HEADERS, runtimeEnv, Math.max(runtimeEnv.requestTimeoutMs, 12_000));
    },

    getEspnRoster(teamId: number) {
      const team = Object.entries(ESPN_TEAM_IDS).find(([code]) => code === getTeamCode(teamId));
      if (!team) {
        return Promise.reject(new Error(`No ESPN team mapping for NBA team ${teamId}`));
      }

      const url = buildUrl(
        "https://site.api.espn.com/apis/site/v2/sports/basketball/nba",
        `teams/${team[1]}/roster`
      );
      return requestJson(fetchImpl, url, DEFAULT_HEADERS, runtimeEnv);
    }
  };
}

export const nbaApiClient = createNbaApiClient();

function getTeamCode(teamId: number) {
  const codes: Record<number, string> = {
    1610612737: "ATL", 1610612738: "BOS", 1610612751: "BKN", 1610612766: "CHA", 1610612741: "CHI",
    1610612739: "CLE", 1610612742: "DAL", 1610612743: "DEN", 1610612765: "DET", 1610612744: "GSW",
    1610612745: "HOU", 1610612754: "IND", 1610612746: "LAC", 1610612747: "LAL", 1610612763: "MEM",
    1610612748: "MIA", 1610612749: "MIL", 1610612750: "MIN", 1610612740: "NOP", 1610612752: "NYK",
    1610612760: "OKC", 1610612753: "ORL", 1610612755: "PHI", 1610612756: "PHX", 1610612757: "POR",
    1610612758: "SAC", 1610612759: "SAS", 1610612761: "TOR", 1610612762: "UTA", 1610612764: "WAS"
  };
  return codes[teamId] ?? "";
}
