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
const REFRESH_COOLDOWN_SECONDS = 15 * 60;
const refreshInFlight = new Map<string, Promise<void>>();
const acceptedRefreshes = new Map<string, number[]>();
const REFRESH_LIMIT = 4;
const REFRESH_WINDOW_MS = 86_400_000;
const REFRESH_QUOTA_KEY = `${REFRESH_KEY}:quota`;

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
      const now = Date.now();
      const accepted = (acceptedRefreshes.get(REFRESH_KEY) ?? []).filter((timestamp) => now - timestamp < REFRESH_WINDOW_MS);
      if (accepted.length >= REFRESH_LIMIT) return { status: "cooldown" as const, remainingSeconds: Math.ceil((REFRESH_WINDOW_MS - (now - accepted[0])) / 1000) };
      const lastAccepted = accepted.at(-1) ?? 0;
      const remainingSeconds = Math.max(0, REFRESH_COOLDOWN_SECONDS - Math.ceil((now - lastAccepted) / 1000));
      if (remainingSeconds > 0) return { status: "cooldown" as const, remainingSeconds };
      if (kv) {
        try {
          const quota = await kv.get<{ acceptedAt?: number[] }>(REFRESH_QUOTA_KEY, "json");
          const globalAccepted = (quota?.acceptedAt ?? []).filter((timestamp) => now - timestamp < REFRESH_WINDOW_MS);
          if (globalAccepted.length >= REFRESH_LIMIT) return { status: "cooldown" as const, remainingSeconds: Math.ceil((REFRESH_WINDOW_MS - (now - globalAccepted[0])) / 1000) };
          globalAccepted.push(now);
          await kv.put(REFRESH_QUOTA_KEY, JSON.stringify({ acceptedAt: globalAccepted }), { expirationTtl: 86_400 });
        } catch (error) {
          console.warn("[refresh] KV quota unavailable", error instanceof Error ? error.message : error);
        }
      }
      accepted.push(now);
      acceptedRefreshes.set(REFRESH_KEY, accepted);

      const task = refreshDatasets(deps)
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
