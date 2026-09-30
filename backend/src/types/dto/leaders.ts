import type { TeamReference } from "./players.js";

export type LeaderCategoryKey = "points" | "rebounds" | "assists" | "steals" | "blocks" | "threesMade";

export interface LeaderRow {
  playerId: number;
  fullName: string;
  headshot: string;
  team: TeamReference | null;
  value: number;
  gamesPlayed: number;
}

export interface LeaderCategory {
  key: LeaderCategoryKey;
  label: string;
  leaders: LeaderRow[];
}
