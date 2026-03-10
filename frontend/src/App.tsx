import React, { useState } from 'react';
import { Routes, Route, useNavigate, useLocation, useParams, Navigate, Link } from 'react-router-dom';
import './App.css';
import PlayersView from './components/PlayersView';
import PlayerDetail from './components/PlayerDetail';
import TeamsView from './components/TeamsView';
import TeamDetail from './components/TeamDetail';
import StandingsView from './components/StandingsView';
import LeadersView from './components/LeadersView';
import ScoreboardView from './components/ScoreboardView';
import HomeView from './components/HomeView';
import TeamStatsView from './components/TeamStatsView';
import GameDetailView from './components/GameDetailView';

const NAV = [
  { path: '/',           label: 'Home',               icon: '🏠', section: 'Esplora' },
  { path: '/players',    label: 'Giocatori',     icon: '👤', section: 'Esplora' },
  { path: '/teams',      label: 'Squadre',       icon: '🏀', section: 'Esplora' },
  { path: '/standings',  label: 'Classifica',    icon: '📊', section: 'Lega' },
  { path: '/leaders',    label: 'Leader Statistiche', icon: '🏆', section: 'Lega' },
  { path: '/teamstats',  label: 'Statistiche Squadre', icon: '📈', section: 'Lega' },
  { path: '/scoreboard', label: 'Calendario',    icon: '📅', section: 'Partite' },
];

const SEASONS = ['2025-26', '2024-25', '2023-24', '2022-23', '2021-22', '2020-21', '2019-20', '2018-19'];

function Sidebar({ season, setSeason }: { season: string; setSeason: (s: string) => void }) {
  const location = useLocation();
  const base = '/' + location.pathname.split('/')[1];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <Link to="/" style={{ textDecoration: 'none' }}>
          <h1>NBA<span>.</span>Statistiche</h1>
        </Link>
      </div>
      <nav className="sidebar-nav">
        {['Esplora', 'Lega', 'Partite'].map(section => (
          <div key={section} className="nav-section">
            <div className="nav-section-label">{section}</div>
            {NAV.filter(i => i.section === section).map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${base === item.path ? 'active' : ''}`}
                style={{ textDecoration: 'none' }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div style={{ padding: '12px 20px', borderTop: '1px solid #1f2937' }}>
        <div style={{ marginBottom: 10 }}>
          <p style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Stagione</p>
          <select
            value={season}
            onChange={e => setSeason(e.target.value)}
            style={{
              width: '100%', background: '#111827', border: '1px solid #374151',
              color: '#f9fafb', padding: '7px 10px', borderRadius: 6,
              fontSize: 13, fontWeight: 600, outline: 'none', cursor: 'pointer'
            }}
          >
            {SEASONS.map(s => (
              <option key={s} value={s}>{s}{s === '2025-26' ? ' ★' : ''}</option>
            ))}
          </select>
        </div>
        <p style={{ fontSize: 12, color: '#4b5563' }}>Server: localhost:5000</p>
      </div>
    </aside>
  );
}

/* ── wrapper routes per estrarre useParams ────────────────────────── */
function PlayerDetailRoute({ season }: { season: string }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  return (
    <PlayerDetail
      playerId={Number(id)}
      onBack={() => navigate('/players')}
      season={season}
      onSelectPlayer={pid => navigate(`/players/${pid}`)}
    />
  );
}

function TeamDetailRoute({ season }: { season: string }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  return (
    <TeamDetail
      teamId={Number(id)}
      onBack={() => navigate('/teams')}
      season={season}
      onSelectPlayer={pid => navigate(`/players/${pid}`)}
    />
  );
}

function GameDetailRoute() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  if (!gameId) return <Navigate to="/scoreboard" replace />;
  return (
    <GameDetailView
      gameId={gameId}
      onBack={() => navigate('/scoreboard')}
      onSelectPlayer={pid => navigate(`/players/${pid}`)}
    />
  );
}

/* ── app root ─────────────────────────────────────────────────────── */
function App() {
  const [season, setSeason] = useState('2025-26');
  const navigate = useNavigate();

  return (
    <div className="app">
      <Sidebar season={season} setSeason={setSeason} />
      <main className="main">
        <Routes>
          <Route path="/" element={
            <HomeView
              season={season}
              onOpenScoreboard={() => navigate('/scoreboard')}
              onOpenLeaders={() => navigate('/leaders')}
              onOpenStandings={() => navigate('/standings')}
              onOpenTeamStats={() => navigate('/teamstats')}
              onOpenGame={gameId => navigate(`/scoreboard/${gameId}`)}
            />
          } />
          <Route path="/players" element={
            <PlayersView onSelectPlayer={id => navigate(`/players/${id}`)} />
          } />
          <Route path="/players/:id" element={<PlayerDetailRoute season={season} />} />
          <Route path="/teams" element={
            <TeamsView onSelectTeam={id => navigate(`/teams/${id}`)} />
          } />
          <Route path="/teams/:id" element={<TeamDetailRoute season={season} />} />
          <Route path="/standings" element={<StandingsView season={season} />} />
          <Route path="/leaders" element={
            <LeadersView season={season} onSelectPlayer={id => navigate(`/players/${id}`)} />
          } />
          <Route path="/teamstats" element={
            <TeamStatsView season={season} onSelectTeam={id => navigate(`/teams/${id}`)} />
          } />
          <Route path="/scoreboard" element={<ScoreboardView onSelectGame={gameId => navigate(`/scoreboard/${gameId}`)} />} />
          <Route path="/scoreboard/:gameId" element={<GameDetailRoute />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
