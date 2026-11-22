import { mapAllStatsRows, mapStatsRows } from "../../utils/stats.js";
import type { ApiEnvelope, GameSummary, TeamDetail, TeamsResponse } from "../../types/dto/index.js";
import { getCurrentSeason, TTL } from "../../config/season.js";
import { cache } from "../../cache/memoryCache.js";
import { getTeamIdentity, getTeamIdentityByCode } from "../../config/teams.js";
import { buildPlayerHeadshotUrl } from "../../utils/assets.js";
import { loadPlayerCatalog, loadRecentGames, loadScheduleSnapshotGames, loadStandings, loadTeamStats, mapEspnScoreboardGames, splitByConference } from "../shared/datasets.js";
import { toEnvelope } from "../shared/envelope.js";
import type { ServiceDeps } from "../shared/types.js";

type StatsRow = Record<string, unknown>;

function getRowValue(row: StatsRow, keys: string[]) {
  const key = Object.keys(row).find((candidate) => keys.some((wanted) => candidate.toLowerCase() === wanted.toLowerCase()));
  return key ? row[key] : undefined;
}

function getNullableNumber(row: StatsRow, key: string) {
  const value = row[key];

  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getRecentGameScores(row: StatsRow) {
  const teamScore = getNullableNumber(row, "PTS");
  const plusMinus = getNullableNumber(row, "PLUS_MINUS");
  const opponentScore = teamScore !== null && plusMinus !== null ? Math.round(teamScore - plusMinus) : null;

  return {
    teamScore,
    opponentScore
  };
}

function hasReliableFinalScore(game: GameSummary) {
  return game.status === "final" && game.homeTeam.score !== null && game.awayTeam.score !== null && game.homeTeam.score + game.awayTeam.score > 0;
}

function buildFallbackRecentGame(teamId: number, row: StatsRow): GameSummary {
  const team = getTeamIdentity(teamId);
  const matchup = String(row.MATCHUP ?? "");
  const opponentCode = matchup.split(" ").pop() ?? "";
  const opponent = getTeamIdentityByCode(opponentCode);
  const isHome = matchup.includes("vs.");
  const { teamScore, opponentScore } = getRecentGameScores(row);

  return {
    gameId: String(row.Game_ID ?? row.GAME_ID ?? ""),
    gameCode: null,
    dateTimeUtc: new Date(String(row.GAME_DATE ?? new Date().toISOString())).toISOString(),
    dateLabel: new Date(String(row.GAME_DATE ?? new Date().toISOString())).toLocaleString("it-IT", {
      dateStyle: "medium",
      timeStyle: "short"
    }),
    status: "final",
    statusText: String(row.WL ?? ""),
    phase: "regular-season",
    arena: null,
    nationalTv: [],
    clock: null,
    period: null,
    homeTeam: {
      teamId: isHome ? teamId : opponent?.teamId ?? 0,
      name: isHome ? team?.name ?? "Home Team" : opponent?.name ?? opponentCode,
      code: isHome ? team?.code ?? "" : opponent?.code ?? opponentCode,
      logo: isHome ? team?.logo ?? "" : opponent?.logo ?? "",
      score: isHome ? teamScore : opponentScore,
      record: null
    },
    awayTeam: {
      teamId: isHome ? opponent?.teamId ?? 0 : teamId,
      name: isHome ? opponent?.name ?? opponentCode : team?.name ?? "Away Team",
      code: isHome ? opponent?.code ?? opponentCode : team?.code ?? "",
      logo: isHome ? opponent?.logo ?? "" : team?.logo ?? "",
      score: isHome ? opponentScore : teamScore,
      record: null
    }
  };
}

export function mergeRecentGame(
  fallbackGame: GameSummary,
  row: StatsRow,
  scheduledGame: GameSummary | undefined
) {
  if (!scheduledGame) {
    return fallbackGame;
  }

  return {
    ...scheduledGame,
    status: hasReliableFinalScore(scheduledGame) ? scheduledGame.status : fallbackGame.status,
    statusText: String(row.WL ?? "") || scheduledGame.statusText,
    homeTeam: {
      ...scheduledGame.homeTeam,
      score: hasReliableFinalScore(scheduledGame) ? scheduledGame.homeTeam.score : fallbackGame.homeTeam.score
    },
    awayTeam: {
      ...scheduledGame.awayTeam,
      score: hasReliableFinalScore(scheduledGame) ? scheduledGame.awayTeam.score : fallbackGame.awayTeam.score
    }
  } satisfies GameSummary;
}

function mapRecentGames(teamId: number, rows: StatsRow[], scheduleByGameId: Map<string, GameSummary>): GameSummary[] {
  return rows.slice(0, 5).map((row) => {
    const fallbackGame = buildFallbackRecentGame(teamId, row);
    return mergeRecentGame(fallbackGame, row, scheduleByGameId.get(fallbackGame.gameId));
  });
}

function buildRecentGamesFromSchedule(teamId: number, scheduleGames: GameSummary[]) {
  const now = Date.now();

  return scheduleGames
    .filter((game) => game.homeTeam.teamId === teamId || game.awayTeam.teamId === teamId)
    // The CDN schedule can lag behind the scoreboard and leave past games as
    // scheduled. A played game with a completed date belongs in the history.
    .filter((game) => game.status === "final" || (Date.parse(game.dateTimeUtc) <= now && hasReliableFinalScore(game)))
    .map((game) => game.status === "final" ? game : { ...game, status: "final", statusText: "Finita" } satisfies GameSummary)
    .sort((left, right) => Date.parse(right.dateTimeUtc) - Date.parse(left.dateTimeUtc))
    .slice(0, 5);
}

function buildUpcomingGamesFromSchedule(teamId: number, scheduleGames: GameSummary[]) {
  const now = Date.now();
  return scheduleGames
    .filter((game) => game.status === "scheduled")
    .filter((game) => game.homeTeam.teamId === teamId || game.awayTeam.teamId === teamId)
    .filter((game) => Date.parse(game.dateTimeUtc) > now)
    .sort((left, right) => Date.parse(left.dateTimeUtc) - Date.parse(right.dateTimeUtc))
    .slice(0, 5);
}

export function mergeUniqueRecentGames(primary: GameSummary[], fallback: GameSummary[]) {
  const byGameId = new Map<string, GameSummary>();

  for (const game of primary) {
    byGameId.set(game.gameId, game);
  }

  for (const game of fallback) {
    const current = byGameId.get(game.gameId);
    if (!current) {
      byGameId.set(game.gameId, game);
      continue;
    }

    byGameId.set(game.gameId, {
      ...current,
      status: hasReliableFinalScore(current) ? current.status : game.status,
      statusText: hasReliableFinalScore(current) ? current.statusText : game.statusText || current.statusText,
      homeTeam: {
        ...current.homeTeam,
        score: hasReliableFinalScore(current) ? current.homeTeam.score : game.homeTeam.score,
        record: current.homeTeam.record ?? game.homeTeam.record
      },
      awayTeam: {
        ...current.awayTeam,
        score: hasReliableFinalScore(current) ? current.awayTeam.score : game.awayTeam.score,
        record: current.awayTeam.record ?? game.awayTeam.record
      }
    });
  }

  return Array.from(byGameId.values())
    .sort((left, right) => Date.parse(right.dateTimeUtc) - Date.parse(left.dateTimeUtc))
    .slice(0, 5);
}

export function createTeamsService(deps: ServiceDeps) {
  return {
    async getTeams(): Promise<ApiEnvelope<TeamsResponse>> {
      const standingsState = await loadStandings(deps);
      const split = splitByConference(standingsState.value);

      return toEnvelope(
        {
          season: getCurrentSeason(),
          east: split.east,
          west: split.west
        },
        standingsState.updatedAt,
        standingsState.stale,
        [
          "stats.nba.com/leaguestandings",
          "cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json"
        ]
      );
    },

    async getTeamDetail(teamId: number): Promise<ApiEnvelope<TeamDetail>> {
      const state = await (deps.cache ?? cache).getOrLoad(`team-detail:v5:${getCurrentSeason()}:${teamId}`, TTL.profile, async () => {
        const standingsState = await loadStandings(deps);
        const [teamStatsResult, scheduleResult, teamInfoResult, rosterResult, teamGameLogResult] = await Promise.allSettled([
          loadTeamStats(deps),
          loadScheduleSnapshotGames(deps),
          deps.client.getTeamInfoCommon(teamId),
          deps.client.getCommonTeamRoster(teamId),
          deps.client.getTeamGameLog(teamId)
        ]);

        const base = standingsState.value.find((team) => team.teamId === teamId);
        if (!base) {
          throw new Error(`Team ${teamId} not found`);
        }

        const teamInfo = teamInfoResult.status === "fulfilled"
          ? mapAllStatsRows<StatsRow>(teamInfoResult.value).find((row) =>
              Object.keys(row).some((key) => key.toLowerCase() === "arena" || key.toLowerCase() === "headcoach")
            ) ?? mapStatsRows<StatsRow>(teamInfoResult.value)[0] ?? {}
          : {};
        const rosterRows = rosterResult.status === "fulfilled" ? mapAllStatsRows<StatsRow>(rosterResult.value) : [];
        let roster = rosterRows.map((row) => {
          const playerId = Number(row.PLAYER_ID ?? row.PlayerID ?? 0);
          const rawBirthDate = getRowValue(row, ["BIRTH_DATE", "BIRTHDATE", "DATE_OF_BIRTH"]);
          const birthDate = rawBirthDate ? new Date(String(rawBirthDate)) : null;
          const age =
            birthDate && !Number.isNaN(birthDate.getTime())
              ? Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
              : null;

          return {
            playerId,
            fullName: String(getRowValue(row, ["PLAYER", "PLAYER_NAME", "DISPLAY_FIRST_LAST"]) ?? ""),
            position: String(getRowValue(row, ["POSITION"]) ?? "") || null,
            jersey: String(getRowValue(row, ["NUM", "JERSEY"]) ?? "") || null,
            height: String(getRowValue(row, ["HEIGHT", "DISPLAY_HEIGHT"]) ?? "") || null,
            weight: String(getRowValue(row, ["WEIGHT", "DISPLAY_WEIGHT"]) ?? "") || null,
            age,
            headshot: buildPlayerHeadshotUrl(playerId)
          };
        }).filter((player) => player.playerId > 0 && player.fullName.length > 0);
        if (roster.length === 0) {
          try {
            if (deps.client.getEspnRoster) {
              const espnResponse = await deps.client.getEspnRoster(teamId);
              const athletes = (espnResponse as { athletes?: Array<Record<string, unknown>> }).athletes ?? [];
              const catalog = await loadPlayerCatalog(deps).catch(() => ({ value: [] as Array<{ playerId: number; fullName: string }> }));
              const catalogByName = new Map(catalog.value.map((player) => [player.fullName.trim().toLowerCase(), player.playerId]));
              roster = athletes.map((athlete) => {
                const position = athlete.position as Record<string, unknown> | undefined;
                const headshot = athlete.headshot as Record<string, unknown> | undefined;
                const birthDate = String(athlete.dateOfBirth ?? "");
                const parsedBirthDate = birthDate ? new Date(birthDate) : null;
                const age = parsedBirthDate && !Number.isNaN(parsedBirthDate.getTime())
                  ? Math.floor((Date.now() - parsedBirthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
                  : null;
                const fullName = String(athlete.fullName ?? athlete.displayName ?? "");
                return {
                  // ESPN ids are not NBA person ids. Prefer the canonical NBA
                  // id from the player catalog whenever the names match.
                  playerId: catalogByName.get(fullName.trim().toLowerCase()) ?? Number(athlete.id ?? 0),
                  fullName,
                  position: String(position?.abbreviation ?? position?.displayName ?? "") || null,
                  jersey: String(athlete.jersey ?? "") || null,
                  height: String(athlete.displayHeight ?? "") || null,
                  weight: String(athlete.displayWeight ?? "") || null,
                  age,
                  headshot: String(headshot?.href ?? "") || buildPlayerHeadshotUrl(Number(athlete.id ?? 0))
                };
              }).filter((player) => player.playerId > 0 && player.fullName.length > 0);
            }
          } catch (error) {
            console.warn("[teams] ESPN roster fallback unavailable", error instanceof Error ? error.message : error);
          }
        }
        if (roster.length === 0) {
          try {
            const catalog = await loadPlayerCatalog(deps);
            roster = catalog.value
              .filter((player) => player.team?.teamId === teamId)
              .map((player) => ({
                playerId: player.playerId,
                fullName: player.fullName,
                position: player.position,
                jersey: player.jersey,
                height: player.height,
                weight: player.weight,
                age: null,
                headshot: player.headshot
              }));
          } catch (error) {
            console.warn("[teams] roster catalog fallback unavailable", error instanceof Error ? error.message : error);
          }
        }
        const scheduleGames = scheduleResult.status === "fulfilled"
          ? scheduleResult.value.value
          : await loadRecentGames(deps);
        const scheduleByGameId = new Map(scheduleGames.map((game) => [game.gameId, game]));
        const recentRows = [
          ...(teamGameLogResult.status === "fulfilled" ? mapStatsRows<StatsRow>(teamGameLogResult.value) : [])
        ].sort((a, b) => {
          const dateA = new Date(String(a.GAME_DATE ?? 0)).getTime();
          const dateB = new Date(String(b.GAME_DATE ?? 0)).getTime();
          return dateB - dateA;
        });
        const recentGamesFromSchedule = buildRecentGamesFromSchedule(teamId, scheduleGames);
        const recentGamesFromLog = mapRecentGames(teamId, recentRows, scheduleByGameId);
        const recentGames = mergeUniqueRecentGames(recentGamesFromSchedule, recentGamesFromLog);
        let upcomingGames = buildUpcomingGamesFromSchedule(teamId, scheduleGames);
        // Some NBA schedule snapshots omit future games for individual teams.
        // ESPN's team schedule is a compatible, current fallback for that case.
        if (upcomingGames.length === 0 && deps.client.getEspnTeamSchedule) {
          try {
            const espnSchedule = await deps.client.getEspnTeamSchedule(teamId);
            const espnGames = mapEspnScoreboardGames(espnSchedule);
            upcomingGames = espnGames
              .filter((game) => game.status === "scheduled")
              .filter((game) => game.homeTeam.teamId === teamId || game.awayTeam.teamId === teamId)
              .filter((game) => Date.parse(game.dateTimeUtc) > Date.now())
              .sort((left, right) => Date.parse(left.dateTimeUtc) - Date.parse(right.dateTimeUtc))
              .slice(0, 5);
          } catch (error) {
            console.warn("[teams] upcoming schedule fallback unavailable", error instanceof Error ? error.message : error);
          }
        }

        return {
          ...base,
          arena: String(teamInfo.ARENA ?? teamInfo.ARENA_NAME ?? "") || null,
          foundedYear: Number(teamInfo.YEARFOUNDED ?? 0) || null,
          coaches: [String(teamInfo.HEADCOACH ?? teamInfo.HEAD_COACH ?? "")].filter(Boolean),
          stats: teamStatsResult.status === "fulfilled" ? teamStatsResult.value.value.get(teamId) ?? null : null,
          roster,
          recentGames,
          upcomingGames
        } satisfies TeamDetail;
      });

      return toEnvelope(state.value, state.updatedAt, state.stale, [
        "stats.nba.com/leaguestandings",
        "cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json",
        "stats.nba.com/teaminfocommon",
        "stats.nba.com/commonteamroster",
        "stats.nba.com/teamgamelog",
        "stats.nba.com/leaguedashteamstats"
      ]);
    }
  };
}
