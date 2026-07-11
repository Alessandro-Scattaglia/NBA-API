import { describe, expect, it } from "vitest";
import { MemoryCache } from "../../cache/memoryCache.js";
import { loadCalendarRange, loadPlayerCatalog, loadStandings } from "./datasets.js";
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

function leagueStandingsRow(teamId: number, rank: number, wins: number, losses: number) {
  return [
    teamId,
    rank,
    rank === 1 ? 0 : Number((rank - 1) * 1.5).toFixed(1),
    wins,
    losses,
    Number((wins / (wins + losses)).toFixed(3)),
    `${Math.ceil(wins / 2)}-${Math.floor(losses / 2)}`,
    `${Math.floor(wins / 2)}-${Math.ceil(losses / 2)}`,
    "8-2",
    rank % 2 === 0 ? "W2" : "L1"
  ];
}

function playoffPictureStandingsRow(
  conference: "East" | "West",
  teamId: number,
  rank: number,
  wins: number,
  losses: number,
  team: string
) {
  return [
    conference,
    rank,
    team,
    team.toLowerCase().replace(/\s+/g, "-"),
    teamId,
    wins,
    losses,
    Number((wins / (wins + losses)).toFixed(3)),
    "10-6",
    "35-17",
    "30-11",
    "28-13",
    rank === 1 ? 0 : Number((rank - 1) * 1.5).toFixed(1),
    0,
    0,
    0,
    0,
    0,
    0,
    0
  ];
}

function playoffPictureStandingsResponse(eastRows: unknown[][], westRows: unknown[][]) {
  return {
    resultSets: [
      {
        name: "EastConfStandings",
        headers: [
          "CONFERENCE",
          "RANK",
          "TEAM",
          "TEAM_SLUG",
          "TEAM_ID",
          "WINS",
          "LOSSES",
          "PCT",
          "DIV",
          "CONF",
          "HOME",
          "AWAY",
          "GB",
          "GR_OVER_500",
          "GR_OVER_500_HOME",
          "GR_OVER_500_AWAY",
          "GR_UNDER_500",
          "GR_UNDER_500_HOME",
          "GR_UNDER_500_AWAY",
          "RANKING_CRITERIA"
        ],
        rowSet: eastRows
      },
      {
        name: "WestConfStandings",
        headers: [
          "CONFERENCE",
          "RANK",
          "TEAM",
          "TEAM_SLUG",
          "TEAM_ID",
          "WINS",
          "LOSSES",
          "PCT",
          "DIV",
          "CONF",
          "HOME",
          "AWAY",
          "GB",
          "GR_OVER_500",
          "GR_OVER_500_HOME",
          "GR_OVER_500_AWAY",
          "GR_UNDER_500",
          "GR_UNDER_500_HOME",
          "GR_UNDER_500_AWAY",
          "RANKING_CRITERIA"
        ],
        rowSet: westRows
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
            leagueStandingsRow(1610612738, 1, 58, 24),
            leagueStandingsRow(1610612751, 8, 40, 42),
            leagueStandingsRow(1610612748, 2, 55, 27),
            leagueStandingsRow(1610612752, 3, 53, 29),
            leagueStandingsRow(1610612739, 4, 51, 31),
            leagueStandingsRow(1610612761, 5, 49, 33),
            leagueStandingsRow(1610612737, 6, 47, 35),
            leagueStandingsRow(1610612755, 7, 45, 37),
            leagueStandingsRow(1610612753, 9, 39, 43),
            leagueStandingsRow(1610612766, 10, 38, 44),
            leagueStandingsRow(1610612760, 1, 61, 21),
            leagueStandingsRow(1610612759, 2, 56, 26),
            leagueStandingsRow(1610612743, 3, 54, 28),
            leagueStandingsRow(1610612747, 4, 50, 32),
            leagueStandingsRow(1610612745, 5, 48, 34),
            leagueStandingsRow(1610612750, 6, 47, 35),
            leagueStandingsRow(1610612756, 11, 34, 48),
            leagueStandingsRow(1610612757, 8, 45, 37),
            leagueStandingsRow(1610612746, 9, 42, 40),
            leagueStandingsRow(1610612744, 10, 41, 41)
          ]
        ),
      getPlayoffPicture: async () =>
        statsResponse(["TEAM_ID", "EliminatedPlayoffContention"], [[1610612756, 1]])
    });

    const state = await loadStandings({ client, cache });
    const celtics = state.value.find((team) => team.teamId === 1610612738);
    const nets = state.value.find((team) => team.teamId === 1610612751);
    const suns = state.value.find((team) => team.teamId === 1610612756);

    expect(state.value).toHaveLength(20);
    expect(celtics?.playoffStatus).toBe("playoff");
    expect(nets?.playoffStatus).toBe("play-in");
    expect(suns?.playoffStatus).toBe("eliminated");
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

  it("uses playoff picture conference standings when league standings is unavailable", async () => {
    const cache = new MemoryCache();
    const client = createClient({
      getLeagueStandings: async () => {
        throw new Error("League standings timed out");
      },
      getPlayoffPicture: async () =>
        playoffPictureStandingsResponse(
          [
            playoffPictureStandingsRow("East", 1610612765, 1, 60, 22, "Detroit"),
            playoffPictureStandingsRow("East", 1610612738, 2, 58, 24, "Boston"),
            playoffPictureStandingsRow("East", 1610612752, 3, 56, 26, "New York"),
            playoffPictureStandingsRow("East", 1610612739, 4, 54, 28, "Cleveland"),
            playoffPictureStandingsRow("East", 1610612761, 5, 50, 32, "Toronto"),
            playoffPictureStandingsRow("East", 1610612737, 6, 47, 35, "Atlanta"),
            playoffPictureStandingsRow("East", 1610612755, 7, 45, 37, "Philadelphia"),
            playoffPictureStandingsRow("East", 1610612753, 8, 44, 38, "Orlando"),
            playoffPictureStandingsRow("East", 1610612766, 9, 40, 42, "Charlotte"),
            playoffPictureStandingsRow("East", 1610612748, 10, 39, 43, "Miami")
          ],
          [
            playoffPictureStandingsRow("West", 1610612760, 1, 64, 18, "Oklahoma City"),
            playoffPictureStandingsRow("West", 1610612759, 2, 57, 25, "San Antonio"),
            playoffPictureStandingsRow("West", 1610612743, 3, 54, 28, "Denver"),
            playoffPictureStandingsRow("West", 1610612747, 4, 50, 32, "Los Angeles"),
            playoffPictureStandingsRow("West", 1610612745, 5, 48, 34, "Houston"),
            playoffPictureStandingsRow("West", 1610612750, 6, 47, 35, "Minnesota"),
            playoffPictureStandingsRow("West", 1610612756, 7, 46, 36, "Phoenix"),
            playoffPictureStandingsRow("West", 1610612757, 8, 45, 37, "Portland"),
            playoffPictureStandingsRow("West", 1610612746, 9, 42, 40, "LA Clippers"),
            playoffPictureStandingsRow("West", 1610612744, 10, 41, 41, "Golden State")
          ]
        )
    });

    const state = await loadStandings({ client, cache });
    const pistons = state.value.find((team) => team.teamId === 1610612765);
    const thunder = state.value.find((team) => team.teamId === 1610612760);

    expect(state.stale).toBe(false);
    expect(state.value).toHaveLength(20);
    expect(pistons?.conferenceRank).toBe(1);
    expect(pistons?.wins).toBe(60);
    expect(pistons?.awayRecord).toBe("28-13");
    expect(pistons?.lastTen).toBe("--");
    expect(thunder?.conferenceRank).toBe(1);
    expect(thunder?.playoffStatus).toBe("playoff");
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

  it("falls back to league leaders when player index and player stats are unavailable", async () => {
    const cache = new MemoryCache();
    const client = createClient({
      getPlayerIndex: async () => {
        throw new Error("Player index unavailable");
      },
      getLeagueDashPlayerStats: async () => {
        throw new Error("League dash player stats unavailable");
      },
      getLeagueLeaders: async () =>
        statsResponse(
          [
            "PLAYER_ID",
            "PLAYER",
            "TEAM_ID",
            "TEAM",
            "GP",
            "MIN",
            "PTS",
            "REB",
            "AST",
            "STL",
            "BLK",
            "FG3M",
            "FG_PCT",
            "FG3_PCT",
            "FT_PCT"
          ],
          [[2544, "LeBron James", 1610612747, "LAL", 60, 33.2, 20.9, 6.1, 7.2, 1.2, 0.6, 1.3, 0.515, 0.317, 0.737]]
        )
    });

    const state = await loadPlayerCatalog({ client, cache });
    const lebron = state.value.find((player) => player.playerId === 2544);

    expect(lebron).toBeDefined();
    expect(lebron?.fullName).toBe("LeBron James");
    expect(lebron?.team?.code).toBe("LAL");
    expect(lebron?.averages?.points).toBe(20.9);
  });
});
