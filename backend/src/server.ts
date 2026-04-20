import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { createServices } from "./modules/services.js";

const services = createServices();
const app = createApp(services);

let warmupRunning = false;

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
      services.players.getPlayers(),
      services.leaders.getLeaders(),
      services.calendar.getCalendar({})
    ]);
  } finally {
    warmupRunning = false;
  }
}

app.listen(env.port, () => {
  console.log(`NBA backend running on http://localhost:${env.port}`);

  if (!env.warmupEnabled) {
    return;
  }

  console.log(`Cache warmup enabled (interval ${env.warmupIntervalMs} ms)`);
  void runWarmup();
  const warmupTimer = setInterval(() => {
    void runWarmup();
  }, env.warmupIntervalMs);
  warmupTimer.unref();
});
