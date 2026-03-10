import React, { useEffect, useState } from 'react';
import { api, teamLogoUrl } from '../api';

interface Props {
  season: string;
  onSelectTeam: (id: number) => void;
}

export default function TeamStatsView({ season, onSelectTeam }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setData(null);
    api.getTeamStats(season)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [season]);

  const rows: any[] = data?.LeagueDashTeamStats || [];

  return (
    <>
      <div className="main-header">
        <h2>Statistiche Squadre</h2>
        <p>Metriche principali per squadra · {season}</p>
      </div>
      <div className="main-content">
        {loading && <div className="loading"><div className="spinner" /> Caricamento statistiche squadre...</div>}
        {error && <div className="error-msg">{error}</div>}
        {!loading && !error && !rows.length && <div className="empty-state">Nessun dato disponibile</div>}

        {!!rows.length && (
          <div className="stats-table-wrapper">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th colSpan={2}>Squadra</th>
                  <th>V</th>
                  <th>S</th>
                  <th>PTS</th>
                  <th>REB</th>
                  <th>AST</th>
                  <th>FG%</th>
                  <th>3P%</th>
                  <th>Net Rt</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .sort((a, b) => (b.W_PCT ?? 0) - (a.W_PCT ?? 0))
                  .map((t, i) => (
                    <tr key={t.TEAM_ID} onClick={() => onSelectTeam(t.TEAM_ID)} style={{ cursor: 'pointer' }}>
                      <td>{i + 1}</td>
                      <td style={{ width: 28 }}>
                        <img
                          src={teamLogoUrl(t.TEAM_ID)}
                          alt={t.TEAM_NAME}
                          style={{ width: 22, height: 22, objectFit: 'contain' }}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      </td>
                      <td className="highlight">{t.TEAM_NAME}</td>
                      <td>{t.W}</td>
                      <td>{t.L}</td>
                      <td>{typeof t.PTS === 'number' ? t.PTS.toFixed(1) : '—'}</td>
                      <td>{typeof t.REB === 'number' ? t.REB.toFixed(1) : '—'}</td>
                      <td>{typeof t.AST === 'number' ? t.AST.toFixed(1) : '—'}</td>
                      <td>{typeof t.FG_PCT === 'number' ? t.FG_PCT.toFixed(3) : '—'}</td>
                      <td>{typeof t.FG3_PCT === 'number' ? t.FG3_PCT.toFixed(3) : '—'}</td>
                      <td>{typeof t.NET_RATING === 'number' ? t.NET_RATING.toFixed(1) : '—'}</td>
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
