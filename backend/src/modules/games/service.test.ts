import { describe, expect, it } from "vitest";
import { MemoryCache } from "../../cache/memoryCache.js";
import type { NbaApiClient } from "../../nba-client/client.js";
import { createGamesService } from "./service.js";

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

function createScheduledGame(gameId: string) {
  return {
    gameId,
    gameCode: "20260320/NYKBOS",
    gameDateTimeUTC: "2026-03-20T23:00:00Z",
    gameStatus: 1,
    gameStatusText: "7:00 PM ET",
    seriesText: "Regular Season",
    arenaName: "TD Garden",
    homeTeam: {
      teamId: 1610612738,
      teamCity: "Boston",
      teamName: "Celtics",
      teamTricode: "BOS",
      wins: 50,
      losses: 20
    },
    awayTeam: {
      teamId: 1610612752,
      teamCity: "New York",
      teamName: "Knicks",
      teamTricode: "NYK",
      wins: 45,
      losses: 25
    },
    broadcasters: {
      nationalTvBroadcasters: [{ broadcasterAbbreviation: "ESPN" }]
    }
  };
}

describe("games service", () => {
  it("falls back to the schedule when the live boxscore is not available yet", async () => {
    const client = createClient({
      getLiveBoxscore: async () => {
        throw new Error("NBA API 403 for https://cdn.nba.com/static/json/liveData/boxscore/boxscore_0022500977.json");
      },
      getScheduleSnapshot: async () => ({
        leagueSchedule: {
          gameDates: [
            {
              gameDate: "2026-03-20",
              games: [createScheduledGame("0022500977")]
            }
          ]
        }
      })
    });

    const service = createGamesService({ client, cache: new MemoryCache() });
    const response = await service.getGameDetail("0022500977");

    expect(response.data.game.status).toBe("scheduled");
    expect(response.data.game.homeTeam.name).toBe("Boston Celtics");
    expect(response.data.dataAvailability.status).toBe("scheduled");
    expect(response.data.dataAvailability.message).toContain("deve ancora iniziare");
    expect(response.data.homePlayers).toEqual([]);
    expect(response.meta.source).toEqual(["cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json"]);
  });

  it("marks the detail as available when the boxscore includes player data", async () => {
    const client = createClient({
      getLiveBoxscore: async () => ({
        game: {
          gameId: "0022500100",
          gameCode: "20260321/BOSNYK",
          gameEt: "2026-03-21T23:00:00Z",
          gameStatus: 2,
          gameStatusText: "Q2 05:12",
          gameClock: "PT05M12.00S",
          period: 2,
          seriesText: "Regular Season",
          arena: {
            arenaName: "Madison Square Garden"
          },
          homeTeam: {
            teamId: 1610612752,
            teamCity: "New York",
            teamName: "Knicks",
            teamTricode: "NYK",
            score: 58,
            wins: 45,
            losses: 25,
            players: [
              {
                personId: 1,
                name: "Jalen Brunson",
                position: "G",
                starter: "1",
                statistics: {
                  minutes: "16:44",
                  points: 18,
                  reboundsTotal: 2,
                  assists: 5,
                  steals: 1,
                  blocks: 0,
                  plusMinusPoints: 7
                }
              }
            ]
          },
          awayTeam: {
            teamId: 1610612738,
            teamCity: "Boston",
            teamName: "Celtics",
            teamTricode: "BOS",
            score: 55,
            wins: 50,
            losses: 20,
            players: [
              {
                personId: 2,
                name: "Jayson Tatum",
                position: "F",
                starter: "1",
                statistics: {
                  minutes: "16:12",
                  points: 16,
                  reboundsTotal: 6,
                  assists: 3,
                  steals: 0,
                  blocks: 1,
                  plusMinusPoints: -2
                }
              }
            ]
          }
        }
      })
    });

    const service = createGamesService({ client, cache: new MemoryCache() });
    const response = await service.getGameDetail("0022500100");

    expect(response.data.dataAvailability.status).toBe("available");
    expect(response.data.dataAvailability.message).toBeNull();
    expect(response.data.awayPlayers).toHaveLength(1);
    expect(response.data.awayLeaders[0].fullName).toBe("Jayson Tatum");
    expect(response.meta.source).toEqual(["cdn.nba.com/static/json/liveData/boxscore"]);
  });

  it("returns a pending state when the boxscore exists but detailed stats are still empty", async () => {
    const client = createClient({
      getLiveBoxscore: async () => ({
        game: {
          gameId: "0022500101",
          gameCode: "20260322/BOSNYK",
          gameEt: "2026-03-22T23:00:00Z",
          gameStatus: 2,
          gameStatusText: "Q1 11:59",
          gameClock: "PT11M59.00S",
          period: 1,
          seriesText: "Regular Season",
          arena: {
            arenaName: "TD Garden"
          },
          homeTeam: {
            teamId: 1610612738,
            teamCity: "Boston",
            teamName: "Celtics",
            teamTricode: "BOS",
            score: 0,
            wins: 50,
            losses: 20,
            players: []
          },
          awayTeam: {
            teamId: 1610612752,
            teamCity: "New York",
            teamName: "Knicks",
            teamTricode: "NYK",
            score: 0,
            wins: 45,
            losses: 25,
            players: []
          }
        }
      })
    });

    const service = createGamesService({ client, cache: new MemoryCache() });
    const response = await service.getGameDetail("0022500101");

    expect(response.data.game.status).toBe("live");
    expect(response.data.dataAvailability.status).toBe("pending");
    expect(response.data.dataAvailability.message).toContain("non sono ancora disponibili");
    expect(response.data.homeLeaders).toEqual([]);
  });
});
