import { Hono } from "hono";
import { z } from "zod";
import { getCurrentSeason } from "../config/season.js";
import { buildApiMeta, requireValidSeason, seasonQuerySchema } from "./season.js";
import { TEAM_DIRECTORY } from "../config/teams.js";
import type { AppServices } from "../modules/services.js";
import { getProviderHealth } from "../monitoring/providerHealth.js";
import type {
  ApiEnvelope,
  CalendarResponse,
  LeaderCategoryKey,
  LeadersResponse,
  PlayoffsResponse,
  PlayersResponse,
  PostseasonConferenceSnapshot,
  StandingsResponse,
  StandingsRow,
  TeamDetail,
  TeamsResponse
} from "../types/dto/index.js";

const idParamSchema = z.coerce.number().int().positive();
const playersQuerySchema = z.object({
  search: z.string().optional(),
  teamId: z.coerce.number().int().positive().optional(),
  position: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(50).optional()
});
const calendarQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  teamId: z.coerce.number().int().positive().optional(),
  status: z.enum(["scheduled", "live", "final"]).optional(),
  phase: z.enum(["preseason", "regular-season", "play-in", "playoffs", "other"]).optional()
});
const leadersQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(20).optional()
});

const FALLBACK_SOURCES = [
  "fallback/local-team-directory"
];

const PLAY_IN_NOTES = [
  "Le squadre classificate dalla 1 alla 6 vanno direttamente ai playoff.",
  "Le squadre dalla 7 alla 10 giocano il Play-In Tournament per assegnare le seed 7 e 8.",
  "Il formato corrente prevede 7 vs 8 e 9 vs 10, poi la seed 8 si decide tra la perdente di 7 vs 8 e la vincente di 9 vs 10."
];

const LEADER_CATEGORY_LABELS: Record<LeaderCategoryKey, string> = {
  points: "Punti a partita",
  rebounds: "Rimbalzi a partita",
  assists: "Assist a partita",
  steals: "Rubate a partita",
  blocks: "Stoppate a partita",
  threesMade: "Triple a partita"
};

function getFallbackMeta() {
  return {
    updatedAt: new Date().toISOString(),
    stale: true,
    source: FALLBACK_SOURCES
  };
}

function derivePlayoffStatus(conferenceRank: number) {
  if (conferenceRank <= 6) {
    return "playoff" as const;
  }

  if (conferenceRank <= 10) {
    return "play-in" as const;
  }

  return "in-the-hunt" as const;
}

function buildFallbackConferenceRows(conference: "East" | "West") {
  return TEAM_DIRECTORY
    .filter((team) => team.conference === conference)
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((team, index) => {
      const conferenceRank = index + 1;

      return {
        ...team,
        seed: conferenceRank,
        wins: 0,
        losses: 0,
        gamesPlayed: 0,
        remainingGames: 82,
        winPct: 0,
        gamesBehind: conferenceRank === 1 ? 0 : 0,
        conferenceRank,
        homeRecord: "--",
        awayRecord: "--",
        lastTen: "--",
        streak: "--",
        playoffStatus: derivePlayoffStatus(conferenceRank),
        clinchedPlayoff: false,
        clinchedDivision: false,
        clinchedConference: false
      } satisfies StandingsRow;
    });
}

function buildFallbackStandingsSplit() {
  return {
    east: buildFallbackConferenceRows("East"),
    west: buildFallbackConferenceRows("West")
  };
}

function buildFallbackTeamsEnvelope(): ApiEnvelope<TeamsResponse> {
  const split = buildFallbackStandingsSplit();

  return {
    data: {
        season: getCurrentSeason(),
      east: split.east,
      west: split.west
    },
    meta: getFallbackMeta()
  };
}

function buildFallbackStandingsEnvelope(): ApiEnvelope<StandingsResponse> {
  const split = buildFallbackStandingsSplit();

  return {
    data: {
        season: getCurrentSeason(),
      east: split.east,
      west: split.west,
      playInNotes: PLAY_IN_NOTES
    },
    meta: getFallbackMeta()
  };
}

function buildFallbackConferenceSnapshot(
  conference: "East" | "West",
  rows: StandingsRow[]
): PostseasonConferenceSnapshot {
  const bySeed = new Map(rows.map((row) => [row.seed, row]));

  return {
    conference,
    directSeeds: rows.filter((row) => row.seed <= 6),
    playInSeeds: rows.filter((row) => row.seed >= 7 && row.seed <= 10),
    outsidePicture: rows.filter((row) => row.seed > 10),
    playInSeries: [
      {
        conference,
        round: "play-in",
        status: "scheduled",
        label: `(${7}) ${bySeed.get(7)?.name ?? "TBD"} vs. (${8}) ${bySeed.get(8)?.name ?? "TBD"}`,
        seedHigh: 7,
        seedLow: 8,
        highSeedTeam: bySeed.get(7) ?? null,
        lowSeedTeam: bySeed.get(8) ?? null,
        note: "La vincente entra nei playoff come seed n. 7.",
        games: []
      },
      {
        conference,
        round: "play-in",
        status: "scheduled",
        label: `(${9}) ${bySeed.get(9)?.name ?? "TBD"} vs. (${10}) ${bySeed.get(10)?.name ?? "TBD"}`,
        seedHigh: 9,
        seedLow: 10,
        highSeedTeam: bySeed.get(9) ?? null,
        lowSeedTeam: bySeed.get(10) ?? null,
        note: "La perdente viene eliminata; la vincente si gioca poi la seed n. 8.",
        games: []
      }
    ],
    semifinalsSeries: [],
    conferenceFinalsSeries: [],
    firstRoundSeries: [
      {
        conference,
        round: "first-round",
        status: "confirmed",
        label: `(${1}) ${bySeed.get(1)?.name ?? "TBD"} vs. (${8}) ${bySeed.get(8)?.name ?? "TBD"}`,
        seedHigh: 1,
        seedLow: 8,
        highSeedTeam: bySeed.get(1) ?? null,
        lowSeedTeam: bySeed.get(8) ?? null,
        note: "Serie del primo turno confermata.",
        games: []
      },
      {
        conference,
        round: "first-round",
        status: "confirmed",
        label: `(${2}) ${bySeed.get(2)?.name ?? "TBD"} vs. (${7}) ${bySeed.get(7)?.name ?? "TBD"}`,
        seedHigh: 2,
        seedLow: 7,
        highSeedTeam: bySeed.get(2) ?? null,
        lowSeedTeam: bySeed.get(7) ?? null,
        note: "Serie del primo turno confermata.",
        games: []
      },
      {
        conference,
        round: "first-round",
        status: "confirmed",
        label: `(${3}) ${bySeed.get(3)?.name ?? "TBD"} vs. (${6}) ${bySeed.get(6)?.name ?? "TBD"}`,
        seedHigh: 3,
        seedLow: 6,
        highSeedTeam: bySeed.get(3) ?? null,
        lowSeedTeam: bySeed.get(6) ?? null,
        note: "Serie del primo turno confermata.",
        games: []
      },
      {
        conference,
        round: "first-round",
        status: "confirmed",
        label: `(${4}) ${bySeed.get(4)?.name ?? "TBD"} vs. (${5}) ${bySeed.get(5)?.name ?? "TBD"}`,
        seedHigh: 4,
        seedLow: 5,
        highSeedTeam: bySeed.get(4) ?? null,
        lowSeedTeam: bySeed.get(5) ?? null,
        note: "Serie del primo turno confermata.",
        games: []
      }
    ]
  };
}

function buildFallbackPlayoffsEnvelope(): ApiEnvelope<PlayoffsResponse> {
  const split = buildFallbackStandingsSplit();
  const east = buildFallbackConferenceSnapshot("East", split.east);
  const west = buildFallbackConferenceSnapshot("West", split.west);

  return {
    data: {
        season: getCurrentSeason(),
      overview: {
        directQualifiedTeams: east.directSeeds.length + west.directSeeds.length,
        playInTeams: east.playInSeeds.length + west.playInSeeds.length,
        confirmedFirstRoundSeries: east.firstRoundSeries.length + west.firstRoundSeries.length,
        playInGamesScheduled: 0,
        playoffGamesScheduled: 0
      },
      keyDates: [],
      finalsDates: [],
      formatNotes: PLAY_IN_NOTES,
      east,
      west,
      playInGames: [],
      playoffGames: []
    },
    meta: getFallbackMeta()
  };
}

function buildFallbackTeamDetailEnvelope(teamId: number): ApiEnvelope<TeamDetail> {
  const split = buildFallbackStandingsSplit();
  const base = [...split.east, ...split.west].find((team) => team.teamId === teamId);

  if (!base) {
    const error = new Error(`Team ${teamId} not found`);
    (error as Error & { status?: number }).status = 404;
    throw error;
  }

  return {
    data: {
      ...base,
      arena: null,
      foundedYear: null,
      coaches: [],
      stats: null,
      roster: [],
      recentGames: []
    },
    meta: getFallbackMeta()
  };
}

function buildFallbackPlayersEnvelope(page = 1, pageSize = 30): ApiEnvelope<PlayersResponse> {
  return {
    data: {
        season: getCurrentSeason(),
      total: 0,
      page,
      pageSize,
      items: []
    },
    meta: getFallbackMeta()
  };
}

function buildFallbackLeadersEnvelope(): ApiEnvelope<LeadersResponse> {
  return {
    data: {
        season: getCurrentSeason(),
      categories: Object.entries(LEADER_CATEGORY_LABELS).map(([key, label]) => ({
        key: key as LeaderCategoryKey,
        label,
        leaders: []
      }))
    },
    meta: getFallbackMeta()
  };
}

function buildFallbackCalendarEnvelope(from?: string, to?: string): ApiEnvelope<CalendarResponse> {
  const season = getCurrentSeason();

  return {
    data: {
      season,
      from: from ?? "",
      to: to ?? "",
      total: 0,
      items: []
    },
    meta: {
      updatedAt: new Date().toISOString(),
      stale: true,
      source: ["fallback"]
    }
  };
}

function isClientError(error: unknown) {
  const status = (error as { status?: number } | null)?.status;
  return typeof status === "number" && status >= 400 && status < 500;
}

function logFallback(route: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.warn(`[fallback] ${route}: ${message}`);
}

function parseWithSchema<T>(schema: z.ZodType<T>, value: unknown) {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const error = new Error(parsed.error.issues.map((issue) => issue.message).join(", "));
    (error as Error & { status?: number }).status = 400;
    throw error;
  }

  return parsed.data;
}

export function createApiRouter(services: AppServices) {
  const router = new Hono();

  router.get("/health", (c) => {
    const season = getCurrentSeason();

    return c.json({
      ok: true,
      app: "nba-api-local",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      season,
      seasonPhase: "regular-season",
      status: "online",
      cache: services.cache.getStats(),
      providers: getProviderHealth(),
      source: "local-nba-data"
    });
  });

  router.get("/seasons", (c) => {
    const season = getCurrentSeason();
    const currentYear = Number(season.slice(0, 4));
    const seasons = Array.from({ length: 6 }, (_, index) => {
      const startYear = currentYear - index;
      return `${startYear}-${String(startYear + 1).slice(-2).padStart(2, "0")}`;
    });

    return c.json({
      data: {
        current: season,
        supported: seasons,
        phase: "regular-season",
        timestamp: new Date().toISOString()
      },
      meta: buildApiMeta(season, false)
    });
  });

  router.get("/seasons/current", (c) => {
    const season = getCurrentSeason();

    return c.json({
      data: {
        season,
        phase: "regular-season",
        timestamp: new Date().toISOString()
      },
      meta: buildApiMeta(season, false)
    });
  });

  router.get("/home", async (c) => {
    try {
      return c.json(await services.home.getHome());
    } catch (error) {
      throw error;
    }
  });

  router.get("/teams", async (c) => {
    try {
      const seasonValue = requireValidSeason(c.req.query("season"));
      if (seasonValue) {
        void seasonValue;
      }
      return c.json(await services.teams.getTeams());
    } catch (error) {
      logFallback("/teams", error);
      return c.json(buildFallbackTeamsEnvelope());
    }
  });

  router.get("/teams/:teamId", async (c) => {
    let teamId: number | undefined;

    try {
      teamId = parseWithSchema(idParamSchema, c.req.param("teamId"));
      return c.json(await services.teams.getTeamDetail(teamId));
    } catch (error) {
      if (isClientError(error) || teamId === undefined) {
        throw error;
      }

      logFallback("/teams/:teamId", error);
      return c.json(buildFallbackTeamDetailEnvelope(teamId));
    }
  });

  router.get("/players", async (c) => {
    let filters: z.infer<typeof playersQuerySchema> | undefined;

    try {
      requireValidSeason(c.req.query("season"));
      filters = parseWithSchema(playersQuerySchema, c.req.query());
      return c.json(await services.players.getPlayers(filters));
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }

      logFallback("/players", error);
      return c.json(buildFallbackPlayersEnvelope(filters?.page ?? 1, filters?.pageSize ?? 30));
    }
  });

  router.get("/players/:playerId", async (c) => {
    let playerId: number | undefined;

    try {
      playerId = parseWithSchema(idParamSchema, c.req.param("playerId"));
      return c.json(await services.players.getPlayerDetail(playerId));
    } catch (error) {
      throw error;
    }
  });

  router.get("/standings", async (c) => {
    try {
      requireValidSeason(c.req.query("season"));
      return c.json(await services.standings.getStandings());
    } catch (error) {
      logFallback("/standings", error);
      return c.json(buildFallbackStandingsEnvelope());
    }
  });

  router.get("/playoffs", async (c) => {
    try {
      requireValidSeason(c.req.query("season"));
      return c.json(await services.playoffs.getPlayoffs());
    } catch (error) {
      logFallback("/playoffs", error);
      return c.json(buildFallbackPlayoffsEnvelope());
    }
  });

  router.get("/calendar", async (c) => {
    let filters: z.infer<typeof calendarQuerySchema> | undefined;

    try {
      requireValidSeason(c.req.query("season"));
      filters = parseWithSchema(calendarQuerySchema, c.req.query());
      return c.json(await services.calendar.getCalendar(filters));
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }

      logFallback("/calendar", error);
      return c.json(buildFallbackCalendarEnvelope(filters?.from, filters?.to));
    }
  });

  router.get("/games/:gameId", async (c) => {
    try {
      return c.json(await services.games.getGameDetail(c.req.param("gameId")));
    } catch (error) {
      throw error;
    }
  });

  router.get("/leaders", async (c) => {
    let query: z.infer<typeof leadersQuerySchema> | undefined;

    try {
      requireValidSeason(c.req.query("season"));
      query = parseWithSchema(leadersQuerySchema, c.req.query());
      return c.json(await services.leaders.getLeaders(query.limit));
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }

      logFallback("/leaders", error);
      return c.json(buildFallbackLeadersEnvelope());
    }
  });

  return router;
}
