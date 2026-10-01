import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { createServices } from "./modules/services.js";
import { getSeasonPhase, NBA_SEASON } from "./config/season.js";

const WARMUP_INTERVAL_MS = 45_000;

const services = createServices();
const app = createApp(services);

let warmupRunning = false;
let warmupTimer: NodeJS.Timeout | undefined;

const stopWarmupTimer = () => {
  if (warmupTimer) {
    clearInterval(warmupTimer);
    warmupTimer = undefined;
  }
};

process.on("SIGINT", () => {
  stopWarmupTimer();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopWarmupTimer();
  process.exit(0);
});

async function runWarmup() {
  if (warmupRunning) {
    return;
  }

  warmupRunning = true;

  try {
    await Promise.allSettled([
      services.home.getHome(),
      services.standings.getStandings(),
      services.playoffs.getPlayoffs(),
      services.teams.getTeams(),
      services.players.getPlayers({}),
      services.leaders.getLeaders(),
      services.calendar.getCalendar({})
    ]);
  } finally {
    warmupRunning = false;
  }
}

app.listen(env.port, () => {
  console.log(`[backend] http://127.0.0.1:${env.port}`);
  console.log(`[backend] detected season: ${NBA_SEASON} (${getSeasonPhase()})`);
  console.log(`[backend] frontend: http://127.0.0.1:5173`);
  console.log(`[backend] cache warmup enabled (${WARMUP_INTERVAL_MS} ms)`);
  void runWarmup();
  warmupTimer = setInterval(() => {
    void runWarmup();
  }, WARMUP_INTERVAL_MS);
  warmupTimer.unref();
});
