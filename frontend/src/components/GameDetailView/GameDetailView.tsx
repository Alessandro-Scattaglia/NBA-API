import React, { useEffect, useState } from 'react';
import { api, teamLogoUrl } from '../../api';
import { formatDateIt, formatGameStatusIt } from '../../formatting';
import { NBA_TIMEZONE, todayInTimeZone } from '../../timezone';
import './GameDetailView.css';

interface Props {
  gameId: string;
  onBack: () => void;
  onSelectPlayer?: (id: number) => void;
}

type Tab = 'boxscore' | 'playbyplay';

export default function GameDetailView({ gameId, onBack, onSelectPlayer }: Props) {
  const [summary, setSummary] = useState<any>(null);
  const [boxscore, setBoxscore] = useState<any>(null);
  const [playbyplay, setPlaybyplay] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('boxscore');

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

  useEffect(() => {
    if (tab !== 'playbyplay') return;
    let alive = true;
    let timer: any = null;

    const load = () => {
      api.getPlayByPlay(gameId)
        .then(res => { if (alive) setPlaybyplay(res); })
        .catch(() => { /* silenzia */ });
    };

    load();
    timer = setInterval(load, 12000);
    return () => { alive = false; if (timer) clearInterval(timer); };
  }, [tab, gameId]);

  const lineScore: any[] = summary?.LineScore || [];
  const teamStats: any[] = boxscore?.TeamStats || [];
  const players: any[] = boxscore?.PlayerStats || [];
  const gameSummary = summary?.GameSummary?.[0];
  const statusText = formatGameStatusIt(gameSummary?.GAME_STATUS_TEXT, gameSummary?.GAME_DATE_EST);
  const statusId = Number(gameSummary?.GAME_STATUS_ID);
  const gameDateIso = gameSummary?.GAME_DATE_EST?.slice(0, 10);
  const nbaToday = todayInTimeZone(NBA_TIMEZONE);
  const isPastDate = gameDateIso ? gameDateIso < nbaToday : false;
  const noBoxscoreMessage = (() => {
    if (statusId === 1) {
      if (isPastDate) {
        return 'Partita indicata come non iniziata nonostante la data passata: possibile rinvio o dati NBA non aggiornati.';
      }
      return 'Partita non iniziata: il tabellino sarà disponibile all’inizio del match.';
    }
    if (statusId === 2) return 'Partita in corso: il tabellino completo potrebbe non essere ancora disponibile.';
    if (statusId === 3) return 'Partita conclusa ma tabellino non ancora disponibile: dati NBA non aggiornati.';
    return 'Tabellino non disponibile: endpoint NBA temporaneamente non raggiungibile.';
  })();

  // Prefer teamStats for scores as they contain the final pts, fallback to lineScore
  const teams = teamStats.length >= 2
    ? [teamStats[0], teamStats[1]]
    : lineScore.length >= 2
      ? [lineScore[0], lineScore[1]]
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
                {noBoxscoreMessage}
              </div>
            )}

            <div className="tabs">
              <button className={`tab-btn ${tab === 'boxscore' ? 'active' : ''}`} onClick={() => setTab('boxscore')}>Tabellino</button>
              <button className={`tab-btn ${tab === 'playbyplay' ? 'active' : ''}`} onClick={() => setTab('playbyplay')}>Cronaca</button>
            </div>

            {tab === 'boxscore' && (
              <div className="game-detail-grid">
                <div className="stats-table-wrapper">
                  <table className="stats-table">
                    <thead>
                      <tr>
                        <th>Squadra</th>
                        <th>Punti</th>
                        <th>Rimbalzi</th>
                        <th>Assist</th>
                        <th>FG%</th>
                        <th>3PT%</th>
                        <th>TL%</th>
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
            )}

            {tab === 'playbyplay' && (
              <PlayByPlayTable data={playbyplay} />
            )}
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
            <th>Min</th>
            <th>Punti</th>
            <th>Rimbalzi</th>
            <th>Assist</th>
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
              <td>{p.MIN ? p.MIN.split(':')[0] : '0'} min</td>
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

function PlayByPlayTable({ data }: { data: any }) {
  if (!data) return <div className="loading"><div className="spinner" />Caricamento cronaca...</div>;
  const rows: any[] = data?.PlayByPlay || [];
  if (!rows.length) return <div className="empty-state">Nessun evento disponibile</div>;

  return (
    <div className="stats-table-wrapper">
      <table className="stats-table">
        <thead>
          <tr>
            <th>Periodo</th>
            <th>Tempo</th>
            <th>Descrizione</th>
            <th>Punteggio</th>
          </tr>
        </thead>
        <tbody>
          {[...rows].reverse().map((r: any, i: number) => (
            <tr key={i}>
              <td>{r.PERIOD ?? '—'}</td>
              <td>{r.PCTIMESTRING ?? '—'}</td>
              <td className="highlight">{r.HOMEDESCRIPTION || r.VISITORDESCRIPTION || r.NEUTRALDESCRIPTION || '—'}</td>
              <td>{r.SCORE ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
