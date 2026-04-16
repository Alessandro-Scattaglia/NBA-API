import { cache } from "../../cache/memoryCache.js";
import { TTL } from "../../config/season.js";
import type { ApiEnvelope, PlayerDetail, PlayersResponse } from "../../types/dto.js";
import { calculateAge, round, safeNumber } from "../../utils/date.js";
import { mapStatsRows } from "../../utils/stats.js";
import { loadPlayerCatalog } from "../shared/datasets.js";
import { toEnvelope } from "../shared/envelope.js";
import type { ServiceDeps } from "../shared/types.js";

type StatsRow = Record<string, unknown>;

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
          season: "2025-26",
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
      const state = await (deps.cache ?? cache).getOrLoad(`player-detail:${playerId}`, TTL.profile, async () => {
        const catalogState = await loadPlayerCatalog(deps);
        const base = catalogState.value.find((player) => player.playerId === playerId);
        if (!base) {
          throw new Error(`Player ${playerId} not found`);
        }

        const [infoResponse, gameLogsResponse] = await Promise.all([
          deps.client.getCommonPlayerInfo(playerId),
          deps.client.getPlayerGameLogs(playerId)
        ]);

        const info = mapStatsRows<StatsRow>(infoResponse)[0] ?? {};
        const recentGames = mapStatsRows<StatsRow>(gameLogsResponse)
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

        const birthDate = String(info.BIRTHDATE ?? info.BIRTH_DATE ?? "") || null;
        const draftParts = [
          info.DRAFT_YEAR ? `Anno ${info.DRAFT_YEAR}` : "",
          info.DRAFT_ROUND ? `Round ${info.DRAFT_ROUND}` : "",
          info.DRAFT_NUMBER ? `Pick ${info.DRAFT_NUMBER}` : ""
        ].filter(Boolean);

        return {
          ...base,
          birthDate,
          age: calculateAge(birthDate),
          country: String(info.COUNTRY ?? info.COUNTRY_CODE ?? "") || null,
          school: String(info.SCHOOL ?? info.COLLEGE ?? "") || null,
          experience: String(info.SEASON_EXP ?? info.EXPERIENCE ?? "") || null,
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
