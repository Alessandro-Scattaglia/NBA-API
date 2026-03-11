import React, { useState, useEffect } from 'react';
import { api, teamLogoUrl } from '../../api';
import './StandingsView.css';

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
        <PlayoffsInfo season={season} east={east} west={west} />
        <div className="standings-grid">
          <ConferenceStandings label="Conference Est" teams={east} />
          <ConferenceStandings label="Conference Ovest" teams={west} />
        </div>
      </div>
    </>
  );
}

function PlayoffsInfo({ season, east, west }: { season: string; east: any[]; west: any[] }) {
  // Deriva l'anno di fine stagione: se season è "2023-24" prendiamo il primo anno e +1
  const firstYear = Number(String(season).split('-')[0]);
  const endYear = Number.isFinite(firstYear) ? firstYear + 1 : season;

  const eastHasPlayIn = east.some(t => Number(t.PlayoffRank) >= 9);
  const westHasPlayIn = west.some(t => Number(t.PlayoffRank) >= 9);
  const eastCut = eastHasPlayIn ? 6 : 8;
  const westCut = westHasPlayIn ? 6 : 8;

  return (
    <div className="playoffs-info">
      <h3>Informazioni Playoff</h3>
      <p className="muted">Inizio previsto: metà aprile {endYear} (indicativo). La regular season termina normalmente a inizio/aprile; il Play-In e i Playoff seguono subito dopo.</p>
      <ul>
        <li>Formato: 8 squadre per conference qualificate ai Playoff via regular season.</li>
        <li>Se è attivo il Play-In: le posizioni 7-10 si contendono gli ultimi posti (vincitori accedono ai Playoff).</li>
        <li>Cut attuale: Est — prime {eastCut} qualificano direttamente{eastHasPlayIn ? ', posizioni 7-10 Play-In' : ''}; Ovest — prime {westCut} qualificano direttamente{westHasPlayIn ? ', posizioni 7-10 Play-In' : ''}.</li>
      </ul>
      <p className="muted" style={{ marginTop: 8 }}>Nota: date e formato possono variare di stagione in stagione. Questa è un'indicazione generica basata sulla stagione selezionata.</p>
    </div>
  );
}

function ConferenceStandings({ label, teams }: { label: string; teams: any[] }) {
  const ranked = teams
    .map((t, i) => ({ ...t, _rank: Number(t.PlayoffRank) > 0 ? Number(t.PlayoffRank) : i + 1 }))
    .sort((a, b) => a._rank - b._rank);
  const hasPlayIn = ranked.some(t => Number(t.PlayoffRank) >= 9);
  const playoffCut = hasPlayIn ? 6 : 8;
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
            {ranked.map((t, i) => {
              const isPlayoff = i < playoffCut;
              const isPlayIn = hasPlayIn && i >= playoffCut && i < 10;
              const rankColor = isPlayoff ? 'var(--badge-green-text)' : isPlayIn ? 'var(--gold)' : 'var(--text-subtle)';
              const streakWin = String(t.strCurrentStreak ?? '').startsWith('W');
              return (
                <tr key={t.TeamID}>
                  <td>
                    <span style={{ color: rankColor, fontWeight: 700 }}>{t._rank}</span>
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
                  <td style={{ color: 'var(--badge-green-text)', fontWeight: 700 }}>{t.WINS}</td>
                  <td style={{ color: 'var(--danger-text)' }}>{t.LOSSES}</td>
                  <td>{t.WinPCT?.toFixed(3)}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{t.ConferenceGamesBack}</td>
                  <td style={{ color: streakWin ? 'var(--badge-green-text)' : 'var(--danger-text)', fontWeight: 600 }}>
                    {t.strCurrentStreak}
                  </td>
                  <td>{t.L10}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 8, display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-subtle)' }}>
        <span>
          <span style={{ color: 'var(--badge-green-text)', fontWeight: 700 }}>■</span>{' '}
          Playoff (1-{playoffCut})
        </span>
        {hasPlayIn && (
          <span>
            <span style={{ color: 'var(--gold)', fontWeight: 700 }}>■</span>{' '}
            Play-In (7-10)
          </span>
        )}
      </div>
    </div>
  );
}
