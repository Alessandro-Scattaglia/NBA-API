import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryCache } from "../../cache/memoryCache.js";
import { loadResultCheckGames } from "./datasets.js";

function liveGame(status: number, score = 0) {
  return {
    gameId: "001",
    gameStatus: status,
    gameStatusText: status === 3 ? "Final" : "Scheduled",
    gameDateTimeUTC: "2026-11-16T00:00:00Z",
    homeTeam: { teamId: 1610612738, teamTricode: "BOS", score },
    awayTeam: { teamId: 1610612747, teamTricode: "LAL", score: 90 }
  };
}

describe("result check window", () => {
  afterEach(() => vi.useRealTimers());

  it("checks the previous Italian day even when today's scoreboard has scheduled games", async () => {
    vi.setSystemTime(new Date("2026-11-16T03:00:00Z"));
    const client = {
      getLiveScoreboard: async () => ({ scoreboard: { games: [liveGame(1)] } }),
      getEspnScoreboardByDate: async () => ({ events: [{
        id: "espn-final",
        date: "2026-11-15T23:00:00Z",
        competitions: [{
          date: "2026-11-15T23:00:00Z",
          competitors: [
            { homeAway: "home", score: "101", team: { abbreviation: "BOS" } },
            { homeAway: "away", score: "99", team: { abbreviation: "LAL" } }
          ],
          status: { type: { state: "post", description: "Final" } }
        }]
      }] }),
      getScheduleSnapshot: async () => ({ leagueSchedule: { gameDates: [] } })
    } as never;

    const result = await loadResultCheckGames({ client, cache: new MemoryCache() }, "2026-11-16", true);
    expect(result.value.some((game) => game.gameId === "espn-final" && game.status === "final")).toBe(true);
    vi.useRealTimers();
  });

  it("uses the CDN snapshot when ESPN returns no usable previous-day result", async () => {
    vi.setSystemTime(new Date("2026-11-16T03:00:00Z"));
    const client = {
      getLiveScoreboard: async () => ({ scoreboard: { games: [liveGame(1)] } }),
      getEspnScoreboardByDate: async () => ({ events: [{
        id: "espn-partial",
        date: "2026-11-15T23:00:00Z",
        competitions: [{ date: "2026-11-15T23:00:00Z", competitors: [], status: { type: { state: "post" } } }]
      }] }),
      getScheduleSnapshot: async () => ({ leagueSchedule: { gameDates: [{ gameDate: "2026-11-15", games: [{
        gameId: "cdn-final",
        gameDateTimeUTC: "2026-11-15T23:00:00Z",
        gameStatus: 3,
        gameStatusText: "Final",
        homeTeam: { teamId: 1610612738, teamTricode: "BOS", score: 101 },
        awayTeam: { teamId: 1610612747, teamTricode: "LAL", score: 99 }
      }] }] } })
    } as never;

    const result = await loadResultCheckGames({ client, cache: new MemoryCache() }, "2026-11-16", true);
    expect(result.value.some((game) => game.gameId === "cdn-final" && game.status === "final")).toBe(true);
    vi.useRealTimers();
  });

  it("keeps previous-day results when the live scoreboard fails", async () => {
    vi.setSystemTime(new Date("2026-11-16T12:00:00Z"));
    const client = {
      getLiveScoreboard: async () => { throw new Error("live unavailable"); },
      getEspnScoreboardByDate: async () => ({ events: [{
        id: "espn-final",
        date: "2026-11-15T23:00:00Z",
        competitions: [{ date: "2026-11-15T23:00:00Z", competitors: [
          { homeAway: "home", score: "101", team: { abbreviation: "BOS" } },
          { homeAway: "away", score: "99", team: { abbreviation: "LAL" } }
        ], status: { type: { state: "post", description: "Final" } } }]
      }] }),
      getScheduleSnapshot: async () => ({ leagueSchedule: { gameDates: [] } })
    } as never;

    const result = await loadResultCheckGames({ client, cache: new MemoryCache() }, "2026-11-16", true);
    expect(result.liveSourceFailed).toBe(true);
    expect(result.value.some((game) => game.gameId === "espn-final")).toBe(true);
  });

  it("fails when live, ESPN and CDN sources all fail", async () => {
    const client = {
      getLiveScoreboard: async () => { throw new Error("live unavailable"); },
      getEspnScoreboardByDate: async () => { throw new Error("ESPN unavailable"); },
      getScheduleSnapshot: async () => { throw new Error("CDN unavailable"); }
    } as never;

    await expect(loadResultCheckGames({ client, cache: new MemoryCache() }, "2026-11-16", true)).rejects.toThrow("All result sources failed");
  });
});
