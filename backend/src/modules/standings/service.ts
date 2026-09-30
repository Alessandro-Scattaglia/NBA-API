import type { ApiEnvelope, StandingsResponse } from "../../types/dto/index.js";
import { NBA_SEASON } from "../../config/season.js";
import { loadStandings, splitByConference } from "../shared/datasets.js";
import { toEnvelope } from "../shared/envelope.js";
import type { ServiceDeps } from "../shared/types.js";

export function createStandingsService(deps: ServiceDeps) {
  return {
    async getStandings(): Promise<ApiEnvelope<StandingsResponse>> {
      const standingsState = await loadStandings(deps);
      const split = splitByConference(standingsState.value);

      return toEnvelope(
        {
          season: NBA_SEASON,
          east: split.east,
          west: split.west,
          playInNotes: [
            "Le squadre classificate dalla 1 alla 6 vanno direttamente ai playoff.",
            "Le squadre dalla 7 alla 10 giocano il Play-In Tournament per assegnare le seed 7 e 8.",
            "Il formato corrente prevede 7 vs 8 e 9 vs 10, poi la seed 8 si decide tra la perdente di 7 vs 8 e la vincente di 9 vs 10."
          ]
        },
        standingsState.updatedAt,
        standingsState.stale,
        [
          "stats.nba.com/leaguestandings",
          "stats.nba.com/playoffpicture",
          "cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json"
        ]
      );
    }
  };
}
