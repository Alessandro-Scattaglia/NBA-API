import { describe, expect, it } from "vitest";
import { MemoryCache } from "../../cache/memoryCache.js";
import { loadCalendarRange } from "./datasets.js";

describe("calendar provider merge", () => {
  it("maps ESPN abbreviated team codes", async () => {
    const client = {
      getGamesSchedule: async () => ({
        data: [{
          id: "espn-2",
          date: "2026-10-02T00:00:00Z",
          competitions: [{
            date: "2026-10-02T00:00:00Z",
            competitors: [
              { homeAway: "home", team: { abbreviation: "NY" } },
              { homeAway: "away", team: { abbreviation: "NO" } }
            ],
            status: { type: { state: "pre", description: "Scheduled" } }
          }]
        }]
      }),
      getScheduleSnapshot: async () => ({ leagueSchedule: { gameDates: [] } })
    } as never;

    const state = await loadCalendarRange({ client, cache: undefined }, "2026-10-02", "2026-10-02");

    expect(state.value).toHaveLength(1);
    expect(state.value[0]?.homeTeam.code).toBe("NYK");
    expect(state.value[0]?.awayTeam.code).toBe("NOP");
  });

  it("uses ESPN as the primary calendar source", async () => {
    const client = {
      getGamesSchedule: async () => ({
        data: [{
          id: "espn-1",
          date: "2026-10-01T00:00:00Z",
          competitions: [{
            date: "2026-10-01T00:00:00Z",
            competitors: [
              { homeAway: "home", team: { abbreviation: "BOS" } },
              { homeAway: "away", team: { abbreviation: "LAL" } }
            ],
            status: { type: { state: "post", description: "Final" } }
          }]
        }]
      }),
      getScheduleSnapshot: async () => ({
        leagueSchedule: {
          gameDates: [{
            gameDate: "2026-10-01",
            games: [
              {
                gameId: "0022600001",
                gameDateTimeUTC: "2026-10-01T00:00:00Z",
                gameStatus: 3,
                gameStatusText: "Final",
                homeTeam: { teamId: 1610612738, teamTricode: "BOS", score: 90 },
                awayTeam: { teamId: 1610612747, teamTricode: "LAL", score: 98 }
              },
              {
                gameId: "0022600002",
                gameDateTimeUTC: "2026-10-01T02:00:00Z",
                gameStatus: 1,
                gameStatusText: "7:00 PM ET",
                homeTeam: { teamId: 1610612741, teamTricode: "CHI" },
                awayTeam: { teamId: 1610612738, teamTricode: "BOS" }
              }
            ]
          }]
        }
      })
    } as never;

    const state = await loadCalendarRange({ client, cache: undefined }, "2026-10-01", "2026-10-01");

    expect(state.value).toHaveLength(1);
    expect(new Set(state.value.map((game) => game.gameId)).size).toBe(1);
    expect(state.value.map((game) => game.gameId)).toEqual(["espn-1"]);
    expect(state.value.every((game) => game.canonicalId?.startsWith("game:"))).toBe(true);
    expect(state.value.find((game) => game.gameId === "espn-1")?.homeTeam.score).toBe(90);
    expect(state.value.find((game) => game.gameId === "espn-1")?.awayTeam.score).toBe(98);
  });

  it("uses a new cache namespace after calendar data source changes", async () => {
    const cache = new MemoryCache();
    const client = {
      getGamesSchedule: async () => ({
        data: [{
          id: "espn-cache-key",
          date: "2026-10-03T00:00:00Z",
          competitions: [{
            date: "2026-10-03T00:00:00Z",
            competitors: [
              { homeAway: "home", team: { abbreviation: "BOS" } },
              { homeAway: "away", team: { abbreviation: "LAL" } }
            ],
            status: { type: { state: "post", description: "Final" } }
          }]
        }]
      }),
      getScheduleSnapshot: async () => ({ leagueSchedule: { gameDates: [] } })
    } as never;

    await loadCalendarRange({ client, cache }, "2026-10-03", "2026-10-03");

    expect(cache.getStats().keys).toContain("calendar:v3:2026-10-03:2026-10-03");
  });

  it("merges providers by team IDs even when their codes differ", async () => {
    const client = {
      getGamesSchedule: async () => ({ data: [{ id: "espn-id-match", date: "2026-10-04T18:00:00Z", competitions: [{ date: "2026-10-04T18:00:00Z", competitors: [{ homeAway: "home", team: { abbreviation: "NY" } }, { homeAway: "away", team: { abbreviation: "NO" } }], status: { type: { state: "pre", description: "Scheduled" } } }] }] }),
      getScheduleSnapshot: async () => ({ leagueSchedule: { gameDates: [{ gameDate: "2026-10-04", games: [{ gameId: "nba-id-match", gameDateTimeUTC: "2026-10-04T18:00:00Z", gameStatus: 3, gameStatusText: "Final", homeTeam: { teamId: 1610612752, score: 101 }, awayTeam: { teamId: 1610612740, score: 99 } }] }] } })
    } as never;

    const state = await loadCalendarRange({ client, cache: new MemoryCache() }, "2026-10-04", "2026-10-04");

    expect(state.value).toHaveLength(1);
    expect(state.value[0]?.status).toBe("final");
    expect(state.value[0]?.homeTeam.score).toBe(101);
    expect(state.value[0]?.awayTeam.score).toBe(99);
  });

  it("keeps different games separate and uses the calendar date for UTC offsets", async () => {
    const client = {
      getGamesSchedule: async () => ({ data: [
        { id: "espn-same-date", date: "2026-10-05T22:30:00Z", competitions: [{ date: "2026-10-05T22:30:00Z", competitors: [{ homeAway: "home", team: { abbreviation: "BOS" } }, { homeAway: "away", team: { abbreviation: "LAL" } }], status: { type: { state: "pre", description: "Scheduled" } } }] },
        { id: "espn-different-game", date: "2026-10-05T22:30:00Z", competitions: [{ date: "2026-10-05T22:30:00Z", competitors: [{ homeAway: "home", team: { abbreviation: "CHI" } }, { homeAway: "away", team: { abbreviation: "NY" } }], status: { type: { state: "pre", description: "Scheduled" } } }] }
      ] }),
      getScheduleSnapshot: async () => ({ leagueSchedule: { gameDates: [{ gameDate: "2026-10-06", games: [{ gameId: "nba-same-date", gameDateTimeUTC: "2026-10-05T23:30:00Z", gameStatus: 3, gameStatusText: "Final", homeTeam: { teamId: 1610612738, teamTricode: "BOS", score: 110 }, awayTeam: { teamId: 1610612747, teamTricode: "LAL", score: 105 } }] }] } })
    } as never;

    const state = await loadCalendarRange({ client, cache: new MemoryCache() }, "2026-10-06", "2026-10-06");

    expect(state.value).toHaveLength(2);
    expect(state.value.find((game) => game.gameId === "espn-same-date")?.status).toBe("final");
    expect(state.value.find((game) => game.gameId === "espn-same-date")?.homeTeam.score).toBe(110);
    expect(state.value.find((game) => game.gameId === "espn-different-game")).toBeDefined();
  });

  it("prefers a final NBA snapshot over a live ESPN snapshot", async () => {
    const client = {
      getGamesSchedule: async () => ({ data: [{ id: "espn-live", date: "2026-10-07T18:00:00Z", competitions: [{ date: "2026-10-07T18:00:00Z", competitors: [{ homeAway: "home", team: { abbreviation: "BOS" }, score: "80" }, { homeAway: "away", team: { abbreviation: "LAL" }, score: "78" }], status: { type: { state: "in", description: "3rd Quarter" } } }] }] }),
      getScheduleSnapshot: async () => ({ leagueSchedule: { gameDates: [{ gameDate: "2026-10-07", games: [{ gameId: "nba-final", gameDateTimeUTC: "2026-10-07T18:00:00Z", gameStatus: 3, gameStatusText: "Final", homeTeam: { teamId: 1610612738, score: 112 }, awayTeam: { teamId: 1610612747, score: 108 } }] }] } })
    } as never;

    const state = await loadCalendarRange({ client, cache: new MemoryCache() }, "2026-10-07", "2026-10-07");

    expect(state.value[0]?.status).toBe("final");
    expect(state.value[0]?.homeTeam.score).toBe(112);
    expect(state.value[0]?.awayTeam.score).toBe(108);
  });
});
