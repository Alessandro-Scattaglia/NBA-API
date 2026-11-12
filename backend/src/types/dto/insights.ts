import type { GameSummary } from "./games.js";
import type { PlayerSummary } from "./players.js";
import type { TeamSeasonStats, TeamSummary } from "./teams.js";

export interface InsightTeam {
  team: TeamSummary;
  stats: TeamSeasonStats | null;
  metric: number;
  metricLabel: string;
}

export interface InsightPlayer {
  player: PlayerSummary;
  metric: number;
  metricLabel: string;
}

export interface InsightGame {
  game: GameSummary;
  interestScore: number;
  reason: string;
}

export interface InsightsOverview {
  games: number;
  scheduledGames: number;
  liveGames: number;
  nationalTvGames: number;
  averageTotalPoints: number | null;
}

export interface InsightsResponse {
  season: string;
  period: {
    from: string;
    to: string;
  };
  overview: InsightsOverview;
  mostInFormTeam: InsightTeam | null;
  bestAttackTeam: InsightTeam | null;
  bestDefenseTeam: InsightTeam | null;
  hottestPlayer: InsightPlayer | null;
  teamFormRanking: InsightTeam[];
  attackRanking: InsightTeam[];
  defenseRanking: InsightTeam[];
  playerRanking: InsightPlayer[];
  interestingGames: InsightGame[];
}
