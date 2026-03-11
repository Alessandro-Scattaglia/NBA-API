import { getCurrentSeason } from './season';

export const BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';
export const DEFAULT_SEASON = getCurrentSeason();
const DEFAULT_TIMEOUT_MS = 15000;

export const playerImageUrl = (playerId: number | string): string =>
  `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`;

export const teamLogoUrl = (teamId: number | string): string =>
  `https://cdn.nba.com/logos/nba/${teamId}/global/L/logo.svg`;

async function apiFetch<T = any>(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      const message = data?.error || data?.detail || data?.message || `HTTP ${res.status}`;
      throw new Error(String(message));
    }
    if (data?.error) throw new Error(String(data.error));
    return data as T;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Timeout richiesta API');
    }
    if (err instanceof TypeError) {
      throw new Error('Impossibile raggiungere il backend');
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

export const api = {
  getAllPlayers: () => apiFetch(`${BASE_URL}/players`),
  getPlayer: (id: number | string) => apiFetch(`${BASE_URL}/players/${id}`),
  getPlayerCareer: (id: number | string) => apiFetch(`${BASE_URL}/players/${id}/career`),
  getPlayerGameLog: (id: number | string, season = DEFAULT_SEASON) =>
    apiFetch(`${BASE_URL}/players/${id}/gamelog?season=${season}`),
  getShotChart: (id: number | string, season = DEFAULT_SEASON) =>
    apiFetch(`${BASE_URL}/players/${id}/shotchart?season=${season}`),

  getAllTeams: () => apiFetch(`${BASE_URL}/teams`),
  getTeam: (id: number | string, season = DEFAULT_SEASON) => apiFetch(`${BASE_URL}/teams/${id}?season=${season}`),
  getTeamRoster: (id: number | string, season = DEFAULT_SEASON) => apiFetch(`${BASE_URL}/teams/${id}/roster?season=${season}`),
  getTeamGameLog: (id: number | string, season = DEFAULT_SEASON) =>
    apiFetch(`${BASE_URL}/teams/${id}/gamelog?season=${season}`),

  getStandings: (season = DEFAULT_SEASON) =>
    apiFetch(`${BASE_URL}/league/standings?season=${season}`),
  getLeaders: (stat = 'PTS', season = DEFAULT_SEASON) =>
    apiFetch(`${BASE_URL}/league/leaders?stat=${stat}&season=${season}`),
  getTeamStats: (season = DEFAULT_SEASON) =>
    apiFetch(`${BASE_URL}/league/teamstats?season=${season}`),

  getScoreboard: (date: string) =>
    apiFetch(`${BASE_URL}/games/scoreboard?date=${date}`),
  getGameSummary: (gameId: string) =>
    apiFetch(`${BASE_URL}/games/${gameId}/summary`),
  getBoxScore: (gameId: string) =>
    apiFetch(`${BASE_URL}/games/${gameId}/boxscore`),
};
