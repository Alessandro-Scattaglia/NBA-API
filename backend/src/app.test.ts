import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { createApiRouter } from "./routes/api.js";
import type { AppServices } from "./modules/services.js";

function createServicesStub(): AppServices {
  return {
    home: { getHome: async () => ({ data: {} as never, meta: { updatedAt: "", stale: false, source: ["test"] } }) },
    teams: {
      getTeams: async () => ({ data: {} as never, meta: { updatedAt: "", stale: false, source: ["test"] } }),
      getTeamDetail: async () => ({ data: {} as never, meta: { updatedAt: "", stale: false, source: ["test"] } })
    },
    players: {
      getPlayers: async () => ({ data: {} as never, meta: { updatedAt: "", stale: false, source: ["test"] } }),
      getPlayerDetail: async () => ({ data: {} as never, meta: { updatedAt: "", stale: false, source: ["test"] } })
    },
    standings: {
      getStandings: async () => ({ data: {} as never, meta: { updatedAt: "", stale: false, source: ["test"] } })
    },
    playoffs: {
      getPlayoffs: async () => ({ data: {} as never, meta: { updatedAt: "", stale: false, source: ["test"] } })
    },
    calendar: {
      getCalendar: async () => ({ data: {} as never, meta: { updatedAt: "", stale: false, source: ["test"] } })
    },
    games: {
      getGameDetail: async () => ({ data: {} as never, meta: { updatedAt: "", stale: false, source: ["test"] } })
    },
    leaders: {
      getLeaders: async () => ({ data: {} as never, meta: { updatedAt: "", stale: false, source: ["test"] } })
    }
  };
}

describe("app and router setup", () => {
  it("creates an express app instance", () => {
    const app = createApp(createServicesStub());

    expect(typeof app).toBe("function");
    expect(typeof app.use).toBe("function");
  });

  it("registers all public api routes", () => {
    const router = createApiRouter(createServicesStub());
    const paths = router.stack
      .map((layer) => layer.route?.path)
      .filter((path): path is string => Boolean(path))
      .sort();

    expect(paths).toEqual([
      "/calendar",
      "/games/:gameId",
      "/health",
      "/home",
      "/leaders",
      "/players",
      "/players/:playerId",
      "/playoffs",
      "/standings",
      "/teams",
      "/teams/:teamId"
    ]);
  });
});
