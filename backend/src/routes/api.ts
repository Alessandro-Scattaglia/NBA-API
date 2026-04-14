import { Router } from "express";
import { z } from "zod";
import type { AppServices } from "../modules/services.js";

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
      next(error);
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
      next(error);
    }
  });

  router.get("/playoffs", async (_request, response, next) => {
    try {
      response.json(await services.playoffs.getPlayoffs());
    } catch (error) {
      next(error);
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
