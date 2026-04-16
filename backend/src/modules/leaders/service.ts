import type { ApiEnvelope, LeaderCategory, LeaderCategoryKey, LeadersResponse, PlayerSummary } from "../../types/dto.js";
import { loadPlayerCatalog } from "../shared/datasets.js";
import { toEnvelope } from "../shared/envelope.js";
import type { ServiceDeps } from "../shared/types.js";

const leaderCategoryDefinitions: Record<
  LeaderCategoryKey,
  { label: string; selector: (player: PlayerSummary) => number }
> = {
  points: {
    label: "Punti a partita",
    selector: (player) => player.averages?.points ?? 0
  },
  rebounds: {
    label: "Rimbalzi a partita",
    selector: (player) => player.averages?.rebounds ?? 0
  },
  assists: {
    label: "Assist a partita",
    selector: (player) => player.averages?.assists ?? 0
  },
  steals: {
    label: "Rubate a partita",
    selector: (player) => player.averages?.steals ?? 0
  },
  blocks: {
    label: "Stoppate a partita",
    selector: (player) => player.averages?.blocks ?? 0
  },
  threesMade: {
    label: "Triple a partita",
    selector: (player) => player.averages?.threesMade ?? 0
  }
};

export const HOME_LEADER_CATEGORY_KEYS = ["points", "rebounds", "assists"] as const satisfies readonly LeaderCategoryKey[];
export const FULL_LEADER_CATEGORY_KEYS = [
  ...HOME_LEADER_CATEGORY_KEYS,
  "steals",
  "blocks",
  "threesMade"
] as const satisfies readonly LeaderCategoryKey[];

function topPlayers(players: PlayerSummary[], selector: (player: PlayerSummary) => number, limit: number) {
  return players
    .filter((player) => player.averages !== null)
    .map((player) => ({
      player,
      value: selector(player),
      gamesPlayed: player.averages?.gamesPlayed ?? 0
    }))
    .filter((entry) => entry.value > 0)
    .sort(
      (left, right) =>
        right.value - left.value || right.gamesPlayed - left.gamesPlayed || left.player.fullName.localeCompare(right.player.fullName)
    )
    .slice(0, limit)
    .map(({ player, value, gamesPlayed }) => ({
      playerId: player.playerId,
      fullName: player.fullName,
      headshot: player.headshot,
      team: player.team,
      value,
      gamesPlayed
    }));
}

export function buildLeaderCategories(
  players: PlayerSummary[],
  limit: number,
  categoryKeys: readonly LeaderCategoryKey[] = HOME_LEADER_CATEGORY_KEYS
): LeaderCategory[] {
  return categoryKeys.map((key) => ({
    key,
    label: leaderCategoryDefinitions[key].label,
    leaders: topPlayers(players, leaderCategoryDefinitions[key].selector, limit)
  }));
}

export function createLeadersService(deps: ServiceDeps) {
  return {
    async getLeaders(limit = 10): Promise<ApiEnvelope<LeadersResponse>> {
      const playersState = await loadPlayerCatalog(deps);
      const categories = buildLeaderCategories(playersState.value, limit, FULL_LEADER_CATEGORY_KEYS);

      return toEnvelope(
        {
          season: "2025-26",
          categories
        },
        playersState.updatedAt,
        playersState.stale,
        ["stats.nba.com/leaguedashplayerstats", "stats.nba.com/playerindex", "stats.nba.com/leagueleaders"]
      );
    }
  };
}
