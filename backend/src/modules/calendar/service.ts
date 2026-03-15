import type { ApiEnvelope, CalendarResponse, GameSummary } from "../../types/dto.js";
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

      const rangeStart = items[0]?.dateTimeUtc.slice(0, 10) ?? filters.from ?? "2025-10-01";
      const rangeEnd = items.at(-1)?.dateTimeUtc.slice(0, 10) ?? filters.to ?? "2026-07-31";

      return toEnvelope(
        {
          season: "2025-26",
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
