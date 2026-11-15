import { createRuntimeEnv, type WorkerEnv } from "./config/env.js";
import { createServices } from "./modules/services.js";
import { loadCalendarRange, loadPlayerCatalog, loadStandings, loadTeamStats, loadTodayGames } from "./modules/shared/datasets.js";
import { SEASON_END_DATE, SEASON_START_DATE } from "./config/season.js";
import { getCurrentSeason } from "./config/season.js";

interface ScheduledController {
  cron?: string;
}

let lastStandingsGameSignature = "";

function getGameSignature(games: Array<{
  gameId: string;
  status: string;
  homeTeam: { score: number | null };
  awayTeam: { score: number | null };
}>) {
  return JSON.stringify(
    games
      .map((game) => [game.gameId, game.status, game.homeTeam.score, game.awayTeam.score])
      .sort((left, right) => String(left[0]).localeCompare(String(right[0])))
  );
}

function isItalianNightGameWindow(date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    hour12: false
  }).format(date));
  return hour >= 0 && hour < 9;
}

export async function scheduled(_controller: ScheduledController, env: WorkerEnv) {
  const services = createServices(createRuntimeEnv(env));
  const deps = { client: services.client, cache: services.cache };

  if (_controller.cron === "*/2 * * * *") {
    if (!isItalianNightGameWindow()) {
      return;
    }
    try {
      const todayGames = await loadTodayGames(deps, true);
      const signature = getGameSignature(todayGames.value);
      let previousSignature = lastStandingsGameSignature;
      if (env.NBA_CACHE) {
        previousSignature =
          (await env.NBA_CACHE.get<string>(`standings:last-game-signature:${getCurrentSeason()}`, "json")) ??
          previousSignature;
      }

      const hasResultToSync = todayGames.value.some((game) => game.status === "live" || game.status === "final");
      if (signature !== previousSignature && hasResultToSync) {
        await Promise.allSettled([
          loadStandings(deps, true),
          loadTeamStats(deps, true),
          loadPlayerCatalog(deps, true)
        ]);
      }

      lastStandingsGameSignature = signature;
      if (env.NBA_CACHE) {
        await env.NBA_CACHE.put(
          `standings:last-game-signature:${getCurrentSeason()}`,
          JSON.stringify(signature),
          { expirationTtl: 60 * 60 * 24 * 10 }
        );
      }
    } catch (error) {
      console.error("[scheduled] scoreboard synchronization failed", error instanceof Error ? error.message : error);
    }
    return;
  }

  const refreshers =
    _controller.cron === "0 */6 * * *"
      ? [async () => {
          const calendar = await loadCalendarRange(deps, SEASON_START_DATE, SEASON_END_DATE, true);
          const signature = getGameSignature(calendar.value);
          const key = `standings:full-game-signature:${getCurrentSeason()}`;
          const previous = env.NBA_CACHE ? await env.NBA_CACHE.get<string>(key, "json") : null;
          if (previous !== signature && calendar.value.some((game) => game.status === "final")) {
            await Promise.allSettled([
              loadStandings(deps, true),
              loadTeamStats(deps, true),
              loadPlayerCatalog(deps, true)
            ]);
          }
          if (env.NBA_CACHE) {
            await env.NBA_CACHE.put(key, JSON.stringify(signature), { expirationTtl: 60 * 60 * 24 * 10 });
          }
        }]
      : [() => loadStandings(deps, true), () => loadPlayerCatalog(deps, true), () => loadTeamStats(deps, true)];

  const results = await Promise.allSettled(refreshers.map((refresh) => refresh()));
  results
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .forEach((result) => console.error("[scheduled] refresh failed", result.reason));
}
