export function getCurrentSeason(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const startYear = month >= 10 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(2)}`;
}

export function buildSeasons(current: string, count = 8): string[] {
  const startYear = Number(current.split('-')[0]);
  if (!Number.isFinite(startYear)) return [current];
  const seasons: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const y = startYear - i;
    seasons.push(`${y}-${String(y + 1).slice(2)}`);
  }
  return seasons;
}
