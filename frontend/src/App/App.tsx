import React, { useState } from 'react';
import { Routes, Route, useNavigate, useLocation, useParams, Navigate, Link } from 'react-router-dom';
import './App.css';
import '../components/Shared/Shared.css';
import { buildSeasons } from '../season';
import { DEFAULT_SEASON } from '../api';
import PlayersView from '../components/PlayersView/PlayersView';
import PlayerDetail from '../components/PlayerDetail/PlayerDetail';
import TeamsView from '../components/TeamsView/TeamsView';
import TeamDetail from '../components/TeamDetail/TeamDetail';
import StandingsView from '../components/StandingsView/StandingsView';
import LeadersView from '../components/LeadersView/LeadersView';
import ScoreboardView from '../components/ScoreboardView/ScoreboardView';
import HomeView from '../components/HomeView/HomeView';
import TeamStatsView from '../components/TeamStatsView/TeamStatsView';
import PlayerStatsView from '../components/PlayerStatsView/PlayerStatsView';
import GameDetailView from '../components/GameDetailView/GameDetailView';

const NAV = [
  { path: '/', label: 'Home', icon: '🏠', section: 'Esplora' },
  { path: '/players', label: 'Giocatori', icon: '👤', section: 'Esplora' },
  { path: '/teams', label: 'Squadre', icon: '🏀', section: 'Esplora' },
  { path: '/standings', label: 'Classifica', icon: '📊', section: 'Lega' },
  { path: '/leaders', label: 'Leader Statistiche', icon: '🏆', section: 'Lega' },
  { path: '/playerstats', label: 'Statistiche Giocatori', icon: '📈', section: 'Lega' },
  { path: '/teamstats', label: 'Statistiche Squadre', icon: '📈', section: 'Lega' },
  { path: '/scoreboard', label: 'Calendario', icon: '📅', section: 'Partite' },
];

const SEASONS = buildSeasons(DEFAULT_SEASON, 8);

function Sidebar({
  season,
  setSeason,
  theme,
  onToggleTheme
}: {
  season: string;
  setSeason: (s: string) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}) {
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
      <div className="sidebar-footer">
        <div>
          <p className="season-label">Stagione</p>
          <select
            className="season-select"
            value={season}
            onChange={e => setSeason(e.target.value)}
          >
            {SEASONS.map(s => (
              <option key={s} value={s}>{s}{s === DEFAULT_SEASON ? ' ★' : ''}</option>
            ))}
          </select>
        </div>
        <button className="theme-toggle" type="button" onClick={onToggleTheme}>
          <span>Tema: {theme === 'light' ? 'Chiaro' : 'Scuro'}</span>
          <span aria-hidden="true">{theme === 'light' ? '🌞' : '🌙'}</span>
        </button>
        <p className="server-label">Server: localhost:5000</p>
      </div>
    </aside>
  );
}

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


function App() {
  const [season, setSeason] = useState(DEFAULT_SEASON);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const navigate = useNavigate();

  return (
    <div className="app" data-theme={theme}>
      <Sidebar
        season={season}
        setSeason={setSeason}
        theme={theme}
        onToggleTheme={() => setTheme(t => (t === 'light' ? 'dark' : 'light'))}
      />
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
          <Route path="/playerstats" element={
            <PlayerStatsView season={season} onSelectPlayer={id => navigate(`/players/${id}`)} />
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
