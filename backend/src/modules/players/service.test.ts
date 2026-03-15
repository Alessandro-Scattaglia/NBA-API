import { describe, expect, it } from "vitest";
import { MemoryCache } from "../../cache/memoryCache.js";
import { createPlayersService } from "./service.js";
import type { NbaApiClient } from "../../nba-client/client.js";

function statsResponse(headers: string[], rows: unknown[][]) {
  return {
    resultSets: [
      {
        headers,
        rowSet: rows
      }
    ]
  };
}

function createClient(overrides: Partial<NbaApiClient>): NbaApiClient {
  const notImplemented = async () => {
    throw new Error("Not implemented in test");
  };

  return {
    getLiveScoreboard: notImplemented,
    getLiveBoxscore: notImplemented,
    getScoreboardByDate: notImplemented,
    getScheduleSnapshot: notImplemented,
    getPlayerIndex: notImplemented,
    getLeagueDashPlayerStats: notImplemented,
    getCommonPlayerInfo: notImplemented,
    getPlayerGameLogs: notImplemented,
    getTeamInfoCommon: notImplemented,
    getCommonTeamRoster: notImplemented,
    getLeagueDashTeamStats: notImplemented,
    getTeamGameLog: notImplemented,
    getLeagueStandings: notImplemented,
    getPlayoffPicture: notImplemented,
    ...overrides
  };
}

describe("players service", () => {
  it("filters the player list by search term", async () => {
    const client = createClient({
      getPlayerIndex: async () =>
        statsResponse(
          ["PLAYER_ID", "PLAYER_NAME", "PLAYER_FIRST_NAME", "PLAYER_LAST_NAME", "TEAM_ID", "TEAM_ABBREVIATION", "POSITION", "HEIGHT", "WEIGHT", "JERSEY"],
          [
            [1, "Jayson Tatum", "Jayson", "Tatum", 1610612738, "BOS", "F", "6-8", "210", "0"],
            [2, "Stephen Curry", "Stephen", "Curry", 1610612744, "GSW", "G", "6-2", "185", "30"]
          ]
        ),
      getLeagueDashPlayerStats: async () =>
        statsResponse(
          ["PLAYER_ID", "GP", "MIN", "PTS", "REB", "AST", "STL", "BLK", "FG_PCT", "FG3_PCT", "FT_PCT"],
          [
            [1, 70, 36.0, 27.4, 8.7, 4.9, 1.1, 0.7, 0.471, 0.383, 0.852],
            [2, 68, 33.1, 26.2, 4.4, 5.3, 0.9, 0.3, 0.452, 0.417, 0.914]
          ]
        )
    });

    const service = createPlayersService({ client, cache: new MemoryCache() });
    const response = await service.getPlayers({ search: "tatum" });

    expect(response.data.total).toBe(1);
    expect(response.data.items[0].fullName).toBe("Jayson Tatum");
  });

  it("builds a player detail payload with recent games", async () => {
    const client = createClient({
      getPlayerIndex: async () =>
        statsResponse(
          ["PLAYER_ID", "PLAYER_NAME", "PLAYER_FIRST_NAME", "PLAYER_LAST_NAME", "TEAM_ID", "TEAM_ABBREVIATION", "POSITION", "HEIGHT", "WEIGHT", "JERSEY"],
          [[1, "Jayson Tatum", "Jayson", "Tatum", 1610612738, "BOS", "F", "6-8", "210", "0"]]
        ),
      getLeagueDashPlayerStats: async () =>
        statsResponse(
          ["PLAYER_ID", "GP", "MIN", "PTS", "REB", "AST", "STL", "BLK", "FG_PCT", "FG3_PCT", "FT_PCT"],
          [[1, 70, 36.0, 27.4, 8.7, 4.9, 1.1, 0.7, 0.471, 0.383, 0.852]]
        ),
      getCommonPlayerInfo: async () =>
        statsResponse(
          ["BIRTHDATE", "COUNTRY", "SCHOOL", "SEASON_EXP", "DRAFT_YEAR", "DRAFT_ROUND", "DRAFT_NUMBER"],
          [["1998-03-03", "USA", "Duke", "7", "2017", "1", "3"]]
        ),
      getPlayerGameLogs: async () =>
        statsResponse(
          ["GAME_ID", "GAME_DATE", "MATCHUP", "WL", "MIN", "PTS", "REB", "AST", "STL", "BLK"],
          [["0022500001", "2025-10-22", "BOS vs. NYK", "W", 35, 31, 9, 5, 1, 1]]
        )
    });

    const service = createPlayersService({ client, cache: new MemoryCache() });
    const response = await service.getPlayerDetail(1);

    expect(response.data.fullName).toBe("Jayson Tatum");
    expect(response.data.recentGames).toHaveLength(1);
    expect(response.data.draft).toContain("Pick 3");
  });
});
