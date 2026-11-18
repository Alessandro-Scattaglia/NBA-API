import { describe, expect, it } from "vitest";
import { mapEspnSummaryToBoxscore } from "./service.js";
import { createGamesService } from "./service.js";
import { MemoryCache } from "../../cache/memoryCache.js";

describe("ESPN boxscore normalization", () => {
  it("keeps missing and invalid ESPN scores null", () => {
    const game = mapEspnSummaryToBoxscore({
      header: { competitions: [{ date: "2026-11-01T00:00:00Z", status: { type: { description: "Scheduled" } }, competitors: [
        { homeAway: "home", score: "", team: { abbreviation: "BOS" } },
        { homeAway: "away", score: "not-a-score", team: { abbreviation: "LAL" } }
      ] }] }
    }, "401-missing-score");

    expect((game.homeTeam as Record<string, unknown>).score).toBeNull();
    expect((game.awayTeam as Record<string, unknown>).score).toBeNull();
  });

  it("falls back to ESPN when the NBA boxscore is HTTP 200 but incomplete", async () => {
    const client = {
      getLiveBoxscore: async () => ({ game: {} }),
      getScheduleSnapshot: async () => ({ leagueSchedule: { gameDates: [{ games: [{
        gameId: "0022600240",
        gameDateTimeUTC: "2026-11-01T00:00:00Z",
        gameStatus: 3,
        gameStatusText: "Final",
        homeTeam: { teamId: 1610612757, teamTricode: "POR", score: 101 },
        awayTeam: { teamId: 1610612759, teamTricode: "SAS", score: 99 }
      }] }] } }),
      getEspnScoreboardByDate: async () => ({ events: [{ id: "401-fallback", competitions: [{ competitors: [
        { homeAway: "home", team: { abbreviation: "POR" } },
        { homeAway: "away", team: { abbreviation: "SA" } }
      ] }] }] }),
      getEspnGameSummary: async () => ({
        header: { competitions: [{ date: "2026-11-01T00:00:00Z", status: { type: { description: "Final" } }, competitors: [
          { homeAway: "home", score: "101", team: { id: "1", abbreviation: "POR", location: "Portland", name: "Trail Blazers" } },
          { homeAway: "away", score: "99", team: { id: "2", abbreviation: "SA", location: "San Antonio", name: "Spurs" } }
        ] }] },
        boxscore: { players: [] }
      })
    } as never;
    const service = createGamesService({ client, cache: new MemoryCache() });

    const result = await service.getGameDetail("0022600240");

    expect(result.data.game.homeTeam.score).toBe(101);
    expect(result.meta.source).toContain("ESPN summary");
  });

  it("maps labelled statistics and never uses ESPN ids as NBA ids", () => {
    const game = mapEspnSummaryToBoxscore({
      header: {
        competitions: [{
          date: "2026-10-01T00:00:00Z",
          status: { type: { description: "Final" } },
          competitors: [
            { homeAway: "home", score: "101", team: { id: "999", abbreviation: "BOS", location: "Boston", name: "Celtics" } },
            { homeAway: "away", score: "99", team: { id: "998", abbreviation: "LAL", location: "Los Angeles", name: "Lakers" } }
          ]
        }]
      },
      boxscore: {
        players: [{
          team: { id: "999" },
          statistics: [{
            names: ["MIN", "PTS", "REB", "AST", "STL", "BLK", "TO", "+/-"],
            athletes: [{
              athlete: { id: "123456", displayName: "Test Player", position: { abbreviation: "G" } },
              starter: true,
              statistics: ["30", "25", "10", "7", "2", "1", "3", "12"]
            }]
          }]
        }]
      }
    }, "game:2026-10-01:LAL:BOS");

    const homeTeam = game.homeTeam as unknown as {
      teamId: number;
      players: Array<Record<string, unknown>>;
    };
    const player = homeTeam.players[0];
    const statistics = player.statistics as Record<string, unknown>;

    expect(homeTeam.teamId).toBe(1610612738);
    expect(homeTeam.teamId).not.toBe(999);
    expect(player.personId).toBeLessThan(0);
    expect(statistics.points).toBe(25);
    expect(statistics.reboundsTotal).toBe(10);
    expect(statistics.assists).toBe(7);
    expect(statistics.steals).toBe(2);
    expect(statistics.blocks).toBe(1);
    expect(statistics.turnovers).toBe(3);
    expect(statistics.plusMinusPoints).toBe(12);
    expect((game as { gameStatusText: string }).gameStatusText).toBe("Final");
  });

  it("maps ESPN stats arrays from the live summary shape", () => {
    const game = mapEspnSummaryToBoxscore({
      header: {
        competitions: [{
          date: "2026-11-03T01:30:00Z",
          status: { type: { description: "Final" } },
          competitors: [
            { homeAway: "home", score: "125", team: { id: "26", abbreviation: "UTAH", location: "Utah", name: "Jazz" } },
            { homeAway: "away", score: "110", team: { id: " SAS", abbreviation: "SA", location: "San Antonio", name: "Spurs" } }
          ]
        }]
      },
      boxscore: {
        players: [{
          team: { id: "26" },
          statistics: [{
            names: ["MIN", "PTS", "FG", "3PT", "FT", "REB", "AST", "TO", "STL", "BLK", "+/-"],
            athletes: [{
              athlete: { id: "1", displayName: "Test Jazz", position: { abbreviation: "F" } },
              starter: true,
              stats: ["31", "22", "8-16", "4-7", "2-2", "8", "3", "0", "1", "0", "-23"]
            }]
          }]
        }]
      }
    }, "401909917");

    const players = (game.homeTeam as Record<string, unknown>).players as Array<Record<string, unknown>>;
    const statistics = players[0]?.statistics as Record<string, unknown>;

    expect(statistics.points).toBe(22);
    expect(statistics.reboundsTotal).toBe(8);
    expect(statistics.assists).toBe(3);
    expect(statistics.steals).toBe(1);
  });

  it("resolves both raw NBA ids and canonical ids across provider fallback", async () => {
    const espnSummary = {
      header: {
        competitions: [{
          date: "2026-10-01T00:00:00Z",
          status: { type: { description: "Final" } },
          competitors: [
            { homeAway: "home", score: "101", team: { id: "999", abbreviation: "BOS", location: "Boston", name: "Celtics" } },
            { homeAway: "away", score: "99", team: { id: "998", abbreviation: "LAL", location: "Los Angeles", name: "Lakers" } }
          ]
        }]
      },
      boxscore: { players: [] }
    };
    let liveCalls = 0;
    const client = {
      getLiveBoxscore: async (id: string) => {
        expect(id).toBe("0022600001");
        liveCalls += 1;
        if (liveCalls > 1) {
          const error = new Error("NBA API 404");
          (error as Error & { status?: number }).status = 404;
          throw error;
        }
        return {
          game: {
            gameId: id,
            gameDateTimeUTC: "2026-10-01T00:00:00Z",
            gameStatusText: "Final",
            homeTeam: { teamId: 1610612738, teamCity: "Boston", teamName: "Celtics", teamTricode: "BOS", score: 101, players: [] },
            awayTeam: { teamId: 1610612747, teamCity: "Los Angeles", teamName: "Lakers", teamTricode: "LAL", score: 99, players: [] }
          }
        };
      },
      getScheduleSnapshot: async () => ({
        leagueSchedule: {
          gameDates: [{
            gameDate: "2026-10-01",
            games: [{
              gameId: "0022600001",
              gameDateTimeUTC: "2026-10-01T00:00:00Z",
              gameStatus: 3,
              gameStatusText: "Final",
              homeTeam: { teamId: 1610612738, teamTricode: "BOS" },
              awayTeam: { teamId: 1610612747, teamTricode: "LAL" }
            }]
          }]
        }
      }),
      getEspnScoreboardByDate: async () => ({
        events: [{
          id: "401",
          competitions: [{
            competitors: [
              { homeAway: "home", team: { abbreviation: "BOS" } },
              { homeAway: "away", team: { abbreviation: "LAL" } }
            ]
          }]
        }]
      }),
      getEspnGameSummary: async (id: string) => {
        expect(id).toBe("401");
        return espnSummary;
      }
    } as never;
    const service = createGamesService({ client, cache: new MemoryCache() });

    const nbaIdResult = await service.getGameDetail("0022600001");
    const canonicalResult = await service.getGameDetail("game:2026-10-01:LAL:BOS");

    expect(nbaIdResult.data.game.gameId).toBe("0022600001");
    expect(canonicalResult.data.game.gameId).toBe("0022600001");
    expect(canonicalResult.meta.source).toContain("ESPN summary");
  });
});
