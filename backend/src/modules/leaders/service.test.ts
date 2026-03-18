import { describe, expect, it } from "vitest";
import { MemoryCache } from "../../cache/memoryCache.js";
import type { NbaApiClient } from "../../nba-client/client.js";
import type { PlayerSummary } from "../../types/dto.js";
import { buildLeaderCategories, createLeadersService } from "./service.js";

function statsResponse(headers: string[], rows: unknown[][]) {
  return {
    resultSets: [
      {
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

function createPlayer(
  playerId: number,
  fullName: string,
  stats: Partial<NonNullable<PlayerSummary["averages"]>>
): PlayerSummary {
  return {
    playerId,
    firstName: fullName.split(" ")[0] ?? fullName,
    lastName: fullName.split(" ").slice(1).join(" ") || fullName,
    fullName,
    headshot: `https://example.com/${playerId}.png`,
    team: {
      teamId: playerId,
      name: `Team ${playerId}`,
      code: `T${playerId}`,
      logo: `https://example.com/${playerId}.svg`
    },
    jersey: null,
    position: null,
    height: null,
    weight: null,
    averages: {
      gamesPlayed: 60,
      minutes: 30,
      points: 0,
      rebounds: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      threesMade: 0,
      fgPct: 0,
      threePct: 0,
      ftPct: 0,
      ...stats
    }
  };
}

describe("leaders service", () => {
  it("keeps the home leader categories focused on points, rebounds and assists", () => {
    const players = [
      createPlayer(1, "Luka Doncic", { points: 32.8 }),
      createPlayer(2, "Nikola Jokic", { rebounds: 12.7 }),
      createPlayer(3, "Trae Young", { assists: 10.8 })
    ];

    const categories = buildLeaderCategories(players, 5);

    expect(categories.map((category) => category.key)).toEqual(["points", "rebounds", "assists"]);
  });

  it("returns extended leaders including blocks, steals and made threes", async () => {
    const client = createClient({
      getPlayerIndex: async () =>
        statsResponse(
          ["PLAYER_ID", "PLAYER_NAME", "PLAYER_FIRST_NAME", "PLAYER_LAST_NAME", "TEAM_ID", "TEAM_ABBREVIATION", "POSITION", "HEIGHT", "WEIGHT", "JERSEY"],
          [
            [30, "Stephen Curry", "Stephen", "Curry", 1610612744, "GSW", "G", "6-2", "185", "30"],
            [1, "Victor Wembanyama", "Victor", "Wembanyama", 1610612759, "SAS", "C", "7-4", "230", "1"],
            [2, "Shai Gilgeous-Alexander", "Shai", "Gilgeous-Alexander", 1610612760, "OKC", "G", "6-6", "195", "2"]
          ]
        ),
      getLeagueDashPlayerStats: async () =>
        statsResponse(
          ["PLAYER_ID", "GP", "MIN", "PTS", "REB", "AST", "STL", "BLK", "FG3M", "FG_PCT", "FG3_PCT", "FT_PCT"],
          [
            [30, 58, 33.4, 28.1, 5.1, 6.2, 1.3, 0.4, 4.8, 0.471, 0.421, 0.913],
            [1, 55, 32.5, 24.7, 11.2, 4.6, 1.1, 3.9, 1.8, 0.503, 0.366, 0.807],
            [2, 59, 34.0, 31.8, 5.2, 6.1, 2.3, 1.0, 2.0, 0.519, 0.384, 0.904]
          ]
        )
    });

    const service = createLeadersService({ client, cache: new MemoryCache() });
    const response = await service.getLeaders(10);

    expect(response.data.categories.map((category) => category.key)).toEqual([
      "points",
      "rebounds",
      "assists",
      "steals",
      "blocks",
      "threesMade"
    ]);
    expect(response.data.categories.find((category) => category.key === "blocks")?.leaders[0].fullName).toBe("Victor Wembanyama");
    expect(response.data.categories.find((category) => category.key === "steals")?.leaders[0].fullName).toBe(
      "Shai Gilgeous-Alexander"
    );
    expect(response.data.categories.find((category) => category.key === "threesMade")?.leaders[0].fullName).toBe(
      "Stephen Curry"
    );
  });
});
