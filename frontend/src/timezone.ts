export const NBA_TIMEZONE = 'America/New_York';
export const LOCAL_TIMEZONE =
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome';

export function todayInTimeZone(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
