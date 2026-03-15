import { env } from "./env.js";

export const NBA_SEASON = env.nbaSeason;
export const SEASON_START_YEAR = Number(NBA_SEASON.slice(0, 4));
export const SEASON_END_YEAR = 2000 + Number(NBA_SEASON.slice(5, 7));
export const PLAYOFF_PICTURE_SEASON_ID = `2${SEASON_START_YEAR}`;
export const REGULAR_SEASON_LABEL = "Regular Season";

export const TTL = {
  live: 60_000,
  standings: 5 * 60_000,
  stats: 15 * 60_000,
  profile: 12 * 60 * 60_000,
  calendar: 6 * 60 * 60_000
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
