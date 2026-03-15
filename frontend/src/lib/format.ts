import type { GamePhase, GameStatus, GameSummary, PlayoffStatus } from "./types";

const LOCALE = "it-IT";
const ROME_TIMEZONE = "Europe/Rome";

function asDate(value: string) {
  return new Date(value);
}

function formatWithOptions(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: ROME_TIMEZONE,
    ...options
  }).format(asDate(value));
}

function translateRawGameText(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (/^w$/i.test(trimmed)) {
    return "Vittoria";
  }

  if (/^l$/i.test(trimmed)) {
    return "Sconfitta";
  }

  if (/^halftime$/i.test(trimmed)) {
    return "Intervallo";
  }

  if (/^live$/i.test(trimmed)) {
    return "In diretta";
  }

  if (/^ppd$/i.test(trimmed)) {
    return "Rinviata";
  }

  return trimmed
    .replace(/^Finale/i, "Finita")
    .replace(/^Final/i, "Finita")
    .replace(/^(\d)(?:st|nd|rd|th)\s+Qtr$/i, "$1° quarto")
    .replace(/^End of (\d)(?:st|nd|rd|th)\s+Qtr$/i, "Fine $1° quarto")
    .replace(/^(\d)(?:st|nd|rd|th)\s+Half$/i, "$1° tempo");
}

export function formatDateTime(value: string) {
  return formatWithOptions(value, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export function formatGameDateLabel(game: Pick<GameSummary, "dateTimeUtc">) {
  const date = asDate(game.dateTimeUtc);

  if (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  ) {
    return formatDate(game.dateTimeUtc);
  }

  return formatDateTime(game.dateTimeUtc);
}

export function formatDate(value: string) {
  return formatWithOptions(value, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

export function formatDateTimeWithSeconds(value: string) {
  return formatWithOptions(value, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

export function formatTime(value: string) {
  return formatWithOptions(value, {
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function formatPercentage(value: number) {
  return `${value.toFixed(3).replace(/^0/, "")}`;
}

export function formatStatusLabel(status: GameStatus) {
  if (status === "live") {
    return "In diretta";
  }

  if (status === "final") {
    return "Finita";
  }

  return "In programma";
}

export function formatPlayoffStatus(status: PlayoffStatus) {
  if (status === "playoff") {
    return "Playoff";
  }

  if (status === "play-in") {
    return "Play-In";
  }

  if (status === "eliminated") {
    return "Eliminata";
  }

  return "In corsa";
}

export function formatGamePhase(phase: GamePhase) {
  if (phase === "preseason") {
    return "Precampionato";
  }

  if (phase === "regular-season") {
    return "Stagione regolare";
  }

  if (phase === "play-in") {
    return "Play-In";
  }

  if (phase === "playoffs") {
    return "Playoff";
  }

  return "Altro";
}

export function formatConference(conference: "East" | "West", extended = false) {
  if (extended) {
    return conference === "East" ? "Conference Est" : "Conference Ovest";
  }

  return conference === "East" ? "Est" : "Ovest";
}

export function formatDivision(division: string) {
  const normalized = division.trim().toLowerCase();

  if (normalized === "atlantic") {
    return "Atlantico";
  }

  if (normalized === "central") {
    return "Centrale";
  }

  if (normalized === "southeast") {
    return "Sud-Est";
  }

  if (normalized === "pacific") {
    return "Pacifico";
  }

  if (normalized === "northwest") {
    return "Nord-Ovest";
  }

  if (normalized === "southwest") {
    return "Sud-Ovest";
  }

  return division;
}

export function formatPosition(position: string | null | undefined) {
  if (!position) {
    return "--";
  }

  return position
    .split(/[-/]/)
    .map((token) => token.trim().toUpperCase())
    .filter(Boolean)
    .map((token) => {
      if (token === "G" || token === "GUARD") {
        return "Guardia";
      }

      if (token === "F" || token === "FORWARD") {
        return "Ala";
      }

      if (token === "C" || token === "CENTER") {
        return "Centro";
      }

      return token;
    })
    .join(" / ");
}

export function formatHeight(height: string | null | undefined) {
  if (!height) {
    return "--";
  }

  const trimmed = height.trim();

  if (/cm$/i.test(trimmed)) {
    return trimmed.replace(/\s*cm$/i, " cm");
  }

  const imperialMatch =
    trimmed.match(/^(\d+)\s*-\s*(\d+)$/) ??
    trimmed.match(/^(\d+)\s*'\s*(\d+)(?:\"|$)/) ??
    trimmed.match(/^(\d+)\s+(\d+)$/);

  if (imperialMatch) {
    const feet = Number(imperialMatch[1]);
    const inches = Number(imperialMatch[2]);
    const centimeters = Math.round((feet * 12 + inches) * 2.54);
    return `${centimeters} cm`;
  }

  const numeric = Number(trimmed.replace(",", "."));
  if (Number.isFinite(numeric) && numeric > 100) {
    return `${Math.round(numeric)} cm`;
  }

  return trimmed;
}

export function formatWeight(weight: string | null | undefined) {
  if (!weight) {
    return "--";
  }

  const trimmed = weight.trim();

  if (/kg$/i.test(trimmed)) {
    return trimmed.replace(/\s*kg$/i, " kg");
  }

  const numeric = Number(trimmed.replace(/[^\d.,-]/g, "").replace(",", "."));
  if (!Number.isFinite(numeric)) {
    return trimmed;
  }

  const kilograms = /lb|lbs|pounds?/i.test(trimmed) || /^[\d.,]+$/.test(trimmed) ? Math.round(numeric * 0.45359237) : Math.round(numeric);
  return `${kilograms} kg`;
}

export function formatExperience(experience: string | null | undefined) {
  if (!experience) {
    return "--";
  }

  if (/^r$/i.test(experience.trim())) {
    return "Esordiente";
  }

  const years = Number(experience);
  if (Number.isFinite(years)) {
    return years === 1 ? "1 stagione" : `${years} stagioni`;
  }

  return experience;
}

export function formatDraft(draft: string | null | undefined) {
  if (!draft) {
    return "--";
  }

  return draft.replace(/\bRound\b/gi, "Giro").replace(/\bPick\b/gi, "Scelta");
}

export function formatMatchup(matchup: string) {
  return matchup.replace(/\s+vs\.\s+/i, " contro ").replace(/\s+@\s+/i, " a ");
}

export function formatGameStatusText(game: Pick<GameSummary, "status" | "statusText" | "dateTimeUtc" | "clock">) {
  if (game.status === "scheduled") {
    return `Ore ${formatTime(game.dateTimeUtc)}`;
  }

  if (game.status === "live") {
    const translated = translateRawGameText(game.statusText) || "In diretta";
    return game.clock ? `${translated} · ${game.clock}` : translated;
  }

  return translateRawGameText(game.statusText) || "Finita";
}

export function formatVenue(arena: string | null | undefined) {
  return arena?.trim() ? arena : "Sede non disponibile";
}

export function formatNumber(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }

  return value.toFixed(digits);
}

export function groupGamesByMonth<T extends { dateTimeUtc: string }>(games: T[]) {
  return games.reduce<Record<string, T[]>>((groups, game) => {
    const key = new Intl.DateTimeFormat(LOCALE, {
      timeZone: ROME_TIMEZONE,
      month: "long",
      year: "numeric"
    }).format(new Date(game.dateTimeUtc));

    groups[key] ??= [];
    groups[key].push(game);
    return groups;
  }, {});
}
