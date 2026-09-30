import type { ApiEnvelope, CalendarResponse, GameSummary } from "../../types/dto/index.js";
import { NBA_SEASON, SEASON_END_DATE, SEASON_START_DATE } from "../../config/season.js";
import { loadCalendarRange } from "../shared/datasets.js";
import { toEnvelope } from "../shared/envelope.js";
import type { ServiceDeps } from "../shared/types.js";

interface CalendarFilters {
  from?: string;
  to?: string;
  teamId?: number;
  status?: string;
  phase?: string;
}

export function createCalendarService(deps: ServiceDeps) {
  return {
    async getCalendar(filters: CalendarFilters): Promise<ApiEnvelope<CalendarResponse>> {
      const state = await loadCalendarRange(deps, filters.from, filters.to);

      const items = state.value.filter((game) => {
        const matchesTeam =
          !filters.teamId ||
          game.homeTeam.teamId === filters.teamId ||
          game.awayTeam.teamId === filters.teamId;
        const matchesStatus = !filters.status || game.status === filters.status;
        const matchesPhase = !filters.phase || game.phase === filters.phase;

        return matchesTeam && matchesStatus && matchesPhase;
      });

      const rangeStart = items[0]?.dateTimeUtc.slice(0, 10) ?? filters.from ?? SEASON_START_DATE;
      const rangeEnd = items.at(-1)?.dateTimeUtc.slice(0, 10) ?? filters.to ?? SEASON_END_DATE;

      return toEnvelope(
        {
          season: NBA_SEASON,
          from: rangeStart,
          to: rangeEnd,
          total: items.length,
          items
        },
        state.updatedAt,
        state.stale,
        ["cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json", "stats.nba.com/scoreboardv2"]
      );
    }
  };
}
