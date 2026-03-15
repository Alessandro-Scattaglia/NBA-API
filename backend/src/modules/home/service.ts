import type { ApiEnvelope, HomeResponse } from "../../types/dto.js";
import { toIsoDate } from "../../utils/date.js";
import { buildLeaderCategories } from "../leaders/service.js";
import { loadCalendarRange, loadPlayerCatalog, loadStandings, loadTodayGames, splitByConference } from "../shared/datasets.js";
import { toEnvelope } from "../shared/envelope.js";
import type { ServiceDeps } from "../shared/types.js";

export function createHomeService(deps: ServiceDeps) {
  return {
    async getHome(): Promise<ApiEnvelope<HomeResponse>> {
      const today = toIsoDate(new Date());
      const nextWeek = toIsoDate(new Date(Date.now() + 7 * 86_400_000));
      const [todayState, standingsState, calendarState, playersState] = await Promise.all([
        loadTodayGames(deps),
        loadStandings(deps),
        loadCalendarRange(deps, today, nextWeek),
        loadPlayerCatalog(deps)
      ]);

      const split = splitByConference(standingsState.value);
      const upcomingGames = calendarState.value.filter((game) => game.status === "scheduled").slice(0, 6);
      const featuredGame = todayState.value.find((game) => game.status === "live") ?? upcomingGames[0] ?? todayState.value[0] ?? null;

      return toEnvelope(
        {
          season: "2025-26",
          todayGames: todayState.value,
          upcomingGames,
          featuredGame,
          conferenceLeaders: {
            east: split.east[0] ?? null,
            west: split.west[0] ?? null
          },
          playerLeaders: buildLeaderCategories(playersState.value, 5)
        },
        todayState.updatedAt,
        todayState.stale || standingsState.stale || calendarState.stale || playersState.stale,
        [
          "cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json",
          "stats.nba.com/leaguestandings",
          "stats.nba.com/leaguedashplayerstats"
        ]
      );
    }
  };
}
