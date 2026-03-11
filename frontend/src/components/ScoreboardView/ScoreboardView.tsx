import React, { useState, useEffect } from 'react';
import { api, teamLogoUrl } from '../../api';
import { NBA_TIMEZONE, todayInTimeZone } from '../../timezone';
import { formatGameStatusIt, formatIsoDateIt } from '../../formatting';
import './ScoreboardView.css';

interface Props {
  onSelectGame?: (gameId: string) => void;
}

export default function ScoreboardView({ onSelectGame }: Props) {
  const [date, setDate] = useState(todayInTimeZone(NBA_TIMEZONE));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = todayInTimeZone(NBA_TIMEZONE);

  function addDaysIso(dateIso: string, delta: number): string {
    const [y, m, d] = dateIso.split('-').map(Number);
    const utc = Date.UTC(y, m - 1, d + delta);
    return new Date(utc).toISOString().slice(0, 10);
  }

  function addMonthsIso(dateIso: string, delta: number): string {
    const [y, m, d] = dateIso.split('-').map(Number);
    const year = y + Math.floor((m - 1 + delta) / 12);
    const monthIndex = (m - 1 + delta) % 12;
    const month = monthIndex < 0 ? monthIndex + 12 : monthIndex;
    const nextYear = monthIndex < 0 ? year - 1 : year;
    const targetYear = monthIndex < 0 ? nextYear : year;
    const daysInTargetMonth = new Date(Date.UTC(targetYear, month + 1, 0)).getUTCDate();
    const safeDay = Math.min(d, daysInTargetMonth);
    return new Date(Date.UTC(targetYear, month, safeDay)).toISOString().slice(0, 10);
  }

  function formatDayLabel(dateIso: string): string {
    const [y, m, d] = dateIso.split('-').map(Number);
    const utc = new Date(Date.UTC(y, m - 1, d));
    return utc.toLocaleDateString('it-IT', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      timeZone: 'UTC',
    });
  }

  function formatMonthLabel(dateIso: string): string {
    const [y, m, d] = dateIso.split('-').map(Number);
    const utc = new Date(Date.UTC(y, m - 1, d));
    return utc.toLocaleDateString('it-IT', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

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
        <p>Partite NBA per data (ora di New York) · orari convertiti in locale</p>
      </div>
      <div className="main-content">
        <div className="scoreboard-date">
          <div className="date-bar">
            <button
              className="date-shift-btn month"
              onClick={() => setDate(addMonthsIso(date, -1))}
              aria-label="Mese precedente"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19 5.5L12.5 12 19 18.5" />
                <path d="M11 5.5L4.5 12 11 18.5" />
              </svg>
            </button>
            <button
              className="date-shift-btn"
              onClick={() => setDate(addDaysIso(date, -1))}
              aria-label="Giorno precedente"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15.5 5.5L9 12l6.5 6.5" />
              </svg>
            </button>
            <div className="date-strip">
              {[-2, -1, 0, 1, 2].map(delta => {
                const d = addDaysIso(date, delta);
                const isActive = d === date;
                return (
                  <button
                    key={d}
                    className={`date-pill ${isActive ? 'active' : ''}`}
                    onClick={() => setDate(d)}
                    aria-current={isActive ? 'date' : undefined}
                  >
                    {formatDayLabel(d)}
                  </button>
                );
              })}
            </div>
            <button
              className="date-shift-btn"
              onClick={() => setDate(addDaysIso(date, 1))}
              aria-label="Giorno successivo"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8.5 5.5L15 12l-6.5 6.5" />
              </svg>
            </button>
            <button
              className="date-shift-btn month"
              onClick={() => setDate(addMonthsIso(date, 1))}
              aria-label="Mese successivo"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 5.5L11.5 12 5 18.5" />
                <path d="M13 5.5L19.5 12 13 18.5" />
              </svg>
            </button>
          </div>
          <div className="date-meta">
            <div className="date-sub">
              {formatIsoDateIt(date)} · {formatMonthLabel(date)} · data NBA (ora di New York)
            </div>
            <div className="date-actions">
              <button
                className="date-today-btn"
                onClick={() => setDate(today)}
                disabled={date === today}
              >
                Oggi
              </button>
              {!loading && (
                <span className="date-games-count">{games.length} partite</span>
              )}
            </div>
          </div>
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
  const statusText = formatGameStatusIt(game.GAME_STATUS_TEXT, date);
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
