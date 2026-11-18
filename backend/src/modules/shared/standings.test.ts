import { describe, expect, it } from "vitest";
import { TEAM_DIRECTORY } from "../../config/teams.js";
import type { GameSummary } from "../../types/dto/index.js";
import { buildScheduleFormByTeam, buildStandingsFromScheduleSnapshot } from "./datasets.js";

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
    dateTimeUtc: new Date(Date.UTC(2026, 10, 1 + index)).toISOString(),
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

  it("calculates Ult. 10 from the away team's perspective", () => {
    const target = TEAM_DIRECTORY[0];
    const opponent = TEAM_DIRECTORY[1];
    const schedule = [
      ...completeSchedule(),
      game(30, opponent.teamId, target.teamId, 90, 100, "final", "1-1", "2-0"),
      game(31, target.teamId, opponent.teamId, 90, 100, "final", "2-1", "2-1")
    ];
    const row = buildStandingsFromScheduleSnapshot(schedule)!.find((item) => item.teamId === target.teamId)!;

    expect(row.lastTen).toBe("2-1");
  });

  it("calculates an away loss as a loss for the selected team", () => {
    const target = TEAM_DIRECTORY[0];
    const opponent = TEAM_DIRECTORY[1];
    const schedule = [...completeSchedule(), game(30, opponent.teamId, target.teamId, 100, 90, "final", "2-0", "1-1")];
    const row = buildStandingsFromScheduleSnapshot(schedule)!.find((item) => item.teamId === target.teamId)!;

    expect(row.lastTen).toBe("1-1");
  });

  it("uses only available completed games and excludes scheduled games", () => {
    const target = TEAM_DIRECTORY[0];
    const opponent = TEAM_DIRECTORY[1];
    const schedule = [
      ...completeSchedule(),
      game(30, opponent.teamId, target.teamId, 90, 100, "final", "1-1", "2-0"),
      game(31, target.teamId, opponent.teamId, null, null, "scheduled", "2-1", "2-1")
    ];
    const row = buildStandingsFromScheduleSnapshot(schedule)!.find((item) => item.teamId === target.teamId)!;

    expect(row.lastTen).toBe("2-0");
  });

  it("does not count a game twice for one team", () => {
    const target = TEAM_DIRECTORY[0];
    const opponent = TEAM_DIRECTORY[1];
    const schedule = [
      ...completeSchedule(),
      game(30, opponent.teamId, target.teamId, 90, 100, "final", "1-1", "2-0")
    ];
    const row = buildStandingsFromScheduleSnapshot(schedule)!.find((item) => item.teamId === target.teamId)!;

    expect(row.gamesPlayed).toBe(2);
    expect(row.lastTen).toBe("2-0");
  });

  it("ignores missing and non-finite scores when calculating form", () => {
    const target = TEAM_DIRECTORY[0];
    const opponent = TEAM_DIRECTORY[1];
    const form = buildScheduleFormByTeam([
      game(40, target.teamId, opponent.teamId, 110, 100, "final", "", ""),
      game(41, target.teamId, opponent.teamId, null, 100, "final", "", ""),
      game(42, target.teamId, opponent.teamId, Number.NaN, 100, "final", "", "")
    ]);

    expect(form.get(target.teamId)).toEqual({ lastTen: "1-0", streak: "W1" });
  });
});
