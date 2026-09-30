import type { GameDataAvailabilityStatus, GamePhase, GameStatus } from "./common.js";
import type { TeamScoreLine } from "./teams.js";

export interface GameSummary {
  gameId: string;
  gameCode: string | null;
  dateTimeUtc: string;
  dateLabel: string;
  status: GameStatus;
  statusText: string;
  phase: GamePhase;
  arena: string | null;
  nationalTv: string[];
  clock: string | null;
  period: number | null;
  homeTeam: TeamScoreLine;
  awayTeam: TeamScoreLine;
}

export interface GameLeader {
  playerId: number;
  fullName: string;
  teamId: number;
  points: number;
  rebounds: number;
  assists: number;
}

export interface GamePlayerLine {
  playerId: number;
  fullName: string;
  position: string | null;
  starter: boolean;
  minutes: string | null;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  plusMinus: number | null;
}

export interface GameDataAvailability {
  status: GameDataAvailabilityStatus;
  message: string | null;
}

export interface GameDetail {
  game: GameSummary;
  dataAvailability: GameDataAvailability;
  homeLeaders: GameLeader[];
  awayLeaders: GameLeader[];
  homePlayers: GamePlayerLine[];
  awayPlayers: GamePlayerLine[];
}