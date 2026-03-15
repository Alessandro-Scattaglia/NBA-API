import type { ApiEnvelope, LeaderCategory, LeadersResponse, PlayerSummary } from "../../types/dto.js";
import { loadPlayerCatalog } from "../shared/datasets.js";
import { toEnvelope } from "../shared/envelope.js";
import type { ServiceDeps } from "../shared/types.js";

function topPlayers(players: PlayerSummary[], selector: (player: PlayerSummary) => number, limit: number) {
  return players
    .filter((player) => player.averages !== null)
    .sort((left, right) => selector(right) - selector(left))
    .slice(0, limit)
    .map((player) => ({
      playerId: player.playerId,
      fullName: player.fullName,
      headshot: player.headshot,
      team: player.team,
      value: selector(player),
      gamesPlayed: player.averages?.gamesPlayed ?? 0
    }));
}

export function buildLeaderCategories(players: PlayerSummary[], limit: number): LeaderCategory[] {
  return [
    {
      key: "points",
      label: "Punti a partita",
      leaders: topPlayers(players, (player) => player.averages?.points ?? 0, limit)
    },
    {
      key: "rebounds",
      label: "Rimbalzi a partita",
      leaders: topPlayers(players, (player) => player.averages?.rebounds ?? 0, limit)
    },
    {
      key: "assists",
      label: "Assist a partita",
      leaders: topPlayers(players, (player) => player.averages?.assists ?? 0, limit)
    }
  ];
}

export function createLeadersService(deps: ServiceDeps) {
  return {
    async getLeaders(limit = 10): Promise<ApiEnvelope<LeadersResponse>> {
      const playersState = await loadPlayerCatalog(deps);
      const categories = buildLeaderCategories(playersState.value, limit);

      return toEnvelope(
        {
          season: "2025-26",
          categories
        },
        playersState.updatedAt,
        playersState.stale,
        ["stats.nba.com/leaguedashplayerstats", "stats.nba.com/playerindex"]
      );
    }
  };
}
