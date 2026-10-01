import { z } from "zod";
import { getSeasonPhase, validateSeason } from "../config/season.js";

export const seasonQuerySchema = z.object({
  season: z.string().regex(/^\d{4}-\d{2}$/).optional()
});

export function requireValidSeason(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  const parsed = seasonQuerySchema.safeParse({ season: value });

  if (!parsed.success) {
    throw new Error("Season must use the format YYYY-YY.");
  }

  return validateSeason(parsed.data.season);
}

export function buildApiMeta(season: string, stale = false) {
  return {
    season,
    seasonPhase: getSeasonPhase(undefined, season),
    source: ["local"],
    fetchedAt: new Date().toISOString(),
    stale
  };
}
