import { cache } from "../../cache/memoryCache.js";
import { TTL } from "../../config/season.js";
import { getTeamIdentity, getTeamIdentityByCode } from "../../config/teams.js";
import type {
  ApiEnvelope,
  GameDataAvailability,
  GameDataAvailabilityStatus,
  GameDetail,
  GameLeader,
  GamePlayerLine,
  GameSummary
} from "../../types/dto/index.js";
import { safeNumber } from "../../utils/date.js";
import { loadPlayerCatalog, loadScheduleSnapshotGames, resolveNbaGameId } from "../shared/datasets.js";
import { toEnvelope } from "../shared/envelope.js";
import type { ServiceDeps } from "../shared/types.js";
import { parseCanonicalGameId, resolveGameIdentity } from "../shared/gameIdentity.js";

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

  const match = error.message.match(/API (\d+)/i);
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
    headshot: String(player.headshot ?? "") || null,
    position: String(player.position ?? "") || null,
    starter: String(player.starter ?? "0") === "1",
    minutes: String(statistics.minutes ?? "") || null,
    points: safeNumber(statistics.points),
    rebounds: safeNumber(statistics.reboundsTotal),
    assists: safeNumber(statistics.assists),
    steals: safeNumber(statistics.steals),
    blocks: safeNumber(statistics.blocks),
    plusMinus: plusMinus !== undefined && plusMinus !== null && plusMinus !== "" ? safeNumber(plusMinus) : null,
    turnovers: safeNumber(statistics.turnovers)
  };
}

function stableInternalPlayerId(name: string, teamCode: string) {
  let hash = 7;
  for (const character of `${teamCode}:${name}`) {
    hash = (hash * 31 + character.charCodeAt(0)) % 2_000_000_000;
  }
  return -Math.max(1, hash);
}

function readEspnStatistic(values: unknown[], names: string[], aliases: string[]) {
  const index = names.findIndex((name) => aliases.includes(name.trim().toLowerCase()));
  return index >= 0 ? values[index] : null;
}

function mapLeaders(players: GamePlayerLine[], teamId: number): GameLeader[] {
  return [...players]
    .sort((left, right) => right.points - left.points)
    .slice(0, 3)
    .map((player) => ({
      playerId: player.playerId,
      fullName: player.fullName,
      headshot: player.headshot,
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

function normalizePlayerName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

async function reconcileEspnPlayerIds(detail: GameDetail, deps: ServiceDeps) {
  const allPlayers = [...detail.homePlayers, ...detail.awayPlayers];
  if (allPlayers.length === 0) {
    return detail;
  }

  let catalog: Awaited<ReturnType<typeof loadPlayerCatalog>>;
  try {
    catalog = await loadPlayerCatalog(deps);
  } catch (error) {
    console.warn(
      "[games] NBA player ID reconciliation unavailable",
      error instanceof Error ? error.message : error
    );
    return detail;
  }
  const playersByName = new Map(
    catalog.value.map((player) => [normalizePlayerName(player.fullName), player.playerId])
  );
  const resolvedIds = new Map<number, number>();

  for (const player of allPlayers) {
    const playerId = playersByName.get(normalizePlayerName(player.fullName));
    if (playerId) {
      resolvedIds.set(player.playerId, playerId);
    }
  }

  if (resolvedIds.size === 0) {
    return detail;
  }

  const resolveId = (playerId: number) => resolvedIds.get(playerId) ?? playerId;
  return {
    ...detail,
    homePlayers: detail.homePlayers.map((player) => ({ ...player, playerId: resolveId(player.playerId) })),
    awayPlayers: detail.awayPlayers.map((player) => ({ ...player, playerId: resolveId(player.playerId) })),
    homeLeaders: detail.homeLeaders.map((leader) => ({ ...leader, playerId: resolveId(leader.playerId) })),
    awayLeaders: detail.awayLeaders.map((leader) => ({ ...leader, playerId: resolveId(leader.playerId) }))
  };
}

async function findEspnEventId(
  client: ServiceDeps["client"],
  game: GameSummary
) {
  if (!client.getEspnScoreboardByDate) return null;
  const response = await client.getEspnScoreboardByDate(game.dateTimeUtc.slice(0, 10));
  const events = (response as { events?: Array<Record<string, unknown>> }).events ?? [];
  return events.find((event) => {
    const competition = (event.competitions as Array<Record<string, unknown>> | undefined)?.[0];
    const competitors = competition?.competitors as Array<Record<string, unknown>> | undefined;
    const codes = competitors?.map((competitor) => String((competitor.team as Record<string, unknown>)?.abbreviation ?? "")) ?? [];
    return codes.includes(game.homeTeam.code) && codes.includes(game.awayTeam.code);
  });
}

export function mapEspnSummaryToBoxscore(response: unknown, requestedGameId: string): BoxscoreGame {
  const payload = response as { header?: Record<string, unknown>; boxscore?: Record<string, unknown> };
  const competition = (payload.header?.competitions as Array<Record<string, unknown>> | undefined)?.[0];
  const competitors = competition?.competitors as Array<Record<string, unknown>> | undefined;
  if (!competition || !competitors || competitors.length < 2) {
    throw new Error("ESPN returned an invalid game summary.");
  }

  const mapTeam = (competitor: Record<string, unknown>) => {
    const team = competitor.team as Record<string, unknown>;
    const athletes = (payload.boxscore?.players as Array<Record<string, unknown>> | undefined)?.find(
      (entry) => (entry.team as Record<string, unknown> | undefined)?.id === team.id
    );
    const players = ((athletes?.statistics as Array<Record<string, unknown>> | undefined) ?? []).flatMap((stat) =>
      ((stat.athletes as Array<Record<string, unknown>> | undefined) ?? []).map((athlete) => {
        const athleteData = athlete.athlete as Record<string, unknown>;
        const headshot = athleteData.headshot as Record<string, unknown> | undefined;
        const values = (athlete.stats as unknown[] | undefined) ??
          (athlete.statistics as unknown[] | undefined) ??
          [];
        const names = ((stat.names as string[] | undefined) ?? []).map((name) => name.toLowerCase());
        const teamCode = String(team.abbreviation ?? "");
        const playerName = String(athleteData.displayName ?? "");
        return {
        personId: stableInternalPlayerId(playerName, teamCode),
        name: playerName,
        headshot: String(headshot?.href ?? "") || null,
        starter: athlete.starter ? "1" : "0",
        position: String((athleteData.position as Record<string, unknown> | undefined)?.abbreviation ?? ""),
        statistics: {
          minutes: String(readEspnStatistic(values, names, ["min", "minutes"]) ?? ""),
          points: safeNumber(readEspnStatistic(values, names, ["pts", "points"])),
          reboundsTotal: safeNumber(readEspnStatistic(values, names, ["reb", "tr", "total rebounds", "rebounds"])),
          assists: safeNumber(readEspnStatistic(values, names, ["ast", "assists"])),
          steals: safeNumber(readEspnStatistic(values, names, ["stl", "steals"])),
          blocks: safeNumber(readEspnStatistic(values, names, ["blk", "blocks"])),
          plusMinusPoints: safeNumber(readEspnStatistic(values, names, ["+/-", "plus/minus", "plusminus"])),
          turnovers: safeNumber(readEspnStatistic(values, names, ["to", "turnovers", "tov"]))
        }
        };
      })
    );
    return {
      teamId: getTeamIdentityByCode(String(team.abbreviation ?? ""))?.teamId ?? 0,
      teamCity: String(team.location ?? ""),
      teamName: String(team.name ?? ""),
      teamTricode: String(team.abbreviation ?? ""),
      score: safeNumber(competitor.score),
      players
    };
  };

  const home = competitors.find((competitor) => competitor.homeAway === "home") ?? competitors[0];
  const away = competitors.find((competitor) => competitor.homeAway === "away") ?? competitors[1];
  return {
    gameId: requestedGameId,
    gameDateTimeUTC: String(competition.date ?? new Date().toISOString()),
    gameStatusText: String(
      ((competition.status as Record<string, unknown> | undefined)?.type as Record<string, unknown> | undefined)
        ?.description ?? ""
    ),
    homeTeam: mapTeam(home),
    awayTeam: mapTeam(away)
  };
}

export function createGamesService(deps: ServiceDeps) {
  return {
    async getGameDetail(gameId: string): Promise<ApiEnvelope<GameDetail>> {
      const state = await (deps.cache ?? cache).getOrLoad(`game-detail:v3:${gameId}`, TTL.live, async () => {
        const identity = resolveGameIdentity(gameId);
        const canonical = parseCanonicalGameId(gameId);
        let nbaGameId = identity.nbaGameId;

        if (identity.espnEventId && deps.client.getEspnGameSummary) {
          const response = await deps.client.getEspnGameSummary(identity.espnEventId);
          return {
            detail: await reconcileEspnPlayerIds(
              buildBoxscoreDetail(mapEspnSummaryToBoxscore(response, gameId), gameId),
              deps
            ),
            source: ["ESPN summary"]
          } satisfies GameDetailState;
        }

        if (canonical) {
          const scheduleState = await loadScheduleSnapshotGames(deps);
          const scheduledGame = scheduleState.value.find(
            (game) =>
              game.canonicalId === gameId ||
              (game.dateTimeUtc.slice(0, 10) === canonical.date &&
                game.homeTeam.code === canonical.homeCode &&
                game.awayTeam.code === canonical.awayCode)
          );
          nbaGameId = scheduledGame ? resolveNbaGameId(scheduledGame.canonicalId ?? gameId) : null;
        }

        try {
          if (!nbaGameId) throw new Error("No NBA Game ID resolved for canonical game.");
          const response = (await deps.client.getLiveBoxscore(nbaGameId)) as {
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

          if (deps.client.getEspnGameSummary && identity.espnEventId) {
            const response = await deps.client.getEspnGameSummary(identity.espnEventId);
            return {
              detail: await reconcileEspnPlayerIds(
                buildBoxscoreDetail(mapEspnSummaryToBoxscore(response, nbaGameId ?? gameId), gameId),
                deps
              ),
              source: ["ESPN summary"]
            } satisfies GameDetailState;
          }

          const scheduleState = await loadScheduleSnapshotGames(deps);
          const scheduledGame = scheduleState.value.find(
            (game) => game.gameId === gameId || game.canonicalId === gameId
          );

          if (!scheduledGame) {
            throw error;
          }

          if (deps.client.getEspnGameSummary) {
            try {
              const event = await findEspnEventId(deps.client, scheduledGame);
              const eventId = String(event?.id ?? "");
              if (eventId) {
                const response = await deps.client.getEspnGameSummary(eventId);
                return {
                  detail: await reconcileEspnPlayerIds(
                    buildBoxscoreDetail(mapEspnSummaryToBoxscore(response, nbaGameId ?? gameId), gameId),
                    deps
                  ),
                  source: ["ESPN summary", "NBA CDN schedule"]
                } satisfies GameDetailState;
              }
            } catch (fallbackError) {
              console.warn(
                "[games] ESPN boxscore fallback failed",
                fallbackError instanceof Error ? fallbackError.message : fallbackError
              );
            }
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
