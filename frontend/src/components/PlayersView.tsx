import React, { useState, useEffect, useMemo } from 'react';
import { api, playerImageUrl } from '../api';

interface Props {
  onSelectPlayer: (id: number) => void;
}

export default function PlayersView({ onSelectPlayer }: Props) {
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api.getAllPlayers()
      .then(data => setPlayers(data.CommonAllPlayers || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return players;
    const q = query.toLowerCase();
    return players.filter(p => p.DISPLAY_FIRST_LAST?.toLowerCase().includes(q));
  }, [players, query]);

  return (
    <>
      <div className="main-header">
        <h2>Giocatori</h2>
        <p>{players.length > 0 ? `${players.length} giocatori nella stagione corrente` : 'Caricamento...'}</p>
      </div>
      <div className="main-content">
        <div className="search-bar">
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
            <span style={{ fontSize: 13, color: '#6b7280' }}>{filtered.length} risultati</span>
          )}
        </div>

        {loading && <div className="loading"><div className="spinner" /> Caricamento giocatori...</div>}
        {error && <div className="error-msg">Errore: {error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="empty-state">Nessun giocatore trovato per "{query}"</div>
        )}

        <div className="cards-grid">
          {filtered.slice(0, 200).map(player => (
            <PlayerCard
              key={player.PERSON_ID}
              player={player}
              onClick={() => onSelectPlayer(player.PERSON_ID)}
            />
          ))}
        </div>

        {filtered.length > 200 && (
          <p style={{ textAlign: 'center', color: '#6b7280', fontSize: 13, marginTop: 16 }}>
            Mostrando 200 di {filtered.length} — affina la ricerca
          </p>
        )}
      </div>
    </>
  );
}

function PlayerCard({ player, onClick }: { player: any; onClick: () => void }) {
  const [imgError, setImgError] = useState(false);
  return (
    <div className="player-card" onClick={onClick}>
      <div className="player-card-image">
        {!imgError ? (
          <img
            src={playerImageUrl(player.PERSON_ID)}
            alt={player.DISPLAY_FIRST_LAST}
            onError={() => setImgError(true)}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 40, background: 'linear-gradient(135deg,#1a2235,#0d1117)'
          }}>👤</div>
        )}
        {player.TEAM_ABBREVIATION && (
          <span className="team-badge">{player.TEAM_ABBREVIATION}</span>
        )}
      </div>
      <div className="player-card-info">
        <div className="player-name">{player.DISPLAY_FIRST_LAST}</div>
        <div className="player-meta">{player.TEAM_CITY} {player.TEAM_NAME}</div>
      </div>
    </div>
  );
}
