import { Router } from "express";
import { z } from "zod";
import { TEAM_DIRECTORY } from "../config/teams.js";
import type { AppServices } from "../modules/services.js";
import type {
  ApiEnvelope,
  PlayoffsResponse,
  PostseasonConferenceSnapshot,
  StandingsResponse,
  StandingsRow,
  TeamsResponse
} from "../types/dto.js";

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
      season: "2025-26",
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
      season: "2025-26",
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
      season: "2025-26",
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
  const router = Router();

  router.get("/health", (_request, response) => {
    response.json({
      ok: true,
      season: "2025-26"
    });
  });

  router.get("/home", async (_request, response, next) => {
    try {
      response.json(await services.home.getHome());
    } catch (error) {
      next(error);
    }
  });

  router.get("/teams", async (_request, response, next) => {
    try {
      response.json(await services.teams.getTeams());
    } catch (error) {
      logFallback("/teams", error);
      response.json(buildFallbackTeamsEnvelope());
    }
  });

  router.get("/teams/:teamId", async (request, response, next) => {
    try {
      const teamId = parseWithSchema(idParamSchema, request.params.teamId);
      response.json(await services.teams.getTeamDetail(teamId));
    } catch (error) {
      next(error);
    }
  });

  router.get("/players", async (request, response, next) => {
    try {
      const filters = parseWithSchema(playersQuerySchema, request.query);
      response.json(await services.players.getPlayers(filters));
    } catch (error) {
      next(error);
    }
  });

  router.get("/players/:playerId", async (request, response, next) => {
    try {
      const playerId = parseWithSchema(idParamSchema, request.params.playerId);
      response.json(await services.players.getPlayerDetail(playerId));
    } catch (error) {
      next(error);
    }
  });

  router.get("/standings", async (_request, response, next) => {
    try {
      response.json(await services.standings.getStandings());
    } catch (error) {
      logFallback("/standings", error);
      response.json(buildFallbackStandingsEnvelope());
    }
  });

  router.get("/playoffs", async (_request, response, next) => {
    try {
      response.json(await services.playoffs.getPlayoffs());
    } catch (error) {
      logFallback("/playoffs", error);
      response.json(buildFallbackPlayoffsEnvelope());
    }
  });

  router.get("/calendar", async (request, response, next) => {
    try {
      const filters = parseWithSchema(calendarQuerySchema, request.query);
      response.json(await services.calendar.getCalendar(filters));
    } catch (error) {
      next(error);
    }
  });

  router.get("/games/:gameId", async (request, response, next) => {
    try {
      response.json(await services.games.getGameDetail(request.params.gameId));
    } catch (error) {
      next(error);
    }
  });

  router.get("/leaders", async (request, response, next) => {
    try {
      const query = parseWithSchema(leadersQuerySchema, request.query);
      response.json(await services.leaders.getLeaders(query.limit));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
