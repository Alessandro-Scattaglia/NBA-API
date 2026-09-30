import type { GameSummary } from "./games.js";
import type { LeaderCategory } from "./leaders.js";
import type { PlayerSummary } from "./players.js";
import type { PostseasonConferenceSnapshot, PostseasonKeyDate, PlayoffsOverview } from "./playoffs.js";
import type { StandingsRow, TeamSummary } from "./teams.js";

export interface HomeResponse {
  season: string;
  homeSpotlightMode: "playoffs" | "standings";
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
