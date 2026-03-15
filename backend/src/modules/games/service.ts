import { cache } from "../../cache/memoryCache.js";
import { TTL } from "../../config/season.js";
import { getTeamIdentity } from "../../config/teams.js";
import type {
  ApiEnvelope,
  GameDataAvailability,
  GameDataAvailabilityStatus,
  GameDetail,
  GameLeader,
  GamePlayerLine,
  GameSummary
} from "../../types/dto.js";
import { safeNumber } from "../../utils/date.js";
import { loadScheduleSnapshotGames } from "../shared/datasets.js";
import { toEnvelope } from "../shared/envelope.js";
import type { ServiceDeps } from "../shared/types.js";

type BoxscorePlayer = Record<string, unknown>;
type BoxscoreGame = Record<string, unknown>;
type GameDetailState = {
  detail: GameDetail;
  source: string[];
};

function getPendingDataMessage(status: GameDataAvailabilityStatus) {
  if (status === "scheduled") {
    return "La partita deve ancora iniziare. Il boxscore e le statistiche saranno disponibili quando l'NBA pubblichera i dati.";
  }

  if (status === "pending") {
    return "I dati dettagliati di questa partita non sono ancora disponibili nell'API NBA.";
  }

  return null;
}

function resolveDataAvailability(game: GameSummary, hasBoxscoreData: boolean): GameDataAvailability {
  if (hasBoxscoreData) {
    return {
      status: "available",
      message: null
    };
  }

  const status = game.status === "scheduled" ? "scheduled" : "pending";

  return {
    status,
    message: getPendingDataMessage(status)
  };
}

function isUnavailableLiveBoxscoreError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const match = error.message.match(/NBA API (\d+)/i);
  const status = match ? Number(match[1]) : null;
  return status === 403 || status === 404;
}

function mapPlayer(player: BoxscorePlayer): GamePlayerLine {
  const statistics = (player.statistics as Record<string, unknown> | undefined) ?? {};
  const fullName =
    String(player.name ?? "") ||
    `${String(player.givenName ?? "")} ${String(player.familyName ?? "")}`.trim();
  const plusMinus = statistics.plusMinusPoints;

  return {
    playerId: safeNumber(player.personId ?? player.playerId),
    fullName,
    position: String(player.position ?? "") || null,
    starter: String(player.starter ?? "0") === "1",
    minutes: String(statistics.minutes ?? "") || null,
    points: safeNumber(statistics.points),
    rebounds: safeNumber(statistics.reboundsTotal),
    assists: safeNumber(statistics.assists),
    steals: safeNumber(statistics.steals),
    blocks: safeNumber(statistics.blocks),
    plusMinus: plusMinus !== undefined && plusMinus !== null && plusMinus !== "" ? safeNumber(plusMinus) : null
  };
}

function mapLeaders(players: GamePlayerLine[], teamId: number): GameLeader[] {
  return [...players]
    .sort((left, right) => right.points - left.points)
    .slice(0, 3)
    .map((player) => ({
      playerId: player.playerId,
      fullName: player.fullName,
      teamId,
      points: player.points,
      rebounds: player.rebounds,
      assists: player.assists
    }));
}

function mapBoxscoreGameSummary(game: BoxscoreGame, requestedGameId: string): GameSummary {
  const homeTeam = (game.homeTeam as Record<string, unknown>) ?? {};
  const awayTeam = (game.awayTeam as Record<string, unknown>) ?? {};
  const homeIdentity = getTeamIdentity(safeNumber(homeTeam.teamId));
  const awayIdentity = getTeamIdentity(safeNumber(awayTeam.teamId));
  const homeScoreRaw = homeTeam.score;
  const awayScoreRaw = awayTeam.score;

  return {
    gameId: String(game.gameId ?? requestedGameId),
    gameCode: String(game.gameCode ?? "") || null,
    dateTimeUtc: new Date(String(game.gameEt ?? game.gameDateTimeUTC ?? new Date().toISOString())).toISOString(),
    dateLabel: new Date(String(game.gameEt ?? game.gameDateTimeUTC ?? new Date().toISOString())).toLocaleString("it-IT", {
      dateStyle: "medium",
      timeStyle: "short"
    }),
    status: String(game.gameStatusText ?? "").toLowerCase().includes("final")
      ? "final"
      : safeNumber(game.gameStatus) === 2
        ? "live"
        : "scheduled",
    statusText: String(game.gameStatusText ?? ""),
    phase: String(game.seriesText ?? "").toLowerCase().includes("playoff") ? "playoffs" : "regular-season",
    arena: String((game.arena as Record<string, unknown> | undefined)?.arenaName ?? "") || null,
    nationalTv: [],
    clock: String(game.gameClock ?? "") || null,
    period: safeNumber(game.period, 0) || null,
    homeTeam: {
      teamId: safeNumber(homeTeam.teamId),
      name: homeIdentity?.name ?? `${homeTeam.teamCity ?? ""} ${homeTeam.teamName ?? ""}`.trim(),
      code: homeIdentity?.code ?? String(homeTeam.teamTricode ?? ""),
      logo: homeIdentity?.logo ?? "",
      score: homeScoreRaw !== undefined && homeScoreRaw !== null && homeScoreRaw !== "" ? safeNumber(homeScoreRaw) : null,
      record: String(homeTeam.wins ?? "") && String(homeTeam.losses ?? "") ? `${homeTeam.wins}-${homeTeam.losses}` : null
    },
    awayTeam: {
      teamId: safeNumber(awayTeam.teamId),
      name: awayIdentity?.name ?? `${awayTeam.teamCity ?? ""} ${awayTeam.teamName ?? ""}`.trim(),
      code: awayIdentity?.code ?? String(awayTeam.teamTricode ?? ""),
      logo: awayIdentity?.logo ?? "",
      score: awayScoreRaw !== undefined && awayScoreRaw !== null && awayScoreRaw !== "" ? safeNumber(awayScoreRaw) : null,
      record: String(awayTeam.wins ?? "") && String(awayTeam.losses ?? "") ? `${awayTeam.wins}-${awayTeam.losses}` : null
    }
  };
}

function buildBoxscoreDetail(game: BoxscoreGame, requestedGameId: string): GameDetail {
  const homeTeam = (game.homeTeam as Record<string, unknown>) ?? {};
  const awayTeam = (game.awayTeam as Record<string, unknown>) ?? {};
  const homePlayers = ((homeTeam.players as BoxscorePlayer[] | undefined) ?? []).map(mapPlayer);
  const awayPlayers = ((awayTeam.players as BoxscorePlayer[] | undefined) ?? []).map(mapPlayer);
  const gameSummary = mapBoxscoreGameSummary(game, requestedGameId);

  return {
    game: gameSummary,
    dataAvailability: resolveDataAvailability(gameSummary, homePlayers.length > 0 || awayPlayers.length > 0),
    homeLeaders: mapLeaders(homePlayers, safeNumber(homeTeam.teamId)),
    awayLeaders: mapLeaders(awayPlayers, safeNumber(awayTeam.teamId)),
    homePlayers,
    awayPlayers
  };
}

function buildUnavailableDetail(game: GameSummary): GameDetail {
  return {
    game,
    dataAvailability: resolveDataAvailability(game, false),
    homeLeaders: [],
    awayLeaders: [],
    homePlayers: [],
    awayPlayers: []
  };
}

export function createGamesService(deps: ServiceDeps) {
  return {
    async getGameDetail(gameId: string): Promise<ApiEnvelope<GameDetail>> {
      const state = await (deps.cache ?? cache).getOrLoad(`game-detail:${gameId}`, TTL.live, async () => {
        try {
          const response = (await deps.client.getLiveBoxscore(gameId)) as {
            game?: BoxscoreGame;
          };

          return {
            detail: buildBoxscoreDetail(response.game ?? {}, gameId),
            source: ["cdn.nba.com/static/json/liveData/boxscore"]
          } satisfies GameDetailState;
        } catch (error) {
          if (!isUnavailableLiveBoxscoreError(error)) {
            throw error;
          }

          const scheduleState = await loadScheduleSnapshotGames(deps);
          const scheduledGame = scheduleState.value.find((game) => game.gameId === gameId);

          if (!scheduledGame) {
            throw error;
          }

          return {
            detail: buildUnavailableDetail(scheduledGame),
            source: ["cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json"]
          } satisfies GameDetailState;
        }
      });

      return toEnvelope(state.value.detail, state.updatedAt, state.stale, state.value.source);
    }
  };
}
