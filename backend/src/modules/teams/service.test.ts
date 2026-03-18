import { describe, expect, it } from "vitest";
import { MemoryCache } from "../../cache/memoryCache.js";
import type { NbaApiClient } from "../../nba-client/client.js";
import { createTeamsService } from "./service.js";

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

describe("teams service", () => {
  it("prefers schedule snapshot data for recent team games", async () => {
    const client = createClient({
      getLeagueStandings: async () =>
        statsResponse(
          [
            "TeamID",
            "PlayoffRank",
            "ConferenceGamesBack",
            "WINS",
            "LOSSES",
            "WinPCT",
            "HOME",
            "ROAD",
            "L10",
            "strCurrentStreak"
          ],
          [[1610612738, 2, 4.0, 50, 22, 0.694, "28-8", "22-14", "7-3", "W2"]]
        ),
      getPlayoffPicture: async () => statsResponse(["TEAM_ID", "EliminatedPlayoffContention"], []),
      getLeagueDashTeamStats: async () =>
        statsResponse(
          ["TEAM_ID", "PTS", "OPP_PTS", "REB", "AST", "NET_RATING", "FG_PCT"],
          [[1610612738, 118.2, 111.4, 45.1, 26.4, 6.8, 0.482]]
        ),
      getTeamInfoCommon: async () =>
        statsResponse(["ARENA", "YEARFOUNDED", "HEADCOACH"], [["TD Garden", 1946, "Joe Mazzulla"]]),
      getCommonTeamRoster: async () =>
        statsResponse(
          ["PLAYER_ID", "PLAYER", "POSITION", "NUM", "HEIGHT", "WEIGHT", "BIRTH_DATE"],
          [[1628369, "Jayson Tatum", "F", "0", "6-8", "210", "1998-03-03"]]
        ),
      getScheduleSnapshot: async () => ({
        leagueSchedule: {
          gameDates: [
            {
              gameDate: "2025-10-22",
              games: [
                {
                  gameId: "0022500001",
                  gameCode: "20251022/BOSNYK",
                  gameStatus: 3,
                  gameStatusText: "Final",
                  gameDateTimeUTC: "2025-10-22T23:30:00Z",
                  arenaName: "Madison Square Garden",
                  homeTeam: {
                    teamId: 1610612752,
                    teamName: "Knicks",
                    teamCity: "New York",
                    teamTricode: "NYK",
                    wins: 1,
                    losses: 0,
                    score: 107
                  },
                  awayTeam: {
                    teamId: 1610612738,
                    teamName: "Celtics",
                    teamCity: "Boston",
                    teamTricode: "BOS",
                    wins: 0,
                    losses: 1,
                    score: 102
                  }
                }
              ]
            },
            {
              gameDate: "2025-10-24",
              games: [
                {
                  gameId: "0022500002",
                  gameCode: "20251024/BOSLAL",
                  gameStatus: 3,
                  gameStatusText: "Final",
                  gameDateTimeUTC: "2025-10-24T23:00:00Z",
                  arenaName: "TD Garden",
                  homeTeam: {
                    teamId: 1610612738,
                    teamName: "Celtics",
                    teamCity: "Boston",
                    teamTricode: "BOS",
                    wins: 1,
                    losses: 1,
                    score: 115
                  },
                  awayTeam: {
                    teamId: 1610612747,
                    teamName: "Lakers",
                    teamCity: "Los Angeles",
                    teamTricode: "LAL",
                    wins: 0,
                    losses: 2,
                    score: 108
                  }
                }
              ]
            }
          ]
        }
      }),
      getTeamGameLog: async () =>
        statsResponse(
          ["GAME_ID", "GAME_DATE", "MATCHUP", "WL", "PTS", "PLUS_MINUS"],
          [
            ["0022500001", "2025-10-22", "BOS @ NYK", "L", 102, -5],
            ["0022500002", "2025-10-24", "BOS vs. LAL", "W", 115, 7]
          ]
        )
    });

    const service = createTeamsService({ client, cache: new MemoryCache() });
    const response = await service.getTeamDetail(1610612738);

    expect(response.data.recentGames).toHaveLength(2);
    expect(response.data.recentGames[0].awayTeam.code).toBe("BOS");
    expect(response.data.recentGames[0].awayTeam.score).toBe(102);
    expect(response.data.recentGames[0].homeTeam.code).toBe("NYK");
    expect(response.data.recentGames[0].homeTeam.score).toBe(107);
    expect(response.data.recentGames[0].arena).toBe("Madison Square Garden");
    expect(response.data.recentGames[0].dateTimeUtc).toBe("2025-10-22T23:30:00.000Z");
    expect(response.data.recentGames[0].statusText).toBe("L");
    expect(response.data.recentGames[1].homeTeam.code).toBe("BOS");
    expect(response.data.recentGames[1].homeTeam.score).toBe(115);
    expect(response.data.recentGames[1].awayTeam.code).toBe("LAL");
    expect(response.data.recentGames[1].awayTeam.score).toBe(108);
    expect(response.data.recentGames[1].arena).toBe("TD Garden");
    expect(response.data.recentGames[1].dateTimeUtc).toBe("2025-10-24T23:00:00.000Z");
    expect(response.data.recentGames[1].statusText).toBe("W");
  });

  it("falls back to team game log scores when the schedule snapshot is missing the game", async () => {
    const client = createClient({
      getLeagueStandings: async () =>
        statsResponse(
          [
            "TeamID",
            "PlayoffRank",
            "ConferenceGamesBack",
            "WINS",
            "LOSSES",
            "WinPCT",
            "HOME",
            "ROAD",
            "L10",
            "strCurrentStreak"
          ],
          [[1610612738, 2, 4.0, 50, 22, 0.694, "28-8", "22-14", "7-3", "W2"]]
        ),
      getPlayoffPicture: async () => statsResponse(["TEAM_ID", "EliminatedPlayoffContention"], []),
      getLeagueDashTeamStats: async () =>
        statsResponse(
          ["TEAM_ID", "PTS", "OPP_PTS", "REB", "AST", "NET_RATING", "FG_PCT"],
          [[1610612738, 118.2, 111.4, 45.1, 26.4, 6.8, 0.482]]
        ),
      getTeamInfoCommon: async () =>
        statsResponse(["ARENA", "YEARFOUNDED", "HEADCOACH"], [["TD Garden", 1946, "Joe Mazzulla"]]),
      getCommonTeamRoster: async () =>
        statsResponse(
          ["PLAYER_ID", "PLAYER", "POSITION", "NUM", "HEIGHT", "WEIGHT", "BIRTH_DATE"],
          [[1628369, "Jayson Tatum", "F", "0", "6-8", "210", "1998-03-03"]]
        ),
      getScheduleSnapshot: async () => ({
        leagueSchedule: {
          gameDates: []
        }
      }),
      getTeamGameLog: async () =>
        statsResponse(
          ["GAME_ID", "GAME_DATE", "MATCHUP", "WL", "PTS", "PLUS_MINUS"],
          [["0022500003", "2025-10-26", "BOS vs. MIA", "W", 120, 9]]
        )
    });

    const service = createTeamsService({ client, cache: new MemoryCache() });
    const response = await service.getTeamDetail(1610612738);

    expect(response.data.recentGames).toHaveLength(1);
    expect(response.data.recentGames[0].homeTeam.code).toBe("BOS");
    expect(response.data.recentGames[0].homeTeam.score).toBe(120);
    expect(response.data.recentGames[0].awayTeam.code).toBe("MIA");
    expect(response.data.recentGames[0].awayTeam.score).toBe(111);
    expect(response.data.recentGames[0].arena).toBeNull();
    expect(response.data.recentGames[0].statusText).toBe("W");
  });
});
