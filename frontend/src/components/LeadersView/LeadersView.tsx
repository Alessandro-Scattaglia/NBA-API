import React, { useState, useEffect } from 'react';
import { api, playerImageUrl } from '../../api';
import './LeadersView.css';

interface Props {
  onSelectPlayer: (id: number) => void;
  season: string;
}

const STATS = [
  { key: 'PTS',    label: 'Punti' },
  { key: 'AST',    label: 'Assist' },
  { key: 'REB',    label: 'Rimbalzi' },
  { key: 'STL',    label: 'Rubate' },
  { key: 'BLK',    label: 'Stoppate' },
  { key: 'FG_PCT', label: 'FG%' },
  { key: 'FG3_PCT',label: '3P%' },
  { key: 'EFF',    label: 'Efficienza' },
];

export default function LeadersView({ onSelectPlayer, season }: Props) {
  const [stat, setStat] = useState('PTS');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setData(null);
    setError(null);
    api.getLeaders(stat, season)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [stat, season]);

  const leaders = data?.LeagueLeaders || [];
  const currentLabel = STATS.find(s => s.key === stat)?.label ?? stat;

  return (
    <>
      <div className="main-header">
        <h2>Leader Statistiche</h2>
        <p>Top 25 giocatori per categoria · {season}</p>
      </div>
      <div className="main-content">
        <div className="leaders-filters">
          {STATS.map(s => (
            <button
              key={s.key}
              className={`filter-btn ${stat === s.key ? 'active' : ''}`}
              onClick={() => setStat(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {loading && <div className="loading"><div className="spinner" /> Caricamento {currentLabel}...</div>}
        {error && <div className="error-msg">{error}</div>}

        {!loading && !error && (
          <div className="leaders-list">
            {leaders.slice(0, 25).map((player: any, i: number) => {
              const val = player[stat];
              const fmt = typeof val === 'number'
                ? val % 1 !== 0 ? val.toFixed(stat.endsWith('PCT') ? 3 : 1) : String(val)
                : String(val ?? '—');
              return (
                <div
                  key={player.PLAYER_ID}
                  className="leader-row"
                  onClick={() => onSelectPlayer(player.PLAYER_ID)}
                >
                  <span className={`leader-rank ${i < 3 ? 'top3' : ''}`}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </span>
                  <div className="leader-photo">
                    <img
                      src={playerImageUrl(player.PLAYER_ID)}
                      alt={player.PLAYER}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                  <div className="leader-info">
                    <div className="leader-name">{player.PLAYER}</div>
                    <div className="leader-team">{player.TEAM}</div>
                  </div>
                  <div className="leader-value">{fmt}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
