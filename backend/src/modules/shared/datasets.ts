import { cache } from "../../cache/memoryCache.js";
import { TEAM_DIRECTORY, getTeamIdentity } from "../../config/teams.js";
import { TTL } from "../../config/season.js";
import type {
  GamePhase,
  GameSummary,
  PlayoffStatus,
  PlayerSummary,
  StandingsRow,
  TeamReference,
  TeamSeasonStats
} from "../../types/dto.js";
import { buildPlayerHeadshotUrl } from "../../utils/assets.js";
import { clampToSeason, enumerateDates, round, safeNumber } from "../../utils/date.js";
import { mapAllStatsRows, mapStatsRows } from "../../utils/stats.js";
import type { NbaApiClient } from "../../nba-client/client.js";
import type { ServiceDeps } from "./types.js";

type StatsRow = Record<string, unknown>;

function getNumber(row: StatsRow, keys: string[], fallback = 0) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return safeNumber(row[key], fallback);
    }
  }

  return fallback;
}

function getString(row: StatsRow, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== "") {
      return String(value);
    }
  }

  return fallback;
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

  const conferenceRank = getNumber(row, ["PlayoffRank", "ConferenceRank", "CONF_RANK"], 99);
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
    remainingGames: Math.max(82 - gamesPlayed, 0),
    winPct: round(getNumber(row, ["WinPCT", "WIN_PCT", "WINPCT"])),
    gamesBehind: round(getNumber(row, ["ConferenceGamesBack", "GB", "CONF_GB"]), 1),
    conferenceRank,
    homeRecord: getString(row, ["HOME", "HomeRecord"]),
    awayRecord: getString(row, ["ROAD", "RoadRecord"]),
    lastTen: getString(row, ["L10", "LastTen"]),
    streak: getString(row, ["strCurrentStreak", "CurrentStreak", "Streak"]),
    playoffStatus,
    clinchedPlayoff: playoffFlags.clinchedPlayoff,
    clinchedDivision: playoffFlags.clinchedDivision,
    clinchedConference: playoffFlags.clinchedConference
  };
}

function inferPhase(seriesText: string) {
  const normalized = seriesText.toLowerCase();

  if (normalized.includes("pre")) {
    return "preseason" satisfies GamePhase;
  }

  if (normalized.includes("playoff")) {
    return "playoffs" satisfies GamePhase;
  }

  if (normalized.includes("play-in")) {
    return "play-in" satisfies GamePhase;
  }

  if (normalized.includes("regular")) {
    return "regular-season" satisfies GamePhase;
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
  const gameDate = getString(row, ["GAME_DATE_EST", "gameEt", "gameDateTimeEst"], new Date().toISOString());
  const arena = getString(row, ["ARENA_NAME", "arenaName"], "");
  const broadcasters = [
    getString(row, ["NATL_TV_BROADCASTER_ABBREVIATION", "natlTvBroadcaster"]),
    getString(row, ["HOME_TV_BROADCASTER_ABBREVIATION", "homeTvBroadcaster"]),
    getString(row, ["AWAY_TV_BROADCASTER_ABBREVIATION", "awayTvBroadcaster"])
  ].filter(Boolean);

  return {
    gameId: getString(row, ["GAME_ID", "gameId"]),
    gameCode: getString(row, ["GAMECODE", "gameCode"], null as unknown as string),
    dateTimeUtc: new Date(gameDate).toISOString(),
    dateLabel: new Date(gameDate).toLocaleString("it-IT", {
      dateStyle: "medium",
      timeStyle: "short"
    }),
    status: asGameStatus(gameStatusId, gameStatusText),
    statusText: gameStatusText || getString(row, ["gameStatusText", "gameLabel"]),
    phase: inferPhase(getString(row, ["SEASON_STAGE", "seriesText", "stageText"], "Regular Season")),
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
  return getCache(deps).getOrLoad("standings-dataset", TTL.standings, async () => {
    const [standingsResponse, playoffPictureResponse] = await Promise.all([
      deps.client.getLeagueStandings(),
      deps.client.getPlayoffPicture()
    ]);

    const standingsRows = mapAllStatsRows<StatsRow>(standingsResponse);
    const playoffRows = mapAllStatsRows<StatsRow>(playoffPictureResponse);
    const playoffByTeamId = new Map(playoffRows.map((row) => [getNumber(row, ["TEAM_ID", "TeamID"]), row]));

    return standingsRows
      .map((row) => mapStandingsRow(row, playoffByTeamId.get(getNumber(row, ["TeamID", "TEAM_ID"]))))
      .filter((row): row is StandingsRow => row !== null)
      .sort((left, right) => left.conference.localeCompare(right.conference) || left.seed - right.seed);
  });
}

export async function loadPlayerCatalog(deps: ServiceDeps) {
  return getCache(deps).getOrLoad("players-catalog", TTL.stats, async () => {
    const [playerIndexResponse, playerStatsResponse] = await Promise.all([
      deps.client.getPlayerIndex(),
      deps.client.getLeagueDashPlayerStats()
    ]);

    const playerRows = mapStatsRows<StatsRow>(playerIndexResponse);
    const statsRows = mapStatsRows<StatsRow>(playerStatsResponse);
    const statsByPlayerId = new Map(
      statsRows.map((row) => [
        getNumber(row, ["PLAYER_ID", "PERSON_ID"]),
        {
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
        }
      ])
    );

    return playerRows
      .map((row) => {
        const playerId = getNumber(row, ["PLAYER_ID", "PERSON_ID"]);
        const firstName = getString(row, ["PLAYER_FIRST_NAME", "FIRST_NAME"]);
        const lastName = getString(row, ["PLAYER_LAST_NAME", "LAST_NAME"]);
        const fullName =
          getString(row, ["PLAYER_NAME", "DISPLAY_FIRST_LAST"]) || `${firstName} ${lastName}`.trim();
        const teamId = getNumber(row, ["TEAM_ID"]);
        const teamCode = getString(row, ["TEAM_ABBREVIATION", "TEAM_CODE"]);

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
      .filter((player) => player.team !== null || player.averages !== null)
      .sort((left, right) => left.fullName.localeCompare(right.fullName));
  });
}

export async function loadTeamStats(deps: ServiceDeps) {
  return getCache(deps).getOrLoad("team-stats-dataset", TTL.stats, async () => {
    const response = await deps.client.getLeagueDashTeamStats();
    const rows = mapStatsRows<StatsRow>(response);

    return new Map<number, TeamSeasonStats>(
      rows.map((row) => {
        const teamId = getNumber(row, ["TEAM_ID"]);
        const values: TeamSeasonStats = {
          pointsPerGame: round(getNumber(row, ["PTS"])),
          opponentPointsPerGame: round(getNumber(row, ["OPP_PTS"])),
          reboundsPerGame: round(getNumber(row, ["REB"])),
          assistsPerGame: round(getNumber(row, ["AST"])),
          netRating: row.NET_RATING !== undefined ? round(getNumber(row, ["NET_RATING"])) : null,
          offensiveRating: row.OFF_RATING !== undefined ? round(getNumber(row, ["OFF_RATING"])) : null,
          defensiveRating: row.DEF_RATING !== undefined ? round(getNumber(row, ["DEF_RATING"])) : null,
          pace: row.PACE !== undefined ? round(getNumber(row, ["PACE"])) : null,
          fgPct: row.FG_PCT !== undefined ? round(getNumber(row, ["FG_PCT"]) * 100, 1) : null,
          threePct: row.FG3_PCT !== undefined ? round(getNumber(row, ["FG3_PCT"]) * 100, 1) : null
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

  return {
    gameId: String(game.gameId ?? ""),
    gameCode: String(game.gameCode ?? ""),
    dateTimeUtc: new Date(String(game.gameEt ?? game.gameDateTimeUTC ?? new Date().toISOString())).toISOString(),
    dateLabel: new Date(String(game.gameEt ?? game.gameDateTimeUTC ?? new Date().toISOString())).toLocaleString("it-IT", {
      dateStyle: "medium",
      timeStyle: "short"
    }),
    status: asGameStatus(statusValue, statusText),
    statusText,
    phase: inferPhase(String(game.seriesText ?? "Regular Season")),
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
  const nationalTv =
    ((broadcasters.nationalTvBroadcasters as Array<Record<string, unknown>> | undefined) ??
      (broadcasters.nationalBroadcasters as Array<Record<string, unknown>> | undefined) ??
      [])
      .map((item) => String(item.broadcasterAbbreviation ?? item.displayName ?? item.broadcasterDisplay ?? ""))
      .filter(Boolean);
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

  return {
    gameId: String(game.gameId ?? ""),
    gameCode: String(game.gameCode ?? "") || null,
    dateTimeUtc: new Date(String(game.gameDateTimeUTC ?? game.gameDateEst ?? new Date().toISOString())).toISOString(),
    dateLabel: new Date(String(game.gameDateTimeUTC ?? game.gameDateEst ?? new Date().toISOString())).toLocaleString("it-IT", {
      dateStyle: "medium",
      timeStyle: "short"
    }),
    status,
    statusText,
    phase: inferPhase(String(game.seriesText ?? "Regular Season")),
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

export async function loadCalendarRange(deps: ServiceDeps, from?: string, to?: string) {
  const range = clampToSeason(from, to);
  const key = `calendar:${range.from}:${range.to}`;

  return getCache(deps).getOrLoad(key, TTL.calendar, async () => {
    const scheduleState = await loadScheduleSnapshotGames(deps);
    const scheduleGames = scheduleState.value
      .filter((game) => game.dateTimeUtc.slice(0, 10) >= range.from && game.dateTimeUtc.slice(0, 10) <= range.to);

    if (scheduleGames.length > 0) {
      return scheduleGames.sort((left, right) => left.dateTimeUtc.localeCompare(right.dateTimeUtc));
    }

    const dates = enumerateDates(range.from, range.to);
    const results = await Promise.all(dates.map((date) => deps.client.getScoreboardByDate(date)));

    return results
      .flatMap((response) => {
        const gameHeaderRows = mapStatsRows<StatsRow>(response, "GameHeader");
        return gameHeaderRows.length > 0 ? gameHeaderRows : mapStatsRows<StatsRow>(response);
      })
      .map((row) => mapScoreboardGame(row))
      .sort((left, right) => left.dateTimeUtc.localeCompare(right.dateTimeUtc));
  });
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
