import type {
  GameSummary,
  PostseasonConferenceSnapshot,
  PostseasonSeries,
  StandingsRow,
  TeamSummary
} from "../../lib/types";

export type ExtendedPostseasonConferenceSnapshot = PostseasonConferenceSnapshot & {
  semifinalsSeries?: PostseasonSeries[];
  conferenceFinalsSeries?: PostseasonSeries[];
};

export type FinalsSummary = {
  eastWinner: StandingsRow;
  westWinner: StandingsRow;
  champion: StandingsRow | null;
  runnerUp: StandingsRow | null;
  winsEast: number;
  winsWest: number;
  games: GameSummary[];
  latestGame: GameSummary | null;
  finished: boolean;
};

export function getTeamGameOutcome(game: GameSummary, teamId: number): "W" | "L" | null {
  const { homeTeam, awayTeam } = game;
  if (homeTeam.score === null || awayTeam.score === null || homeTeam.score === awayTeam.score) return null;
  const isHome = homeTeam.teamId === teamId;
  const isAway = awayTeam.teamId === teamId;
  if (!isHome && !isAway) return null;
  return isHome ? (homeTeam.score > awayTeam.score ? "W" : "L") : awayTeam.score > homeTeam.score ? "W" : "L";
}

export function toPlayoffConferenceStandings(
  snapshot: PostseasonConferenceSnapshot,
  playoffGames: GameSummary[],
  playoffsStarted: boolean
): TeamSummary[] {
  const teams = [...snapshot.directSeeds, ...snapshot.playInSeeds].filter((team) => team.seed <= 8);
  if (!playoffsStarted) {
    return teams
      .slice()
      .sort((left, right) => (left.seed || left.conferenceRank) - (right.seed || right.conferenceRank))
      .map((team) => ({
        ...team,
        wins: 0,
        losses: 0,
        winPct: 0,
        gamesBehind: 0,
        conferenceRank: team.seed || team.conferenceRank,
        homeRecord: "0-0",
        awayRecord: "0-0",
        lastTen: "0-0",
        streak: "-",
        playoffStatus: "playoff" as const,
        clinchedPlayoff: false,
        clinchedDivision: false,
        clinchedConference: false
      }));
  }

  const teamIds = new Set(teams.map((team) => team.teamId));
  const games = playoffGames
    .filter((game) => teamIds.has(game.homeTeam.teamId) && teamIds.has(game.awayTeam.teamId) && game.status === "final" && game.homeTeam.score !== null)
    .sort((left, right) => Date.parse(left.dateTimeUtc) - Date.parse(right.dateTimeUtc));
  const records = new Map(teams.map((team) => [team.teamId, { wins: 0, losses: 0, homeWins: 0, homeLosses: 0, awayWins: 0, awayLosses: 0 }]));

  for (const game of games) {
    const home = records.get(game.homeTeam.teamId);
    const away = records.get(game.awayTeam.teamId);
    if (!home || !away || game.homeTeam.score === null || game.awayTeam.score === null) continue;
    if (game.homeTeam.score > game.awayTeam.score) {
      home.wins++;
      home.homeWins++;
      away.losses++;
      away.awayLosses++;
    } else {
      away.wins++;
      away.awayWins++;
      home.losses++;
      home.homeLosses++;
    }
  }

  const streaks = new Map<number, string>();
  for (const team of teams) {
    const teamGames = games
      .filter((game) => game.homeTeam.teamId === team.teamId || game.awayTeam.teamId === team.teamId)
      .reverse();
    let type: "W" | "L" | null = null;
    let count = 0;
    for (const game of teamGames) {
      const outcome = getTeamGameOutcome(game, team.teamId);
      if (!outcome) continue;
      if (!type) {
        type = outcome;
        count = 1;
      } else if (outcome === type) {
        count++;
      } else {
        break;
      }
    }
    streaks.set(team.teamId, type ? `${type}${count}` : "-");
  }

  const ranked = teams.slice().sort((left, right) => {
    const leftRecord = records.get(left.teamId)!;
    const rightRecord = records.get(right.teamId)!;
    return rightRecord.wins - leftRecord.wins || leftRecord.losses - rightRecord.losses || left.seed - right.seed;
  });
  const leader = records.get(ranked[0]?.teamId ?? -1);

  return ranked.map((team, index) => {
    const record = records.get(team.teamId)!;
    const gamesPlayed = record.wins + record.losses;
    return {
      ...team,
      wins: record.wins,
      losses: record.losses,
      winPct: gamesPlayed ? record.wins / gamesPlayed : 0,
      gamesBehind: ((leader?.wins ?? 0) - record.wins + (record.losses - (leader?.losses ?? 0))) / 2,
      conferenceRank: index + 1,
      homeRecord: `${record.homeWins}-${record.homeLosses}`,
      awayRecord: `${record.awayWins}-${record.awayLosses}`,
      lastTen: `${record.wins}-${record.losses}`,
      streak: streaks.get(team.teamId) ?? "-",
      playoffStatus: "playoff" as const,
      clinchedPlayoff: false,
      clinchedDivision: false,
      clinchedConference: false
    };
  });
}

export function hasVisibleSeriesData(series?: PostseasonSeries) {
  return Boolean(series && (series.games.length > 0 || series.highSeedTeam || series.lowSeedTeam));
}

export function btRecord(series?: PostseasonSeries) {
  if (!series?.highSeedTeam) return { winsHigh: 0, winsLow: 0 };
  let winsHigh = 0;
  let winsLow = 0;
  for (const game of series.games) {
    if (game.status !== "final") continue;
    getTeamGameOutcome(game, series.highSeedTeam.teamId) === "W" ? winsHigh++ : winsLow++;
  }
  return { winsHigh, winsLow };
}

export function getSeriesWinner(series?: PostseasonSeries): StandingsRow | null {
  if (!series?.highSeedTeam) return null;
  const { winsHigh, winsLow } = btRecord(series);
  if (winsHigh === 4) return series.highSeedTeam;
  if (winsLow === 4) return series.lowSeedTeam;
  return null;
}

export function getFinalsSummary(
  playoffGames: GameSummary[],
  east: PostseasonConferenceSnapshot,
  west: PostseasonConferenceSnapshot
): FinalsSummary | null {
  const eastWinner = getSeriesWinner((east as ExtendedPostseasonConferenceSnapshot).conferenceFinalsSeries?.[0]);
  const westWinner = getSeriesWinner((west as ExtendedPostseasonConferenceSnapshot).conferenceFinalsSeries?.[0]);
  if (!eastWinner || !westWinner) return null;

  const finalists = new Set([eastWinner.teamId, westWinner.teamId]);
  const games = playoffGames
    .filter((game) => game.phase === "playoffs" && finalists.has(game.homeTeam.teamId) && finalists.has(game.awayTeam.teamId))
    .sort((left, right) => Date.parse(left.dateTimeUtc) - Date.parse(right.dateTimeUtc));
  const wins = new Map<number, number>([[eastWinner.teamId, 0], [westWinner.teamId, 0]]);

  for (const game of games) {
    if (game.status !== "final" || game.homeTeam.score === null || game.awayTeam.score === null) continue;
    const winnerTeamId = game.homeTeam.score > game.awayTeam.score ? game.homeTeam.teamId : game.awayTeam.teamId;
    wins.set(winnerTeamId, (wins.get(winnerTeamId) ?? 0) + 1);
  }

  const winsEast = wins.get(eastWinner.teamId) ?? 0;
  const winsWest = wins.get(westWinner.teamId) ?? 0;
  const champion = winsEast === 4 ? eastWinner : winsWest === 4 ? westWinner : null;
  const runnerUp = champion?.teamId === eastWinner.teamId ? westWinner : champion?.teamId === westWinner.teamId ? eastWinner : null;

  return {
    eastWinner,
    westWinner,
    champion,
    runnerUp,
    winsEast,
    winsWest,
    games,
    latestGame: games.at(-1) ?? null,
    finished: winsEast === 4 || winsWest === 4
  };
}
