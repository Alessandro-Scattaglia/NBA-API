import { describe, expect, it } from "vitest";
import { MemoryCache } from "../../cache/memoryCache.js";
import { loadCalendarRange, loadStandings } from "./datasets.js";
import type { NbaApiClient } from "../../nba-client/client.js";

function statsResponse(headers: string[], rows: unknown[][]) {
  return {
    resultSets: [
      {
        name: "ResultSet",
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

describe("shared datasets", () => {
  it("maps standings and derives playoff status", async () => {
    const cache = new MemoryCache();
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
          [
            [1610612738, 1, 0, 58, 24, 0.707, "32-9", "26-15", "8-2", "W3"],
            [1610612751, 8, 12.5, 40, 42, 0.488, "22-19", "18-23", "4-6", "L1"],
            [1610612756, 11, 18.0, 34, 48, 0.415, "18-23", "16-25", "3-7", "L2"]
          ]
        ),
      getPlayoffPicture: async () =>
        statsResponse(["TEAM_ID", "EliminatedPlayoffContention"], [[1610612756, 1]])
    });

    const state = await loadStandings({ client, cache });

    expect(state.value).toHaveLength(3);
    expect(state.value[0].playoffStatus).toBe("playoff");
    expect(state.value[1].playoffStatus).toBe("play-in");
    expect(state.value[2].playoffStatus).toBe("eliminated");
  });

  it("falls back to schedule snapshot standings when stats endpoints fail", async () => {
    const cache = new MemoryCache();
    const client = createClient({
      getLeagueStandings: async () => {
        throw new Error("Stats unavailable");
      },
      getPlayoffPicture: async () => {
        throw new Error("Playoff picture unavailable");
      },
      getScheduleSnapshot: async () => ({
        leagueSchedule: {
          gameDates: [
            {
              gameDate: "2026-03-01",
              games: [
                {
                  gameId: "0022600901",
                  gameCode: "20260301/BOSNYK",
                  gameStatus: 3,
                  gameStatusText: "Final",
                  gameDateTimeUTC: "2026-03-01T20:00:00Z",
                  arenaName: "Madison Square Garden",
                  homeTeam: {
                    teamId: 1610612752,
                    teamName: "Knicks",
                    teamCity: "New York",
                    teamTricode: "NYK",
                    wins: 45,
                    losses: 27,
                    score: 103
                  },
                  awayTeam: {
                    teamId: 1610612738,
                    teamName: "Celtics",
                    teamCity: "Boston",
                    teamTricode: "BOS",
                    wins: 52,
                    losses: 20,
                    score: 111
                  }
                }
              ]
            }
          ]
        }
      })
    });

    const state = await loadStandings({ client, cache });
    const celtics = state.value.find((team) => team.teamId === 1610612738);

    expect(state.stale).toBe(false);
    expect(state.value).toHaveLength(30);
    expect(celtics?.wins).toBe(52);
    expect(celtics?.losses).toBe(20);
    expect(celtics?.conferenceRank).toBe(1);
    expect(celtics?.seed).toBe(1);
    expect(celtics?.playoffStatus).toBe("playoff");
    expect(celtics?.homeRecord).toBe("--");
  });

  it("returns directory fallback standings when both stats and schedule fail", async () => {
    const cache = new MemoryCache();
    const client = createClient({
      getLeagueStandings: async () => {
        throw new Error("Stats unavailable");
      },
      getPlayoffPicture: async () => {
        throw new Error("Playoff picture unavailable");
      },
      getScheduleSnapshot: async () => {
        throw new Error("Schedule unavailable");
      }
    });

    const state = await loadStandings({ client, cache });
    const lakers = state.value.find((team) => team.teamId === 1610612747);

    expect(state.value).toHaveLength(30);
    expect(lakers?.wins).toBe(0);
    expect(lakers?.losses).toBe(0);
    expect(lakers?.conferenceRank).toBeGreaterThanOrEqual(1);
    expect(lakers?.conferenceRank).toBeLessThanOrEqual(15);
  });

  it("falls back to scoreboard by date when schedule snapshot is empty", async () => {
    const cache = new MemoryCache();
    let scoreboardCalls = 0;
    const client = createClient({
      getScheduleSnapshot: async () => ({
        leagueSchedule: {
          gameDates: []
        }
      }),
      getScoreboardByDate: async () => {
        scoreboardCalls += 1;
        return statsResponse(
          [
            "GAME_ID",
            "GAME_STATUS_ID",
            "GAME_STATUS_TEXT",
            "GAME_DATE_EST",
            "HOME_TEAM_ID",
            "VISITOR_TEAM_ID",
            "HOME_TEAM_SCORE",
            "VISITOR_TEAM_SCORE",
            "HOME_TEAM_ABBREVIATION",
            "VISITOR_TEAM_ABBREVIATION"
          ],
          [[
            "0022500001",
            3,
            "Final",
            "2025-10-22T00:00:00Z",
            1610612738,
            1610612747,
            110,
            101,
            "BOS",
            "LAL"
          ]]
        );
      }
    });

    const state = await loadCalendarRange(
      { client, cache },
      "2025-10-22",
      "2025-10-22"
    );

    expect(scoreboardCalls).toBe(1);
    expect(state.value).toHaveLength(1);
    expect(state.value[0].gameId).toBe("0022500001");
    expect(state.value[0].homeTeam.code).toBe("BOS");
  });

  it("maps schedule snapshot games with the correct status and scores", async () => {
    const cache = new MemoryCache();
    const client = createClient({
      getScheduleSnapshot: async () => ({
        leagueSchedule: {
          gameDates: [
            {
              gameDate: "2026-03-15",
              games: [
                {
                  gameId: "0022500999",
                  gameCode: "20260315/BOSNYK",
                  gameStatus: 3,
                  gameStatusText: "Final",
                  gameDateTimeUTC: "2026-03-15T23:30:00Z",
                  arenaName: "Madison Square Garden",
                  homeTeam: {
                    teamId: 1610612752,
                    teamName: "Knicks",
                    teamCity: "New York",
                    teamTricode: "NYK",
                    wins: 43,
                    losses: 25,
                    score: 104
                  },
                  awayTeam: {
                    teamId: 1610612738,
                    teamName: "Celtics",
                    teamCity: "Boston",
                    teamTricode: "BOS",
                    wins: 44,
                    losses: 23,
                    score: 110
                  },
                  broadcasters: {
                    nationalTvBroadcasters: [
                      {
                        broadcasterAbbreviation: "ABC"
                      }
                    ]
                  }
                }
              ]
            }
          ]
        }
      })
    });

    const state = await loadCalendarRange({ client, cache }, "2026-03-15", "2026-03-15");

    expect(state.value).toHaveLength(1);
    expect(state.value[0].status).toBe("final");
    expect(state.value[0].statusText).toBe("Final");
    expect(state.value[0].homeTeam.score).toBe(104);
    expect(state.value[0].awayTeam.score).toBe(110);
    expect(state.value[0].nationalTv).toEqual(["ABC"]);
  });
});
