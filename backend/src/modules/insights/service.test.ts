import { describe, expect, it } from "vitest";
import { TEAM_DIRECTORY } from "../../config/teams.js";
import type { TeamSeasonStats, TeamSummary } from "../../types/dto/index.js";
import { rankInsightsTeams } from "./service.js";

function team(index: number): TeamSummary {
  const identity = TEAM_DIRECTORY[index];
  return {
    ...identity,
    wins: 1,
    losses: 1,
    winPct: 0.5,
    gamesBehind: 0,
    conferenceRank: index + 1,
    homeRecord: "--",
    awayRecord: "--",
    lastTen: "--",
    streak: "--",
    playoffStatus: "in-the-hunt",
    clinchedPlayoff: false,
    clinchedDivision: false,
    clinchedConference: false
  };
}

function stats(pointsPerGame: number, defensiveRating: number): TeamSeasonStats {
  return {
    pointsPerGame,
    opponentPointsPerGame: 0,
    reboundsPerGame: 0,
    assistsPerGame: 0,
    netRating: null,
    offensiveRating: null,
    defensiveRating,
    pace: null,
    fgPct: null,
    threePct: null
  };
}

describe("insights team rankings", () => {
  it("orders attack descending and defense ascending without using zero metrics", () => {
    const teams = [team(0), team(1), team(2)];
    const values = new Map([
      [teams[0].teamId, stats(110, 108)],
      [teams[1].teamId, stats(120, 112)],
      [teams[2].teamId, stats(0, 104)]
    ]);

    const ranked = rankInsightsTeams(teams, values);

    expect(ranked.attack.map((item) => item.team.teamId)).toEqual([teams[1].teamId, teams[0].teamId]);
    expect(ranked.defense.map((item) => item.team.teamId)).toEqual([teams[2].teamId, teams[0].teamId, teams[1].teamId]);
  });

  it("labels recent-game fallback metrics accurately", () => {
    const teams = [team(0)];
    const ranked = rankInsightsTeams(teams, new Map(), new Map([
      [teams[0].teamId, { games: 2, pointsFor: 220, pointsAgainst: 200 }]
    ]));

    expect(ranked.attack[0]?.metric).toBe(110);
    expect(ranked.attack[0]?.metricLabel).toContain("ultime 45");
    expect(ranked.defense[0]?.metric).toBe(100);
    expect(ranked.defense[0]?.metricLabel).toContain("ultime 45");
  });
});
