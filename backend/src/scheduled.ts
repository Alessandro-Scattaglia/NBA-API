import { createRuntimeEnv, type WorkerEnv } from "./config/env.js";
import { createServices } from "./modules/services.js";
import { loadCalendarRange, loadPlayerCatalog, loadResultCheckGames, loadStandings, loadTeamStats } from "./modules/shared/datasets.js";
import { SEASON_END_DATE, SEASON_START_DATE } from "./config/season.js";
import { getCurrentSeason } from "./config/season.js";
import { addCalendarDays, getItalianDate } from "./utils/date.js";

interface ScheduledController {
  cron?: string;
}

let lastStandingsGameSignature = "";
let syncStateWrite = Promise.resolve();

interface SyncState {
  liveSignature?: string;
  fullSignature?: string;
  lastSuccessfulAt?: string;
  live?: { status: "success" | "failed"; source: string; at: string };
  full?: { status: "success" | "failed"; source: string; at: string };
}

function syncStateKey() {
  return `standings:sync-state:${getCurrentSeason()}`;
}

async function readSyncState(env: WorkerEnv): Promise<SyncState> {
  if (!env.NBA_CACHE) return {};
  try {
    const value = await env.NBA_CACHE.get<SyncState>(syncStateKey(), "json");
    return value && typeof value === "object" ? value : {};
  } catch (error) {
    console.warn("[scheduled] sync state read failed", error instanceof Error ? error.message : error);
    return {};
  }
}

async function writeSyncState(env: WorkerEnv, patch: Partial<SyncState>, successful = true) {
  if (!env.NBA_CACHE) return;
  const write = syncStateWrite.then(async () => {
    const state = { ...(await readSyncState(env)), ...patch };
    if (successful) state.lastSuccessfulAt = new Date().toISOString();
    await env.NBA_CACHE!.put(syncStateKey(), JSON.stringify(state), { expirationTtl: 60 * 60 * 24 * 10 });
  });
  syncStateWrite = write.catch(() => undefined);
  await write;
}

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

export async function scheduled(_controller: ScheduledController, env: WorkerEnv) {
  const services = createServices(createRuntimeEnv(env));
  const deps = { client: services.client, cache: services.cache };

  if (_controller.cron === "*/2 * * * *") {
    try {
      const italianToday = getItalianDate();
      const results = await loadResultCheckGames(deps, italianToday, true);
      const signature = getGameSignature(results.value);
      const state = await readSyncState(env);
      const previousSignature = state.liveSignature ?? lastStandingsGameSignature;

      const hasResultToSync = results.value.some((game) => game.status === "live" || game.status === "final");
      if (signature !== previousSignature && hasResultToSync) {
        await Promise.all([
          loadStandings(deps, true),
          loadTeamStats(deps, true),
          loadPlayerCatalog(deps, true)
        ]);
      }

      if (results.liveSourceFailed || results.stale) {
        throw new Error("Live scoreboard was not refreshed; result signature was not persisted.");
      }
      lastStandingsGameSignature = signature;
      await writeSyncState(env, { liveSignature: signature, live: { status: "success", source: "live-scoreboard", at: new Date().toISOString() } });
    } catch (error) {
      console.error("[scheduled] scoreboard synchronization failed", error instanceof Error ? error.message : error);
      await writeSyncState(env, { live: { status: "failed", source: "live-scoreboard", at: new Date().toISOString() } }, false).catch(() => undefined);
    }
    return;
  }

  const refreshers =
    _controller.cron === "0 */6 * * *"
      ? [async () => {
          const calendar = await loadCalendarRange(deps, SEASON_START_DATE, SEASON_END_DATE, true);
          const signature = getGameSignature(calendar.value);
          const previous = (await readSyncState(env)).fullSignature ?? null;
          if (previous !== signature && calendar.value.some((game) => game.status === "final")) {
            await Promise.all([
              loadStandings(deps, true),
              loadTeamStats(deps, true),
              loadPlayerCatalog(deps, true)
            ]);
          }
          if (env.NBA_CACHE) {
            await writeSyncState(env, { fullSignature: signature, full: { status: "success", source: "calendar-merge", at: new Date().toISOString() } });
          }
        }]
      : [() => loadStandings(deps, true), () => loadPlayerCatalog(deps, true), () => loadTeamStats(deps, true)];

  const results = await Promise.allSettled(refreshers.map((refresh) => refresh()));
  results
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .forEach((result) => console.error("[scheduled] refresh failed", result.reason));
}
