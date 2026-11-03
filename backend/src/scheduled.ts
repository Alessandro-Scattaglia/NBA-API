import { createRuntimeEnv, type WorkerEnv } from "./config/env.js";
import { createServices } from "./modules/services.js";
import { loadCalendarRange, loadPlayerCatalog, loadStandings, loadTodayGames } from "./modules/shared/datasets.js";
import { SEASON_END_DATE, SEASON_START_DATE } from "./config/season.js";

interface ScheduledController {
  cron?: string;
}

export async function scheduled(_controller: ScheduledController, env: WorkerEnv) {
  const services = createServices(createRuntimeEnv(env));
  const deps = { client: services.client, cache: services.cache };
  const refreshers =
    _controller.cron === "*/2 * * * *"
      ? [() => loadTodayGames(deps)]
      : _controller.cron === "0 */6 * * *"
        ? [() => loadCalendarRange(deps, SEASON_START_DATE, SEASON_END_DATE)]
        : [() => loadStandings(deps), () => loadPlayerCatalog(deps)];

  await Promise.allSettled(refreshers.map((refresh) => refresh()));
}
