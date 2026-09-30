import type { Conference } from "./common.js";
import type { GameSummary } from "./games.js";
import type { StandingsRow } from "./teams.js";

export interface PostseasonKeyDate {
  key: string;
  label: string;
  startDate: string;
  endDate: string | null;
  note: string | null;
}

export type PostseasonRound = "play-in" | "first-round" | "semifinals" | "conference-finals" | "finals";
export type PostseasonSeriesStatus = "scheduled" | "confirmed" | "awaiting-play-in";

export interface PostseasonSeries {
  conference: Conference;
  round: PostseasonRound;
  status: PostseasonSeriesStatus;
  label: string;
  seedHigh: number;
  seedLow: number;
  highSeedTeam: StandingsRow | null;
  lowSeedTeam: StandingsRow | null;
  note: string | null;
  games: GameSummary[];
}

export interface PostseasonConferenceSnapshot {
  conference: Conference;
  directSeeds: StandingsRow[];
  playInSeeds: StandingsRow[];
  outsidePicture: StandingsRow[];
  playInSeries: PostseasonSeries[];
  firstRoundSeries: PostseasonSeries[];
  semifinalsSeries: PostseasonSeries[];
  conferenceFinalsSeries: PostseasonSeries[];
}

export interface PlayoffsOverview {
  directQualifiedTeams: number;
  playInTeams: number;
  confirmedFirstRoundSeries: number;
  playInGamesScheduled: number;
  playoffGamesScheduled: number;
}
