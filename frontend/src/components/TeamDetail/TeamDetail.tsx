import React, { useState, useEffect } from 'react';
import { api, teamLogoUrl, playerImageUrl } from '../../api';
import './TeamDetail.css';

interface Props {
  teamId: number;
  onBack: () => void;
  season: string;
  onSelectPlayer?: (id: number) => void;
}

type Tab = 'roster' | 'gamelog';

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

function formatDateIt(value?: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' });
}

export default function TeamDetail({ teamId, onBack, season, onSelectPlayer }: Props) {
  const [teamInfo, setTeamInfo] = useState<any>(null);
  const [roster, setRoster] = useState<any>(null);
  const [gamelog, setGamelog] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('roster');
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setLogoError(false);
    setGamelog(null);

    Promise.allSettled([
      api.getTeam(teamId, season),
      api.getTeamRoster(teamId, season),
      api.getAllTeams(),
    ])
      .then(([teamRes, rosterRes, teamsRes]) => {
        let resolvedTeamInfo: any = null;
        let resolvedRoster: any = { CommonTeamRoster: [] };

        if (teamRes.status === 'fulfilled') {
          resolvedTeamInfo = teamRes.value;
        }

        if (rosterRes.status === 'fulfilled') {
          resolvedRoster = rosterRes.value;
        }

        if (!resolvedTeamInfo && teamsRes.status === 'fulfilled' && Array.isArray(teamsRes.value)) {
          const fallbackTeam = teamsRes.value.find((t: any) => t.id === teamId);
          if (fallbackTeam) {
            resolvedTeamInfo = {
              TeamInfoCommon: [{
                TEAM_ID: fallbackTeam.id,
                TEAM_CITY: fallbackTeam.city,
                TEAM_NAME: fallbackTeam.nickname,
                TEAM_ABBREVIATION: fallbackTeam.abbreviation,
                TEAM_CONFERENCE: fallbackTeam.conference || undefined,
                TEAM_DIVISION: fallbackTeam.division || undefined,
              }],
            };
          }
        }

        if (!resolvedTeamInfo) {
          const teamErr = teamRes.status === 'rejected' ? teamRes.reason?.message || 'Errore squadra' : 'Squadra non trovata';
          const rosterErr = rosterRes.status === 'rejected' ? rosterRes.reason?.message || 'Errore rosa' : null;
          setError(rosterErr ? `${teamErr} | ${rosterErr}` : teamErr);
          return;
        }

        setTeamInfo(resolvedTeamInfo);
        setRoster(resolvedRoster);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [teamId, season]);

  useEffect(() => {
    if (tab === 'gamelog') {
      setGamelog(null);
      api.getTeamGameLog(teamId, season).then(setGamelog).catch(console.error);
    }
  }, [tab, teamId, season]); // eslint-disable-line

  if (loading) return <div className="loading"><div className="spinner" /> Caricamento squadra...</div>;
  if (error) return (
    <div className="main-content">
      <button className="back-btn" onClick={onBack}>← Indietro</button>
      <div className="error-msg">{error}</div>
    </div>
  );

  const info = teamInfo?.TeamInfoCommon?.[0];
  const rosterPlayers = roster?.CommonTeamRoster || [];

  return (
    <>
      <div className="main-header">
        <button className="back-btn" onClick={onBack}>← Squadre</button>
        <h2>{info?.TEAM_CITY} {info?.TEAM_NAME}</h2>
        <p>{info?.TEAM_CONFERENCE ? `Conferenza ${info.TEAM_CONFERENCE === 'East' ? 'Est' : 'Ovest'}` : 'Conferenza'} · {info?.TEAM_DIVISION}</p>
      </div>
      <div className="main-content">

        {/* Hero */}
        <div className="team-detail-header">
          {!logoError ? (
            <img
              src={teamLogoUrl(teamId)}
              alt={info?.TEAM_NAME}
              className="team-detail-logo"
              onError={() => setLogoError(true)}
            />
          ) : (
            <div className="team-card-logo-fallback" style={{ width: 100, height: 100, fontSize: 26 }}>
              {info?.TEAM_ABBREVIATION}
            </div>
          )}
          <div className="team-detail-info">
            <h2>{info?.TEAM_CITY} {info?.TEAM_NAME}</h2>
            <p>{info?.TEAM_CONFERENCE ? `Conferenza ${info.TEAM_CONFERENCE === 'East' ? 'Est' : 'Ovest'}` : 'Conferenza'} · {info?.TEAM_DIVISION}</p>
            {info?.W !== undefined && (
              <p style={{ marginTop: 8, fontSize: 16 }}>
                <span style={{ color: 'var(--badge-green-text)', fontWeight: 700 }}>{info.W}V</span>
                {' - '}
                <span style={{ color: 'var(--danger-text)', fontWeight: 700 }}>{info.L}S</span>
                {info.PCT !== undefined && (
                  <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
                    {(info.PCT * 100).toFixed(1)}%
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button className={`tab-btn ${tab === 'roster' ? 'active' : ''}`} onClick={() => setTab('roster')}>Rosa</button>
          <button className={`tab-btn ${tab === 'gamelog' ? 'active' : ''}`} onClick={() => setTab('gamelog')}>Registro Partite</button>
        </div>

        {tab === 'roster' && (
          <div className="stats-table-wrapper">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th colSpan={2}>Giocatore</th>
                  <th>Ruolo</th>
                  <th>Altezza</th>
                  <th>Peso</th>
                  <th>Età</th>
                  <th>Esperienza</th>
                </tr>
              </thead>
              <tbody>
                {rosterPlayers.map((p: any) => (
                  <tr
                    key={p.PLAYER_ID}
                    style={{ cursor: onSelectPlayer ? 'pointer' : 'default' }}
                    onClick={() => onSelectPlayer?.(p.PLAYER_ID)}
                  >
                    <td style={{ color: 'var(--text-subtle)' }}>{p.NUM}</td>
                    <td style={{ width: 32 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', background: 'var(--surface-3)' }}>
                        <img
                          src={playerImageUrl(p.PLAYER_ID)}
                          alt={p.PLAYER}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      </div>
                    </td>
                    <td className="highlight">{p.PLAYER}</td>
                    <td>{p.POSITION}</td>
                    <td>{feetInchesToCm(p.HEIGHT)}</td>
                    <td>{poundsToKg(p.WEIGHT)}</td>
                    <td>{p.AGE}</td>
                    <td>
                      {p.EXP === 'R'
                        ? <span className="badge badge-green">Esordiente</span>
                        : `${p.EXP} ann`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'gamelog' && (
          !gamelog
            ? <div className="loading"><div className="spinner" />Caricamento...</div>
            : (
              <div className="stats-table-wrapper">
                <table className="stats-table">
                  <thead>
                    <tr>
                      {['Data', 'Partita', 'V/S', 'PTS', 'REB', 'AST', 'FG%', '+/-'].map(h => <th key={h}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {(gamelog?.TeamGameLog || []).map((g: any, i: number) => (
                      <tr key={i}>
                        <td>{formatDateIt(g.GAME_DATE)}</td>
                        <td>{g.MATCHUP}</td>
                        <td style={{ color: g.WL === 'W' ? 'var(--badge-green-text)' : 'var(--danger-text)', fontWeight: 700 }}>{g.WL}</td>
                        <td className="highlight">{g.PTS}</td>
                        <td>{g.REB}</td>
                        <td>{g.AST}</td>
                        <td>{g.FG_PCT?.toFixed(3)}</td>
                        <td style={{ color: g.PLUS_MINUS > 0 ? 'var(--badge-green-text)' : g.PLUS_MINUS < 0 ? 'var(--danger-text)' : undefined, fontWeight: 600 }}>
                          {g.PLUS_MINUS > 0 ? `+${g.PLUS_MINUS}` : g.PLUS_MINUS}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        )}
      </div>
    </>
  );
}
