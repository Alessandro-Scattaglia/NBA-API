import { cache } from "../cache/memoryCache.js";
import { nbaApiClient, type NbaApiClient } from "../nba-client/client.js";
import { createCalendarService } from "./calendar/service.js";
import { createGamesService } from "./games/service.js";
import { createHomeService } from "./home/service.js";
import { createLeadersService } from "./leaders/service.js";
import { createPlayoffsService } from "./playoffs/service.js";
import { createPlayersService } from "./players/service.js";
import { createStandingsService } from "./standings/service.js";
import { createTeamsService } from "./teams/service.js";

export interface AppServices {
  home: ReturnType<typeof createHomeService>;
  teams: ReturnType<typeof createTeamsService>;
  players: ReturnType<typeof createPlayersService>;
  standings: ReturnType<typeof createStandingsService>;
  playoffs: ReturnType<typeof createPlayoffsService>;
  calendar: ReturnType<typeof createCalendarService>;
  games: ReturnType<typeof createGamesService>;
  leaders: ReturnType<typeof createLeadersService>;
}

export function createServices(client: NbaApiClient = nbaApiClient): AppServices {
  const deps = {
    client,
    cache
  };

  return {
    home: createHomeService(deps),
    teams: createTeamsService(deps),
    players: createPlayersService(deps),
    standings: createStandingsService(deps),
    playoffs: createPlayoffsService(deps),
    calendar: createCalendarService(deps),
    games: createGamesService(deps),
    leaders: createLeadersService(deps)
  };
}
