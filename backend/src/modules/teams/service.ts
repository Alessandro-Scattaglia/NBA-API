import { mapStatsRows } from "../../utils/stats.js";
import type { ApiEnvelope, GameSummary, TeamDetail, TeamsResponse } from "../../types/dto.js";
import { TTL } from "../../config/season.js";
import { cache } from "../../cache/memoryCache.js";
import { getTeamIdentity, getTeamIdentityByCode } from "../../config/teams.js";
import { buildPlayerHeadshotUrl } from "../../utils/assets.js";
import { loadStandings, loadTeamStats, splitByConference } from "../shared/datasets.js";
import { toEnvelope } from "../shared/envelope.js";
import type { ServiceDeps } from "../shared/types.js";

type StatsRow = Record<string, unknown>;

function mapRecentGames(teamId: number, rows: StatsRow[]): GameSummary[] {
  const team = getTeamIdentity(teamId);

  return rows.slice(0, 5).map((row) => {
    const matchup = String(row.MATCHUP ?? "");
    const opponentCode = matchup.split(" ").pop() ?? "";
    const opponent = getTeamIdentityByCode(opponentCode);
    const isHome = matchup.includes("vs.");

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
        score: null,
        record: null
      },
      awayTeam: {
        teamId: isHome ? opponent?.teamId ?? 0 : teamId,
        name: isHome ? opponent?.name ?? opponentCode : team?.name ?? "Away Team",
        code: isHome ? opponent?.code ?? opponentCode : team?.code ?? "",
        logo: isHome ? opponent?.logo ?? "" : team?.logo ?? "",
        score: null,
        record: null
      }
    };
  });
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
        ["stats.nba.com/leaguestandings"]
      );
    },

    async getTeamDetail(teamId: number): Promise<ApiEnvelope<TeamDetail>> {
      const state = await (deps.cache ?? cache).getOrLoad(`team-detail:${teamId}`, TTL.profile, async () => {
        const [standingsState, teamStatsState, teamInfoResponse, rosterResponse, teamGameLogResponse] =
          await Promise.all([
            loadStandings(deps),
            loadTeamStats(deps),
            deps.client.getTeamInfoCommon(teamId),
            deps.client.getCommonTeamRoster(teamId),
            deps.client.getTeamGameLog(teamId)
          ]);

        const base = standingsState.value.find((team) => team.teamId === teamId);
        if (!base) {
          throw new Error(`Team ${teamId} not found`);
        }

        const teamInfo = mapStatsRows<StatsRow>(teamInfoResponse)[0] ?? {};
        const roster = mapStatsRows<StatsRow>(rosterResponse).map((row) => {
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
        const recentGames = mapRecentGames(teamId, mapStatsRows<StatsRow>(teamGameLogResponse));

        return {
          ...base,
          arena: String(teamInfo.ARENA ?? teamInfo.ARENA_NAME ?? "") || null,
          foundedYear: Number(teamInfo.YEARFOUNDED ?? 0) || null,
          coaches: [String(teamInfo.HEADCOACH ?? teamInfo.HEAD_COACH ?? "")].filter(Boolean),
          stats: teamStatsState.value.get(teamId) ?? null,
          roster,
          recentGames
        } satisfies TeamDetail;
      });

      return toEnvelope(state.value, state.updatedAt, state.stale, [
        "stats.nba.com/leaguestandings",
        "stats.nba.com/teaminfocommon",
        "stats.nba.com/commonteamroster",
        "stats.nba.com/teamgamelog",
        "stats.nba.com/leaguedashteamstats"
      ]);
    }
  };
}
