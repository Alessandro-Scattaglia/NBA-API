export interface ApiEnvelope<T> {
  data: T;
  meta: {
    updatedAt: string;
    stale: boolean;
    source: string[];
  };
}

export type Conference = "East" | "West";
export type PlayoffStatus = "playoff" | "play-in" | "eliminated" | "in-the-hunt";
export type GameStatus = "scheduled" | "live" | "final";
export type GamePhase = "preseason" | "regular-season" | "play-in" | "playoffs" | "other";
export type GameDataAvailabilityStatus = "available" | "scheduled" | "pending";

export interface TeamReference {
  teamId: number;
  name: string;
  code: string;
  logo: string;
}

export interface TeamSummary {
  teamId: number;
  city: string;
  name: string;
  nickname: string;
  code: string;
  slug: string;
  conference: Conference;
  division: string;
  logo: string;
  wins: number;
  losses: number;
  winPct: number;
  gamesBehind: number;
  conferenceRank: number;
  homeRecord: string;
  awayRecord: string;
  lastTen: string;
  streak: string;
  playoffStatus: PlayoffStatus;
  clinchedPlayoff: boolean;
  clinchedDivision: boolean;
  clinchedConference: boolean;
}

export interface TeamSeasonStats {
  pointsPerGame: number;
  opponentPointsPerGame: number;
  reboundsPerGame: number;
  assistsPerGame: number;
  netRating: number | null;
  offensiveRating: number | null;
  defensiveRating: number | null;
  pace: number | null;
  fgPct: number | null;
  threePct: number | null;
}

export interface TeamRosterPlayer {
  playerId: number;
  fullName: string;
  position: string | null;
  jersey: string | null;
  height: string | null;
  weight: string | null;
  age: number | null;
  headshot: string;
}

export interface TeamDetail extends TeamSummary {
  arena: string | null;
  foundedYear: number | null;
  coaches: string[];
  stats: TeamSeasonStats | null;
  roster: TeamRosterPlayer[];
  recentGames: GameSummary[];
}

export interface StandingsRow extends TeamSummary {
  seed: number;
  gamesPlayed: number;
  remainingGames: number;
}

export interface PlayerAverageLine {
  gamesPlayed: number;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  threesMade: number;
  fgPct: number;
  threePct: number;
  ftPct: number;
}

export interface PlayerSummary {
  playerId: number;
  firstName: string;
  lastName: string;
  fullName: string;
  headshot: string;
  team: TeamReference | null;
  jersey: string | null;
  position: string | null;
  height: string | null;
  weight: string | null;
  averages: PlayerAverageLine | null;
}

export interface PlayerRecentGame {
  gameId: string;
  gameDate: string;
  matchup: string;
  result: string;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
}

export interface PlayerDetail extends PlayerSummary {
  birthDate: string | null;
  age: number | null;
  country: string | null;
  school: string | null;
  experience: string | null;
  draft: string | null;
  recentGames: PlayerRecentGame[];
}

export interface TeamScoreLine {
  teamId: number;
  name: string;
  code: string;
  logo: string;
  score: number | null;
  record: string | null;
}

export interface GameSummary {
  gameId: string;
  gameCode: string | null;
  dateTimeUtc: string;
  dateLabel: string;
  status: GameStatus;
  statusText: string;
  phase: GamePhase;
  arena: string | null;
  nationalTv: string[];
  clock: string | null;
  period: number | null;
  homeTeam: TeamScoreLine;
  awayTeam: TeamScoreLine;
}

export interface GameLeader {
  playerId: number;
  fullName: string;
  teamId: number;
  points: number;
  rebounds: number;
  assists: number;
}

export interface GamePlayerLine {
  playerId: number;
  fullName: string;
  position: string | null;
  starter: boolean;
  minutes: string | null;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  plusMinus: number | null;
}

export interface GameDataAvailability {
  status: GameDataAvailabilityStatus;
  message: string | null;
}

export interface GameDetail {
  game: GameSummary;
  dataAvailability: GameDataAvailability;
  homeLeaders: GameLeader[];
  awayLeaders: GameLeader[];
  homePlayers: GamePlayerLine[];
  awayPlayers: GamePlayerLine[];
}

export type LeaderCategoryKey = "points" | "rebounds" | "assists" | "steals" | "blocks" | "threesMade";

export interface LeaderRow {
  playerId: number;
  fullName: string;
  headshot: string;
  team: TeamReference | null;
  value: number;
  gamesPlayed: number;
}

export interface LeaderCategory {
  key: LeaderCategoryKey;
  label: string;
  leaders: LeaderRow[];
}

export interface HomeResponse {
  season: string;
  todayGames: GameSummary[];
  upcomingGames: GameSummary[];
  featuredGame: GameSummary | null;
  conferenceLeaders: {
    east: TeamSummary | null;
    west: TeamSummary | null;
  };
  playerLeaders: LeaderCategory[];
}

export interface TeamsResponse {
  season: string;
  east: TeamSummary[];
  west: TeamSummary[];
}

export interface PlayersResponse {
  season: string;
  total: number;
  page: number;
  pageSize: number;
  items: PlayerSummary[];
}

export interface StandingsResponse {
  season: string;
  east: StandingsRow[];
  west: StandingsRow[];
  playInNotes: string[];
}

export interface CalendarResponse {
  season: string;
  from: string;
  to: string;
  total: number;
  items: GameSummary[];
}

export interface LeadersResponse {
  season: string;
  categories: LeaderCategory[];
}

export interface PostseasonKeyDate {
  key: string;
  label: string;
  startDate: string;
  endDate: string | null;
  note: string | null;
}

export type PostseasonRound = "play-in" | "first-round";
export type PostseasonSeriesStatus = "scheduled" | "confirmed" | "awaiting-play-in";

export interface PostseasonSeries {
  conference: Conference;
  round: PostseasonRound;
  status: PostseasonSeriesStatus;
  label: string;
  seedHigh: number;
  seedLow: number;
  highSeedTeam: StandingsRow | null;
  lowSeedTeam: StandingsRow | null;
  note: string | null;
  games: GameSummary[];
}

export interface PostseasonConferenceSnapshot {
  conference: Conference;
  directSeeds: StandingsRow[];
  playInSeeds: StandingsRow[];
  outsidePicture: StandingsRow[];
  playInSeries: PostseasonSeries[];
  firstRoundSeries: PostseasonSeries[];
}

export interface PlayoffsOverview {
  directQualifiedTeams: number;
  playInTeams: number;
  confirmedFirstRoundSeries: number;
  playInGamesScheduled: number;
  playoffGamesScheduled: number;
}

export interface PlayoffsResponse {
  season: string;
  overview: PlayoffsOverview;
  keyDates: PostseasonKeyDate[];
  finalsDates: PostseasonKeyDate[];
  formatNotes: string[];
  east: PostseasonConferenceSnapshot;
  west: PostseasonConferenceSnapshot;
  playInGames: GameSummary[];
  playoffGames: GameSummary[];
}
