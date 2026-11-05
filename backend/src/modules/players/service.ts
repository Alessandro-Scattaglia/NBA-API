import { cache } from "../../cache/memoryCache.js";
import { getCurrentSeason, TTL } from "../../config/season.js";
import type { ApiEnvelope, PlayerDetail, PlayersResponse } from "../../types/dto/index.js";
import { calculateAge, round, safeNumber } from "../../utils/date.js";
import { mapAllStatsRows, mapStatsRows } from "../../utils/stats.js";
import { loadPlayerCatalog } from "../shared/datasets.js";
import { toEnvelope } from "../shared/envelope.js";
import type { ServiceDeps } from "../shared/types.js";

type StatsRow = Record<string, unknown>;

function getInfoValue(row: StatsRow, keys: string[]) {
  for (const key of keys) {
    const actualKey = Object.keys(row).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
    const value = actualKey ? row[actualKey] : undefined;
    if (value !== undefined && value !== null && value !== "") {
      return String(value);
    }
  }

  return "";
}

interface PlayerFilters {
  search?: string;
  teamId?: number;
  position?: string;
  page?: number;
  pageSize?: number;
}

export function createPlayersService(deps: ServiceDeps) {
  return {
    async getPlayers(filters: PlayerFilters): Promise<ApiEnvelope<PlayersResponse>> {
      const state = await loadPlayerCatalog(deps);
      const search = filters.search?.trim().toLowerCase() ?? "";
      const page = filters.page && filters.page > 0 ? filters.page : 1;
      const pageSize = filters.pageSize && filters.pageSize > 0 ? Math.min(filters.pageSize, 50) : 30;

      const filtered = state.value.filter((player) => {
        const matchesSearch =
          search.length === 0 ||
          player.fullName.toLowerCase().includes(search) ||
          player.team?.name.toLowerCase().includes(search) === true;
        const matchesTeam = !filters.teamId || player.team?.teamId === filters.teamId;
        const matchesPosition = !filters.position || player.position?.includes(filters.position) === true;

        return matchesSearch && matchesTeam && matchesPosition;
      });

      const items = filtered.slice((page - 1) * pageSize, page * pageSize);

      return toEnvelope(
        {
          season: getCurrentSeason(),
          total: filtered.length,
          page,
          pageSize,
          items
        },
        state.updatedAt,
        state.stale,
        ["stats.nba.com/playerindex", "stats.nba.com/leaguedashplayerstats", "stats.nba.com/leagueleaders"]
      );
    },

    async getPlayerDetail(playerId: number): Promise<ApiEnvelope<PlayerDetail>> {
      const state = await (deps.cache ?? cache).getOrLoad(`player-detail:v3:${getCurrentSeason()}:${playerId}`, TTL.profile, async () => {
        const catalogState = await loadPlayerCatalog(deps);
        const base = catalogState.value.find((player) => player.playerId === playerId);
        if (!base) {
          throw new Error(`Player ${playerId} not found`);
        }

        const [infoResult, gameLogsResult, playoffGameLogsResult, rosterResult] = await Promise.allSettled([
          deps.client.getCommonPlayerInfo(playerId),
          deps.client.getPlayerGameLogs(playerId),
          deps.client.getPlayerGameLogs(playerId, "Playoffs"),
          base.team && deps.client.getEspnRoster ? deps.client.getEspnRoster(base.team.teamId) : Promise.reject(new Error("Roster fallback unavailable"))
        ]);

        const info = infoResult.status === "fulfilled"
          ? mapAllStatsRows<StatsRow>(infoResult.value).find((row) =>
              getInfoValue(row, ["DISPLAY_FIRST_LAST", "BIRTHDATE", "BIRTH_DATE", "COUNTRY"]).length > 0
            ) ?? mapStatsRows<StatsRow>(infoResult.value)[0] ?? {}
          : {};
        const normalizedName = base.fullName.trim().toLowerCase();
        const rosterAthlete = rosterResult.status === "fulfilled"
          ? ((rosterResult.value as { athletes?: Array<Record<string, unknown>> }).athletes ?? []).find((athlete) =>
              String(athlete.fullName ?? athlete.displayName ?? "").trim().toLowerCase() === normalizedName
            )
          : undefined;
        const rosterPosition = rosterAthlete?.position as Record<string, unknown> | undefined;
        const allGameLogs = [
          ...(playoffGameLogsResult.status === "fulfilled" ? mapStatsRows<StatsRow>(playoffGameLogsResult.value) : []),
          ...(gameLogsResult.status === "fulfilled" ? mapStatsRows<StatsRow>(gameLogsResult.value) : [])
        ].sort((a, b) => {
          const dateA = new Date(String(a.GAME_DATE ?? 0)).getTime();
          const dateB = new Date(String(b.GAME_DATE ?? 0)).getTime();
          return dateB - dateA;
        });

        let recentGames = allGameLogs
          .slice(0, 5)
          .map((row) => ({
            gameId: String(row.GAME_ID ?? ""),
            gameDate: new Date(String(row.GAME_DATE ?? new Date().toISOString())).toISOString(),
            matchup: String(row.MATCHUP ?? ""),
            result: String(row.WL ?? ""),
            minutes: round(safeNumber(row.MIN)),
            points: safeNumber(row.PTS),
            rebounds: safeNumber(row.REB),
            assists: safeNumber(row.AST),
            steals: safeNumber(row.STL),
            blocks: safeNumber(row.BLK)
          }));

        if (recentGames.length === 0 && base.team && deps.client.getEspnTeamSchedule && deps.client.getEspnGameSummary) {
          const scheduleResult = await Promise.allSettled([
            deps.client.getEspnTeamSchedule(base.team.teamId)
          ]);
          const events = scheduleResult[0].status === "fulfilled"
            ? ((scheduleResult[0].value as { events?: Array<Record<string, unknown>> }).events ?? [])
            : [];
          const completedEvents = events
            .filter((event) => {
              const status = (event.competitions as Array<Record<string, unknown>> | undefined)?.[0]
                ?.status as Record<string, unknown> | undefined;
              return status?.type && (status.type as Record<string, unknown>).completed === true;
            })
            .sort((left, right) => String(right.date ?? "").localeCompare(String(left.date ?? "")))
            .slice(0, 5);
          const summaries = await Promise.allSettled(
            completedEvents.map((event) => deps.client.getEspnGameSummary!(String(event.id)))
          );
          const normalizedName = base.fullName.trim().toLowerCase();
          recentGames = summaries.flatMap((summary, index) => {
            if (summary.status !== "fulfilled") {
              return [];
            }
            const payload = summary.value as {
              boxscore?: { players?: Array<Record<string, unknown>> };
            };
            const playerGroup = payload.boxscore?.players?.find((group) =>
              ((group.statistics as Array<Record<string, unknown>> | undefined) ?? []).some((stat) =>
                ((stat.athletes as Array<Record<string, unknown>> | undefined) ?? []).some((athlete) =>
                  String((athlete.athlete as Record<string, unknown> | undefined)?.displayName ?? "")
                    .trim()
                    .toLowerCase() === normalizedName
                )
              )
            );
            const athlete = ((playerGroup?.statistics as Array<Record<string, unknown>> | undefined) ?? [])
              .flatMap((stat) => (stat.athletes as Array<Record<string, unknown>> | undefined) ?? [])
              .find((candidate) =>
                String((candidate.athlete as Record<string, unknown> | undefined)?.displayName ?? "")
                  .trim()
                  .toLowerCase() === normalizedName
              ) as Record<string, unknown> | undefined;
            if (!athlete) {
              return [];
            }
            const stats = (athlete.stats as string[] | undefined) ?? [];
            const competition = (completedEvents[index].competitions as Array<Record<string, unknown>> | undefined)?.[0];
            const competitors = (competition?.competitors as Array<Record<string, unknown>> | undefined) ?? [];
            const result = competitors.find((competitor) =>
              String((competitor.team as Record<string, unknown> | undefined)?.abbreviation ?? "").toLowerCase() ===
              base.team?.code.toLowerCase()
            );
            return [{
              gameId: String(completedEvents[index].id ?? ""),
              gameDate: new Date(String(completedEvents[index].date ?? new Date().toISOString())).toISOString(),
              matchup: String(completedEvents[index].name ?? ""),
              result: result?.winner === true ? "W" : "L",
              minutes: round(safeNumber(stats[0])),
              points: safeNumber(stats[1]),
              rebounds: safeNumber(stats[5]),
              assists: safeNumber(stats[6]),
              steals: safeNumber(stats[8]),
              blocks: safeNumber(stats[9])
            }];
          });
        }

        const birthDate =
          getInfoValue(info, ["BIRTHDATE", "BIRTH_DATE"]) ||
          getInfoValue((rosterAthlete ?? {}) as StatsRow, ["birthDate", "dateOfBirth"]) ||
          null;
        const draftParts = [
          getInfoValue(info, ["DRAFT_YEAR"]) ? `Anno ${getInfoValue(info, ["DRAFT_YEAR"])}` : "",
          getInfoValue(info, ["DRAFT_ROUND"]) ? `Round ${getInfoValue(info, ["DRAFT_ROUND"])}` : "",
          getInfoValue(info, ["DRAFT_NUMBER"]) ? `Pick ${getInfoValue(info, ["DRAFT_NUMBER"])}` : ""
        ].filter(Boolean);

        return {
          ...base,
          position: base.position ?? (String(rosterPosition?.abbreviation ?? "") || null),
          height: base.height ?? (String(rosterAthlete?.displayHeight ?? "") || null),
          weight: base.weight ?? (String(rosterAthlete?.displayWeight ?? "") || null),
          birthDate,
          age: calculateAge(birthDate),
          country: getInfoValue(info, ["COUNTRY", "COUNTRY_CODE"]) || null,
          school: getInfoValue(info, ["SCHOOL", "COLLEGE"]) || null,
          experience: getInfoValue(info, ["SEASON_EXP", "EXPERIENCE"]) || null,
          draft: draftParts.length > 0 ? draftParts.join(" - ") : null,
          recentGames
        } satisfies PlayerDetail;
      });

      return toEnvelope(state.value, state.updatedAt, state.stale, [
        "stats.nba.com/commonplayerinfo",
        "stats.nba.com/playergamelogs"
      ]);
    }
  };
}
