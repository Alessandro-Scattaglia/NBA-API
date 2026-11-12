import type { ApiEnvelope, GameSummary, InsightsResponse, PlayerSummary, TeamSeasonStats, TeamSummary } from "../../types/dto/index.js";
import { getCurrentSeason } from "../../config/season.js";
import { toIsoDate } from "../../utils/date.js";
import { loadCalendarRange, loadPlayerCatalog, loadRecentGames, loadStandings, loadTeamStats } from "../shared/datasets.js";
import { toEnvelope } from "../shared/envelope.js";
import type { ServiceDeps } from "../shared/types.js";

function parseRecord(value: string) {
  const match = value.trim().match(/^(\d+)\s*-\s*(\d+)$/);
  if (!match) {
    return null;
  }

  const wins = Number(match[1]);
  const losses = Number(match[2]);
  const games = wins + losses;

  return games > 0 ? { wins, losses, winPct: wins / games } : null;
}

function getTeamMetric(team: TeamSummary, stats: Map<number, TeamSeasonStats>, key: keyof TeamSeasonStats, fallback: number) {
  const value = stats.get(team.teamId)?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function chooseMostInFormTeam(teams: TeamSummary[]) {
  return teams
    .map((team) => ({ team, record: parseRecord(team.lastTen) }))
    .sort((left, right) => {
      const leftPct = left.record?.winPct ?? left.team.winPct;
      const rightPct = right.record?.winPct ?? right.team.winPct;
      return rightPct - leftPct || right.team.wins - left.team.wins;
    })[0]?.team ?? null;
}

function buildInsightTeam(
  team: TeamSummary | null,
  stats: Map<number, TeamSeasonStats>,
  metric: number,
  metricLabel: string
) {
  return team ? { team, stats: stats.get(team.teamId) ?? null, metric, metricLabel } : null;
}

function buildInsightPlayer(player: PlayerSummary) {
  return player.averages
    ? {
        player,
        metric: player.averages.points,
        metricLabel: "punti di media"
      }
    : null;
}

function buildRecentTeamMetrics(games: GameSummary[]) {
  const metrics = new Map<number, { games: number; pointsFor: number; pointsAgainst: number }>();

  for (const game of games) {
    if (game.status !== "final" || game.homeTeam.score === null || game.awayTeam.score === null) {
      continue;
    }

    const home = metrics.get(game.homeTeam.teamId) ?? { games: 0, pointsFor: 0, pointsAgainst: 0 };
    home.games += 1;
    home.pointsFor += game.homeTeam.score;
    home.pointsAgainst += game.awayTeam.score;
    metrics.set(game.homeTeam.teamId, home);

    const away = metrics.get(game.awayTeam.teamId) ?? { games: 0, pointsFor: 0, pointsAgainst: 0 };
    away.games += 1;
    away.pointsFor += game.awayTeam.score;
    away.pointsAgainst += game.homeTeam.score;
    metrics.set(game.awayTeam.teamId, away);
  }

  return metrics;
}

function buildInterestingGames(games: GameSummary[], teams: TeamSummary[]) {
  const standingsByTeamId = new Map(teams.map((team) => [team.teamId, team]));

  return games
    .map((game) => {
      const home = standingsByTeamId.get(game.homeTeam.teamId);
      const away = standingsByTeamId.get(game.awayTeam.teamId);
      const rankedTeams = [home, away].filter((team): team is TeamSummary => Boolean(team));
      const rankScore = rankedTeams.reduce((score, team) => score + Math.max(0, 13 - team.conferenceRank), 0);
      const matchupBonus = home && away && home.conferenceRank <= 10 && away.conferenceRank <= 10 ? 4 : 0;
      const tvBonus = game.nationalTv.length > 0 ? 3 : 0;
      const liveBonus = game.status === "live" ? 5 : 0;
      const interestScore = rankScore + matchupBonus + tvBonus + liveBonus;
      const reasons = [];

      if (home && away && home.conferenceRank <= 10 && away.conferenceRank <= 10) {
        reasons.push("sfida tra squadre in zona postseason");
      } else if (rankedTeams.some((team) => team.conferenceRank <= 4)) {
        reasons.push("in campo una delle migliori della conference");
      }

      if (game.nationalTv.length > 0) {
        reasons.push("trasmessa a livello nazionale");
      }

      return {
        game,
        interestScore,
        reason: reasons.join(" · ") || "partita della settimana"
      };
    })
    .sort((left, right) => right.interestScore - left.interestScore || left.game.dateTimeUtc.localeCompare(right.game.dateTimeUtc))
    .slice(0, 6);
}

export function createInsightsService(deps: ServiceDeps) {
  return {
    async getInsights(): Promise<ApiEnvelope<InsightsResponse>> {
      const from = toIsoDate(new Date());
      const to = toIsoDate(new Date(Date.now() + 7 * 86_400_000));
      const [standingsResult, teamStatsResult, playersResult, calendarResult, recentGamesResult] = await Promise.allSettled([
        loadStandings(deps),
        loadTeamStats(deps),
        loadPlayerCatalog(deps),
        loadCalendarRange(deps, from, to),
        loadRecentGames(deps)
      ]);

      const fulfilledCount = [standingsResult, teamStatsResult, playersResult, calendarResult, recentGamesResult].filter(
        (result) => result.status === "fulfilled"
      ).length;

      if (fulfilledCount === 0) {
        throw new Error("Unable to load insights datasets");
      }

      const teams = standingsResult.status === "fulfilled" ? standingsResult.value.value : [];
      const teamStats = teamStatsResult.status === "fulfilled" ? teamStatsResult.value.value : new Map<number, TeamSeasonStats>();
      const players = playersResult.status === "fulfilled" ? playersResult.value.value : [];
      const games = calendarResult.status === "fulfilled" ? calendarResult.value.value : [];
      const recentTeamMetrics = recentGamesResult.status === "fulfilled"
        ? buildRecentTeamMetrics(recentGamesResult.value)
        : new Map<number, { games: number; pointsFor: number; pointsAgainst: number }>();
      const getRecentAttack = (team: TeamSummary) => {
        const metric = recentTeamMetrics.get(team.teamId);
        return metric && metric.games > 0 ? metric.pointsFor / metric.games : 0;
      };
      const getRecentDefense = (team: TeamSummary) => {
        const metric = recentTeamMetrics.get(team.teamId);
        return metric && metric.games > 0 ? metric.pointsAgainst / metric.games : 0;
      };
      const getAttackValue = (team: TeamSummary) =>
        getTeamMetric(team, teamStats, "offensiveRating", 0) || getRecentAttack(team) || 0;
      const getDefenseValue = (team: TeamSummary) =>
        getTeamMetric(team, teamStats, "defensiveRating", 0) || getRecentDefense(team) || 0;
      const getAttackLabel = (team: TeamSummary) =>
        getTeamMetric(team, teamStats, "offensiveRating", 0) > 0
          ? "offensive rating"
          : "punti segnati nelle ultime 45 giornate";
      const getDefenseLabel = (team: TeamSummary) =>
        getTeamMetric(team, teamStats, "defensiveRating", 0) > 0
          ? "defensive rating"
          : "punti subiti nelle ultime 45 giornate";
      const teamFormRanking = teams
        .slice()
        .sort((left, right) => {
          const leftRecord = parseRecord(left.lastTen);
          const rightRecord = parseRecord(right.lastTen);
          return (rightRecord?.winPct ?? right.winPct) - (leftRecord?.winPct ?? left.winPct) || right.wins - left.wins;
        })
        .slice(0, 5)
        .map((team) =>
          buildInsightTeam(team, teamStats, parseRecord(team.lastTen)?.winPct ?? team.winPct, "percentuale vittorie ultime 10")
        )
        .filter((insight): insight is NonNullable<typeof insight> => Boolean(insight));
      const attackRanking = teams
        .slice()
        .filter((team) => getAttackValue(team) > 0)
        .sort((left, right) =>
          getAttackValue(right) - getAttackValue(left)
        )
        .slice(0, 5)
        .map((team) =>
          buildInsightTeam(
            team,
            teamStats,
            getAttackValue(team),
            getAttackLabel(team)
          )
        )
        .filter((insight): insight is NonNullable<typeof insight> => Boolean(insight));
      const defenseRanking = teams
        .slice()
        .filter((team) => getDefenseValue(team) > 0)
        .sort((left, right) =>
          getDefenseValue(left) - getDefenseValue(right)
        )
        .slice(0, 5)
        .map((team) =>
          buildInsightTeam(
            team,
            teamStats,
            getDefenseValue(team),
            getDefenseLabel(team)
          )
        )
        .filter((insight): insight is NonNullable<typeof insight> => Boolean(insight));
      const rankedPlayers = players
        .filter((player): player is PlayerSummary & { averages: NonNullable<PlayerSummary["averages"]> } => Boolean(player.averages))
        .sort((left, right) => right.averages.points - left.averages.points || right.averages.assists - left.averages.assists)
        .slice(0, 5)
        .map(buildInsightPlayer)
        .filter((insight): insight is NonNullable<typeof insight> => Boolean(insight));
      const finalGames = games.filter(
        (game) => game.status === "final" && game.homeTeam.score !== null && game.awayTeam.score !== null
      );
      const averageTotalPoints = finalGames.length > 0
        ? finalGames.reduce((total, game) => total + (game.homeTeam.score ?? 0) + (game.awayTeam.score ?? 0), 0) / finalGames.length
        : null;
      const mostInFormTeam = teamFormRanking[0]?.team ?? chooseMostInFormTeam(teams);
      const bestAttackTeam = attackRanking[0]?.team ?? null;
      const bestDefenseTeam = defenseRanking[0]?.team ?? null;
      const hottestPlayer = rankedPlayers[0] ?? null;
      const updatedAt = [
        standingsResult.status === "fulfilled" ? standingsResult.value.updatedAt : null,
        teamStatsResult.status === "fulfilled" ? teamStatsResult.value.updatedAt : null,
        playersResult.status === "fulfilled" ? playersResult.value.updatedAt : null,
        calendarResult.status === "fulfilled" ? calendarResult.value.updatedAt : null
      ]
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? new Date().toISOString();

      return toEnvelope(
        {
          season: getCurrentSeason(),
          period: { from, to },
          overview: {
            games: games.length,
            scheduledGames: games.filter((game) => game.status === "scheduled").length,
            liveGames: games.filter((game) => game.status === "live").length,
            nationalTvGames: games.filter((game) => game.nationalTv.length > 0).length,
            averageTotalPoints: averageTotalPoints === null ? null : Math.round(averageTotalPoints * 10) / 10
          },
          mostInFormTeam: teamFormRanking[0] ?? null,
          bestAttackTeam: attackRanking[0] ?? null,
          bestDefenseTeam: defenseRanking[0] ?? null,
          hottestPlayer,
          teamFormRanking,
          attackRanking,
          defenseRanking,
          playerRanking: rankedPlayers,
          interestingGames: buildInterestingGames(games, teams)
        },
        updatedAt,
        [standingsResult, teamStatsResult, playersResult, calendarResult].some(
          (result) => result.status === "fulfilled" && result.value.stale
        ) || fulfilledCount < 4,
        ["stats.nba.com/leaguestandings", "stats.nba.com/leaguedashteamstats", "stats.nba.com/leaguedashplayerstats", "ESPN scoreboard"]
      );
    }
  };
}
