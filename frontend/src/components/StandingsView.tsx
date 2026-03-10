import React, { useState, useEffect } from 'react';
import { api, teamLogoUrl } from '../api';

export default function StandingsView({ season }: { season: string }) {
  const [standings, setStandings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setStandings(null);
    setError(null);
    api.getStandings(season)
      .then(setStandings)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [season]);

  if (loading) return (
    <>
      <div className="main-header"><h2>Classifica</h2></div>
      <div className="main-content"><div className="loading"><div className="spinner" /> Caricamento classifica...</div></div>
    </>
  );
  if (error) return (
    <>
      <div className="main-header"><h2>Classifica</h2></div>
      <div className="main-content"><div className="error-msg">{error}</div></div>
    </>
  );

  const all: any[] = standings?.Standings || [];
  const east = all.filter(t => t.Conference === 'East').sort((a, b) => a.PlayoffRank - b.PlayoffRank);
  const west = all.filter(t => t.Conference === 'West').sort((a, b) => a.PlayoffRank - b.PlayoffRank);

  return (
    <>
      <div className="main-header">
        <h2>Classifica</h2>
        <p>Stagione NBA {season}</p>
      </div>
      <div className="main-content">
        <div className="standings-grid">
          <ConferenceStandings label="Conference Est" teams={east} />
          <ConferenceStandings label="Conference Ovest" teams={west} />
        </div>
      </div>
    </>
  );
}

function ConferenceStandings({ label, teams }: { label: string; teams: any[] }) {
  return (
    <div className="conference-block">
      <h3>{label}</h3>
      <div className="stats-table-wrapper">
        <table className="stats-table">
          <thead>
            <tr>
              <th>#</th>
              <th colSpan={2}>Squadra</th>
              <th>V</th>
              <th>S</th>
              <th>%</th>
              <th>GB</th>
              <th>Serie</th>
              <th>U10</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t, i) => {
              const isPlayoff = i < 6;
              const isPlayIn = i >= 6 && i < 10;
              const rankColor = isPlayoff ? '#22c55e' : isPlayIn ? '#ffc107' : '#6b7280';
              const streakWin = String(t.strCurrentStreak ?? '').startsWith('W');
              return (
                <tr key={t.TeamID}>
                  <td>
                    <span style={{ color: rankColor, fontWeight: 700 }}>{i + 1}</span>
                  </td>
                  <td style={{ width: 26 }}>
                    <img
                      src={teamLogoUrl(t.TeamID)}
                      alt={t.TeamName}
                      style={{ width: 22, height: 22, objectFit: 'contain', verticalAlign: 'middle' }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </td>
                  <td className="highlight">{t.TeamCity} {t.TeamName}</td>
                  <td style={{ color: '#22c55e', fontWeight: 700 }}>{t.WINS}</td>
                  <td style={{ color: '#ef4444' }}>{t.LOSSES}</td>
                  <td>{t.WinPCT?.toFixed(3)}</td>
                  <td style={{ color: '#9ca3af' }}>{t.ConferenceGamesBack}</td>
                  <td style={{ color: streakWin ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                    {t.strCurrentStreak}
                  </td>
                  <td>{t.L10}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 8, display: 'flex', gap: 16, fontSize: 11, color: '#6b7280' }}>
        <span><span style={{ color: '#22c55e', fontWeight: 700 }}>■</span> Playoff (1-6)</span>
        <span><span style={{ color: '#ffc107', fontWeight: 700 }}>■</span> Play-In (7-10)</span>
      </div>
    </div>
  );
}
