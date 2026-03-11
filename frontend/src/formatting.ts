import { LOCAL_TIMEZONE } from './timezone';

const POSITION_LABELS: Record<string, string> = {
  PG: 'Playmaker',
  SG: 'Guardia tiratrice',
  SF: 'Ala piccola',
  PF: 'Ala grande',
  G: 'Guardia',
  F: 'Ala',
  C: 'Centro',
};

export function formatPositionIt(position?: string): string {
  const raw = String(position ?? '').trim();
  if (!raw) return '—';
  const normalized = raw.toUpperCase();
  const parts = normalized.split(/[-/]/).map(p => p.trim()).filter(Boolean);
  if (!parts.length) return raw;
  const labels = parts.map(p => POSITION_LABELS[p]).filter(Boolean);
  if (!labels.length) return raw;
  const labelText = labels.join('/');
  return `${raw} (${labelText})`;
}

export function formatDateIt(value?: string, timeZone: string = LOCAL_TIMEZONE): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone,
  });
}

export function formatIsoDateIt(value?: string): string {
  if (!value) return '—';
  const m = String(value).match(/^(\d{4})-?(\d{2})-?(\d{2})/);
  if (!m) return value;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function timezoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('it-IT', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return asUtc - date.getTime();
}

function dateInTimeZone(dateIso: string, hour: number, minute: number, timeZone: string): Date {
  let utc = Date.UTC(Number(dateIso.slice(0, 4)), Number(dateIso.slice(5, 7)) - 1, Number(dateIso.slice(8, 10)), hour, minute, 0);
  const first = new Date(utc);
  utc -= timezoneOffsetMs(first, timeZone);
  const second = new Date(utc);
  utc -= timezoneOffsetMs(second, timeZone);
  return new Date(utc);
}

export function formatGameStatusIt(status?: string, gameDateIso?: string): string {
  const clean = String(status || '').trim();
  if (!clean) return 'Stato non disponibile';
  const dateIso = gameDateIso ? gameDateIso.slice(0, 10) : '';

  const scheduled = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)\s*ET$/i);
  if (scheduled && dateIso) {
    let hour = Number(scheduled[1]);
    const minute = Number(scheduled[2]);
    const ampm = scheduled[3].toUpperCase();
    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    const nyDate = dateInTimeZone(dateIso, hour, minute, 'America/New_York');
    const oraLocale = nyDate.toLocaleTimeString('it-IT', {
      timeZone: LOCAL_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${oraLocale} (ora locale)`;
  }

  return clean
    .replace(/^Final$/i, 'Finale')
    .replace(/^Final OT$/i, 'Finale OT')
    .replace(/^Halftime$/i, 'Intervallo')
    .replace(/\bQ1\b/i, '1º quarto')
    .replace(/\bQ2\b/i, '2º quarto')
    .replace(/\bQ3\b/i, '3º quarto')
    .replace(/\bQ4\b/i, '4º quarto')
    .replace(/\bOT\b/i, 'Tempi supplementari')
    .replace(/\bET\b/i, 'ora di New York');
}
