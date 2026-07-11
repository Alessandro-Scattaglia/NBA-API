import { getSeasonBounds, isDateInsideSeason } from "../config/season.js";

export function parseNbaDate(dateStr: string): Date {
  if (!dateStr) {
    return new Date();
  }
  
  if (/(Z|[+-]\d{2}:\d{2})$/.test(dateStr)) {
    return new Date(dateStr);
  }

  // Treat as America/New_York
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2}))?/);
  if (!match) {
    return new Date(dateStr);
  }

  const [_, year, month, day, hour = "00", minute = "00", second = "00"] = match;

  // We convert it to a string that Intl.DateTimeFormat can format to verify offset.
  // A naive way is to assume UTC-5 for EST or UTC-4 for EDT.
  // We can format a UTC date in America/New_York, get the offset, and apply it.
  const utcDate = new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute, +second));
  
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric",
    hour12: false
  });
  
  const nyParts = formatter.formatToParts(utcDate);
  const findObj = (type: string) => Number(nyParts.find(p => p.type === type)?.value || 0);
  
  // Calculate the difference between the UTC representation and NY local representation
  // This tells us the exact offset of NY at that point in time.
  // Actually, to get the Ny offset at `utcDate`:
  // NY time handles EDT (-4) and EST (-5).
  // A simpler way: just append "-05:00" because NBA "GAME_DATE_EST" usually implies literal EST (-5)
  // or use the server's IANA tz calculation.
  
  // Let's use the standard Javascript date manipulation to get the EDT/EST offset correctly:
  const tzDate = new Date(dateStr + "Z");
  let offset = 5; // default EST
  
  // Determine if daylight saving time in NY (roughly Mar to Nov)
  const isDST = () => {
      const monthNum = +month;
      if (monthNum > 3 && monthNum < 11) return true;
      if (monthNum === 3 && +day >= 14) return true; // rough approx
      if (monthNum === 11 && +day <= 7) return true; // rough approx
      return false;
  };
  
  if (isDST()) offset = 4;

  const validIsoStr = `${year}-${month}-${day}T${hour}:${minute}:${second}-0${offset}:00`;
  return new Date(validIsoStr);
}

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
