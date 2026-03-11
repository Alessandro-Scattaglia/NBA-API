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

function formatPct(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num.toFixed(3) : '—';
}

function formatMetric(value: unknown, digits = 1) {
  if (value === null || value === undefined || value === '') return '—';
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num.toFixed(digits) : '—';
}

function pickTeamRow(rows: any[], team: any) {
  if (!team) return null;
  return rows.find((row: any) =>
    row?.TEAM_ID === team?.TEAM_ID ||
    row?.teamId === team?.TEAM_ID ||
    row?.TEAM_ABBREVIATION === team?.TEAM_ABBREVIATION ||
    row?.teamTricode === team?.TEAM_ABBREVIATION
  ) || null;
}

export default function GameDetailView({ gameId, onBack, onSelectPlayer }: Props) {
  const [summary, setSummary] = useState<any>(null);
  const [boxscore, setBoxscore] = useState<any>(null);
  const [playbyplay, setPlaybyplay] = useState<any>(null);
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab | 'insights'>('boxscore');

  useEffect(() => {
    setLoading(true);
    setError(null);
    setSummary(null);
    setBoxscore(null);
    setInsights(null);

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

  useEffect(() => {
    if (tab !== 'insights' || insights) return;
    let alive = true;
    api.getGameInsights(gameId)
      .then(res => { if (alive) setInsights(res); })
      .catch(() => { if (alive) setInsights({ error: true }); });
    return () => { alive = false; };
  }, [tab, gameId, insights]);

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
              <button className={`tab-btn ${tab === 'insights' ? 'active' : ''}`} onClick={() => setTab('insights')}>Approfondimenti</button>
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
                          <td>{formatPct(t.FG_PCT)}</td>
                          <td>{formatPct(t.FG3_PCT)}</td>
                          <td>{formatPct(t.FT_PCT)}</td>
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

            {tab === 'insights' && (
              <GameInsightsView data={insights} teamA={teamA} teamB={teamB} />
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

function GameInsightsView({ data, teamA, teamB }: { data: any; teamA: any; teamB: any }) {
  if (!data) return <div className="loading"><div className="spinner" />Caricamento approfondimenti...</div>;
  if (data?.error) return <div className="empty-state">Statistiche avanzate non disponibili per questa partita</div>;
  if (!data?.HasAnyData) return <div className="empty-state">Nessun approfondimento disponibile: boxscore e fonti supplementari non hanno restituito dati sufficienti</div>;

  const derivedA = pickTeamRow(data?.DerivedTeamStats || [], teamA);
  const derivedB = pickTeamRow(data?.DerivedTeamStats || [], teamB);
  const advancedA = pickTeamRow(data?.AdvancedTeamStats || [], teamA);
  const advancedB = pickTeamRow(data?.AdvancedTeamStats || [], teamB);
  const fourA = pickTeamRow(data?.FourFactorsTeamStats || [], teamA);
  const fourB = pickTeamRow(data?.FourFactorsTeamStats || [], teamB);
  const miscA = pickTeamRow(data?.MiscTeamStats || [], teamA);
  const miscB = pickTeamRow(data?.MiscTeamStats || [], teamB);
  const scoringA = pickTeamRow(data?.ScoringTeamStats || [], teamA);
  const scoringB = pickTeamRow(data?.ScoringTeamStats || [], teamB);
  const hustleA = pickTeamRow(data?.HustleTeamStats || [], teamA);
  const hustleB = pickTeamRow(data?.HustleTeamStats || [], teamB);
  const hasAdvancedExtras = Boolean(advancedA || advancedB || fourA || fourB || miscA || miscB || scoringA || scoringB || hustleA || hustleB);

  return (
    <div className="game-detail-grid">
      <InsightTable
        title="Efficienza Tiro"
        teamA={teamA}
        teamB={teamB}
        rowA={derivedA}
        rowB={derivedB}
        metrics={[
          ['FG%', 'FG_PCT', 3],
          ['3PT%', 'FG3_PCT', 3],
          ['FT%', 'FT_PCT', 3],
          ['eFG%', 'EFG_PCT', 3],
          ['TS%', 'TS_PCT', 3],
        ]}
      />
      <InsightTable
        title="Profilo Offensivo"
        teamA={teamA}
        teamB={teamB}
        rowA={derivedA}
        rowB={derivedB}
        metrics={[
          ['3PA Rate', 'FG3_RATE', 3],
          ['FTA Rate', 'FTA_RATE', 3],
          ['AST/TOV', 'AST_TOV', 2],
          ['Poss stimati', 'POSS_EST', 1],
          ['Off Rtg stim.', 'OFF_RATING_EST', 1],
        ]}
      />
      <InsightTable
        title="Controllo Partita"
        teamA={teamA}
        teamB={teamB}
        rowA={derivedA}
        rowB={derivedB}
        metrics={[
          ['OREB%', 'OREB_PCT', 3],
          ['DREB%', 'DREB_PCT', 3],
          ['Pace stimato', 'PACE_EST', 1],
          ['Def Rtg stim.', 'DEF_RATING_EST', 1],
          ['+/-', 'PLUS_MINUS', 0],
        ]}
      />
      <InsightTable
        title="Volume"
        teamA={teamA}
        teamB={teamB}
        rowA={derivedA}
        rowB={derivedB}
        metrics={[
          ['Punti', 'PTS', 0],
          ['Rimbalzi', 'REB', 0],
          ['Assist', 'AST', 0],
          ['Perse', 'TO', 0],
          ['Falli', 'PF', 0],
        ]}
      />
      {hasAdvancedExtras && (
        <>
      <InsightTable
        title="Advanced"
        teamA={teamA}
        teamB={teamB}
        rowA={advancedA}
        rowB={advancedB}
        metrics={[
          ['Off Rtg', 'OFF_RATING', 1],
          ['Def Rtg', 'DEF_RATING', 1],
          ['Net Rtg', 'NET_RATING', 1],
          ['Pace', 'PACE', 1],
          ['TS%', 'TS_PCT', 3],
          ['eFG%', 'EFG_PCT', 3],
          ['PIE', 'PIE', 3],
        ]}
      />
      <InsightTable
        title="Four Factors"
        teamA={teamA}
        teamB={teamB}
        rowA={fourA}
        rowB={fourB}
        metrics={[
          ['eFG%', 'EFG_PCT', 3],
          ['FTA Rate', 'FTA_RATE', 3],
          ['TOV%', 'TM_TOV_PCT', 3],
          ['OREB%', 'OREB_PCT', 3],
          ['Opp eFG%', 'OPP_EFG_PCT', 3],
        ]}
      />
      <InsightTable
        title="Scoring Profile"
        teamA={teamA}
        teamB={teamB}
        rowA={scoringA}
        rowB={scoringB}
        metrics={[
          ['FGA 2PT%', 'PCT_FGA_2PT', 3],
          ['FGA 3PT%', 'PCT_FGA_3PT', 3],
          ['Pts 3PT%', 'PCT_PTS_3PT', 3],
          ['Pts FB%', 'PCT_PTS_FB', 3],
          ['Pts Paint%', 'PCT_PTS_PAINT', 3],
        ]}
      />
      <InsightTable
        title="Misc"
        teamA={teamA}
        teamB={teamB}
        rowA={miscA}
        rowB={miscB}
        metrics={[
          ['Pts da TO', 'PTS_OFF_TOV', 0],
          ['Second Chance', 'PTS_2ND_CHANCE', 0],
          ['Fast Break', 'PTS_FB', 0],
          ['Paint', 'PTS_PAINT', 0],
          ['Falli Subiti', 'PFD', 0],
        ]}
      />
      <InsightTable
        title="Hustle"
        teamA={teamA}
        teamB={teamB}
        rowA={hustleA}
        rowB={hustleB}
        metrics={[
          ['Deflections', 'deflections', 0],
          ['Contested', 'contestedShots', 0],
          ['Screen Ast', 'screenAssists', 0],
          ['Loose Balls', 'looseBallsRecoveredTotal', 0],
          ['Box Outs', 'boxOuts', 0],
        ]}
      />
        </>
      )}
    </div>
  );
}

function InsightTable({
  title, teamA, teamB, rowA, rowB, metrics
}: {
  title: string;
  teamA: any;
  teamB: any;
  rowA: any;
  rowB: any;
  metrics: Array<[string, string, number]>;
}) {
  return (
    <div className="stats-table-wrapper">
      <table className="stats-table">
        <thead>
          <tr>
            <th>{title}</th>
            <th>{teamA?.TEAM_ABBREVIATION || 'A'}</th>
            <th>{teamB?.TEAM_ABBREVIATION || 'B'}</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map(([label, key, digits]) => (
            <tr key={`${title}-${key}`}>
              <td className="highlight">{label}</td>
              <td>{formatMetric(rowA?.[key], digits)}</td>
              <td>{formatMetric(rowB?.[key], digits)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
