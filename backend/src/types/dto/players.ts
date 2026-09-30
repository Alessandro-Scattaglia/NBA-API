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

export interface TeamReference {
  teamId: number;
  name: string;
  code: string;
  logo: string;
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
