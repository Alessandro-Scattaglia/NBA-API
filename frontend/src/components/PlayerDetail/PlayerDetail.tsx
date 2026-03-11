import React, { useState, useEffect } from 'react';
import { api, playerImageUrl } from '../../api';
import ShotChart from '../ShotChart/ShotChart';
import { formatDateIt, formatPositionIt } from '../../formatting';
import './PlayerDetail.css';

interface Props {
  playerId: number;
  onBack: () => void;
  season: string;
  onSelectPlayer?: (id: number) => void;
}

type Tab = 'overview' | 'career' | 'gamelog' | 'shotchart' | 'profile';

function feetInchesToCm(height?: string): string {
  if (!height) return '—';
  const [ftRaw, inRaw] = String(height).split('-');
  const ft = Number(ftRaw);
  const inch = Number(inRaw);
  if (Number.isNaN(ft) || Number.isNaN(inch)) return height;
  const cm = Math.round((ft * 12 + inch) * 2.54);
  return `${cm} cm`;
}

function poundsToKg(weight?: string | number): string {
  const lbs = Number(weight);
  if (Number.isNaN(lbs)) return String(weight ?? '—');
  const kg = Math.round(lbs * 0.45359237);
  return `${kg} kg`;
}

export default function PlayerDetail({ playerId, onBack, season: globalSeason }: Props) {
  const [info, setInfo] = useState<any>(null);
  const [career, setCareer] = useState<any>(null);
  const [gamelog, setGamelog] = useState<any>(null);
  const [shotchart, setShotchart] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [imgError, setImgError] = useState(false);
  const [season, setSeason] = useState(globalSeason);

  // Sync stagione globale dalla sidebar
  useEffect(() => {
    setSeason(globalSeason);
    setGamelog(null);
    setShotchart(null);
  }, [globalSeason]);

  // Carica bio + career sempre (career contiene tutte le stagioni)
  useEffect(() => {
    setLoading(true);
    setError(null);
    setInfo(null);
    setCareer(null);
    setImgError(false);
    Promise.all([
      api.getPlayer(playerId),
      api.getPlayerCareer(playerId),
    ])
      .then(([inf, car]) => { setInfo(inf); setCareer(car); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [playerId]);

  useEffect(() => {
    if (tab === 'gamelog') {
      setGamelog(null);
      api.getPlayerGameLog(playerId, season).then(setGamelog).catch(console.error);
    }
    if (tab === 'shotchart') {
      setShotchart(null);
      api.getShotChart(playerId, season).then(setShotchart).catch(console.error);
    }
    if (tab === 'profile') {
      setProfile(null);
      api.getPlayerProfile(playerId).then(setProfile).catch(console.error);
    }
  }, [tab, playerId, season]); // eslint-disable-line

  if (loading) return <div className="loading"><div className="spinner" /> Caricamento giocatore...</div>;
  if (error) return (
    <div className="main-content">
      <button className="back-btn" onClick={onBack}>← Indietro</button>
      <div className="error-msg">{error}</div>
    </div>
  );

  const pi = info?.CommonPlayerInfo?.[0];
  if (!pi) return null;

  // Totali della stagione selezionata → calcoliamo le medie per partita
  const allSeasons: any[] = career?.SeasonTotalsRegularSeason || [];
  const availableSeasons = allSeasons
    .map(row => String(row.SEASON_ID))
    .filter(Boolean)
    .filter((value, index, arr) => arr.indexOf(value) === index)
    .reverse();
  const seasonOptions = availableSeasons.length ? availableSeasons : [season];
  const seasonTotals = allSeasons.find(s => s.SEASON_ID === season) ?? null;
  const gp = seasonTotals?.GP || 1;
  const seasonStats = seasonTotals ? {
    ...seasonTotals,
    PTS: seasonTotals.PTS / gp,
    REB: seasonTotals.REB / gp,
    AST: seasonTotals.AST / gp,
    STL: seasonTotals.STL / gp,
    BLK: seasonTotals.BLK / gp,
    TOV: seasonTotals.TOV / gp,
    MIN: seasonTotals.MIN / gp,
    // FG_PCT, FG3_PCT, FT_PCT sono già percentuali, non si dividono
  } : null;

  return (
    <>
      <div className="main-header">
        <button className="back-btn" onClick={onBack}>← Giocatori</button>
        <h2>{pi.DISPLAY_FIRST_LAST}</h2>
        <p>{pi.TEAM_CITY} {pi.TEAM_NAME} · #{pi.JERSEY} · {formatPositionIt(pi.POSITION)}</p>
      </div>
      <div className="main-content">

        {/* Hero card */}
        <div className="player-detail-header">
          <div className="player-detail-photo">
            {!imgError ? (
              <img
                src={playerImageUrl(playerId)}
                alt={pi.DISPLAY_FIRST_LAST}
                onError={() => setImgError(true)}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52 }}>👤</div>
            )}
          </div>

          <div className="player-detail-bio">
            <div className="player-full-name">{pi.DISPLAY_FIRST_LAST}</div>
            <div className="player-team-name">{pi.TEAM_CITY} {pi.TEAM_NAME}</div>
            <div className="player-bio-grid">
              {pi.POSITION  && <BioItem label="Ruolo"     value={formatPositionIt(pi.POSITION)} />}
              {pi.HEIGHT    && <BioItem label="Altezza"   value={feetInchesToCm(pi.HEIGHT)} />}
              {pi.WEIGHT    && <BioItem label="Peso"      value={poundsToKg(pi.WEIGHT)} />}
              {pi.COUNTRY   && <BioItem label="Paese"     value={pi.COUNTRY} />}
              {pi.BIRTHDATE && <BioItem label="Anno"      value={new Date(pi.BIRTHDATE).getFullYear().toString()} />}
              {pi.SEASON_EXP !== undefined && <BioItem label="Esperienza" value={`${pi.SEASON_EXP} anni`} />}
              {pi.DRAFT_YEAR && <BioItem label="Draft" value={`${pi.DRAFT_YEAR} R${pi.DRAFT_ROUND} #${pi.DRAFT_NUMBER}`} />}
            </div>
          </div>

          {seasonStats ? (
            <div className="headline-stats">
              <div className="headline-stat">
                <span className="hs-value">{seasonStats.PTS?.toFixed(1)}</span>
                <span className="hs-label">PTI</span>
              </div>
              <div className="headline-stat">
                <span className="hs-value">{seasonStats.REB?.toFixed(1)}</span>
                <span className="hs-label">RIM</span>
              </div>
              <div className="headline-stat">
                <span className="hs-value">{seasonStats.AST?.toFixed(1)}</span>
                <span className="hs-label">AST</span>
              </div>
            </div>
          ) : (
            <div className="headline-stats">
              <div style={{ fontSize: 12, color: 'var(--text-subtle)', padding: '12px 16px' }}>Nessuna stat<br/>per {season}</div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="tabs">
          {(['overview', 'career', 'gamelog', 'shotchart', 'profile'] as Tab[]).map(t => (
            <button
              key={t}
              className={`tab-btn ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'overview' ? 'Panoramica'
                : t === 'career' ? 'Carriera'
                : t === 'gamelog' ? 'Registro Partite'
                : t === 'shotchart' ? 'Mappa Tiri'
                : 'Profilo'}
            </button>
          ))}
        </div>

        {/* Season selector */}
        {(tab === 'gamelog' || tab === 'shotchart') && (
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-subtle)' }}>Stagione:</span>
            <select
              value={season}
              onChange={e => setSeason(e.target.value)}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 10px', borderRadius: 6, fontSize: 13, outline: 'none' }}
            >
              {seasonOptions.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}

        {tab === 'overview'  && <OverviewTab seasonStats={seasonStats} season={season} />}
        {tab === 'career'    && <CareerTab career={career} />}
        {tab === 'gamelog'   && <GameLogTab gamelog={gamelog} />}
        {tab === 'shotchart' && <ShotChartTab shotchart={shotchart} />}
        {tab === 'profile'  && <ProfileTab profile={profile} />}
      </div>
    </>
  );
}

function BioItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bio-item">
      <span className="bio-label">{label}</span>
      <span className="bio-value">{value}</span>
    </div>
  );
}

function OverviewTab({ seasonStats, season }: { seasonStats: any; season: string }) {
  if (!seasonStats) return (
    <div className="empty-state">Nessuna statistica disponibile per la stagione {season}</div>
  );
  const stats = [
    { label: 'Punti',    value: seasonStats.PTS?.toFixed(1) },
    { label: 'Rimbalzi', value: seasonStats.REB?.toFixed(1) },
    { label: 'Assist',   value: seasonStats.AST?.toFixed(1) },
    { label: 'Rubate',   value: seasonStats.STL?.toFixed(1) },
    { label: 'Stoppate', value: seasonStats.BLK?.toFixed(1) },
    { label: 'Perse',    value: seasonStats.TOV?.toFixed(1) },
    { label: 'FG%',      value: seasonStats.FG_PCT?.toFixed(3) },
    { label: '3P%',      value: seasonStats.FG3_PCT?.toFixed(3) },
    { label: 'FT%',      value: seasonStats.FT_PCT?.toFixed(3) },
    { label: 'Partite',  value: seasonStats.GP },
    { label: 'Min/G',    value: seasonStats.MIN?.toFixed(1) },
  ];
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Media per partita · {season}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 12 }}>
        {stats.map(st => (
          <div key={st.label} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '18px 12px', textAlign: 'center'
          }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>{st.value ?? '—'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: 4 }}>{st.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CareerTab({ career }: { career: any }) {
  if (!career) return <div className="loading"><div className="spinner" />Caricamento carriera...</div>;
  const seasons = career?.SeasonTotalsRegularSeason || [];
  if (!seasons.length) return <div className="empty-state">Nessun dato carriera</div>;

  const cols = ['SEASON_ID', 'TEAM_ABBREVIATION', 'GP', 'MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'TOV', 'FG_PCT', 'FG3_PCT', 'FT_PCT'];
  const labels: Record<string, string> = {
    SEASON_ID: 'Stagione', TEAM_ABBREVIATION: 'Squadra', GP: 'GP', MIN: 'MIN',
    PTS: 'PTS', REB: 'REB', AST: 'AST', STL: 'STL', BLK: 'BLK',
    TOV: 'TOV', FG_PCT: 'FG%', FG3_PCT: '3P%', FT_PCT: 'FT%',
  };

  return (
    <div className="stats-table-wrapper">
      <table className="stats-table">
        <thead><tr>{cols.map(c => <th key={c}>{labels[c]}</th>)}</tr></thead>
        <tbody>
          {[...seasons].reverse().map((row: any, i: number) => (
            <tr key={i}>
              {cols.map(c => (
                <td key={c} className={['PTS', 'REB', 'AST'].includes(c) ? 'highlight' : ''}>
                  {typeof row[c] === 'number' && row[c] % 1 !== 0
                    ? row[c].toFixed(c.endsWith('PCT') ? 3 : 1)
                    : (row[c] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GameLogTab({ gamelog }: { gamelog: any }) {
  if (!gamelog) return <div className="loading"><div className="spinner" />Caricamento registro partite...</div>;
  const games = gamelog?.PlayerGameLog || [];
  if (!games.length) return <div className="empty-state">Nessuna partita trovata per questa stagione</div>;

  const cols = ['GAME_DATE', 'MATCHUP', 'WL', 'MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'TOV', 'FG_PCT', 'FG3_PCT', 'PLUS_MINUS'];
  const labels: Record<string, string> = {
    GAME_DATE: 'Data', MATCHUP: 'Partita', WL: 'V/S', MIN: 'MIN',
    PTS: 'PTS', REB: 'REB', AST: 'AST', STL: 'STL', BLK: 'BLK',
    TOV: 'TOV', FG_PCT: 'FG%', FG3_PCT: '3P%', PLUS_MINUS: '+/-',
  };

  return (
    <div className="stats-table-wrapper">
      <table className="stats-table">
        <thead><tr>{cols.map(c => <th key={c}>{labels[c]}</th>)}</tr></thead>
        <tbody>
          {games.map((row: any, i: number) => (
            <tr key={i}>
              {cols.map(c => {
                let color: string | undefined;
                if (c === 'WL') color = row[c] === 'W' ? 'var(--badge-green-text)' : 'var(--danger-text)';
                if (c === 'PLUS_MINUS') color = row[c] > 0 ? 'var(--badge-green-text)' : row[c] < 0 ? 'var(--danger-text)' : undefined;
                return (
                  <td key={c}
                    className={['PTS', 'REB', 'AST'].includes(c) ? 'highlight' : ''}
                    style={color ? { color, fontWeight: 700 } : undefined}
                  >
                    {c === 'GAME_DATE' ? formatDateIt(row[c])
                      : typeof row[c] === 'number' && row[c] % 1 !== 0
                        ? row[c].toFixed(c.endsWith('PCT') ? 3 : 1)
                        : (row[c] ?? '—')}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ShotChartTab({ shotchart }: { shotchart: any }) {
  if (!shotchart) return <div className="loading"><div className="spinner" />Caricamento mappa tiri...</div>;
  const shots = shotchart?.Shot_Chart_Detail || [];
  if (!shots.length) return <div className="empty-state">Nessun dato tiri per questa stagione</div>;
  return <ShotChart shots={shots} />;
}

function ProfileTab({ profile }: { profile: any }) {
  if (!profile) return <div className="loading"><div className="spinner" />Caricamento profilo...</div>;

  const ranking = profile?.SeasonRankingsRegularSeason?.[0];
  const career = profile?.CareerTotalsRegularSeason?.[0];

  const rankItems = ranking ? [
    ['Punti', ranking.PTS_PG ?? ranking.PTS],
    ['Rimbalzi', ranking.REB_PG ?? ranking.REB],
    ['Assist', ranking.AST_PG ?? ranking.AST],
    ['Rubate', ranking.STL_PG ?? ranking.STL],
    ['Stoppate', ranking.BLK_PG ?? ranking.BLK],
    ['FG%', ranking.FG_PCT],
    ['3P%', ranking.FG3_PCT],
    ['FT%', ranking.FT_PCT],
    ['Rank PTS', ranking.RANK_PTS],
    ['Rank REB', ranking.RANK_REB],
    ['Rank AST', ranking.RANK_AST],
    ['Rank STL', ranking.RANK_STL],
    ['Rank BLK', ranking.RANK_BLK],
  ].filter(([, v]) => v !== undefined && v !== null) : [];

  const careerItems = career ? [
    ['GP', career.GP],
    ['MIN', career.MIN],
    ['PTS', career.PTS],
    ['REB', career.REB],
    ['AST', career.AST],
    ['STL', career.STL],
    ['BLK', career.BLK],
    ['FG%', career.FG_PCT],
    ['3P%', career.FG3_PCT],
    ['FT%', career.FT_PCT],
  ].filter(([, v]) => v !== undefined && v !== null) : [];

  if (!rankItems.length && !careerItems.length) {
    return <div className="empty-state">Nessun dato profilo disponibile</div>;
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {!!rankItems.length && (
        <div className="stats-table-wrapper">
          <table className="stats-table">
            <thead>
              <tr>
                <th colSpan={2}>Ranking stagione (regular season)</th>
              </tr>
            </thead>
            <tbody>
              {rankItems.map(([label, value]) => (
                <tr key={label}>
                  <td className="highlight">{label}</td>
                  <td>{typeof value === 'number' && value % 1 !== 0 ? value.toFixed(3) : String(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!!careerItems.length && (
        <div className="stats-table-wrapper">
          <table className="stats-table">
            <thead>
              <tr>
                <th colSpan={2}>Totali carriera (regular season)</th>
              </tr>
            </thead>
            <tbody>
              {careerItems.map(([label, value]) => (
                <tr key={label}>
                  <td className="highlight">{label}</td>
                  <td>{typeof value === 'number' && value % 1 !== 0 ? value.toFixed(3) : String(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
