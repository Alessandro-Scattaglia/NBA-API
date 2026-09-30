import type { Conference, PlayoffStatus } from "./common.js";
import type { GameSummary } from "./games.js";

export interface TeamIdentity {
  teamId: number;
  city: string;
  name: string;
  nickname: string;
  code: string;
  slug: string;
  conference: Conference;
  division: string;
  logo: string;
}

export interface TeamSummary extends TeamIdentity {
  wins: number;
  losses: number;
  winPct: number;
  gamesBehind: number;
  conferenceRank: number;
  homeRecord: string;
  awayRecord: string;
  lastTen: string;
  streak: string;
  playoffStatus: PlayoffStatus;
  clinchedPlayoff: boolean;
  clinchedDivision: boolean;
  clinchedConference: boolean;
}

export interface TeamRosterPlayer {
  playerId: number;
  fullName: string;
  position: string | null;
  jersey: string | null;
  height: string | null;
  weight: string | null;
  age: number | null;
  headshot: string;
}

export interface TeamSeasonStats {
  pointsPerGame: number;
  opponentPointsPerGame: number;
  reboundsPerGame: number;
  assistsPerGame: number;
  netRating: number | null;
  offensiveRating: number | null;
  defensiveRating: number | null;
  pace: number | null;
  fgPct: number | null;
  threePct: number | null;
}

export interface TeamDetail extends TeamSummary {
  arena: string | null;
  foundedYear: number | null;
  coaches: string[];
  stats: TeamSeasonStats | null;
  roster: TeamRosterPlayer[];
  recentGames: GameSummary[];
}

export interface StandingsRow extends TeamSummary {
  seed: number;
  gamesPlayed: number;
  remainingGames: number;
}

export interface TeamScoreLine {
  teamId: number;
  name: string;
  code: string;
  logo: string;
  score: number | null;
  record: string | null;
}
