import { getSeasonBounds, isDateInsideSeason } from "../config/season.js";

export function toIsoDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

export function toScoreboardDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${month}/${day}/${year}`;
}

export function enumerateDates(from: string, to: string) {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  const dates: string[] = [];

  for (let cursor = start; cursor <= end; cursor = new Date(cursor.getTime() + 86_400_000)) {
    if (isDateInsideSeason(cursor)) {
      dates.push(toIsoDate(cursor));
    }
  }

  return dates;
}

export function clampToSeason(from?: string, to?: string) {
  const bounds = getSeasonBounds();
  const start = from ? new Date(`${from}T00:00:00.000Z`) : bounds.start;
  const end = to ? new Date(`${to}T00:00:00.000Z`) : new Date();

  const clampedStart = start < bounds.start ? bounds.start : start;
  const clampedEnd = end > bounds.end ? bounds.end : end;

  return {
    from: toIsoDate(clampedStart),
    to: toIsoDate(clampedEnd)
  };
}

export function safeNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

export function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function calculateAge(value: string | null) {
  if (!value) {
    return null;
  }

  const birthDate = new Date(value);
  if (Number.isNaN(birthDate.getTime())) {
    return null;
  }

  const diff = Date.now() - birthDate.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}
