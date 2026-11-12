import { cache } from "../../cache/memoryCache.js";
import { createRuntimeEnv } from "../../config/env.js";
import { TEAM_DIRECTORY, getTeamIdentity, getTeamIdentityByCode } from "../../config/teams.js";
import { getCurrentSeason, SEASON_END_YEAR, TTL } from "../../config/season.js";
import type {
  GamePhase,
  GameSummary,
  PlayoffStatus,
  PlayerSummary,
  StandingsRow,
  TeamReference,
  TeamSeasonStats
} from "../../types/dto/index.js";
import { buildPlayerHeadshotUrl } from "../../utils/assets.js";
import { clampToSeason, enumerateDates, round, safeNumber, parseNbaDate } from "../../utils/date.js";
import { mapAllStatsRows, mapStatsRows } from "../../utils/stats.js";
import type { NbaApiClient } from "../../nba-client/client.js";
import type { ServiceDeps } from "./types.js";
import { canonicalGameId, registerGameIdentity } from "./gameIdentity.js";

type StatsRow = Record<string, unknown>;
type TeamRecordSnapshot = {
  wins: number;
  losses: number;
  observedAt: string;
};

const STANDINGS_LOAD_TIMEOUT_MS = Math.max(createRuntimeEnv().requestTimeoutMs + 1_000, 6_000);
const nbaGameIdsByCanonicalId = new Map<string, string>();

function getNumber(row: StatsRow, keys: string[], fallback = 0) {
  for (const key of keys) {
    const actualKey = Object.keys(row).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
    if (actualKey && row[actualKey] !== undefined && row[actualKey] !== null && row[actualKey] !== "") {
      return safeNumber(row[actualKey], fallback);
    }
  }

  return fallback;
}

function getString(row: StatsRow, keys: string[], fallback = "") {
  for (const key of keys) {
    const actualKey = Object.keys(row).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
    const value = actualKey ? row[actualKey] : undefined;
    if (value !== undefined && value !== null && value !== "") {
      return String(value);
    }
  }

  return fallback;
}

function getOptionalNumber(row: StatsRow, keys: string[], multiplier = 1) {
  for (const key of keys) {
    const actualKey = Object.keys(row).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
    const value = actualKey ? row[actualKey] : undefined;

    if (value !== undefined && value !== null && value !== "") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? round(parsed * multiplier) : null;
    }
  }

  return null;
}

function resolveTeamReference(teamId: number, code = ""): TeamReference | null {
  const team = getTeamIdentity(teamId);
  if (!team) {
    return teamId
      ? {
          teamId,
          name: code || "NBA",
          code,
          logo: ""
        }
      : null;
  }

  return {
    teamId: team.teamId,
    name: team.name,
    code: team.code,
    logo: team.logo
  };
}

function derivePlayoffStatus(conferenceRank: number): PlayoffStatus {
  if (conferenceRank <= 6) {
    return "playoff";
  }

  if (conferenceRank <= 10) {
    return "play-in";
  }

  return "in-the-hunt";
}

function extractPlayoffFlags(row: StatsRow) {
  return {
    clinchedPlayoff:
      getString(row, ["ClinchedPlayoffBirth", "CLINCHED_PLAYOFF_BIRTH", "xClinchedPlayoffBirth"]) === "1" ||
      getString(row, ["ClinchedPlayoffsCode", "ClinchedPlayoffCode"]) !== "",
    clinchedConference:
      getString(row, ["ClinchedConferenceTitle", "CLINCHED_CONFERENCE_TITLE"]) === "1" ||
      getString(row, ["ClinchedConferenceCode"]) !== "",
    clinchedDivision:
      getString(row, ["ClinchedDivisionTitle", "CLINCHED_DIVISION_TITLE"]) === "1" ||
      getString(row, ["ClinchedDivisionCode"]) !== "",
    eliminated:
      getString(row, ["EliminatedPlayoffContention", "ELIMINATED_PLAYOFF_CONTENTION", "PostSeasonEliminated"]) === "1"
  };
}

function mapStandingsRow(row: StatsRow, playoffRow?: StatsRow): StandingsRow | null {
  const teamId = getNumber(row, ["TeamID", "TEAM_ID"]);
  const identity = getTeamIdentity(teamId);

  if (!identity) {
    return null;
  }

  const conferenceRank = getNumber(row, ["PlayoffRank", "ConferenceRank", "CONF_RANK", "RANK"], 99);
  const wins = getNumber(row, ["WINS", "W", "Win"]);
  const losses = getNumber(row, ["LOSSES", "L", "Loss"]);
  const gamesPlayed = wins + losses;
  const playoffFlags = extractPlayoffFlags({ ...row, ...(playoffRow ?? {}) });
  const playoffStatus = playoffFlags.eliminated
    ? "eliminated"
    : derivePlayoffStatus(conferenceRank);

  return {
    ...identity,
    seed: conferenceRank,
    wins,
    losses,
    gamesPlayed,
    remainingGames: getNumber(row, ["REMAINING_G"], Math.max(82 - gamesPlayed, 0)),
    winPct: round(getNumber(row, ["WinPCT", "WIN_PCT", "WINPCT", "PCT"])),
    gamesBehind: round(getNumber(row, ["ConferenceGamesBack", "GB", "CONF_GB"]), 1),
    conferenceRank,
    homeRecord: getString(row, ["HOME", "HomeRecord"], "--"),
    awayRecord: getString(row, ["ROAD", "AWAY", "RoadRecord"], "--"),
    lastTen: getString(row, ["L10", "LastTen"], "--"),
    streak: getString(row, ["strCurrentStreak", "CurrentStreak", "Streak"], "--"),
    playoffStatus,
    clinchedPlayoff: playoffFlags.clinchedPlayoff,
    clinchedDivision: playoffFlags.clinchedDivision,
    clinchedConference: playoffFlags.clinchedConference
  };
}

function extractPlayoffPictureStandingsRows(response: unknown) {
  const eastStandings = mapStatsRows<StatsRow>(response, "EastConfStandings");
  const westStandings = mapStatsRows<StatsRow>(response, "WestConfStandings");

  if (eastStandings.length > 0 || westStandings.length > 0) {
    return [...eastStandings, ...westStandings];
  }

  return mapAllStatsRows<StatsRow>(response).filter((row) => getNumber(row, ["TEAM_ID", "TeamID"]) > 0);
}

function parseTeamRecord(record: string | null) {
  if (!record) {
    return null;
  }

  const match = record.trim().match(/^(\d+)\s*-\s*(\d+)$/);
  if (!match) {
    return null;
  }

  const wins = Number(match[1]);
  const losses = Number(match[2]);

  if (!Number.isFinite(wins) || !Number.isFinite(losses)) {
    return null;
  }

  return {
    wins,
    losses
  };
}

function upsertLatestRecord(
  recordsByTeamId: Map<number, TeamRecordSnapshot>,
  teamId: number,
  record: { wins: number; losses: number },
  observedAt: string
) {
  const current = recordsByTeamId.get(teamId);
  const currentGamesPlayed = current ? current.wins + current.losses : -1;
  const candidateGamesPlayed = record.wins + record.losses;

  if (
    !current ||
    candidateGamesPlayed > currentGamesPlayed ||
    (candidateGamesPlayed === currentGamesPlayed && observedAt > current.observedAt)
  ) {
    recordsByTeamId.set(teamId, {
      wins: record.wins,
      losses: record.losses,
      observedAt
    });
  }
}

function buildConferenceRows(
  conference: "East" | "West",
  recordsByTeamId: Map<number, TeamRecordSnapshot>
) {
  const teams = TEAM_DIRECTORY
    .filter((team) => team.conference === conference)
    .map((team) => {
      const record = recordsByTeamId.get(team.teamId) ?? {
        wins: 0,
        losses: 0,
        observedAt: ""
      };

      return {
        team,
        wins: record.wins,
        losses: record.losses
      };
    })
    .sort((left, right) => {
      if (right.wins !== left.wins) {
        return right.wins - left.wins;
      }

      if (left.losses !== right.losses) {
        return left.losses - right.losses;
      }

      return left.team.name.localeCompare(right.team.name);
    });

  const leader = teams[0] ?? null;
  const leaderWins = leader?.wins ?? 0;
  const leaderLosses = leader?.losses ?? 0;

  return teams.map((entry, index) => {
    const conferenceRank = index + 1;
    const gamesPlayed = entry.wins + entry.losses;

    return {
      ...entry.team,
      seed: conferenceRank,
      wins: entry.wins,
      losses: entry.losses,
      gamesPlayed,
      remainingGames: Math.max(82 - gamesPlayed, 0),
      winPct: gamesPlayed > 0 ? round(entry.wins / gamesPlayed, 3) : 0,
      gamesBehind:
        conferenceRank === 1
          ? 0
          : round((leaderWins - entry.wins + entry.losses - leaderLosses) / 2, 1),
      conferenceRank,
      homeRecord: "--",
      awayRecord: "--",
      lastTen: "--",
      streak: "--",
      playoffStatus: derivePlayoffStatus(conferenceRank),
      clinchedPlayoff: false,
      clinchedDivision: false,
      clinchedConference: false
    } satisfies StandingsRow;
  });
}

function buildStandingsFromScheduleSnapshot(scheduleGames: GameSummary[]) {
  const recordsByTeamId = new Map<number, TeamRecordSnapshot>();

  for (const game of scheduleGames) {
    const homeRecord = parseTeamRecord(game.homeTeam.record);
    if (homeRecord) {
      upsertLatestRecord(recordsByTeamId, game.homeTeam.teamId, homeRecord, game.dateTimeUtc);
    }

    const awayRecord = parseTeamRecord(game.awayTeam.record);
    if (awayRecord) {
      upsertLatestRecord(recordsByTeamId, game.awayTeam.teamId, awayRecord, game.dateTimeUtc);
    }
  }

  const rows = [...buildConferenceRows("East", recordsByTeamId), ...buildConferenceRows("West", recordsByTeamId)];
  const gamesByTeam = new Map<number, GameSummary[]>();

  for (const game of scheduleGames) {
    if (game.status !== "final" || game.homeTeam.score === null || game.awayTeam.score === null) {
      continue;
    }

    for (const teamId of [game.homeTeam.teamId, game.awayTeam.teamId]) {
      const games = gamesByTeam.get(teamId) ?? [];
      games.push(game);
      gamesByTeam.set(teamId, games);
    }
  }

  return rows.map((row) => {
    const games = (gamesByTeam.get(row.teamId) ?? [])
      .sort((left, right) => Date.parse(right.dateTimeUtc) - Date.parse(left.dateTimeUtc));
    const outcomes = games.map((game) => {
      const teamScore = game.homeTeam.teamId === row.teamId ? game.homeTeam.score : game.awayTeam.score;
      const opponentScore = game.homeTeam.teamId === row.teamId ? game.awayTeam.score : game.homeTeam.score;
      return teamScore !== null && opponentScore !== null && teamScore > opponentScore ? "W" : "L";
    });
    const lastTenOutcomes = outcomes.slice(0, 10);
    const wins = lastTenOutcomes.filter((outcome) => outcome === "W").length;
    const losses = lastTenOutcomes.length - wins;
    const streakOutcome = outcomes[0];
    let streakLength = 0;
    for (const outcome of outcomes) {
      if (outcome !== streakOutcome) break;
      streakLength += 1;
    }

    return {
      ...row,
      lastTen: outcomes.length > 0 ? `${wins}-${losses}` : row.lastTen,
      streak: streakOutcome ? `${streakOutcome}${streakLength}` : row.streak
    };
  });
}

function mapEspnScoreboardGames(response: unknown, phase: GamePhase = "regular-season"): GameSummary[] {
  const events = (response as { events?: Array<Record<string, unknown>> }).events ?? [];

  return events.flatMap((event) => {
    const competition = (event.competitions as Array<Record<string, unknown>> | undefined)?.[0];
    const competitors = competition?.competitors as Array<Record<string, unknown>> | undefined;
    if (!competition || !competitors || competitors.length < 2) return [];

    const home = competitors.find((competitor) => competitor.homeAway === "home") ?? competitors[0];
    const away = competitors.find((competitor) => competitor.homeAway === "away") ?? competitors[1];
    const homeData = home.team as Record<string, unknown>;
    const awayData = away.team as Record<string, unknown>;
    const homeIdentity = getTeamIdentityByCode(String(homeData.abbreviation ?? ""));
    const awayIdentity = getTeamIdentityByCode(String(awayData.abbreviation ?? ""));
    if (!homeIdentity || !awayIdentity) return [];

    const dateTimeUtc = String(competition.date ?? event.date ?? new Date().toISOString());
    const statusType = (competition.status as Record<string, unknown> | undefined)?.type as Record<string, unknown> | undefined;
    const homeRecord = (home.records as Array<Record<string, unknown>> | undefined)?.find((record) => record.type === "total");
    const awayRecord = (away.records as Array<Record<string, unknown>> | undefined)?.find((record) => record.type === "total");

    const eventId = String(event.id ?? "");
    if (!eventId) return [];

    const mapped = {
      gameId: eventId,
      canonicalId: canonicalGameId(dateTimeUtc, homeIdentity.code, awayIdentity.code),
      gameCode: null,
      dateTimeUtc: new Date(dateTimeUtc).toISOString(),
      dateLabel: new Date(dateTimeUtc).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" }),
      status: String(statusType?.state ?? "").toLowerCase() === "in" ? "live" :
        String(statusType?.description ?? "").toLowerCase().includes("final") ? "final" : "scheduled",
      statusText: String(statusType?.description ?? "Final"),
      phase,
      arena: null,
      nationalTv: [],
      clock: null,
      period: null,
      homeTeam: {
        teamId: homeIdentity.teamId,
        name: homeIdentity.name,
        code: homeIdentity.code,
        logo: homeIdentity.logo,
        score: home.score !== undefined ? safeNumber(home.score) : null,
        record: String(homeRecord?.summary ?? "") || null
      },
      awayTeam: {
        teamId: awayIdentity.teamId,
        name: awayIdentity.name,
        code: awayIdentity.code,
        logo: awayIdentity.logo,
        score: away.score !== undefined ? safeNumber(away.score) : null,
        record: String(awayRecord?.summary ?? "") || null
      }
    } satisfies GameSummary;
    registerGameIdentity({
      canonicalGameId: canonicalGameId(dateTimeUtc, homeIdentity.code, awayIdentity.code),
      nbaGameId: null,
      espnEventId: eventId,
      date: dateTimeUtc.slice(0, 10),
      homeCode: homeIdentity.code,
      awayCode: awayIdentity.code
    });
    return [mapped];
  });
}

function getCalendarDate(dateTimeUtc: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(dateTimeUtc));
}

function getIsoDateDaysAgo(days: number) {
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Timeout while loading ${label}`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

function inferPhase(values: {
  seriesText?: string;
  seasonStage?: string;
  stageText?: string;
  gameId?: string;
}) {
  const normalizedText = [values.seriesText, values.seasonStage, values.stageText]
    .filter((value) => Boolean(value && value.trim()))
    .join(" ")
    .toLowerCase();
  const normalizedGameId = (values.gameId ?? "").trim();

  if (normalizedText.includes("play-in") || normalizedText.includes("play in")) {
    return "play-in" satisfies GamePhase;
  }

  if (normalizedText.includes("playoff")) {
    return "playoffs" satisfies GamePhase;
  }

  if (normalizedText.includes("regular")) {
    return "regular-season" satisfies GamePhase;
  }

  if (normalizedText.includes("pre")) {
    return "preseason" satisfies GamePhase;
  }

  if (normalizedGameId.startsWith("005")) {
    return "play-in" satisfies GamePhase;
  }

  if (normalizedGameId.startsWith("004")) {
    return "playoffs" satisfies GamePhase;
  }

  if (normalizedGameId.startsWith("002")) {
    return "regular-season" satisfies GamePhase;
  }

  if (normalizedGameId.startsWith("001")) {
    return "preseason" satisfies GamePhase;
  }

  return "other" satisfies GamePhase;
}

function asGameStatus(statusValue: number, statusText: string) {
  if (statusValue >= 3 || statusText.toLowerCase().includes("final")) {
    return "final" as const;
  }

  if (statusValue === 2 || statusText.toLowerCase().includes("qtr") || statusText.toLowerCase().includes("halftime")) {
    return "live" as const;
  }

  return "scheduled" as const;
}

function mapScoreboardGame(row: StatsRow, teamsById = new Map<number, string>()): GameSummary {
  const homeTeamId = getNumber(row, ["HOME_TEAM_ID", "hTeamId"]);
  const awayTeamId = getNumber(row, ["VISITOR_TEAM_ID", "vTeamId"]);
  const homeIdentity = getTeamIdentity(homeTeamId);
  const awayIdentity = getTeamIdentity(awayTeamId);
  const gameStatusText = getString(row, ["GAME_STATUS_TEXT", "gameStatusText"]);
  const gameStatusId = getNumber(row, ["GAME_STATUS_ID", "gameStatus"]);
  // the api might return GAME_DATE_UTC in some cases, so let's check it first
  const gameDate = getString(row, ["gameDateTimeUTC", "GAME_DATE_UTC", "GAME_DATE_EST", "gameEt", "gameDateTimeEst"], new Date().toISOString());
  const parsedDate = parseNbaDate(gameDate);
  const arena = getString(row, ["ARENA_NAME", "arenaName"], "");
  const broadcasters = [
    getString(row, ["NATL_TV_BROADCASTER_ABBREVIATION", "natlTvBroadcaster"]),
    getString(row, ["HOME_TV_BROADCASTER_ABBREVIATION", "homeTvBroadcaster"]),
    getString(row, ["AWAY_TV_BROADCASTER_ABBREVIATION", "awayTvBroadcaster"])
  ].filter(Boolean);

  return {
    gameId: getString(row, ["GAME_ID", "gameId"]),
    gameCode: getString(row, ["GAMECODE", "gameCode"], null as unknown as string),
    dateTimeUtc: parsedDate.toISOString(),
    dateLabel: parsedDate.toLocaleString("it-IT", {
      dateStyle: "medium",
      timeStyle: "short"
    }),
    status: asGameStatus(gameStatusId, gameStatusText),
    statusText: gameStatusText || getString(row, ["gameStatusText", "gameLabel"]),
    phase: inferPhase({
      gameId: getString(row, ["GAME_ID", "gameId"]),
      seriesText: getString(row, ["seriesText", "SERIES_TEXT"], ""),
      stageText: getString(row, ["stageText", "STAGE_TEXT"], ""),
      seasonStage: getString(row, ["SEASON_STAGE", "SEASON_STAGE_ID"], "")
    }),
    arena: arena || null,
    nationalTv: broadcasters,
    clock: getString(row, ["GAME_CLOCK", "gameClock"], "") || null,
    period: getNumber(row, ["PERIOD", "period"], 0) || null,
    homeTeam: {
      teamId: homeTeamId,
      name: homeIdentity?.name ?? teamsById.get(homeTeamId) ?? "Home Team",
      code: homeIdentity?.code ?? getString(row, ["HOME_TEAM_ABBREVIATION", "hTeamTricode"]),
      logo: homeIdentity?.logo ?? "",
      score: row.HOME_TEAM_SCORE !== undefined ? getNumber(row, ["HOME_TEAM_SCORE", "hTeamScore"]) : null,
      record: getString(row, ["HOME_TEAM_WINS_LOSSES", "hTeamRecord"], "") || null
    },
    awayTeam: {
      teamId: awayTeamId,
      name: awayIdentity?.name ?? teamsById.get(awayTeamId) ?? "Away Team",
      code: awayIdentity?.code ?? getString(row, ["VISITOR_TEAM_ABBREVIATION", "vTeamTricode"]),
      logo: awayIdentity?.logo ?? "",
      score: row.VISITOR_TEAM_SCORE !== undefined ? getNumber(row, ["VISITOR_TEAM_SCORE", "vTeamScore"]) : null,
      record: getString(row, ["VISITOR_TEAM_WINS_LOSSES", "vTeamRecord"], "") || null
    }
  };
}

function getCache(deps: ServiceDeps) {
  return deps.cache ?? cache;
}

export async function loadStandings(deps: ServiceDeps) {
  return getCache(deps).getOrLoad(`standings-dataset:v5-${getCurrentSeason()}-espn-fallback`, TTL.standings, async () => {
    try {
      const [standingsResponseResult, playoffPictureResponseResult] = await Promise.allSettled([
        withTimeout(deps.client.getLeagueStandings(), STANDINGS_LOAD_TIMEOUT_MS, "league standings"),
        withTimeout(deps.client.getPlayoffPicture(), STANDINGS_LOAD_TIMEOUT_MS, "playoff picture")
      ]);

      const standingsRows =
        standingsResponseResult.status === "fulfilled" ? mapAllStatsRows<StatsRow>(standingsResponseResult.value) : [];
      const playoffRows =
        playoffPictureResponseResult.status === "fulfilled"
          ? mapAllStatsRows<StatsRow>(playoffPictureResponseResult.value).filter(
              (row) => getNumber(row, ["TEAM_ID", "TeamID"]) > 0
            )
          : [];
      const playoffStandingsRows =
        playoffPictureResponseResult.status === "fulfilled"
          ? extractPlayoffPictureStandingsRows(playoffPictureResponseResult.value)
          : [];
      const sourceRows = standingsRows.length > 0 ? standingsRows : playoffStandingsRows;
      const playoffByTeamId = new Map(playoffRows.map((row) => [getNumber(row, ["TEAM_ID", "TeamID"]), row]));
      const mappedRows = sourceRows
        .map((row) => mapStandingsRow(row, playoffByTeamId.get(getNumber(row, ["TeamID", "TEAM_ID"]))))
        .filter((row): row is StandingsRow => row !== null);

      if (mappedRows.length >= 20 && mappedRows.some((row) => row.gamesPlayed > 0)) {
        const missingForm = mappedRows.some((row) => row.lastTen === "--" || row.streak === "--");
        if (missingForm) {
          const scheduleState = await withTimeout(
            loadScheduleSnapshotGames(deps),
            STANDINGS_LOAD_TIMEOUT_MS,
            "standings form"
          );
          const scheduleRowsByTeam = new Map(
            buildStandingsFromScheduleSnapshot(scheduleState.value).map((row) => [row.teamId, row])
          );
          return mappedRows
            .map((row) => {
              const scheduleRow = scheduleRowsByTeam.get(row.teamId);
              return {
                ...row,
                lastTen: row.lastTen === "--" ? scheduleRow?.lastTen ?? row.lastTen : row.lastTen,
                streak: row.streak === "--" ? scheduleRow?.streak ?? row.streak : row.streak
              };
            })
            .sort((left, right) => left.conference.localeCompare(right.conference) || left.seed - right.seed);
        }

        return mappedRows.sort((left, right) => left.conference.localeCompare(right.conference) || left.seed - right.seed);
      }
    } catch {
      // Fall back to schedule snapshot when stats endpoints are unavailable or too slow.
    }

    if (deps.client.getGamesSchedule) {
      try {
        const response = (await deps.client.getGamesSchedule(getIsoDateDaysAgo(45), getIsoDateDaysAgo(0))) as {
          data?: unknown[];
        };
        const espnGames = mapEspnScoreboardGames({ events: response.data ?? [] });
        if (espnGames.length > 0) {
          return buildStandingsFromScheduleSnapshot(espnGames);
        }
      } catch (error) {
        console.warn("[standings] ESPN range fallback failed", error instanceof Error ? error.message : error);
      }
    }

    try {
      const scheduleState = await withTimeout(
        loadScheduleSnapshotGames(deps),
        STANDINGS_LOAD_TIMEOUT_MS,
        "standings schedule snapshot"
      );

      const hasScheduleRecords = scheduleState.value.some(
        (game) => {
          const homeRecord = parseTeamRecord(game.homeTeam.record);
          const awayRecord = parseTeamRecord(game.awayTeam.record);
          return Boolean(
            (homeRecord && homeRecord.wins + homeRecord.losses > 0) ||
              (awayRecord && awayRecord.wins + awayRecord.losses > 0)
          );
        }
      );
      if (hasScheduleRecords) return buildStandingsFromScheduleSnapshot(scheduleState.value);

      if (deps.client.getEspnScoreboardByDate) {
        try {
          const espnGames = mapEspnScoreboardGames(
            await deps.client.getEspnScoreboardByDate(`${SEASON_END_YEAR}-04-12`)
          );
          if (espnGames.length > 0) return buildStandingsFromScheduleSnapshot(espnGames);
          console.warn("[standings] ESPN fallback returned no mappable games");
        } catch (error) {
          console.warn("[standings] ESPN fallback failed", error instanceof Error ? error.message : error);
        }
      }

      return buildStandingsFromScheduleSnapshot([]);
    } catch {
      if (deps.client.getEspnScoreboardByDate) {
        try {
          const espnGames = mapEspnScoreboardGames(
            await deps.client.getEspnScoreboardByDate(`${SEASON_END_YEAR}-04-12`)
          );
          if (espnGames.length > 0) return buildStandingsFromScheduleSnapshot(espnGames);
        } catch {
          // Continue with the directory fallback below.
        }
      }

      return buildStandingsFromScheduleSnapshot([]);
    }
  });
}

export async function loadPlayerCatalog(deps: ServiceDeps) {
  return getCache(deps).getOrLoad(`players-catalog:${getCurrentSeason()}`, TTL.stats, async () => {
    const leagueLeadersRequest = deps.client.getLeagueLeaders
      ? deps.client.getLeagueLeaders("PTS")
      : Promise.reject(new Error("leagueleaders endpoint not available"));

    const [playerIndexResult, playerStatsResult, leagueLeadersResult] = await Promise.allSettled([
      deps.client.getPlayerIndex(),
      deps.client.getLeagueDashPlayerStats(),
      leagueLeadersRequest
    ]);

    if (
      playerIndexResult.status === "rejected" &&
      playerStatsResult.status === "rejected" &&
      leagueLeadersResult.status === "rejected"
    ) {
      if (deps.client.getEspnRoster) {
        const rosterResults = await Promise.allSettled(
          TEAM_DIRECTORY.map((team) => deps.client.getEspnRoster!(team.teamId))
        );
        const rosterPlayers = rosterResults.flatMap((result, index) => {
          if (result.status !== "fulfilled") return [];
          const team = TEAM_DIRECTORY[index];
          const athletes = (result.value as { athletes?: Array<Record<string, unknown>> }).athletes ?? [];
          return athletes.map((athlete) => {
            const position = athlete.position as Record<string, unknown> | undefined;
            const headshot = athlete.headshot as Record<string, unknown> | undefined;
            return {
              playerId: safeNumber(athlete.id),
              firstName: String(athlete.firstName ?? ""),
              lastName: String(athlete.lastName ?? ""),
              fullName: String(athlete.fullName ?? athlete.displayName ?? "Player"),
              headshot: String(headshot?.href ?? ""),
              team: resolveTeamReference(team.teamId, team.code),
              jersey: String(athlete.jersey ?? "") || null,
              position: String(position?.abbreviation ?? "") || null,
              height: String(athlete.displayHeight ?? "") || null,
              weight: String(athlete.displayWeight ?? "") || null,
              averages: null
            } satisfies PlayerSummary;
          });
        }).filter((player) => player.playerId > 0);

        if (rosterPlayers.length > 0) return rosterPlayers.sort((left, right) => left.fullName.localeCompare(right.fullName));
      }

      throw new Error("Unable to load player index, player stats, league leaders, and ESPN rosters");
    }

    const playerRows = playerIndexResult.status === "fulfilled" ? mapStatsRows<StatsRow>(playerIndexResult.value) : [];
    const statsRows = playerStatsResult.status === "fulfilled" ? mapStatsRows<StatsRow>(playerStatsResult.value) : [];
    const leaderRows = leagueLeadersResult.status === "fulfilled" ? mapStatsRows<StatsRow>(leagueLeadersResult.value) : [];
    const statsByPlayerId = new Map<number, PlayerSummary["averages"]>();
    const statsIdentityByPlayerId = new Map<
      number,
      {
        fullName: string;
        teamId: number;
        teamCode: string;
      }
    >();

    const ingestStatsRow = (row: StatsRow) => {
      const playerId = getNumber(row, ["PLAYER_ID", "PERSON_ID"]);
      if (playerId <= 0) {
        return;
      }

      statsByPlayerId.set(playerId, {
        gamesPlayed: getNumber(row, ["GP"]),
        minutes: round(getNumber(row, ["MIN"])),
        points: round(getNumber(row, ["PTS"])),
        rebounds: round(getNumber(row, ["REB"])),
        assists: round(getNumber(row, ["AST"])),
        steals: round(getNumber(row, ["STL"])),
        blocks: round(getNumber(row, ["BLK"])),
        threesMade: round(getNumber(row, ["FG3M"])),
        fgPct: round(getNumber(row, ["FG_PCT"]) * 100, 1),
        threePct: round(getNumber(row, ["FG3_PCT"]) * 100, 1),
        ftPct: round(getNumber(row, ["FT_PCT"]) * 100, 1)
      });

      statsIdentityByPlayerId.set(playerId, {
        fullName: getString(row, ["PLAYER_NAME", "PLAYER"], `Player ${playerId}`),
        teamId: getNumber(row, ["TEAM_ID"]),
        teamCode: getString(row, ["TEAM_ABBREVIATION", "TEAM_CODE", "TEAM"])
      });
    };

    for (const row of statsRows) {
      ingestStatsRow(row);
    }

    for (const row of leaderRows) {
      ingestStatsRow(row);
    }

    const mappedFromIndex = playerRows
      .map((row) => {
        const playerId = getNumber(row, ["PLAYER_ID", "PERSON_ID"]);
        if (playerId <= 0) {
          return null;
        }

        const statsIdentity = statsIdentityByPlayerId.get(playerId);
        const firstName = getString(row, ["PLAYER_FIRST_NAME", "FIRST_NAME"]);
        const lastName = getString(row, ["PLAYER_LAST_NAME", "LAST_NAME"]);
        const fullName =
          getString(row, ["PLAYER_NAME", "DISPLAY_FIRST_LAST"]) ||
          statsIdentity?.fullName ||
          `${firstName} ${lastName}`.trim() ||
          `Player ${playerId}`;
        const teamId = getNumber(row, ["TEAM_ID"], statsIdentity?.teamId ?? 0);
        const teamCode = getString(
          row,
          ["TEAM_ABBREVIATION", "TEAM_CODE", "TEAM"],
          statsIdentity?.teamCode ?? ""
        );

        return {
          playerId,
          firstName,
          lastName,
          fullName,
          headshot: buildPlayerHeadshotUrl(playerId),
          team: resolveTeamReference(teamId, teamCode),
          jersey: getString(row, ["JERSEY", "JERSEY_NUMBER"]) || null,
          position: getString(row, ["POSITION"]) || null,
          height: getString(row, ["HEIGHT"]) || null,
          weight: getString(row, ["WEIGHT"]) || null,
          averages: statsByPlayerId.get(playerId) ?? null
        } satisfies PlayerSummary;
      })
      .filter((player): player is PlayerSummary => player !== null)
      .filter((player) => player.team !== null || player.averages !== null);

    const mappedFromStats = Array.from(statsIdentityByPlayerId.entries())
      .map(([playerId, identity]) => {
        const fullName = identity.fullName.trim() || `Player ${playerId}`;
        const nameParts = fullName.split(/\s+/).filter(Boolean);
        const firstName = nameParts[0] ?? "";
        const lastName = nameParts.slice(1).join(" ");

        return {
          playerId,
          firstName,
          lastName,
          fullName,
          headshot: buildPlayerHeadshotUrl(playerId),
          team: resolveTeamReference(identity.teamId, identity.teamCode),
          jersey: null,
          position: null,
          height: null,
          weight: null,
          averages: statsByPlayerId.get(playerId) ?? null
        } satisfies PlayerSummary;
      })
      .filter((player) => player.team !== null || player.averages !== null);

    if (mappedFromIndex.length === 0) {
      return mappedFromStats.sort((left, right) => left.fullName.localeCompare(right.fullName));
    }

    const mergedByPlayerId = new Map<number, PlayerSummary>();

    for (const player of mappedFromStats) {
      mergedByPlayerId.set(player.playerId, player);
    }

    for (const player of mappedFromIndex) {
      const existing = mergedByPlayerId.get(player.playerId);
      if (!existing) {
        mergedByPlayerId.set(player.playerId, player);
        continue;
      }

      mergedByPlayerId.set(player.playerId, {
        ...existing,
        ...player,
        firstName: player.firstName || existing.firstName,
        lastName: player.lastName || existing.lastName,
        fullName: player.fullName || existing.fullName,
        team: player.team ?? existing.team,
        jersey: player.jersey ?? existing.jersey,
        position: player.position ?? existing.position,
        height: player.height ?? existing.height,
        weight: player.weight ?? existing.weight,
        averages: player.averages ?? existing.averages
      });
    }

    return Array.from(mergedByPlayerId.values())
      .filter((player) => player.team !== null || player.averages !== null)
      .sort((left, right) => left.fullName.localeCompare(right.fullName));
  });
}

export async function loadTeamStats(deps: ServiceDeps) {
  return getCache(deps).getOrLoad("team-stats-dataset:v2", TTL.stats, async () => {
    const [baseResult, advancedResult] = await Promise.allSettled([
      deps.client.getLeagueDashTeamStats("Base"),
      deps.client.getLeagueDashTeamStats("Advanced")
    ]);
    const baseRows = baseResult.status === "fulfilled" ? mapStatsRows<StatsRow>(baseResult.value) : [];
    const advancedRows = advancedResult.status === "fulfilled" ? mapStatsRows<StatsRow>(advancedResult.value) : [];
    const rows = baseRows.length > 0 ? baseRows : advancedRows;
    const advancedByTeamId = new Map(
      advancedRows.map((row) => [getNumber(row, ["TEAM_ID"]), row])
    );

    return new Map<number, TeamSeasonStats>(
      rows.map((row) => {
        const teamId = getNumber(row, ["TEAM_ID"]);
        const advancedRow = advancedByTeamId.get(teamId) ?? {};
        const pointsPerGame = getNumber(row, ["PTS"]);
        const plusMinus = getOptionalNumber(row, ["PLUS_MINUS"]);
        const opponentPointsPerGame =
          getOptionalNumber(row, ["OPP_PTS"]) ??
          (plusMinus !== null ? round(pointsPerGame - plusMinus) : 0);
        const values: TeamSeasonStats = {
          pointsPerGame: round(pointsPerGame),
          opponentPointsPerGame,
          reboundsPerGame: round(getNumber(row, ["REB"])),
          assistsPerGame: round(getNumber(row, ["AST"])),
          netRating: getOptionalNumber(advancedRow, ["NET_RATING"]),
          offensiveRating: getOptionalNumber(advancedRow, ["OFF_RATING"]),
          defensiveRating: getOptionalNumber(advancedRow, ["DEF_RATING"]),
          pace: getOptionalNumber(advancedRow, ["PACE"]),
          fgPct: getOptionalNumber(row, ["FG_PCT"], 100),
          threePct: getOptionalNumber(row, ["FG3_PCT"], 100)
        };

        return [teamId, values];
      })
    );
  });
}

function mapLiveGame(game: Record<string, unknown>): GameSummary {
  const homeTeam = game.homeTeam as Record<string, unknown>;
  const awayTeam = game.awayTeam as Record<string, unknown>;
  const watch = (game.watch as Record<string, unknown> | undefined) ?? {};
  const broadcast = (watch.broadcast as Record<string, unknown> | undefined) ?? {};
  const nationalBroadcasters = (broadcast.national as Array<Record<string, unknown>> | undefined) ?? [];
  const period = safeNumber((game.period as number | undefined) ?? 0);
  const statusText = String(game.gameStatusText ?? game.gameStatus ?? "");
  const statusValue = safeNumber(game.gameStatus ?? 1);
  const parsedDate = parseNbaDate(String(game.gameDateTimeUTC ?? game.gameEt ?? new Date().toISOString()));
  const canonicalId = canonicalGameId(
    parsedDate.toISOString(),
    String(homeTeam.teamTricode ?? ""),
    String(awayTeam.teamTricode ?? "")
  );
  const nbaGameId = String(game.gameId ?? "");
  registerGameIdentity({
    canonicalGameId: canonicalId,
    nbaGameId,
    espnEventId: null,
    date: parsedDate.toISOString().slice(0, 10),
    homeCode: String(homeTeam.teamTricode ?? ""),
    awayCode: String(awayTeam.teamTricode ?? "")
  });

  return {
    gameId: nbaGameId,
    canonicalId,
    gameCode: String(game.gameCode ?? ""),
    dateTimeUtc: parsedDate.toISOString(),
    dateLabel: parsedDate.toLocaleString("it-IT", {
      dateStyle: "medium",
      timeStyle: "short"
    }),
    status: asGameStatus(statusValue, statusText),
    statusText,
    phase: inferPhase({
      gameId: String(game.gameId ?? ""),
      seriesText: String(game.seriesText ?? ""),
      stageText: String(game.stageText ?? ""),
      seasonStage: String(game.seasonStage ?? "")
    }),
    arena: String((game.arena as Record<string, unknown> | undefined)?.arenaName ?? "") || null,
    nationalTv: nationalBroadcasters.map((item) => String(item.displayName ?? item.callLetters ?? "")).filter(Boolean),
    clock: String(game.gameClock ?? "") || null,
    period: period || null,
    homeTeam: {
      teamId: safeNumber(homeTeam.teamId),
      name: `${homeTeam.teamCity ?? ""} ${homeTeam.teamName ?? ""}`.trim(),
      code: String(homeTeam.teamTricode ?? ""),
      logo: getTeamIdentity(safeNumber(homeTeam.teamId))?.logo ?? "",
      score: homeTeam.score !== undefined ? safeNumber(homeTeam.score) : null,
      record: String(homeTeam.wins ?? "") && String(homeTeam.losses ?? "") ? `${homeTeam.wins}-${homeTeam.losses}` : null
    },
    awayTeam: {
      teamId: safeNumber(awayTeam.teamId),
      name: `${awayTeam.teamCity ?? ""} ${awayTeam.teamName ?? ""}`.trim(),
      code: String(awayTeam.teamTricode ?? ""),
      logo: getTeamIdentity(safeNumber(awayTeam.teamId))?.logo ?? "",
      score: awayTeam.score !== undefined ? safeNumber(awayTeam.score) : null,
      record: String(awayTeam.wins ?? "") && String(awayTeam.losses ?? "") ? `${awayTeam.wins}-${awayTeam.losses}` : null
    }
  };
}

function mapScheduleSnapshotGame(game: Record<string, unknown>): GameSummary {
  const homeTeamData = (game.homeTeam as Record<string, unknown> | undefined) ?? {};
  const awayTeamData = (game.awayTeam as Record<string, unknown> | undefined) ?? {};
  const homeTeamId = safeNumber(homeTeamData.teamId);
  const awayTeamId = safeNumber(awayTeamData.teamId);
  const homeTeam = getTeamIdentity(homeTeamId);
  const awayTeam = getTeamIdentity(awayTeamId);
  const broadcasters = (game.broadcasters as Record<string, unknown> | undefined) ?? {};
  const broadcasterLists = [
    broadcasters.nationalTvBroadcasters,
    broadcasters.nationalBroadcasters,
    broadcasters.homeTvBroadcasters,
    broadcasters.awayTvBroadcasters
  ].filter((value): value is Array<Record<string, unknown>> => Array.isArray(value));
  const nationalTv = [...new Set(
    broadcasterLists
      .flat()
      .map((item) => String(item.displayName ?? item.broadcasterDisplay ?? item.broadcasterAbbreviation ?? ""))
      .filter(Boolean)
  )];
  const statusValue = safeNumber(game.gameStatus, 1);
  const rawStatusText = String(game.gameStatusText ?? "");
  const status = asGameStatus(statusValue, rawStatusText);
  const statusText =
    status === "scheduled"
      ? rawStatusText && rawStatusText.includes("ET")
        ? rawStatusText
        : "In programma"
      : rawStatusText || (status === "final" ? "Finale" : "Live");
  const homeScoreRaw = homeTeamData.score;
  const awayScoreRaw = awayTeamData.score;
  const homeScore =
    homeScoreRaw !== undefined && homeScoreRaw !== null && homeScoreRaw !== "" ? safeNumber(homeScoreRaw) : null;
  const awayScore =
    awayScoreRaw !== undefined && awayScoreRaw !== null && awayScoreRaw !== "" ? safeNumber(awayScoreRaw) : null;
  const parsedDate = parseNbaDate(String(game.gameDateTimeUTC ?? game.gameDateEst ?? new Date().toISOString()));
  const canonicalId = canonicalGameId(parsedDate.toISOString(), homeTeam?.code ?? "", awayTeam?.code ?? "");
  const nbaGameId = String(game.gameId ?? "");
  if (nbaGameId) {
    nbaGameIdsByCanonicalId.set(canonicalId, nbaGameId);
    registerGameIdentity({
      canonicalGameId: canonicalId,
      nbaGameId,
      espnEventId: null,
      date: parsedDate.toISOString().slice(0, 10),
      homeCode: homeTeam?.code ?? "",
      awayCode: awayTeam?.code ?? ""
    });
  }

  return {
    gameId: nbaGameId,
    canonicalId,
    gameCode: String(game.gameCode ?? "") || null,
    dateTimeUtc: parsedDate.toISOString(),
    dateLabel: parsedDate.toLocaleString("it-IT", {
      dateStyle: "medium",
      timeStyle: "short"
    }),
    status,
    statusText,
    phase: inferPhase({
      gameId: String(game.gameId ?? ""),
      seriesText: String(game.seriesText ?? ""),
      stageText: String(game.stageText ?? ""),
      seasonStage: String(game.seasonStage ?? "")
    }),
    arena: String((game.arenaName as string | undefined) ?? "") || null,
    nationalTv,
    clock: null,
    period: null,
    homeTeam: {
      teamId: homeTeamId,
      name: homeTeam?.name ?? `${String(homeTeamData.teamCity ?? "")} ${String(homeTeamData.teamName ?? "")}`.trim(),
      code: homeTeam?.code ?? String(homeTeamData.teamTricode ?? ""),
      logo: homeTeam?.logo ?? "",
      score: homeScore,
      record:
        homeTeamData.wins !== undefined && homeTeamData.losses !== undefined
          ? `${homeTeamData.wins}-${homeTeamData.losses}`
          : null
    },
    awayTeam: {
      teamId: awayTeamId,
      name: awayTeam?.name ?? `${String(awayTeamData.teamCity ?? "")} ${String(awayTeamData.teamName ?? "")}`.trim(),
      code: awayTeam?.code ?? String(awayTeamData.teamTricode ?? ""),
      logo: awayTeam?.logo ?? "",
      score: awayScore,
      record:
        awayTeamData.wins !== undefined && awayTeamData.losses !== undefined
          ? `${awayTeamData.wins}-${awayTeamData.losses}`
          : null
    }
  };
}

export function resolveNbaGameId(canonicalId: string) {
  return nbaGameIdsByCanonicalId.get(canonicalId) ?? null;
}

export async function loadTodayGames(deps: ServiceDeps) {
  return getCache(deps).getOrLoad("today-games", TTL.live, async () => {
    const response = (await deps.client.getLiveScoreboard()) as { scoreboard?: { games?: Array<Record<string, unknown>> } };
    return (response.scoreboard?.games ?? []).map((game) => mapLiveGame(game));
  });
}

export async function loadScheduleSnapshotGames(deps: ServiceDeps) {
  return getCache(deps).getOrLoad("schedule-snapshot-games", TTL.calendar, async () => {
    const scheduleSnapshot = (await deps.client.getScheduleSnapshot()) as {
      leagueSchedule?: {
        gameDates?: Array<{ gameDate: string; games: Array<Record<string, unknown>> }>;
      };
    };

    return (scheduleSnapshot.leagueSchedule?.gameDates ?? [])
      .flatMap((entry) => entry.games)
      .map((game) => mapScheduleSnapshotGame(game))
      .sort((left, right) => left.dateTimeUtc.localeCompare(right.dateTimeUtc));
  });
}

export async function loadRecentGames(deps: ServiceDeps, days = 45) {
  if (!deps.client.getGamesSchedule) {
    return [];
  }

  try {
    const response = (await deps.client.getGamesSchedule(getIsoDateDaysAgo(days), getIsoDateDaysAgo(0))) as {
      data?: unknown[];
    };
    return mapEspnScoreboardGames({ events: response.data ?? [] });
  } catch (error) {
    console.warn("[games] ESPN recent-games fallback failed", error instanceof Error ? error.message : error);
    return [];
  }
}

export async function loadCalendarRange(deps: ServiceDeps, from?: string, to?: string) {
  const range = clampToSeason(from, to);
  const key = `calendar:v3:${range.from}:${range.to}`;

  return getCache(deps).getOrLoad(key, TTL.calendar, async () => {
    let espnGames: GameSummary[] = [];
    try {
      const response = (await deps.client.getGamesSchedule(range.from, range.to)) as { data?: unknown[] };
      espnGames = mapEspnScoreboardGames({ events: response.data ?? [] }).filter((game) => {
        const date = getCalendarDate(game.dateTimeUtc);
        return date >= range.from && date <= range.to;
      });
    } catch (error) {
      console.warn("[calendar] ESPN failed; using NBA CDN schedule fallback.", error instanceof Error ? error.message : error);
    }

    let cdnGames: GameSummary[] = [];
    try {
      const snapshot = await loadScheduleSnapshotGames(deps);
      cdnGames = snapshot.value.filter((game) => {
        const date = getCalendarDate(game.dateTimeUtc);
        return date >= range.from && date <= range.to;
      });
    } catch (error) {
      console.warn("[calendar] NBA CDN schedule failed.", error instanceof Error ? error.message : error);
    }

    const buildMergeKey = (game: GameSummary) =>
      `${game.dateTimeUtc.slice(0, 10)}:${[game.homeTeam.code, game.awayTeam.code].sort().join(":")}`;
    const mergeGameData = (primary: GameSummary, secondary: GameSummary): GameSummary => ({
      ...primary,
      status: primary.status === "scheduled" && secondary.status !== "scheduled" ? secondary.status : primary.status,
      statusText: primary.status === "scheduled" && secondary.status !== "scheduled" ? secondary.statusText : primary.statusText,
      clock: primary.clock ?? secondary.clock,
      period: primary.period ?? secondary.period,
      homeTeam: {
        ...primary.homeTeam,
        score: primary.homeTeam.score ?? secondary.homeTeam.score,
        record: primary.homeTeam.record ?? secondary.homeTeam.record
      },
      awayTeam: {
        ...primary.awayTeam,
        score: primary.awayTeam.score ?? secondary.awayTeam.score,
        record: primary.awayTeam.record ?? secondary.awayTeam.record
      }
    });
    const cdnByKey = new Map(cdnGames.map((game) => [buildMergeKey(game), game]));
    const merged = espnGames.length > 0
      ? espnGames.map((game) => mergeGameData(game, cdnByKey.get(buildMergeKey(game)) ?? game))
      : cdnGames;

    if (merged.length === 0) {
      throw new Error("ESPN and NBA CDN returned an empty or invalid calendar response.");
    }

    return merged.sort((left, right) => left.dateTimeUtc.localeCompare(right.dateTimeUtc));
  }, true, (games) => games.length > 0);
}

export function splitByConference(rows: StandingsRow[]) {
  return {
    east: rows.filter((row) => row.conference === "East"),
    west: rows.filter((row) => row.conference === "West")
  };
}

export function getDirectoryTeams() {
  return TEAM_DIRECTORY;
}
