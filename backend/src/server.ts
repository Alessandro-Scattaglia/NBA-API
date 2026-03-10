import express from 'express';
import cors from 'cors';
import axios, { AxiosInstance } from 'axios';
import https from 'https';

const PORT = Number(process.env.PORT || 5000);
const CURRENT_SEASON = '2025-26';
const NBA_BASE = 'https://stats.nba.com/stats';

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

const nbaClient: AxiosInstance = axios.create({
  baseURL: NBA_BASE,
  timeout: 20000,
  httpsAgent,
  headers: {
    'Host': 'stats.nba.com',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.nba.com/',
    'Origin': 'https://www.nba.com',
    'Connection': 'keep-alive',
  },
});

function normalizeResultSet(set: any): any[] {
  const headers: string[] = set.headers || [];
  const rows: any[] = set.rowSet || set.row_set || [];
  return rows.map(row => {
    const obj: Record<string, any> = {};
    headers.forEach((h, i) => {
      obj[h] = row[i];
    });
    return obj;
  });
}

function normalizeStatsResponse(data: any): Record<string, any> {
  if (!data) return {};
  const output: Record<string, any> = {};

  if (Array.isArray(data.resultSets)) {
    for (const set of data.resultSets) {
      if (!set?.name) continue;
      output[set.name] = normalizeResultSet(set);
    }
    return output;
  }

  if (data.resultSet && data.resultSet.name) {
    output[data.resultSet.name] = normalizeResultSet(data.resultSet);
    return output;
  }

  return data;
}

async function nbaGet(endpoint: string, params: Record<string, any>) {
  const res = await nbaClient.get(`/${endpoint}`, { params });
  return normalizeStatsResponse(res.data);
}

const TEAMS = [
  { id: 1610612737, full_name: 'Atlanta Hawks', abbreviation: 'ATL', nickname: 'Hawks', city: 'Atlanta', state: 'Georgia', year_founded: 1949, conference: 'East', division: 'Southeast' },
  { id: 1610612738, full_name: 'Boston Celtics', abbreviation: 'BOS', nickname: 'Celtics', city: 'Boston', state: 'Massachusetts', year_founded: 1946, conference: 'East', division: 'Atlantic' },
  { id: 1610612751, full_name: 'Brooklyn Nets', abbreviation: 'BKN', nickname: 'Nets', city: 'Brooklyn', state: 'New York', year_founded: 1976, conference: 'East', division: 'Atlantic' },
  { id: 1610612766, full_name: 'Charlotte Hornets', abbreviation: 'CHA', nickname: 'Hornets', city: 'Charlotte', state: 'North Carolina', year_founded: 1988, conference: 'East', division: 'Southeast' },
  { id: 1610612741, full_name: 'Chicago Bulls', abbreviation: 'CHI', nickname: 'Bulls', city: 'Chicago', state: 'Illinois', year_founded: 1966, conference: 'East', division: 'Central' },
  { id: 1610612739, full_name: 'Cleveland Cavaliers', abbreviation: 'CLE', nickname: 'Cavaliers', city: 'Cleveland', state: 'Ohio', year_founded: 1970, conference: 'East', division: 'Central' },
  { id: 1610612742, full_name: 'Dallas Mavericks', abbreviation: 'DAL', nickname: 'Mavericks', city: 'Dallas', state: 'Texas', year_founded: 1980, conference: 'West', division: 'Southwest' },
  { id: 1610612743, full_name: 'Denver Nuggets', abbreviation: 'DEN', nickname: 'Nuggets', city: 'Denver', state: 'Colorado', year_founded: 1976, conference: 'West', division: 'Northwest' },
  { id: 1610612765, full_name: 'Detroit Pistons', abbreviation: 'DET', nickname: 'Pistons', city: 'Detroit', state: 'Michigan', year_founded: 1948, conference: 'East', division: 'Central' },
  { id: 1610612744, full_name: 'Golden State Warriors', abbreviation: 'GSW', nickname: 'Warriors', city: 'Golden State', state: 'California', year_founded: 1946, conference: 'West', division: 'Pacific' },
  { id: 1610612745, full_name: 'Houston Rockets', abbreviation: 'HOU', nickname: 'Rockets', city: 'Houston', state: 'Texas', year_founded: 1967, conference: 'West', division: 'Southwest' },
  { id: 1610612754, full_name: 'Indiana Pacers', abbreviation: 'IND', nickname: 'Pacers', city: 'Indiana', state: 'Indiana', year_founded: 1967, conference: 'East', division: 'Central' },
  { id: 1610612746, full_name: 'Los Angeles Clippers', abbreviation: 'LAC', nickname: 'Clippers', city: 'Los Angeles', state: 'California', year_founded: 1970, conference: 'West', division: 'Pacific' },
  { id: 1610612747, full_name: 'Los Angeles Lakers', abbreviation: 'LAL', nickname: 'Lakers', city: 'Los Angeles', state: 'California', year_founded: 1947, conference: 'West', division: 'Pacific' },
  { id: 1610612763, full_name: 'Memphis Grizzlies', abbreviation: 'MEM', nickname: 'Grizzlies', city: 'Memphis', state: 'Tennessee', year_founded: 1995, conference: 'West', division: 'Southwest' },
  { id: 1610612748, full_name: 'Miami Heat', abbreviation: 'MIA', nickname: 'Heat', city: 'Miami', state: 'Florida', year_founded: 1988, conference: 'East', division: 'Southeast' },
  { id: 1610612749, full_name: 'Milwaukee Bucks', abbreviation: 'MIL', nickname: 'Bucks', city: 'Milwaukee', state: 'Wisconsin', year_founded: 1968, conference: 'East', division: 'Central' },
  { id: 1610612750, full_name: 'Minnesota Timberwolves', abbreviation: 'MIN', nickname: 'Timberwolves', city: 'Minnesota', state: 'Minnesota', year_founded: 1989, conference: 'West', division: 'Northwest' },
  { id: 1610612740, full_name: 'New Orleans Pelicans', abbreviation: 'NOP', nickname: 'Pelicans', city: 'New Orleans', state: 'Louisiana', year_founded: 2002, conference: 'West', division: 'Southwest' },
  { id: 1610612752, full_name: 'New York Knicks', abbreviation: 'NYK', nickname: 'Knicks', city: 'New York', state: 'New York', year_founded: 1946, conference: 'East', division: 'Atlantic' },
  { id: 1610612760, full_name: 'Oklahoma City Thunder', abbreviation: 'OKC', nickname: 'Thunder', city: 'Oklahoma City', state: 'Oklahoma', year_founded: 1967, conference: 'West', division: 'Northwest' },
  { id: 1610612753, full_name: 'Orlando Magic', abbreviation: 'ORL', nickname: 'Magic', city: 'Orlando', state: 'Florida', year_founded: 1989, conference: 'East', division: 'Southeast' },
  { id: 1610612755, full_name: 'Philadelphia 76ers', abbreviation: 'PHI', nickname: '76ers', city: 'Philadelphia', state: 'Pennsylvania', year_founded: 1949, conference: 'East', division: 'Atlantic' },
  { id: 1610612756, full_name: 'Phoenix Suns', abbreviation: 'PHX', nickname: 'Suns', city: 'Phoenix', state: 'Arizona', year_founded: 1968, conference: 'West', division: 'Pacific' },
  { id: 1610612757, full_name: 'Portland Trail Blazers', abbreviation: 'POR', nickname: 'Trail Blazers', city: 'Portland', state: 'Oregon', year_founded: 1970, conference: 'West', division: 'Northwest' },
  { id: 1610612758, full_name: 'Sacramento Kings', abbreviation: 'SAC', nickname: 'Kings', city: 'Sacramento', state: 'California', year_founded: 1948, conference: 'West', division: 'Pacific' },
  { id: 1610612759, full_name: 'San Antonio Spurs', abbreviation: 'SAS', nickname: 'Spurs', city: 'San Antonio', state: 'Texas', year_founded: 1976, conference: 'West', division: 'Southwest' },
  { id: 1610612761, full_name: 'Toronto Raptors', abbreviation: 'TOR', nickname: 'Raptors', city: 'Toronto', state: 'Ontario', year_founded: 1995, conference: 'East', division: 'Atlantic' },
  { id: 1610612762, full_name: 'Utah Jazz', abbreviation: 'UTA', nickname: 'Jazz', city: 'Utah', state: 'Utah', year_founded: 1974, conference: 'West', division: 'Northwest' },
  { id: 1610612764, full_name: 'Washington Wizards', abbreviation: 'WAS', nickname: 'Wizards', city: 'Washington', state: 'District of Columbia', year_founded: 1961, conference: 'East', division: 'Southeast' },
];

const app = express();
app.use(cors());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/players', async (_req, res) => {
  try {
    const data = await nbaGet('commonallplayers', {
      IsOnlyCurrentSeason: 1,
      LeagueID: '00',
      Season: CURRENT_SEASON,
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

app.get('/api/players/:playerId', async (req, res) => {
  try {
    const data = await nbaGet('commonplayerinfo', {
      PlayerID: req.params.playerId,
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

app.get('/api/players/:playerId/career', async (req, res) => {
  try {
    const data = await nbaGet('playercareerstats', {
      PlayerID: req.params.playerId,
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

app.get('/api/players/:playerId/gamelog', async (req, res) => {
  try {
    const season = String(req.query.season || CURRENT_SEASON);
    const data = await nbaGet('playergamelog', {
      PlayerID: req.params.playerId,
      Season: season,
      SeasonType: 'Regular Season',
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

app.get('/api/players/:playerId/profile', async (req, res) => {
  try {
    const data = await nbaGet('playerprofilev2', {
      PlayerID: req.params.playerId,
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

app.get('/api/players/:playerId/shotchart', async (req, res) => {
  try {
    const season = String(req.query.season || CURRENT_SEASON);
    const data = await nbaGet('shotchartdetail', {
      PlayerID: req.params.playerId,
      TeamID: 0,
      Season: season,
      ContextMeasure: 'FGA',
      SeasonType: 'Regular Season',
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

app.get('/api/teams', (_req, res) => {
  res.json(TEAMS);
});

app.get('/api/teams/:teamId', async (req, res) => {
  try {
    const season = String(req.query.season || CURRENT_SEASON);
    const data = await nbaGet('teaminfocommon', {
      TeamID: req.params.teamId,
      Season: season,
      SeasonType: 'Regular Season',
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

app.get('/api/teams/:teamId/roster', async (req, res) => {
  try {
    const season = String(req.query.season || CURRENT_SEASON);
    const data = await nbaGet('commonteamroster', {
      TeamID: req.params.teamId,
      Season: season,
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

app.get('/api/teams/:teamId/gamelog', async (req, res) => {
  try {
    const season = String(req.query.season || CURRENT_SEASON);
    const data = await nbaGet('teamgamelog', {
      TeamID: req.params.teamId,
      Season: season,
      SeasonType: 'Regular Season',
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

app.get('/api/teams/:teamId/history', async (req, res) => {
  try {
    const data = await nbaGet('teamyearbyyearstats', {
      TeamID: req.params.teamId,
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

app.get('/api/league/standings', async (req, res) => {
  try {
    const season = String(req.query.season || CURRENT_SEASON);
    const data = await nbaGet('leaguestandings', {
      Season: season,
      SeasonType: 'Regular Season',
      LeagueID: '00',
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

app.get('/api/league/leaders', async (req, res) => {
  try {
    const season = String(req.query.season || CURRENT_SEASON);
    const stat = String(req.query.stat || 'PTS');
    const data = await nbaGet('leagueleaders', {
      LeagueID: '00',
      PerMode: 'PerGame',
      Scope: 'S',
      Season: season,
      SeasonType: 'Regular Season',
      StatCategory: stat,
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

app.get('/api/league/playerstats', async (req, res) => {
  try {
    const season = String(req.query.season || CURRENT_SEASON);
    const data = await nbaGet('leaguedashplayerstats', {
      Season: season,
      SeasonType: 'Regular Season',
      PerMode: 'PerGame',
      LeagueID: '00',
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

app.get('/api/league/teamstats', async (req, res) => {
  try {
    const season = String(req.query.season || CURRENT_SEASON);
    const data = await nbaGet('leaguedashteamstats', {
      Season: season,
      SeasonType: 'Regular Season',
      PerMode: 'PerGame',
      LeagueID: '00',
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

app.get('/api/games/scoreboard', async (req, res) => {
  try {
    const date = String(req.query.date || new Date().toISOString().slice(0, 10));
    const data = await nbaGet('scoreboardv2', {
      GameDate: date,
      LeagueID: '00',
      DayOffset: 0,
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

app.get('/api/games/:gameId/summary', async (req, res) => {
  try {
    const data = await nbaGet('boxscoresummaryv2', {
      GameID: req.params.gameId,
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

app.get('/api/games/:gameId/boxscore', async (req, res) => {
  try {
    const data = await nbaGet('boxscoretraditionalv2', {
      GameID: req.params.gameId,
      StartPeriod: 0,
      EndPeriod: 10,
      StartRange: 0,
      EndRange: 0,
      RangeType: 0,
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Backend NBA (TS) in ascolto su http://localhost:${PORT}`);
});
