import React, { useState, useEffect } from 'react';
import { api, teamLogoUrl } from '../../api';
import './TeamsView.css';

interface Props {
  onSelectTeam: (id: number) => void;
}

const EAST_TEAM_IDS = new Set([
  1610612737, 1610612738, 1610612751, 1610612766, 1610612741,
  1610612739, 1610612765, 1610612754, 1610612748, 1610612749,
  1610612752, 1610612753, 1610612755, 1610612761, 1610612764,
]);

function getConference(team: any): 'East' | 'West' | null {
  if (team.conference === 'East' || team.conference === 'West') return team.conference;
  if (EAST_TEAM_IDS.has(team.id)) return 'East';
  if (typeof team.id === 'number') return 'West';
  return null;
}

export default function TeamsView({ onSelectTeam }: Props) {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getAllTeams()
      .then(data => setTeams(Array.isArray(data) ? data : []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const eastTeams = teams
    .filter(team => getConference(team) === 'East')
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
  const westTeams = teams
    .filter(team => getConference(team) === 'West')
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <>
      <div className="main-header">
        <h2>Squadre</h2>
        <p>Tutte le 30 franchigie NBA</p>
      </div>
      <div className="main-content">
        {loading && <div className="loading"><div className="spinner" /> Caricamento squadre...</div>}
        {error && <div className="error-msg">Errore: {error}</div>}

        <div className="teams-conference-block">
          <h3>Conferenza Est</h3>
          <div className="cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(155px,1fr))' }}>
            {eastTeams.map(team => (
              <TeamCard key={team.id} team={team} onClick={() => onSelectTeam(team.id)} />
            ))}
          </div>
        </div>

        <div className="teams-conference-block">
          <h3>Conferenza Ovest</h3>
          <div className="cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(155px,1fr))' }}>
            {westTeams.map(team => (
              <TeamCard key={team.id} team={team} onClick={() => onSelectTeam(team.id)} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function TeamCard({ team, onClick }: { team: any; onClick: () => void }) {
  const [imgError, setImgError] = useState(false);
  return (
    <div className="team-card" onClick={onClick}>
      {!imgError ? (
        <img
          src={teamLogoUrl(team.id)}
          alt={team.full_name}
          className="team-card-logo"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="team-card-logo-fallback">{team.abbreviation}</div>
      )}
      <div>
        <div className="team-card-name">{team.nickname}</div>
        <div className="team-card-abbr">{team.city} · {team.abbreviation}</div>
      </div>
    </div>
  );
}
