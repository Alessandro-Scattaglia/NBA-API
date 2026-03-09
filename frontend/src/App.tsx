import React, { useState } from 'react';

const API = 'http://localhost:5000/api';

interface Endpoint {
  label: string;
  description: string;
  category: string;
  buildUrl: (params: Record<string, string>) => string;
  params: { name: string; placeholder: string; defaultValue: string }[];
}

const ENDPOINTS: Endpoint[] = [
  // Players
  {
    category: 'Players', label: 'All Players',
    description: 'List of all current NBA players',
    buildUrl: () => `${API}/players`,
    params: [],
  },
  {
    category: 'Players', label: 'Player Info',
    description: 'General info about a player',
    buildUrl: (p) => `${API}/players/${p.player_id}`,
    params: [{ name: 'player_id', placeholder: 'Player ID', defaultValue: '2544' }],
  },
  {
    category: 'Players', label: 'Player Career Stats',
    description: 'Career stats of a player',
    buildUrl: (p) => `${API}/players/${p.player_id}/career`,
    params: [{ name: 'player_id', placeholder: 'Player ID', defaultValue: '2544' }],
  },
  {
    category: 'Players', label: 'Player Game Log',
    description: 'Game log for a player in a season',
    buildUrl: (p) => `${API}/players/${p.player_id}/gamelog?season=${p.season}`,
    params: [
      { name: 'player_id', placeholder: 'Player ID', defaultValue: '2544' },
      { name: 'season', placeholder: 'Season (es. 2024-25)', defaultValue: '2024-25' },
    ],
  },
  {
    category: 'Players', label: 'Player Shot Chart',
    description: 'Shot chart for a player in a season',
    buildUrl: (p) => `${API}/players/${p.player_id}/shotchart?season=${p.season}`,
    params: [
      { name: 'player_id', placeholder: 'Player ID', defaultValue: '2544' },
      { name: 'season', placeholder: 'Season', defaultValue: '2024-25' },
    ],
  },
  // Teams
  {
    category: 'Teams', label: 'All Teams',
    description: 'List of all NBA teams',
    buildUrl: () => `${API}/teams`,
    params: [],
  },
  {
    category: 'Teams', label: 'Team Info',
    description: 'General info about a team',
    buildUrl: (p) => `${API}/teams/${p.team_id}`,
    params: [{ name: 'team_id', placeholder: 'Team ID', defaultValue: '1610612747' }],
  },
  {
    category: 'Teams', label: 'Team Roster',
    description: 'Current roster of a team',
    buildUrl: (p) => `${API}/teams/${p.team_id}/roster`,
    params: [{ name: 'team_id', placeholder: 'Team ID', defaultValue: '1610612747' }],
  },
  {
    category: 'Teams', label: 'Team Game Log',
    description: 'Game log for a team in a season',
    buildUrl: (p) => `${API}/teams/${p.team_id}/gamelog?season=${p.season}`,
    params: [
      { name: 'team_id', placeholder: 'Team ID', defaultValue: '1610612747' },
      { name: 'season', placeholder: 'Season', defaultValue: '2024-25' },
    ],
  },
  {
    category: 'Teams', label: 'Team History',
    description: 'Year-by-year stats for a team',
    buildUrl: (p) => `${API}/teams/${p.team_id}/history`,
    params: [{ name: 'team_id', placeholder: 'Team ID', defaultValue: '1610612747' }],
  },
  // League
  {
    category: 'League', label: 'Standings',
    description: 'Current standings in the league',
    buildUrl: (p) => `${API}/league/standings?season=${p.season}`,
    params: [{ name: 'season', placeholder: 'Season', defaultValue: '2024-25' }],
  },
  {
    category: 'League', label: 'League Leaders',
    description: 'Statistical leaders in the league',
    buildUrl: (p) => `${API}/league/leaders?season=${p.season}&stat=${p.stat}`,
    params: [
      { name: 'season', placeholder: 'Season', defaultValue: '2024-25' },
      { name: 'stat', placeholder: 'Stat (PTS, AST, REB...)', defaultValue: 'PTS' },
    ],
  },
  {
    category: 'League', label: 'Player Stats Dashboard',
    description: 'All player stats for a season',
    buildUrl: (p) => `${API}/league/playerstats?season=${p.season}`,
    params: [{ name: 'season', placeholder: 'Season', defaultValue: '2024-25' }],
  },
  {
    category: 'League', label: 'Team Stats Dashboard',
    description: 'All team stats for a season',
    buildUrl: (p) => `${API}/league/teamstats?season=${p.season}`,
    params: [{ name: 'season', placeholder: 'Season', defaultValue: '2024-25' }],
  },
  // Games
  {
    category: 'Games', label: 'Scoreboard',
    description: 'Scores for a specific date',
    buildUrl: (p) => `${API}/games/scoreboard?date=${p.date}`,
    params: [{ name: 'date', placeholder: 'Date (YYYY-MM-DD)', defaultValue: '2025-03-09' }],
  },
  {
    category: 'Games', label: 'Box Score Summary',
    description: 'Summary of a game box score',
    buildUrl: (p) => `${API}/games/${p.game_id}/summary`,
    params: [{ name: 'game_id', placeholder: 'Game ID', defaultValue: '0022401000' }],
  },
  {
    category: 'Games', label: 'Box Score Traditional',
    description: 'Traditional box score for a game',
    buildUrl: (p) => `${API}/games/${p.game_id}/boxscore`,
    params: [{ name: 'game_id', placeholder: 'Game ID', defaultValue: '0022401000' }],
  },
];

const categories = Array.from(new Set(ENDPOINTS.map(e => e.category)));

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  const defaultParams = Object.fromEntries(endpoint.params.map(p => [p.name, p.defaultValue]));
  const [params, setParams] = useState<Record<string, string>>(defaultParams);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const url = endpoint.buildUrl(params);
      const res = await fetch(url);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ border: '1px solid #ccc', margin: '8px 0', padding: '12px' }}>
      <strong>{endpoint.label}</strong> — <span>{endpoint.description}</span>
      <div style={{ marginTop: 8 }}>
        {endpoint.params.map(p => (
          <input
            key={p.name}
            style={{ marginRight: 8 }}
            placeholder={p.placeholder}
            value={params[p.name]}
            onChange={e => setParams(prev => ({ ...prev, [p.name]: e.target.value }))}
          />
        ))}
        <button onClick={fetchData} disabled={loading}>
          {loading ? 'Loading...' : 'Fetch'}
        </button>
      </div>
      {error && <pre style={{ color: 'red' }}>Error: {error}</pre>}
      {data && (
        <pre style={{ background: '#f4f4f4', padding: 8, maxHeight: 400, overflow: 'auto', fontSize: 12 }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

function App() {
  return (
    <div style={{ padding: 20 }}>
      <h1>NBA API Explorer</h1>
      <p>Backend: <code>http://localhost:5000</code> — avvia <code>python backend/app.py</code> prima di fare fetch.</p>
      {categories.map(cat => (
        <div key={cat}>
          <h2>{cat}</h2>
          {ENDPOINTS.filter(e => e.category === cat).map(ep => (
            <EndpointCard key={ep.label} endpoint={ep} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default App;
