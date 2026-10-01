import { env } from "./env.js";

export type SeasonPhase = "preseason" | "regular-season" | "nba-cup" | "play-in" | "playoffs" | "offseason";

const seasonPattern = /^(\d{4})-(\d{2})$/;

export function validateSeason(value: string | undefined): string {
  const input = value?.trim();

  if (!input) {
    throw new Error("Season is required and must use the format YYYY-YY.");
  }

  const match = input.match(seasonPattern);

  if (!match) {
    throw new Error(`Season "${input}" is invalid. Expected format YYYY-YY such as 2026-27.`);
  }

  const startYear = Number(match[1]);
  const endYear = Number(match[2]);
  const expectedEnd = (startYear + 1) % 100;

  if (endYear !== expectedEnd) {
    throw new Error(`Season "${input}" is invalid. Expected the second part to match ${startYear + 1}.`);
  }

  return `${startYear}-${String(startYear + 1).slice(-2).padStart(2, "0")}`;
}

export function inferSeasonFromDate(date = new Date()): string {
  const currentDate = new Date(date);
  const year = currentDate.getUTCFullYear();
  const month = currentDate.getUTCMonth() + 1;
  const startYear = month >= 9 ? year : year - 1;

  return `${startYear}-${String(startYear + 1).slice(-2).padStart(2, "0")}`;
}

export function resolveSeason(date = new Date(), override = process.env.NBA_SEASON): string {
  if (override && override.trim()) {
    return validateSeason(override);
  }

  return inferSeasonFromDate(date);
}

export function getSeasonPhase(date = new Date(), season = resolveSeason(date)): SeasonPhase {
  const currentDate = new Date(date);
  const seasonStartYear = Number(season.slice(0, 4));
  const preseasonStart = new Date(Date.UTC(seasonStartYear, 8, 1));
  const regularSeasonStart = new Date(Date.UTC(seasonStartYear, 9, 1));
  const nbaCupStart = new Date(Date.UTC(seasonStartYear, 10, 1));
  const playInStart = new Date(Date.UTC(seasonStartYear + 1, 3, 10));
  const playoffsStart = new Date(Date.UTC(seasonStartYear + 1, 3, 15));
  const offseasonStart = new Date(Date.UTC(seasonStartYear + 1, 6, 1));

  if (currentDate >= preseasonStart && currentDate < regularSeasonStart) {
    return "preseason";
  }

  if (currentDate >= regularSeasonStart && currentDate < nbaCupStart) {
    return "regular-season";
  }

  if (currentDate >= nbaCupStart && currentDate < playInStart) {
    return "nba-cup";
  }

  if (currentDate >= playInStart && currentDate < playoffsStart) {
    return "play-in";
  }

  if (currentDate >= playoffsStart && currentDate < offseasonStart) {
    return "playoffs";
  }

  return "offseason";
}

export const NBA_SEASON = resolveSeason();
export const SEASON_START_YEAR = Number(NBA_SEASON.slice(0, 4));
export const SEASON_END_YEAR = Number(NBA_SEASON.slice(5, 7)) + 2000;
export const PLAYOFF_PICTURE_SEASON_ID = `2${SEASON_START_YEAR}`;
export const REGULAR_SEASON_LABEL = "Regular Season";
export const SEASON_START_DATE = `${SEASON_START_YEAR}-10-01`;
export const SEASON_END_DATE = `${SEASON_END_YEAR}-07-31`;
const PLAY_IN_START = new Date(Date.UTC(SEASON_END_YEAR, 3, 14));

export const TTL = {
  live: 30_000,
  standings: 2 * 60_000,
  stats: 10 * 60_000,
  profile: 12 * 60 * 60_000,
  calendar: 10 * 60_000
} as const;

export function getSeasonBounds() {
  return {
    start: new Date(Date.UTC(SEASON_START_YEAR, 9, 1)),
    end: new Date(Date.UTC(SEASON_END_YEAR, 6, 31))
  };
}

export function isDateInsideSeason(date: Date) {
  const { start, end } = getSeasonBounds();
  return date >= start && date <= end;
}

export function getHomeSpotlightMode(date = new Date()) {
  return date >= PLAY_IN_START ? "playoffs" : "standings";
}
