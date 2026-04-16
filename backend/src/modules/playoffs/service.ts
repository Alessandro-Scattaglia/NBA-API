import { SEASON_END_YEAR } from "../../config/season.js";
import type {
  ApiEnvelope,
  Conference,
  GameSummary,
  PlayoffsResponse,
  PostseasonConferenceSnapshot,
  PostseasonKeyDate,
  PostseasonSeries,
  PostseasonSeriesStatus,
  StandingsRow
} from "../../types/dto.js";
import { loadCalendarRange, loadStandings, loadTodayGames, splitByConference } from "../shared/datasets.js";
import { toEnvelope } from "../shared/envelope.js";
import type { ServiceDeps } from "../shared/types.js";

const POSTSEASON_START_DATE = `${SEASON_END_YEAR}-04-14`;
const POSTSEASON_END_DATE = `${SEASON_END_YEAR}-07-31`;

const KEY_DATES: PostseasonKeyDate[] = [
  {
    key: "regular-season-finale",
    label: "Ultimo giorno di regular season",
    startDate: `${SEASON_END_YEAR}-04-12`,
    endDate: null,
    note: "La griglia postseason si chiude dopo le 15 partite del final Sunday."
  },
  {
    key: "play-in-window",
    label: "SoFi NBA Play-In Tournament",
    startDate: `${SEASON_END_YEAR}-04-14`,
    endDate: `${SEASON_END_YEAR}-04-17`,
    note: "Le squadre dal 7° al 10° posto di ogni conference si giocano le seed 7 e 8."
  },
  {
    key: "playoffs-begin",
    label: "Inizio playoff NBA",
    startDate: `${SEASON_END_YEAR}-04-18`,
    endDate: null,
    note: "Parte il primo turno con serie al meglio delle 7 partite."
  },
  {
    key: "finals-begin",
    label: "Inizio NBA Finals",
    startDate: `${SEASON_END_YEAR}-06-03`,
    endDate: null,
    note: "Gara 1 delle Finals in esclusiva ABC."
  }
];

const FINALS_DATES: PostseasonKeyDate[] = [
  {
    key: "finals-game-1",
    label: "Finals 2026 - Gara 1",
    startDate: `${SEASON_END_YEAR}-06-03`,
    endDate: null,
    note: "ABC, 20:30 ET"
  },
  {
    key: "finals-game-2",
    label: "Finals 2026 - Gara 2",
    startDate: `${SEASON_END_YEAR}-06-05`,
    endDate: null,
    note: "ABC, 20:30 ET"
  },
  {
    key: "finals-game-3",
    label: "Finals 2026 - Gara 3",
    startDate: `${SEASON_END_YEAR}-06-08`,
    endDate: null,
    note: "ABC, 20:30 ET"
  },
  {
    key: "finals-game-4",
    label: "Finals 2026 - Gara 4",
    startDate: `${SEASON_END_YEAR}-06-10`,
    endDate: null,
    note: "ABC, 20:30 ET"
  },
  {
    key: "finals-game-5",
    label: "Finals 2026 - Gara 5",
    startDate: `${SEASON_END_YEAR}-06-13`,
    endDate: null,
    note: "Se necessaria, ABC, 20:30 ET"
  },
  {
    key: "finals-game-6",
    label: "Finals 2026 - Gara 6",
    startDate: `${SEASON_END_YEAR}-06-16`,
    endDate: null,
    note: "Se necessaria, ABC, 20:30 ET"
  },
  {
    key: "finals-game-7",
    label: "Finals 2026 - Gara 7",
    startDate: `${SEASON_END_YEAR}-06-19`,
    endDate: null,
    note: "Se necessaria, ABC, 20:30 ET"
  }
];

const FORMAT_NOTES = [
  "Le seed dalla 1 alla 6 entrano direttamente nel tabellone playoff di conference.",
  "Le seed 7 e 8 si affrontano per il posto n. 7; la perdente ha un'ultima chance contro la vincente di 9 contro 10 per il posto n. 8.",
  "La perdente della sfida 9 contro 10 viene eliminata subito dalla postseason.",
  "Ogni serie playoff e Finals e al meglio delle 7 con formato 2-2-1-1-1 e vantaggio campo per la seed migliore."
];

const PLAY_IN_SLOTS = [
  {
    highSeed: 7,
    lowSeed: 8,
    note: "La vincente entra nei playoff come seed n. 7."
  },
  {
    highSeed: 9,
    lowSeed: 10,
    note: "La perdente viene eliminata; la vincente si gioca poi la seed n. 8."
  }
] as const;

const FIRST_ROUND_SLOTS = [
  {
    highSeed: 1,
    lowSeed: 8
  },
  {
    highSeed: 2,
    lowSeed: 7
  },
  {
    highSeed: 3,
    lowSeed: 6
  },
  {
    highSeed: 4,
    lowSeed: 5
  }
] as const;

function sortGames(games: GameSummary[]) {
  return games.slice().sort((left, right) => left.dateTimeUtc.localeCompare(right.dateTimeUtc));
}

function getGameTeamIds(game: GameSummary) {
  return [game.homeTeam.teamId, game.awayTeam.teamId];
}

function isMatchup(game: GameSummary, firstTeamId: number, secondTeamId: number) {
  const [homeTeamId, awayTeamId] = getGameTeamIds(game);

  return (
    (homeTeamId === firstTeamId && awayTeamId === secondTeamId) ||
    (homeTeamId === secondTeamId && awayTeamId === firstTeamId)
  );
}

function findSeriesGames(games: GameSummary[], firstTeamId: number, candidateTeamIds: number[]) {
  for (const candidateTeamId of candidateTeamIds) {
    const seriesGames = sortGames(games.filter((game) => isMatchup(game, firstTeamId, candidateTeamId)));

    if (seriesGames.length > 0) {
      return seriesGames;
    }
  }

  return [] as GameSummary[];
}

function buildSeriesLabel(
  highSeed: number,
  lowSeed: number,
  highSeedTeam: StandingsRow | null,
  lowSeedTeam: StandingsRow | null
) {
  const highLabel = highSeedTeam ? `(${highSeed}) ${highSeedTeam.name}` : `(${highSeed}) TBD`;
  const lowLabel = lowSeedTeam ? `(${lowSeed}) ${lowSeedTeam.name}` : `(${lowSeed}) TBD`;
  return `${highLabel} vs. ${lowLabel}`;
}

function getLatestUpdatedAt(values: string[]) {
  return values.slice().sort().at(-1) ?? new Date().toISOString();
}

function mergeLivePostseasonGames(scheduleGames: GameSummary[], todayGames: GameSummary[]) {
  const liveByGameId = new Map(
    todayGames
      .filter((game) => game.phase === "play-in" || game.phase === "playoffs")
      .map((game) => [game.gameId, game])
  );

  const mergedGames = scheduleGames.map((game) => liveByGameId.get(game.gameId) ?? game);
  const knownGameIds = new Set(mergedGames.map((game) => game.gameId));
  const liveOnlyGames = todayGames.filter(
    (game) =>
      (game.phase === "play-in" || game.phase === "playoffs") &&
      !knownGameIds.has(game.gameId)
  );

  return sortGames([...mergedGames, ...liveOnlyGames]);
}

function buildTeamsBySeed(rows: StandingsRow[]) {
  return new Map(rows.map((row) => [row.seed, row]));
}

function buildTeamsById(rows: StandingsRow[]) {
  return new Map(rows.map((row) => [row.teamId, row]));
}

function buildPlayInSeries(
  conference: Conference,
  teamsBySeed: Map<number, StandingsRow>,
  playInGames: GameSummary[]
) {
  return PLAY_IN_SLOTS.map<PostseasonSeries>((slot) => {
    const highSeedTeam = teamsBySeed.get(slot.highSeed) ?? null;
    const lowSeedTeam = teamsBySeed.get(slot.lowSeed) ?? null;
    const games =
      highSeedTeam && lowSeedTeam
        ? sortGames(playInGames.filter((game) => isMatchup(game, highSeedTeam.teamId, lowSeedTeam.teamId)))
        : [];

    return {
      conference,
      round: "play-in",
      status: "scheduled",
      label: buildSeriesLabel(slot.highSeed, slot.lowSeed, highSeedTeam, lowSeedTeam),
      seedHigh: slot.highSeed,
      seedLow: slot.lowSeed,
      highSeedTeam,
      lowSeedTeam,
      note: slot.note,
      games
    };
  });
}

function buildFirstRoundSeries(
  conference: Conference,
  conferenceRows: StandingsRow[],
  teamsBySeed: Map<number, StandingsRow>,
  playoffGames: GameSummary[]
) {
  const teamsById = buildTeamsById(conferenceRows);
  const playInCandidateIds = conferenceRows
    .filter((row) => row.seed >= 7 && row.seed <= 10)
    .map((row) => row.teamId);

  return FIRST_ROUND_SLOTS.map<PostseasonSeries>((slot) => {
    const highSeedTeam = teamsBySeed.get(slot.highSeed) ?? null;
    const expectedLowSeedTeam = teamsBySeed.get(slot.lowSeed) ?? null;
    const candidateTeamIds =
      slot.lowSeed <= 6 && expectedLowSeedTeam ? [expectedLowSeedTeam.teamId] : playInCandidateIds;
    const games = highSeedTeam ? findSeriesGames(playoffGames, highSeedTeam.teamId, candidateTeamIds) : [];
    const detectedOpponentId =
      highSeedTeam && games.length > 0
        ? getGameTeamIds(games[0]).find((teamId) => teamId !== highSeedTeam.teamId) ?? null
        : null;
    const lowSeedTeam =
      detectedOpponentId !== null ? (teamsById.get(detectedOpponentId) ?? null) : slot.lowSeed <= 6 ? expectedLowSeedTeam : null;
    const status: PostseasonSeriesStatus = lowSeedTeam ? "confirmed" : "awaiting-play-in";
    const note =
      lowSeedTeam !== null
        ? "Serie del primo turno confermata."
        : `La seed n. ${slot.lowSeed} verra decisa dal Play-In Tournament.`;

    return {
      conference,
      round: "first-round",
      status,
      label: buildSeriesLabel(slot.highSeed, slot.lowSeed, highSeedTeam, lowSeedTeam),
      seedHigh: slot.highSeed,
      seedLow: slot.lowSeed,
      highSeedTeam,
      lowSeedTeam,
      note,
      games
    };
  });
}

function filterConferenceGames(games: GameSummary[], rows: StandingsRow[]) {
  const teamIds = new Set(rows.map((row) => row.teamId));

  return sortGames(
    games.filter((game) => teamIds.has(game.homeTeam.teamId) && teamIds.has(game.awayTeam.teamId))
  );
}

function buildConferenceSnapshot(
  conference: Conference,
  rows: StandingsRow[],
  playInGames: GameSummary[],
  playoffGames: GameSummary[]
): PostseasonConferenceSnapshot {
  const sortedRows = rows.slice().sort((left, right) => left.seed - right.seed);
  const teamsBySeed = buildTeamsBySeed(sortedRows);
  const conferencePlayInGames = filterConferenceGames(playInGames, sortedRows);
  const conferencePlayoffGames = filterConferenceGames(playoffGames, sortedRows);

  return {
    conference,
    directSeeds: sortedRows.filter((row) => row.seed <= 6),
    playInSeeds: sortedRows.filter((row) => row.seed >= 7 && row.seed <= 10),
    outsidePicture: sortedRows.filter((row) => row.seed > 10),
    playInSeries: buildPlayInSeries(conference, teamsBySeed, conferencePlayInGames),
    firstRoundSeries: buildFirstRoundSeries(conference, sortedRows, teamsBySeed, conferencePlayoffGames)
  };
}

export function createPlayoffsService(deps: ServiceDeps) {
  return {
    async getPlayoffs(): Promise<ApiEnvelope<PlayoffsResponse>> {
      const nowIso = new Date().toISOString();
      const [standingsResult, calendarResult, todayResult] = await Promise.allSettled([
        loadStandings(deps),
        loadCalendarRange(deps, POSTSEASON_START_DATE, POSTSEASON_END_DATE),
        loadTodayGames(deps)
      ]);

      const standingsState =
        standingsResult.status === "fulfilled"
          ? standingsResult.value
          : {
              value: [],
              updatedAt: nowIso,
              stale: true
            };
      const calendarState =
        calendarResult.status === "fulfilled"
          ? calendarResult.value
          : {
              value: [],
              updatedAt: nowIso,
              stale: true
            };
      const todayState =
        todayResult.status === "fulfilled"
          ? todayResult.value
          : {
              value: [],
              updatedAt: nowIso,
              stale: true
            };

      const postseasonGames = mergeLivePostseasonGames(
        calendarState.value.filter((game) => game.phase === "play-in" || game.phase === "playoffs"),
        todayState.value
      );
      const playInGames = postseasonGames.filter((game) => game.phase === "play-in");
      const playoffGames = postseasonGames.filter((game) => game.phase === "playoffs");
      const split = splitByConference(standingsState.value);
      const east = buildConferenceSnapshot("East", split.east, playInGames, playoffGames);
      const west = buildConferenceSnapshot("West", split.west, playInGames, playoffGames);
      const confirmedFirstRoundSeries = [...east.firstRoundSeries, ...west.firstRoundSeries].filter(
        (series) => series.status === "confirmed"
      ).length;

      return toEnvelope(
        {
          season: "2025-26",
          overview: {
            directQualifiedTeams: east.directSeeds.length + west.directSeeds.length,
            playInTeams: east.playInSeeds.length + west.playInSeeds.length,
            confirmedFirstRoundSeries,
            playInGamesScheduled: playInGames.length,
            playoffGamesScheduled: playoffGames.length
          },
          keyDates: KEY_DATES,
          finalsDates: FINALS_DATES,
          formatNotes: FORMAT_NOTES,
          east,
          west,
          playInGames,
          playoffGames
        },
        getLatestUpdatedAt([standingsState.updatedAt, calendarState.updatedAt, todayState.updatedAt]),
        standingsState.stale ||
          calendarState.stale ||
          todayState.stale ||
          standingsResult.status === "rejected" ||
          calendarResult.status === "rejected" ||
          todayResult.status === "rejected",
        [
          "https://stats.nba.com/stats/leaguestandings",
          "https://stats.nba.com/stats/playoffpicture",
          "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json",
          "https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json",
          "https://www.nba.com/playoffs/2026",
          "https://www.nba.com/news/2026-nba-playoffs-schedule",
          "https://www.nba.com/key-dates"
        ]
      );
    }
  };
}
