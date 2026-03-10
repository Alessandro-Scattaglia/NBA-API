import React, { useState, useEffect } from 'react';
import { api, teamLogoUrl } from '../../api';
import './ScoreboardView.css';

interface Props {
  onSelectGame?: (gameId: string) => void;
}

function todayStr() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function timezoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
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

function formatStatusInItalian(status: string, dateIso: string): string {
  const clean = String(status || '').trim();
  if (!clean) return 'Stato non disponibile';

  const scheduled = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)\s*ET$/i);
  if (scheduled) {
    let hour = Number(scheduled[1]);
    const minute = Number(scheduled[2]);
    const ampm = scheduled[3].toUpperCase();
    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    const nyDate = dateInTimeZone(dateIso, hour, minute, 'America/New_York');
    const oraItalia = nyDate.toLocaleTimeString('it-IT', {
      timeZone: 'Europe/Rome',
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${oraItalia} (ora italiana)`;
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
    .replace(/\bET\b/i, 'ora costa est USA');
}

export default function ScoreboardView({ onSelectGame }: Props) {
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setData(null);
    setError(null);
    api.getScoreboard(date)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [date]);

  const gameHeaders: any[] = data?.GameHeader || [];
  const lineScore: any[] = data?.LineScore || [];

  const games = gameHeaders.map(g => ({
    ...g,
    teams: lineScore.filter(ls => ls.GAME_ID === g.GAME_ID),
  }));

  return (
    <>
      <div className="main-header">
        <h2>Calendario Partite</h2>
        <p>Partite NBA per data (ora italiana)</p>
      </div>
      <div className="main-content">
        <div className="scoreboard-date">
          <input
            type="date"
            className="date-input"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
          {!loading && games.length > 0 && (
            <span style={{ fontSize: 13, color: 'var(--text-subtle)' }}>{games.length} partite</span>
          )}
        </div>

        {loading && <div className="loading"><div className="spinner" /> Caricamento partite...</div>}
        {error && <div className="error-msg">{error}</div>}
        {!loading && !error && games.length === 0 && (
          <div className="empty-state">Nessuna partita trovata per questa data</div>
        )}

        <div className="game-cards-grid">
          {games.map(game => (
            <GameCard key={game.GAME_ID} game={game} date={date} onSelectGame={onSelectGame} />
          ))}
        </div>
      </div>
    </>
  );
}

function GameCard({ game, date, onSelectGame }: { game: any; date: string; onSelectGame?: (gameId: string) => void }) {
  const [t1, t2] = game.teams;
  if (!t1 || !t2) return null;

  const s1 = t1.PTS;
  const s2 = t2.PTS;
  const statusText = formatStatusInItalian(game.GAME_STATUS_TEXT, date);
  const isLive = /quarto|intervallo|supplementari/i.test(statusText);
  const statusColor = isLive ? 'var(--danger-text)' : 'var(--text-muted)';

  return (
    <div
      className="game-card"
      onClick={() => onSelectGame?.(game.GAME_ID)}
      style={{ cursor: onSelectGame ? 'pointer' : 'default' }}
    >
      <div className="game-card-status" style={{ color: statusColor }}>
        {statusText}
      </div>
      <div className="game-card-teams">
        <TeamRow team={t1} score={s1} isWinner={s1 != null && s2 != null && s1 > s2} />
        <div className="game-divider" />
        <TeamRow team={t2} score={s2} isWinner={s1 != null && s2 != null && s2 > s1} />
      </div>
    </div>
  );
}

function TeamRow({ team, score, isWinner }: { team: any; score: any; isWinner: boolean }) {
  return (
    <div className="game-team-row">
      <div className="game-team-info">
        <img
          src={teamLogoUrl(team.TEAM_ID)}
          alt={team.TEAM_ABBREVIATION}
          className="game-team-logo"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <span className="game-team-name">
          {team.TEAM_CITY_NAME} {team.TEAM_NICKNAME}
        </span>
      </div>
      <span
        className="game-team-score"
        style={{ opacity: score != null ? (isWinner ? 1 : 0.5) : 0.4 }}
      >
        {score ?? '-'}
      </span>
    </div>
  );
}
