import { afterEach, describe, expect, it, vi } from "vitest";
import { scheduled } from "./scheduled.js";

function scoreboard(status: number, score: number, clock: string) {
  return { scoreboard: { games: [{
    gameId: "0022600001",
    gameStatus: status,
    gameStatusText: status === 3 ? "Final" : "Q1",
    gameDateTimeUTC: "2026-11-18T01:00:00Z",
    period: 1,
    gameClock: clock,
    homeTeam: { teamId: 1610612738, teamTricode: "BOS", score },
    awayTeam: { teamId: 1610612747, teamTricode: "LAL", score: 90 }
  }] } };
}

function kvBinding() {
  const entries = new Map<string, string>();
  const puts: Array<{ key: string; value: string }> = [];
  return {
    puts,
    async get<T>(key: string) { return entries.has(key) ? JSON.parse(entries.get(key)!) as T : null; },
    async put(key: string, value: string) { entries.set(key, value); puts.push({ key, value }); }
  };
}

describe("scheduled live synchronization", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it("does not write repeated polling or clock-only changes and persists score at the five-minute interval", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-18T12:00:00Z"));
    const kv = kvBinding();
    let current = scoreboard(2, 10, "10:00");
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("todaysScoreboard")) return new Response(JSON.stringify(current));
      if (url.includes("scoreboardv2")) return new Response(JSON.stringify({ resultSets: [] }));
      if (url.includes("scheduleleaguev2")) return new Response(JSON.stringify({ leagueSchedule: { gameDates: [] } }));
      if (url.includes("scoreboard?")) return new Response(JSON.stringify({ events: [] }));
      return new Response(JSON.stringify({ resultSets: [] }));
    }));

    await scheduled({ cron: "*/2 * * * *" }, { NBA_CACHE: kv as never, NBA_REQUEST_RETRIES: "0" });
    expect(kv.puts.filter((item) => item.key.startsWith("today-games:")).length).toBe(1);
    const firstSnapshot = JSON.parse(kv.puts.find((item) => item.key.startsWith("today-games:"))!.value);
    expect(firstSnapshot.updatedAt).toBeTruthy();

    vi.advanceTimersByTime(2 * 60_000);
    current = scoreboard(2, 10, "9:00");
    await scheduled({ cron: "*/2 * * * *" }, { NBA_CACHE: kv as never, NBA_REQUEST_RETRIES: "0" });
    expect(kv.puts.filter((item) => item.key.startsWith("today-games:")).length).toBe(1);

    vi.advanceTimersByTime(2 * 60_000);
    current = scoreboard(2, 11, "8:00");
    await scheduled({ cron: "*/2 * * * *" }, { NBA_CACHE: kv as never, NBA_REQUEST_RETRIES: "0" });
    expect(kv.puts.filter((item) => item.key.startsWith("today-games:")).length).toBe(1);

    vi.advanceTimersByTime(2 * 60_000);
    await scheduled({ cron: "*/2 * * * *" }, { NBA_CACHE: kv as never, NBA_REQUEST_RETRIES: "0" });
    expect(kv.puts.filter((item) => item.key.startsWith("today-games:")).length).toBe(2);
  });

  it("persists a final game immediately and does not rewrite unchanged derived datasets", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-18T12:00:00Z"));
    const kv = kvBinding();
    let current = scoreboard(2, 10, "10:00");
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("todaysScoreboard")) return new Response(JSON.stringify(current));
      if (url.includes("scoreboardv2")) return new Response(JSON.stringify({ resultSets: [] }));
      if (url.includes("scheduleleaguev2")) return new Response(JSON.stringify({ leagueSchedule: { gameDates: [] } }));
      if (url.includes("scoreboard?")) return new Response(JSON.stringify({ events: [] }));
      return new Response(JSON.stringify({ resultSets: [] }));
    }));

    await scheduled({ cron: "*/2 * * * *" }, { NBA_CACHE: kv as never, NBA_REQUEST_RETRIES: "0" });
    const beforeFinal = kv.puts.length;
    vi.advanceTimersByTime(2 * 60_000);
    current = scoreboard(3, 110, "0:00");
    await scheduled({ cron: "*/2 * * * *" }, { NBA_CACHE: kv as never, NBA_REQUEST_RETRIES: "0" });
    expect(kv.puts.filter((item) => item.key.startsWith("today-games:")).length).toBe(2);
    expect(kv.puts.length).toBeGreaterThanOrEqual(beforeFinal + 1);
    const derived = kv.puts.filter((item) => /standings-dataset|team-stats-dataset|players-catalog/.test(item.key));
    expect(new Set(derived.map((item) => item.key)).size).toBe(derived.length);
  });
});
