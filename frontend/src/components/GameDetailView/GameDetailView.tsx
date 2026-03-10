import React, { useEffect, useState } from 'react';
import { api, teamLogoUrl } from '../../api';
import './GameDetailView.css';

interface Props {
  gameId: string;
  onBack: () => void;
  onSelectPlayer?: (id: number) => void;
}

function formatDateIt(value?: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Rome',
  });
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

function formatStatusInItalian(status?: string, gameDateEst?: string): string {
  const clean = String(status || '').trim();
  if (!clean) return 'Stato non disponibile';
  const dateIso = gameDateEst ? gameDateEst.slice(0, 10) : '';

  const scheduled = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)\s*ET$/i);
  if (scheduled && dateIso) {
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
    return `${oraItalia} (ora di Roma)`;
  }

  return clean
    .replace(/^Final$/i, 'Finale')
    .replace(/^Final OT$/i, 'Finale OT')
    .replace(/^Halftime$/i, 'Intervallo')
    .replace(/\bQ1\b/i, '1º quarto')
    .replace(/\bQ2\b/i, '2º quarto')
    .replace(/\bQ3\b/i, '3º quarto')
    .replace(/\bQ4\b/i, '4º quarto')
    .replace(/\bOT\b/i, 'Tempi supplementari');
}

export default function GameDetailView({ gameId, onBack, onSelectPlayer }: Props) {
  const [summary, setSummary] = useState<any>(null);
  const [boxscore, setBoxscore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setSummary(null);
    setBoxscore(null);

    Promise.allSettled([api.getGameSummary(gameId), api.getBoxScore(gameId)])
      .then(([summaryRes, boxRes]) => {
        if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value);
        if (boxRes.status === 'fulfilled') setBoxscore(boxRes.value);

        if (summaryRes.status === 'rejected' && boxRes.status === 'rejected') {
          setError('Impossibile caricare i dati della partita');
        }
      })
      .finally(() => setLoading(false));
  }, [gameId]);

  const lineScore: any[] = summary?.LineScore || [];
  const teamStats: any[] = boxscore?.TeamStats || [];
  const players: any[] = boxscore?.PlayerStats || [];
  const gameSummary = summary?.GameSummary?.[0];
  const statusText = formatStatusInItalian(gameSummary?.GAME_STATUS_TEXT, gameSummary?.GAME_DATE_EST);

  const teams = lineScore.length >= 2
    ? [lineScore[0], lineScore[1]]
    : teamStats.length >= 2
      ? [teamStats[0], teamStats[1]]
      : [];

  const [teamA, teamB] = teams;
  const playersA = players.filter(p => p.TEAM_ID === teamA?.TEAM_ID);
  const playersB = players.filter(p => p.TEAM_ID === teamB?.TEAM_ID);

  return (
    <>
      <div className="main-header">
        <button className="back-btn" onClick={onBack}>← Calendario</button>
        <h2>Dettaglio Partita</h2>
        <p>ID partita: {gameId}</p>
      </div>
      <div className="main-content">
        {loading && <div className="loading"><div className="spinner" /> Caricamento partita...</div>}
        {error && <div className="error-msg">{error}</div>}

        {!loading && !error && (
          <>
            <div className="game-detail-hero">
              <div className="game-detail-teams">
                <TeamBadge team={teamA} />
                <span className="game-detail-vs">VS</span>
                <TeamBadge team={teamB} />
              </div>
              <div className="game-detail-meta">
                <span>Data: {formatDateIt(gameSummary?.GAME_DATE_EST)}</span>
                <span>Stato: {statusText}</span>
              </div>
            </div>

            {!teamStats.length && (
              <div className="info-msg">
                Tabellino non disponibile: partita non iniziata oppure endpoint NBA temporaneamente non raggiungibile.
              </div>
            )}

            <div className="game-detail-grid">
              <div className="stats-table-wrapper">
                <table className="stats-table">
                  <thead>
                    <tr>
                      <th>Squadra</th>
                      <th>PTS</th>
                      <th>REB</th>
                      <th>AST</th>
                      <th>FG%</th>
                      <th>3P%</th>
                      <th>FT%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamStats.map((t: any) => (
                      <tr key={t.TEAM_ID}>
                        <td className="highlight">{t.TEAM_ABBREVIATION || t.TEAM_NAME}</td>
                        <td>{t.PTS}</td>
                        <td>{t.REB}</td>
                        <td>{t.AST}</td>
                        <td>{typeof t.FG_PCT === 'number' ? t.FG_PCT.toFixed(3) : '—'}</td>
                        <td>{typeof t.FG3_PCT === 'number' ? t.FG3_PCT.toFixed(3) : '—'}</td>
                        <td>{typeof t.FT_PCT === 'number' ? t.FT_PCT.toFixed(3) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <PlayersBox title={teamA?.TEAM_ABBREVIATION || 'Squadra A'} players={playersA} onSelectPlayer={onSelectPlayer} />
              <PlayersBox title={teamB?.TEAM_ABBREVIATION || 'Squadra B'} players={playersB} onSelectPlayer={onSelectPlayer} />
            </div>
          </>
        )}
      </div>
    </>
  );
}

function TeamBadge({ team }: { team: any }) {
  if (!team) return <div className="game-detail-team">—</div>;
  return (
    <div className="game-detail-team">
      <img
        src={teamLogoUrl(team.TEAM_ID)}
        alt={team.TEAM_ABBREVIATION || team.TEAM_NAME}
        className="game-detail-team-logo"
      />
      <div>{team.TEAM_ABBREVIATION || team.TEAM_NAME}</div>
      <div className="game-detail-team-score">{team.PTS ?? '—'}</div>
    </div>
  );
}

function PlayersBox({ title, players, onSelectPlayer }: { title: string; players: any[]; onSelectPlayer?: (id: number) => void }) {
  return (
    <div className="stats-table-wrapper">
      <table className="stats-table">
        <thead>
          <tr>
            <th colSpan={5}>{title}</th>
          </tr>
          <tr>
            <th>Giocatore</th>
            <th>MIN</th>
            <th>PTS</th>
            <th>REB</th>
            <th>AST</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p: any) => (
            <tr
              key={`${p.PLAYER_ID}-${title}`}
              onClick={() => onSelectPlayer?.(p.PLAYER_ID)}
              style={{ cursor: onSelectPlayer ? 'pointer' : 'default' }}
            >
              <td className="highlight">{p.PLAYER_NAME}</td>
              <td>{p.MIN}</td>
              <td>{p.PTS}</td>
              <td>{p.REB}</td>
              <td>{p.AST}</td>
            </tr>
          ))}
          {!players.length && (
            <tr>
              <td colSpan={5} style={{ color: 'var(--text-subtle)' }}>Statistiche giocatori non disponibili</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
