import { mapStatsRows } from "../../utils/stats.js";
import type { ApiEnvelope, GameSummary, TeamDetail, TeamsResponse } from "../../types/dto.js";
import { TTL } from "../../config/season.js";
import { cache } from "../../cache/memoryCache.js";
import { getTeamIdentity, getTeamIdentityByCode } from "../../config/teams.js";
import { buildPlayerHeadshotUrl } from "../../utils/assets.js";
import { loadScheduleSnapshotGames, loadStandings, loadTeamStats, splitByConference } from "../shared/datasets.js";
import { toEnvelope } from "../shared/envelope.js";
import type { ServiceDeps } from "../shared/types.js";

type StatsRow = Record<string, unknown>;

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

function mergeRecentGame(
  fallbackGame: GameSummary,
  row: StatsRow,
  scheduledGame: GameSummary | undefined
) {
  if (!scheduledGame) {
    return fallbackGame;
  }

  return {
    ...scheduledGame,
    statusText: String(row.WL ?? "") || scheduledGame.statusText,
    homeTeam: {
      ...scheduledGame.homeTeam,
      score: scheduledGame.homeTeam.score ?? fallbackGame.homeTeam.score
    },
    awayTeam: {
      ...scheduledGame.awayTeam,
      score: scheduledGame.awayTeam.score ?? fallbackGame.awayTeam.score
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
    .filter((game) => Date.parse(game.dateTimeUtc) <= now || game.status !== "scheduled")
    .sort((left, right) => Date.parse(right.dateTimeUtc) - Date.parse(left.dateTimeUtc))
    .slice(0, 5);
}

function mergeUniqueRecentGames(primary: GameSummary[], fallback: GameSummary[]) {
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
      statusText: game.statusText || current.statusText,
      homeTeam: {
        ...current.homeTeam,
        score: current.homeTeam.score ?? game.homeTeam.score,
        record: current.homeTeam.record ?? game.homeTeam.record
      },
      awayTeam: {
        ...current.awayTeam,
        score: current.awayTeam.score ?? game.awayTeam.score,
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
          season: "2025-26",
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
      const state = await (deps.cache ?? cache).getOrLoad(`team-detail:${teamId}`, TTL.profile, async () => {
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

        const teamInfo = teamInfoResult.status === "fulfilled" ? mapStatsRows<StatsRow>(teamInfoResult.value)[0] ?? {} : {};
        const rosterRows = rosterResult.status === "fulfilled" ? mapStatsRows<StatsRow>(rosterResult.value) : [];
        const roster = rosterRows.map((row) => {
          const playerId = Number(row.PLAYER_ID ?? row.PlayerID ?? 0);
          const birthDate = row.BIRTH_DATE ? new Date(String(row.BIRTH_DATE)) : null;
          const age =
            birthDate && !Number.isNaN(birthDate.getTime())
              ? Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
              : null;

          return {
            playerId,
            fullName: String(row.PLAYER ?? row.PLAYER_NAME ?? ""),
            position: String(row.POSITION ?? "") || null,
            jersey: String(row.NUM ?? row.JERSEY ?? "") || null,
            height: String(row.HEIGHT ?? "") || null,
            weight: String(row.WEIGHT ?? "") || null,
            age,
            headshot: buildPlayerHeadshotUrl(playerId)
          };
        });
        const scheduleGames = scheduleResult.status === "fulfilled" ? scheduleResult.value.value : [];
        const scheduleByGameId = new Map(scheduleGames.map((game) => [game.gameId, game]));
        const recentRows = teamGameLogResult.status === "fulfilled" ? mapStatsRows<StatsRow>(teamGameLogResult.value) : [];
        const recentGamesFromSchedule = buildRecentGamesFromSchedule(teamId, scheduleGames);
        const recentGamesFromLog = mapRecentGames(teamId, recentRows, scheduleByGameId);
        const recentGames = mergeUniqueRecentGames(recentGamesFromSchedule, recentGamesFromLog);

        return {
          ...base,
          arena: String(teamInfo.ARENA ?? teamInfo.ARENA_NAME ?? "") || null,
          foundedYear: Number(teamInfo.YEARFOUNDED ?? 0) || null,
          coaches: [String(teamInfo.HEADCOACH ?? teamInfo.HEAD_COACH ?? "")].filter(Boolean),
          stats: teamStatsResult.status === "fulfilled" ? teamStatsResult.value.value.get(teamId) ?? null : null,
          roster,
          recentGames
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
