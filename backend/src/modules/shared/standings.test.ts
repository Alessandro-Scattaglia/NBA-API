import { describe, expect, it } from "vitest";
import { TEAM_DIRECTORY } from "../../config/teams.js";
import type { GameSummary } from "../../types/dto/index.js";
import { buildStandingsFromScheduleSnapshot } from "./datasets.js";

function game(
  index: number,
  homeTeamId: number,
  awayTeamId: number,
  homeScore: number | null,
  awayScore: number | null,
  status: GameSummary["status"],
  homeRecord: string,
  awayRecord: string
): GameSummary {
  const home = TEAM_DIRECTORY.find((team) => team.teamId === homeTeamId)!;
  const away = TEAM_DIRECTORY.find((team) => team.teamId === awayTeamId)!;
  return {
    gameId: `test-${index}`,
    gameCode: null,
    dateTimeUtc: `2026-11-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
    dateLabel: "",
    status,
    statusText: status,
    phase: "regular-season",
    arena: null,
    nationalTv: [],
    clock: null,
    period: null,
    homeTeam: { teamId: home.teamId, name: home.name, code: home.code, logo: home.logo, score: homeScore, record: homeRecord },
    awayTeam: { teamId: away.teamId, name: away.name, code: away.code, logo: away.logo, score: awayScore, record: awayRecord }
  };
}

function completeSchedule() {
  return Array.from({ length: 15 }, (_, index) => {
    const east = TEAM_DIRECTORY[index];
    const west = TEAM_DIRECTORY[index + 15];
    return game(index, east.teamId, west.teamId, 100 + index, 90, "final", "1-0", "0-1");
  });
}

describe("standings schedule fallback", () => {
  it("rejects an empty snapshot instead of manufacturing 0-0 standings", () => {
    expect(buildStandingsFromScheduleSnapshot([])).toBeNull();
  });

  it("calculates records and ignores postponed games as played", () => {
    const schedule = [
      ...completeSchedule(),
      game(20, TEAM_DIRECTORY[0].teamId, TEAM_DIRECTORY[1].teamId, null, null, "scheduled", "1-0", "1-0")
    ];
    const rows = buildStandingsFromScheduleSnapshot(schedule)!;
    const team = rows.find((row) => row.teamId === TEAM_DIRECTORY[0].teamId)!;

    expect(team.gamesPlayed).toBe(1);
    expect(team.remainingGames).toBe(1);
    expect(team.homeRecord).toBe("1-0");
    expect(team.awayRecord).toBe("0-0");
    expect(team.lastTen).toBe("1-0");
    expect(team.streak).toBe("W1");
  });
});
