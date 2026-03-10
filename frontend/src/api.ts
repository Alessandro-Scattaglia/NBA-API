export const BASE_URL = 'http://localhost:5000/api';

export const playerImageUrl = (playerId: number | string): string =>
  `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`;

export const teamLogoUrl = (teamId: number | string): string =>
  `https://cdn.nba.com/logos/nba/${teamId}/global/L/logo.svg`;

async function apiFetch<T = any>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data as T;
}

export const api = {
  getAllPlayers: () => apiFetch(`${BASE_URL}/players`),
  getPlayer: (id: number | string) => apiFetch(`${BASE_URL}/players/${id}`),
  getPlayerCareer: (id: number | string) => apiFetch(`${BASE_URL}/players/${id}/career`),
  getPlayerGameLog: (id: number | string, season = '2025-26') =>
    apiFetch(`${BASE_URL}/players/${id}/gamelog?season=${season}`),
  getShotChart: (id: number | string, season = '2025-26') =>
    apiFetch(`${BASE_URL}/players/${id}/shotchart?season=${season}`),

  getAllTeams: () => apiFetch(`${BASE_URL}/teams`),
  getTeam: (id: number | string, season = '2025-26') => apiFetch(`${BASE_URL}/teams/${id}?season=${season}`),
  getTeamRoster: (id: number | string, season = '2025-26') => apiFetch(`${BASE_URL}/teams/${id}/roster?season=${season}`),
  getTeamGameLog: (id: number | string, season = '2025-26') =>
    apiFetch(`${BASE_URL}/teams/${id}/gamelog?season=${season}`),

  getStandings: (season = '2025-26') =>
    apiFetch(`${BASE_URL}/league/standings?season=${season}`),
  getLeaders: (stat = 'PTS', season = '2025-26') =>
    apiFetch(`${BASE_URL}/league/leaders?stat=${stat}&season=${season}`),
  getTeamStats: (season = '2025-26') =>
    apiFetch(`${BASE_URL}/league/teamstats?season=${season}`),

  getScoreboard: (date: string) =>
    apiFetch(`${BASE_URL}/games/scoreboard?date=${date}`),
  getGameSummary: (gameId: string) =>
    apiFetch(`${BASE_URL}/games/${gameId}/summary`),
  getBoxScore: (gameId: string) =>
    apiFetch(`${BASE_URL}/games/${gameId}/boxscore`),
};
