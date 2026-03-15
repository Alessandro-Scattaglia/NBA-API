import { env } from "../config/env.js";
import { NBA_SEASON, PLAYOFF_PICTURE_SEASON_ID, REGULAR_SEASON_LABEL } from "../config/season.js";

export interface NbaApiClient {
  getLiveScoreboard(): Promise<unknown>;
  getLiveBoxscore(gameId: string): Promise<unknown>;
  getScoreboardByDate(gameDateIso: string): Promise<unknown>;
  getScheduleSnapshot(): Promise<unknown>;
  getPlayerIndex(): Promise<unknown>;
  getLeagueDashPlayerStats(): Promise<unknown>;
  getCommonPlayerInfo(playerId: number): Promise<unknown>;
  getPlayerGameLogs(playerId: number): Promise<unknown>;
  getTeamInfoCommon(teamId: number): Promise<unknown>;
  getCommonTeamRoster(teamId: number): Promise<unknown>;
  getLeagueDashTeamStats(): Promise<unknown>;
  getTeamGameLog(teamId: number): Promise<unknown>;
  getLeagueStandings(): Promise<unknown>;
  getPlayoffPicture(): Promise<unknown>;
}

type FetchImpl = typeof fetch;

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
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
};

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= env.requestRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.requestTimeoutMs);

    try {
      const response = await fetchImpl(url, {
        headers,
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`NBA API ${response.status} for ${url}`);
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;

      if (attempt < env.requestRetries) {
        await delay(300 * (attempt + 1));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Unknown NBA API error for ${url}`);
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

    getCommonPlayerInfo(playerId: number) {
      const url = buildUrl(env.statsBaseUrl, "commonplayerinfo", {
        LeagueID: "00",
        PlayerID: playerId
      });
      return requestJson(fetchImpl, url, STATS_HEADERS);
    },

    getPlayerGameLogs(playerId: number) {
      const url = buildUrl(env.statsBaseUrl, "playergamelog", {
        LeagueID: "00",
        PlayerID: playerId,
        Season: NBA_SEASON,
        SeasonType: REGULAR_SEASON_LABEL
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

    getTeamGameLog(teamId: number) {
      const url = buildUrl(env.statsBaseUrl, "teamgamelog", {
        LeagueID: "00",
        Season: NBA_SEASON,
        SeasonType: REGULAR_SEASON_LABEL,
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
