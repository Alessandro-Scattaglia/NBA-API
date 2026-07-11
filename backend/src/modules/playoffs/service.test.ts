import { describe, expect, it } from "vitest";
import { MemoryCache } from "../../cache/memoryCache.js";
import type { NbaApiClient } from "../../nba-client/client.js";
import { createPlayoffsService } from "./service.js";

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

function makeStandingsRow(teamId: number, seed: number, wins: number, losses: number) {
  const gamesBack = seed === 1 ? 0 : Number((seed - 1) * 1.5).toFixed(1);
  const winPct = wins / (wins + losses);

  return [
    teamId,
    seed,
    gamesBack,
    wins,
    losses,
    winPct,
    `${Math.ceil(wins / 2)}-${Math.floor(losses / 2)}`,
    `${Math.floor(wins / 2)}-${Math.ceil(losses / 2)}`,
    "6-4",
    seed % 2 === 0 ? "W2" : "L1"
  ];
}

describe("playoffs service", () => {
  it("builds play-in and first-round snapshots from standings and postseason games", async () => {
    const cache = new MemoryCache();
    const client = createClient({
      getLiveScoreboard: async () => ({
        scoreboard: {
          games: []
        }
      }),
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
            makeStandingsRow(1610612765, 1, 58, 24),
            makeStandingsRow(1610612738, 2, 55, 27),
            makeStandingsRow(1610612752, 3, 53, 29),
            makeStandingsRow(1610612739, 4, 51, 31),
            makeStandingsRow(1610612761, 5, 49, 33),
            makeStandingsRow(1610612737, 6, 47, 35),
            makeStandingsRow(1610612755, 7, 45, 37),
            makeStandingsRow(1610612753, 8, 44, 38),
            makeStandingsRow(1610612766, 9, 40, 42),
            makeStandingsRow(1610612748, 10, 39, 43),
            makeStandingsRow(1610612760, 1, 61, 21),
            makeStandingsRow(1610612759, 2, 56, 26),
            makeStandingsRow(1610612743, 3, 54, 28),
            makeStandingsRow(1610612747, 4, 50, 32),
            makeStandingsRow(1610612745, 5, 48, 34),
            makeStandingsRow(1610612750, 6, 47, 35),
            makeStandingsRow(1610612756, 7, 46, 36),
            makeStandingsRow(1610612757, 8, 45, 37),
            makeStandingsRow(1610612746, 9, 42, 40),
            makeStandingsRow(1610612744, 10, 41, 41)
          ]
        ),
      getPlayoffPicture: async () => statsResponse(["TEAM_ID"], []),
      getScheduleSnapshot: async () => ({
        leagueSchedule: {
          gameDates: [
            {
              gameDate: "2026-04-14",
              games: [
                {
                  gameId: "0042600101",
                  gameCode: "20260414/CHARMIA",
                  gameStatus: 1,
                  gameStatusText: "7:30 pm ET",
                  gameDateTimeUTC: "2026-04-14T23:30:00Z",
                  seriesText: "Play-In Tournament",
                  arenaName: "Kaseya Center",
                  homeTeam: {
                    teamId: 1610612748,
                    teamName: "Heat",
                    teamCity: "Miami",
                    teamTricode: "MIA",
                    wins: 39,
                    losses: 43
                  },
                  awayTeam: {
                    teamId: 1610612766,
                    teamName: "Hornets",
                    teamCity: "Charlotte",
                    teamTricode: "CHA",
                    wins: 40,
                    losses: 42
                  },
                  broadcasters: {
                    nationalTvBroadcasters: [
                      {
                        broadcasterAbbreviation: "PRIME"
                      }
                    ]
                  }
                }
              ]
            },
            {
              gameDate: "2026-04-15",
              games: [
                {
                  gameId: "0042600102",
                  gameCode: "20260415/PHIORL",
                  gameStatus: 1,
                  gameStatusText: "7:30 pm ET",
                  gameDateTimeUTC: "2026-04-15T23:30:00Z",
                  seriesText: "Play-In Tournament",
                  arenaName: "Kia Center",
                  homeTeam: {
                    teamId: 1610612753,
                    teamName: "Magic",
                    teamCity: "Orlando",
                    teamTricode: "ORL",
                    wins: 44,
                    losses: 38
                  },
                  awayTeam: {
                    teamId: 1610612755,
                    teamName: "76ers",
                    teamCity: "Philadelphia",
                    teamTricode: "PHI",
                    wins: 45,
                    losses: 37
                  },
                  broadcasters: {
                    nationalTvBroadcasters: [
                      {
                        broadcasterAbbreviation: "PRIME"
                      }
                    ]
                  }
                }
              ]
            },
            {
              gameDate: "2026-04-18",
              games: [
                {
                  gameId: "0042600110",
                  gameCode: "20260418/ATLNYK",
                  gameStatus: 1,
                  gameStatusText: "6:00 pm ET",
                  gameDateTimeUTC: "2026-04-18T22:00:00Z",
                  seriesText: "Playoffs",
                  arenaName: "Madison Square Garden",
                  homeTeam: {
                    teamId: 1610612752,
                    teamName: "Knicks",
                    teamCity: "New York",
                    teamTricode: "NYK",
                    wins: 53,
                    losses: 29
                  },
                  awayTeam: {
                    teamId: 1610612737,
                    teamName: "Hawks",
                    teamCity: "Atlanta",
                    teamTricode: "ATL",
                    wins: 47,
                    losses: 35
                  },
                  broadcasters: {
                    nationalTvBroadcasters: [
                      {
                        broadcasterAbbreviation: "PRIME"
                      }
                    ]
                  }
                },
                {
                  gameId: "0042600111",
                  gameCode: "20260418/HOULAL",
                  gameStatus: 1,
                  gameStatusText: "8:30 pm ET",
                  gameDateTimeUTC: "2026-04-19T00:30:00Z",
                  seriesText: "Playoffs",
                  arenaName: "Crypto.com Arena",
                  homeTeam: {
                    teamId: 1610612747,
                    teamName: "Lakers",
                    teamCity: "Los Angeles",
                    teamTricode: "LAL",
                    wins: 50,
                    losses: 32
                  },
                  awayTeam: {
                    teamId: 1610612745,
                    teamName: "Rockets",
                    teamCity: "Houston",
                    teamTricode: "HOU",
                    wins: 48,
                    losses: 34
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

    const service = createPlayoffsService({ client, cache });
    const response = await service.getPlayoffs();

    expect(response.data.overview.directQualifiedTeams).toBe(12);
    expect(response.data.overview.playInTeams).toBe(8);
    expect(response.data.overview.playInGamesScheduled).toBe(2);
    expect(response.data.east.playInSeries[0].games).toHaveLength(1);
    expect(response.data.east.firstRoundSeries[0].status).toBe("awaiting-play-in");
    expect(response.data.east.firstRoundSeries[2].lowSeedTeam?.code).toBe("ATL");
    expect(response.data.east.firstRoundSeries[2].games).toHaveLength(1);
    expect(response.data.west.firstRoundSeries[3].highSeedTeam?.code).toBe("LAL");
    expect(response.data.west.firstRoundSeries[3].games[0]?.nationalTv).toEqual(["ABC"]);
  });

  it("does not advance teams to conference finals until the semifinal winner reaches 4 wins", async () => {
    const cache = new MemoryCache();
    const client = createClient({
      getLiveScoreboard: async () => ({
        scoreboard: {
          games: []
        }
      }),
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
            makeStandingsRow(1610612765, 1, 58, 24),
            makeStandingsRow(1610612738, 2, 55, 27),
            makeStandingsRow(1610612752, 3, 53, 29),
            makeStandingsRow(1610612739, 4, 51, 31),
            makeStandingsRow(1610612761, 5, 49, 33),
            makeStandingsRow(1610612737, 6, 47, 35),
            makeStandingsRow(1610612755, 7, 45, 37),
            makeStandingsRow(1610612753, 8, 44, 38),
            makeStandingsRow(1610612766, 9, 40, 42),
            makeStandingsRow(1610612748, 10, 39, 43),
            makeStandingsRow(1610612760, 1, 61, 21),
            makeStandingsRow(1610612759, 2, 56, 26),
            makeStandingsRow(1610612743, 3, 54, 28),
            makeStandingsRow(1610612747, 4, 50, 32),
            makeStandingsRow(1610612745, 5, 48, 34),
            makeStandingsRow(1610612750, 6, 47, 35),
            makeStandingsRow(1610612756, 7, 46, 36),
            makeStandingsRow(1610612757, 8, 45, 37),
            makeStandingsRow(1610612746, 9, 42, 40),
            makeStandingsRow(1610612744, 10, 41, 41)
          ]
        ),
      getPlayoffPicture: async () => statsResponse(["TEAM_ID"], []),
      getScheduleSnapshot: async () => ({
        leagueSchedule: {
          gameDates: [
            {
              gameDate: "2026-04-18",
              games: [
                {
                  gameId: "0042600101",
                  gameCode: "20260418/ORLDET",
                  gameStatus: 3,
                  gameStatusText: "Final",
                  gameDateTimeUTC: "2026-04-18T23:00:00Z",
                  seriesText: "Playoffs",
                  arenaName: "Little Caesars Arena",
                  homeTeam: { teamId: 1610612765, teamName: "Pistons", teamCity: "Detroit", teamTricode: "DET", score: 105 },
                  awayTeam: { teamId: 1610612753, teamName: "Magic", teamCity: "Orlando", teamTricode: "ORL", score: 99 }
                },
                {
                  gameId: "0042600102",
                  gameCode: "20260420/ORLDET",
                  gameStatus: 3,
                  gameStatusText: "Final",
                  gameDateTimeUTC: "2026-04-20T23:00:00Z",
                  seriesText: "Playoffs",
                  arenaName: "Little Caesars Arena",
                  homeTeam: { teamId: 1610612765, teamName: "Pistons", teamCity: "Detroit", teamTricode: "DET", score: 96 },
                  awayTeam: { teamId: 1610612753, teamName: "Magic", teamCity: "Orlando", teamTricode: "ORL", score: 101 }
                },
                {
                  gameId: "0042600103",
                  gameCode: "20260422/DETORL",
                  gameStatus: 3,
                  gameStatusText: "Final",
                  gameDateTimeUTC: "2026-04-22T23:00:00Z",
                  seriesText: "Playoffs",
                  arenaName: "Kia Center",
                  homeTeam: { teamId: 1610612753, teamName: "Magic", teamCity: "Orlando", teamTricode: "ORL", score: 98 },
                  awayTeam: { teamId: 1610612765, teamName: "Pistons", teamCity: "Detroit", teamTricode: "DET", score: 112 }
                },
                {
                  gameId: "0042600104",
                  gameCode: "20260424/DETORL",
                  gameStatus: 3,
                  gameStatusText: "Final",
                  gameDateTimeUTC: "2026-04-24T23:00:00Z",
                  seriesText: "Playoffs",
                  arenaName: "Kia Center",
                  homeTeam: { teamId: 1610612753, teamName: "Magic", teamCity: "Orlando", teamTricode: "ORL", score: 103 },
                  awayTeam: { teamId: 1610612765, teamName: "Pistons", teamCity: "Detroit", teamTricode: "DET", score: 94 }
                },
                {
                  gameId: "0042600201",
                  gameCode: "20260418/PHIBOS",
                  gameStatus: 3,
                  gameStatusText: "Final",
                  gameDateTimeUTC: "2026-04-18T23:30:00Z",
                  seriesText: "Playoffs",
                  arenaName: "TD Garden",
                  homeTeam: { teamId: 1610612738, teamName: "Celtics", teamCity: "Boston", teamTricode: "BOS", score: 100 },
                  awayTeam: { teamId: 1610612755, teamName: "76ers", teamCity: "Philadelphia", teamTricode: "PHI", score: 111 }
                },
                {
                  gameId: "0042600202",
                  gameCode: "20260420/PHIBOS",
                  gameStatus: 3,
                  gameStatusText: "Final",
                  gameDateTimeUTC: "2026-04-20T23:30:00Z",
                  seriesText: "Playoffs",
                  arenaName: "TD Garden",
                  homeTeam: { teamId: 1610612738, teamName: "Celtics", teamCity: "Boston", teamTricode: "BOS", score: 98 },
                  awayTeam: { teamId: 1610612755, teamName: "76ers", teamCity: "Philadelphia", teamTricode: "PHI", score: 104 }
                },
                {
                  gameId: "0042600203",
                  gameCode: "20260422/BOSPHI",
                  gameStatus: 3,
                  gameStatusText: "Final",
                  gameDateTimeUTC: "2026-04-22T23:30:00Z",
                  seriesText: "Playoffs",
                  arenaName: "Wells Fargo Center",
                  homeTeam: { teamId: 1610612755, teamName: "76ers", teamCity: "Philadelphia", teamTricode: "PHI", score: 97 },
                  awayTeam: { teamId: 1610612738, teamName: "Celtics", teamCity: "Boston", teamTricode: "BOS", score: 109 }
                },
                {
                  gameId: "0042600204",
                  gameCode: "20260424/BOSPHI",
                  gameStatus: 3,
                  gameStatusText: "Final",
                  gameDateTimeUTC: "2026-04-24T23:30:00Z",
                  seriesText: "Playoffs",
                  arenaName: "Wells Fargo Center",
                  homeTeam: { teamId: 1610612755, teamName: "76ers", teamCity: "Philadelphia", teamTricode: "PHI", score: 93 },
                  awayTeam: { teamId: 1610612738, teamName: "Celtics", teamCity: "Boston", teamTricode: "BOS", score: 108 }
                },
                {
                  gameId: "0042600301",
                  gameCode: "20260501/CLEDET",
                  gameStatus: 3,
                  gameStatusText: "Final",
                  gameDateTimeUTC: "2026-05-01T23:00:00Z",
                  seriesText: "Playoffs",
                  arenaName: "Little Caesars Arena",
                  homeTeam: { teamId: 1610612765, teamName: "Pistons", teamCity: "Detroit", teamTricode: "DET", score: 110 },
                  awayTeam: { teamId: 1610612739, teamName: "Cavaliers", teamCity: "Cleveland", teamTricode: "CLE", score: 102 }
                },
                {
                  gameId: "0042600302",
                  gameCode: "20260503/CLEDET",
                  gameStatus: 3,
                  gameStatusText: "Final",
                  gameDateTimeUTC: "2026-05-03T23:00:00Z",
                  seriesText: "Playoffs",
                  arenaName: "Little Caesars Arena",
                  homeTeam: { teamId: 1610612765, teamName: "Pistons", teamCity: "Detroit", teamTricode: "DET", score: 95 },
                  awayTeam: { teamId: 1610612739, teamName: "Cavaliers", teamCity: "Cleveland", teamTricode: "CLE", score: 101 }
                },
                {
                  gameId: "0042600303",
                  gameCode: "20260505/DETCLE",
                  gameStatus: 3,
                  gameStatusText: "Final",
                  gameDateTimeUTC: "2026-05-05T23:00:00Z",
                  seriesText: "Playoffs",
                  arenaName: "Rocket Arena",
                  homeTeam: { teamId: 1610612739, teamName: "Cavaliers", teamCity: "Cleveland", teamTricode: "CLE", score: 99 },
                  awayTeam: { teamId: 1610612765, teamName: "Pistons", teamCity: "Detroit", teamTricode: "DET", score: 107 }
                },
                {
                  gameId: "0042600304",
                  gameCode: "20260507/DETCLE",
                  gameStatus: 3,
                  gameStatusText: "Final",
                  gameDateTimeUTC: "2026-05-07T23:00:00Z",
                  seriesText: "Playoffs",
                  arenaName: "Rocket Arena",
                  homeTeam: { teamId: 1610612739, teamName: "Cavaliers", teamCity: "Cleveland", teamTricode: "CLE", score: 112 },
                  awayTeam: { teamId: 1610612765, teamName: "Pistons", teamCity: "Detroit", teamTricode: "DET", score: 109 }
                },
                {
                  gameId: "0042600311",
                  gameCode: "20260501/PHINYK",
                  gameStatus: 3,
                  gameStatusText: "Final",
                  gameDateTimeUTC: "2026-05-01T23:30:00Z",
                  seriesText: "Playoffs",
                  arenaName: "Madison Square Garden",
                  homeTeam: { teamId: 1610612752, teamName: "Knicks", teamCity: "New York", teamTricode: "NYK", score: 115 },
                  awayTeam: { teamId: 1610612755, teamName: "76ers", teamCity: "Philadelphia", teamTricode: "PHI", score: 100 }
                },
                {
                  gameId: "0042600312",
                  gameCode: "20260503/PHINYK",
                  gameStatus: 3,
                  gameStatusText: "Final",
                  gameDateTimeUTC: "2026-05-03T23:30:00Z",
                  seriesText: "Playoffs",
                  arenaName: "Madison Square Garden",
                  homeTeam: { teamId: 1610612752, teamName: "Knicks", teamCity: "New York", teamTricode: "NYK", score: 109 },
                  awayTeam: { teamId: 1610612755, teamName: "76ers", teamCity: "Philadelphia", teamTricode: "PHI", score: 98 }
                },
                {
                  gameId: "0042600313",
                  gameCode: "20260505/NYKPHI",
                  gameStatus: 3,
                  gameStatusText: "Final",
                  gameDateTimeUTC: "2026-05-05T23:30:00Z",
                  seriesText: "Playoffs",
                  arenaName: "Wells Fargo Center",
                  homeTeam: { teamId: 1610612755, teamName: "76ers", teamCity: "Philadelphia", teamTricode: "PHI", score: 96 },
                  awayTeam: { teamId: 1610612752, teamName: "Knicks", teamCity: "New York", teamTricode: "NYK", score: 111 }
                },
                {
                  gameId: "0042600314",
                  gameCode: "20260507/NYKPHI",
                  gameStatus: 3,
                  gameStatusText: "Final",
                  gameDateTimeUTC: "2026-05-07T23:30:00Z",
                  seriesText: "Playoffs",
                  arenaName: "Wells Fargo Center",
                  homeTeam: { teamId: 1610612755, teamName: "76ers", teamCity: "Philadelphia", teamTricode: "PHI", score: 91 },
                  awayTeam: { teamId: 1610612752, teamName: "Knicks", teamCity: "New York", teamTricode: "NYK", score: 105 }
                }
              ]
            }
          ]
        }
      })
    });

    const service = createPlayoffsService({ client, cache });
    const response = await service.getPlayoffs();

    expect(response.data.east.semifinalsSeries[0].games).toHaveLength(4);
    expect(response.data.east.semifinalsSeries[1].games).toHaveLength(4);
    expect(response.data.east.conferenceFinalsSeries[0].games).toHaveLength(0);
    expect(response.data.east.conferenceFinalsSeries[0].highSeedTeam).toBeNull();
    expect(response.data.east.conferenceFinalsSeries[0].lowSeedTeam).toBeNull();
  });
});
