import type { ApiEnvelope, HomeResponse } from "../../types/dto.js";
import { toIsoDate } from "../../utils/date.js";
import { buildLeaderCategories } from "../leaders/service.js";
import { loadCalendarRange, loadPlayerCatalog, loadStandings, loadTodayGames, splitByConference } from "../shared/datasets.js";
import { toEnvelope } from "../shared/envelope.js";
import type { ServiceDeps } from "../shared/types.js";

function getLatestUpdatedAt(values: string[]) {
  return values.slice().sort().at(-1) ?? new Date().toISOString();
}

export function createHomeService(deps: ServiceDeps) {
  return {
    async getHome(): Promise<ApiEnvelope<HomeResponse>> {
      const today = toIsoDate(new Date());
      const nextWeek = toIsoDate(new Date(Date.now() + 7 * 86_400_000));
      const [todayResult, standingsResult, calendarResult, playersResult] = await Promise.allSettled([
        loadTodayGames(deps),
        loadStandings(deps),
        loadCalendarRange(deps, today, nextWeek),
        loadPlayerCatalog(deps)
      ]);

      const todayState = todayResult.status === "fulfilled" ? todayResult.value : null;
      const standingsState = standingsResult.status === "fulfilled" ? standingsResult.value : null;
      const calendarState = calendarResult.status === "fulfilled" ? calendarResult.value : null;
      const playersState = playersResult.status === "fulfilled" ? playersResult.value : null;
      const split = splitByConference(standingsState?.value ?? []);
      const todayGames = todayState?.value ?? [];
      const upcomingGames = (calendarState?.value ?? []).filter((game) => game.status === "scheduled").slice(0, 6);
      const featuredGame = todayGames.find((game) => game.status === "live") ?? upcomingGames[0] ?? todayGames[0] ?? null;
      const updatedAt = getLatestUpdatedAt(
        [todayState?.updatedAt, standingsState?.updatedAt, calendarState?.updatedAt, playersState?.updatedAt].filter(
          (value): value is string => Boolean(value)
        )
      );

      return toEnvelope(
        {
          season: "2025-26",
          todayGames,
          upcomingGames,
          featuredGame,
          conferenceLeaders: {
            east: split.east[0] ?? null,
            west: split.west[0] ?? null
          },
          playerLeaders: buildLeaderCategories(playersState?.value ?? [], 5)
        },
        updatedAt,
        todayResult.status === "rejected" ||
          standingsResult.status === "rejected" ||
          calendarResult.status === "rejected" ||
          playersResult.status === "rejected" ||
          Boolean(todayState?.stale || standingsState?.stale || calendarState?.stale || playersState?.stale),
        [
          "cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json",
          "stats.nba.com/leaguestandings",
          "stats.nba.com/leaguedashplayerstats"
        ]
      );
    }
  };
}
