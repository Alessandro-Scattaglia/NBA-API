import { describe, expect, it } from "vitest";
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
              { homeAway: "home", score: "100", team: { abbreviation: "BOS" } },
              { homeAway: "away", score: "98", team: { abbreviation: "LAL" } }
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
    expect(state.value.find((game) => game.gameId === "espn-1")?.homeTeam.score).toBe(100);
  });
});
