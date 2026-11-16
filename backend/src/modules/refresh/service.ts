import { getCurrentSeason } from "../../config/season.js";
import {
  loadCalendarRange,
  loadPlayerCatalog,
  loadStandings,
  loadTeamStats,
  loadTodayGames
} from "../shared/datasets.js";
import type { ServiceDeps } from "../shared/types.js";
import { addCalendarDays, getItalianDate } from "../../utils/date.js";

const REFRESH_KEY = `manual-refresh:${getCurrentSeason()}`;
const REFRESH_COOLDOWN_SECONDS = 5 * 60;
const refreshInFlight = new Map<string, Promise<void>>();

async function refreshDatasets(deps: ServiceDeps) {
  const today = getItalianDate();
  const nextWeek = addCalendarDays(today, 7);
  const results = await Promise.allSettled([
    loadTodayGames(deps, true),
    loadStandings(deps, true),
    loadCalendarRange(deps, today, nextWeek, true),
    loadPlayerCatalog(deps, true),
    loadTeamStats(deps, true)
  ]);
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length > 0) {
    throw new Error(`${failures.length} dataset essenziali non sono stati aggiornati.`);
  }
}

export function createRefreshService(deps: ServiceDeps) {
  return {
    async request() {
      const existing = refreshInFlight.get(REFRESH_KEY);
      if (existing) {
        return { status: "running" as const, task: existing };
      }

      const kv = deps.runtimeEnv?.cache;
      const previous = kv ? await kv.get<{ updatedAt?: string; status?: string }>(REFRESH_KEY, "json") : null;
      if (previous?.status === "running") {
        return { status: "running" as const };
      }
      const lastUpdatedAt = previous?.updatedAt ? Date.parse(previous.updatedAt) : 0;
      const remainingSeconds = Math.max(
        0,
        REFRESH_COOLDOWN_SECONDS - Math.ceil((Date.now() - lastUpdatedAt) / 1000)
      );
      if (remainingSeconds > 0) {
        return { status: "cooldown" as const, remainingSeconds };
      }

      if (kv) {
        await kv.put(REFRESH_KEY, JSON.stringify({ status: "running" }), {
          expirationTtl: REFRESH_COOLDOWN_SECONDS
        });
      }

      const task = refreshDatasets(deps)
        .then(async () => {
          if (kv) {
            await kv.put(REFRESH_KEY, JSON.stringify({ updatedAt: new Date().toISOString() }), {
              expirationTtl: REFRESH_COOLDOWN_SECONDS
            });
          }
        })
        .catch((error) => {
          console.error("[refresh] manual dataset refresh failed", error instanceof Error ? error.message : error);
          throw error;
        })
        .finally(() => refreshInFlight.delete(REFRESH_KEY));

      refreshInFlight.set(REFRESH_KEY, task);
      return { status: "accepted" as const, task };
    }
  };
}
