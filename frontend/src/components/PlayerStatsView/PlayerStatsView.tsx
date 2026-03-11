import React, { useEffect, useMemo, useState } from 'react';
import { api, playerImageUrl } from '../../api';
import './PlayerStatsView.css';

interface Props {
  season: string;
  onSelectPlayer?: (id: number) => void;
}

const COLS = [
  'PLAYER_NAME', 'TEAM_ABBREVIATION', 'GP', 'MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'TOV', 'FG_PCT', 'FG3_PCT', 'FT_PCT',
];

const LABELS: Record<string, string> = {
  PLAYER_NAME: 'Giocatore',
  TEAM_ABBREVIATION: 'Squadra',
  GP: 'GP',
  MIN: 'MIN',
  PTS: 'PTS',
  REB: 'REB',
  AST: 'AST',
  STL: 'STL',
  BLK: 'BLK',
  TOV: 'TOV',
  FG_PCT: 'FG%',
  FG3_PCT: '3P%',
  FT_PCT: 'FT%',
};

export default function PlayerStatsView({ season, onSelectPlayer }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    setData(null);
    api.getLeaguePlayerStats(season)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [season]);

  const rows: any[] = data?.LeagueDashPlayerStats || [];
  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter(r => String(r.PLAYER_NAME || '').toLowerCase().includes(q));
  }, [rows, query]);

  return (
    <>
      <div className="main-header">
        <h2>Statistiche Giocatori</h2>
        <p>Stagione {season} · dati completi lega</p>
      </div>
      <div className="main-content">
        <div className="playerstats-toolbar">
          <div className="search-input-wrapper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              className="search-input"
              placeholder="Cerca giocatore..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          {query && (
            <span className="playerstats-count">{filtered.length} risultati</span>
          )}
        </div>

        {loading && <div className="loading"><div className="spinner" /> Caricamento statistiche giocatori...</div>}
        {error && <div className="error-msg">{error}</div>}
        {!loading && !error && !filtered.length && <div className="empty-state">Nessun dato disponibile</div>}

        {!loading && !error && !!filtered.length && (
          <div className="stats-table-wrapper">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th></th>
                  {COLS.map(c => <th key={c}>{LABELS[c]}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p: any, i: number) => (
                  <tr key={p.PLAYER_ID ?? i} onClick={() => onSelectPlayer?.(p.PLAYER_ID)} style={{ cursor: onSelectPlayer ? 'pointer' : 'default' }}>
                    <td>{i + 1}</td>
                    <td style={{ width: 28 }}>
                      <img
                        src={playerImageUrl(p.PLAYER_ID)}
                        alt={p.PLAYER_NAME}
                        style={{ width: 22, height: 22, objectFit: 'cover', borderRadius: '50%' }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </td>
                    {COLS.map(c => {
                      const val = p[c];
                      const formatted = typeof val === 'number'
                        ? val % 1 !== 0 ? val.toFixed(c.endsWith('PCT') ? 3 : 1) : String(val)
                        : String(val ?? '—');
                      return (
                        <td key={c} className={c === 'PLAYER_NAME' ? 'highlight' : ''}>
                          {formatted}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
