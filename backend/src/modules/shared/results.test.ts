import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryCache } from "../../cache/memoryCache.js";
import { liveStandingsSignature, liveVisualSignature, loadResultCheckGames, loadTodayGames } from "./datasets.js";

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

describe("live signatures", () => {
  const game: any = { gameId: "g1", status: "live", statusText: "Q1", period: 1, clock: "10:00", dateTimeUtc: "2026-11-16T00:00:00Z", homeTeam: { teamId: 1, score: 10 }, awayTeam: { teamId: 2, score: 9 } };

  it("sorts games so input order does not affect signatures", () => {
    const other = { ...game, gameId: "g2" };
    expect(liveVisualSignature([game, other])).toBe(liveVisualSignature([other, game]));
    expect(liveStandingsSignature([game, other])).toBe(liveStandingsSignature([other, game]));
  });

  it("tracks clock visually but not in standings signatures", () => {
    const changed = { ...game, clock: "9:00" } as never;
    expect(liveVisualSignature([game])).not.toBe(liveVisualSignature([changed]));
    expect(liveStandingsSignature([game])).toBe(liveStandingsSignature([changed]));
  });

  it("tracks score, status, additions, and removals in standings signatures", () => {
    expect(liveStandingsSignature([game])).not.toBe(liveStandingsSignature([{ ...game, status: "final" } as never]));
    expect(liveStandingsSignature([game])).not.toBe(liveStandingsSignature([{ ...game, homeTeam: { teamId: 1, score: 11 } } as never]));
    expect(liveStandingsSignature([game])).not.toBe(liveStandingsSignature([]));
  });
});

describe("live persistence cadence", () => {
  it("persists a local update after five minutes even without a new provider change", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-18T12:00:00Z"));
    const values = new Map<string, unknown>();
    const puts: Array<{ key: string; value: { value: Array<{ homeTeam: { score: number } }>; updatedAt: string } }> = [];
    let score = 10;
    let calls = 0;
    const kv = {
      async get<T>(key: string) { return (values.get(key) as T | undefined) ?? null; },
      async put(key: string, value: string) {
        const parsed = JSON.parse(value);
        values.set(key, parsed);
        puts.push({ key, value: parsed });
      }
    };
    const client = {
      getLiveScoreboard: async () => {
        calls += 1;
        return { scoreboard: { games: [{ gameId: "g1", gameStatus: 2, gameStatusText: "Q1", gameDateTimeUTC: "2026-11-18T12:00:00Z", period: 1, gameClock: "10:00", homeTeam: { teamId: 1, score }, awayTeam: { teamId: 2, score: 9 } }] } };
      }
    } as never;
    const deps = { client, cache: new MemoryCache(kv, true), runtimeEnv: { cache: kv } as never, allowKvPut: true };

    await loadTodayGames(deps, true);
    expect(puts).toHaveLength(1);
    score = 11;
    vi.advanceTimersByTime(2 * 60_000);
    await loadTodayGames(deps, true);
    expect(puts).toHaveLength(1);
    vi.advanceTimersByTime(2 * 60_000);
    await loadTodayGames(deps, true);
    expect(puts).toHaveLength(1);
    vi.advanceTimersByTime(2 * 60_000);
    await loadTodayGames(deps, true);
    expect(puts).toHaveLength(2);
    expect(puts[1].value.value[0].homeTeam.score).toBe(11);

    const snapshot = Array.from(values.values()).find((entry) => entry && typeof entry === "object" && "value" in entry) as { value: Array<{ homeTeam: { score: number } }> };
    expect(calls).toBe(4);
    expect(snapshot.value[0].homeTeam.score).toBe(11);
    vi.useRealTimers();
  });
});
