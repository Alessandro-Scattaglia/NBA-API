import { describe, expect, it } from "vitest";
import { MemoryCache } from "../../cache/memoryCache.js";
import { createHomeService } from "./service.js";
import type { NbaApiClient } from "../../nba-client/client.js";

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

describe("home service", () => {
  it("returns a degraded payload instead of throwing when upstream datasets fail", async () => {
    const failing = async () => {
      throw new Error("Upstream unavailable");
    };

    const client = createClient({
      getLiveScoreboard: failing,
      getLeagueStandings: failing,
      getPlayoffPicture: failing,
      getScheduleSnapshot: failing,
      getLeagueDashPlayerStats: failing,
      getPlayerIndex: failing
    });

    const response = await createHomeService({ client, cache: new MemoryCache() }).getHome();

    expect(response.data.todayGames).toEqual([]);
    expect(response.data.upcomingGames).toEqual([]);
    expect(response.data.featuredGame).toBeNull();
    expect(response.data.conferenceLeaders.east).toBeNull();
    expect(response.data.conferenceLeaders.west).toBeNull();
    expect(response.data.playerLeaders).toHaveLength(3);
    expect(response.data.playerLeaders.every((category) => category.leaders.length === 0)).toBe(true);
    expect(response.meta.stale).toBe(true);
    expect(Number.isNaN(Date.parse(response.meta.updatedAt))).toBe(false);
  });
});
