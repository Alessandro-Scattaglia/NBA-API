import { describe, expect, it } from "vitest";
import type { GameSummary } from "../../types/dto/index.js";
import { mergeRecentGame, mergeUniqueRecentGames } from "./service.js";

function game(status: GameSummary["status"], homeScore: number | null, awayScore: number | null): GameSummary {
  return {
    gameId: "game-1",
    gameCode: null,
    dateTimeUtc: "2026-11-01T00:00:00Z",
    dateLabel: "",
    status,
    statusText: status,
    phase: "regular-season",
    arena: null,
    nationalTv: [],
    clock: null,
    period: null,
    homeTeam: { teamId: 1, name: "Home", code: "H", logo: "", score: homeScore, record: null },
    awayTeam: { teamId: 2, name: "Away", code: "A", logo: "", score: awayScore, record: null }
  };
}

describe("team recent game merging", () => {
  it("uses the game log result when the schedule has an incomplete final", () => {
    const merged = mergeRecentGame(game("final", 101, 99), { WL: "W" }, game("final", 0, 0));

    expect(merged.homeTeam.score).toBe(101);
    expect(merged.awayTeam.score).toBe(99);
  });

  it("does not replace a reliable final result with incomplete data", () => {
    const merged = mergeUniqueRecentGames([game("final", 101, 99)], [game("final", null, null)]);

    expect(merged[0]?.status).toBe("final");
    expect(merged[0]?.homeTeam.score).toBe(101);
    expect(merged[0]?.awayTeam.score).toBe(99);
  });
});
