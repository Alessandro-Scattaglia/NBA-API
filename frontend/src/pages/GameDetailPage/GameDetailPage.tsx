import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Badge, DataStamp, EmptyState, ErrorState, LoadingState, PageHeader } from "../../components/common/States";
import { SurfaceCard } from "../../components/cards/SurfaceCard";
import { apiGet } from "../../lib/api";
import { buildPlayerHeadshotUrl } from "../../lib/assets";
import {
  formatGameDateLabel,
  formatGameMinutes,
  formatGamePhase,
  formatGameStatusText,
  formatStatusLabel,
  formatVenue
} from "../../lib/format";
import type { GameDetail, GameLeader, GamePlayerLine } from "../../lib/types";
import "./GameDetailPage.css";

function getStatusTone(status: GameDetail["game"]["status"]) {
  if (status === "live") {
    return "live" as const;
  }

  if (status === "final") {
    return "neutral" as const;
  }

  return "warning" as const;
}

function getPlayedMinutesSortValue(value: string | null) {
  if (!value) {
    return 0;
  }

  const trimmed = value.trim();
  const simpleMatch = trimmed.match(/^(\d+):(\d{2})$/);
  if (simpleMatch) {
    return Number(simpleMatch[1]) * 60 + Number(simpleMatch[2]);
  }

  const isoMatch = trimmed.match(/^PT(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i);
  if (!isoMatch) {
    return 0;
  }

  return Number(isoMatch[1] ?? 0) * 60 + Number(isoMatch[2] ?? 0);
}

type HighlightTone = "triple" | "double" | "thirty" | "forty" | "fifty" | "record" | "clutch";

type PerformanceHighlight = {
  key: string;
  label: string;
  icon: string;
  tone: HighlightTone;
  priority: number;
  description: string;
};

type MilestoneCarrier = {
  milestones?: {
    careerHigh?: boolean;
    personalRecord?: string | null;
    teamRecord?: string | null;
    gameWinner?: boolean;
    clutchMoment?: boolean;
  } | null;
};

function getWinningTeamId(game: GameDetail["game"]) {
  if (game.homeTeam.score === null || game.awayTeam.score === null || game.homeTeam.score === game.awayTeam.score) {
    return null;
  }

  return game.homeTeam.score > game.awayTeam.score ? game.homeTeam.teamId : game.awayTeam.teamId;
}

function getScoreMargin(game: GameDetail["game"]) {
  if (game.homeTeam.score === null || game.awayTeam.score === null) {
    return null;
  }

  return Math.abs(game.homeTeam.score - game.awayTeam.score);
}

function getLeaderLine(leader: GameLeader, rows: GamePlayerLine[]) {
  return rows.find((row) => row.playerId === leader.playerId) ?? null;
}

function getDoubleFigureCategories(player: Pick<GamePlayerLine, "points" | "rebounds" | "assists" | "steals" | "blocks">) {
  return [player.points, player.rebounds, player.assists, player.steals, player.blocks].filter((value) => value >= 10).length;
}

function buildPerformanceHighlights(
  leader: GameLeader,
  line: GamePlayerLine | null,
  game: GameDetail["game"],
  teamRows: GamePlayerLine[]
) {
  const highlights: PerformanceHighlight[] = [];
  const player = line ?? { points: leader.points, rebounds: leader.rebounds, assists: leader.assists, steals: 0, blocks: 0 };
  const doubleFigureCategories = getDoubleFigureCategories(player);
  const milestoneData = leader as GameLeader & MilestoneCarrier;

  if (doubleFigureCategories >= 3) {
    highlights.push({
      key: "triple-double",
      label: "Tripla doppia",
      icon: "TD",
      tone: "triple",
      priority: 100,
      description: "Almeno tre categorie in doppia cifra."
    });
  } else if (doubleFigureCategories >= 2) {
    highlights.push({
      key: "double-double",
      label: "Doppia doppia",
      icon: "DD",
      tone: "double",
      priority: 80,
      description: "Almeno due categorie in doppia cifra."
    });
  }

  if (leader.points >= 50) {
    highlights.push({
      key: "fifty-points",
      label: "50+ punti",
      icon: "50",
      tone: "fifty",
      priority: 96,
      description: "Serata da 50 o più punti."
    });
  } else if (leader.points >= 40) {
    highlights.push({
      key: "forty-points",
      label: "40+ punti",
      icon: "40",
      tone: "forty",
      priority: 74,
      description: "Serata da 40 o più punti."
    });
  } else if (leader.points >= 30) {
    highlights.push({
      key: "thirty-points",
      label: "30+ punti",
      icon: "30",
      tone: "thirty",
      priority: 56,
      description: "Serata da 30 o più punti."
    });
  }

  const winningTeamId = getWinningTeamId(game);
  const scoreMargin = getScoreMargin(game);
  const teamBestPoints = Math.max(...teamRows.map((row) => row.points), leader.points);
  const likelyClutch =
    game.status === "final" &&
    winningTeamId === leader.teamId &&
    scoreMargin !== null &&
    scoreMargin <= 5 &&
    leader.points >= teamBestPoints &&
    (leader.points >= 25 || doubleFigureCategories >= 2);

  if (milestoneData.milestones?.gameWinner || milestoneData.milestones?.clutchMoment || likelyClutch) {
    highlights.push({
      key: "clutch",
      label: milestoneData.milestones?.gameWinner ? "Game winner" : "Clutch moment",
      icon: milestoneData.milestones?.gameWinner ? "GW" : "CL",
      tone: "clutch",
      priority: milestoneData.milestones?.gameWinner ? 90 : 84,
      description:
        milestoneData.milestones?.gameWinner
          ? "Canestro o giocata decisiva nel finale."
          : "Prestazione pesante in una gara chiusa punto a punto."
    });
  }

  if (milestoneData.milestones?.careerHigh) {
    highlights.push({
      key: "career-high",
      label: "Career high",
      icon: "CH",
      tone: "record",
      priority: 98,
      description: "Nuovo massimo in carriera."
    });
  }

  if (milestoneData.milestones?.personalRecord) {
    highlights.push({
      key: "personal-record",
      label: milestoneData.milestones.personalRecord,
      icon: "PR",
      tone: "record",
      priority: 94,
      description: "Record personale."
    });
  }

  if (milestoneData.milestones?.teamRecord) {
    highlights.push({
      key: "team-record",
      label: milestoneData.milestones.teamRecord,
      icon: "TR",
      tone: "record",
      priority: 92,
      description: "Record di squadra."
    });
  }

  return highlights.sort((left, right) => right.priority - left.priority);
}

function LeaderSection({
  title,
  subtitle,
  leaders,
  playerRows,
  game,
  emptyLabel,
  tone
}: {
  title: string;
  subtitle: string;
  leaders: GameLeader[];
  playerRows: GamePlayerLine[];
  game: GameDetail["game"];
  emptyLabel: string;
  tone: "away" | "home";
}) {
  return (
    <SurfaceCard title={title} subtitle={subtitle}>
      {leaders.length > 0 ? (
        <div className="leader-list">
          {leaders.map((leader, index) => {
            const line = getLeaderLine(leader, playerRows);
            const highlights = buildPerformanceHighlights(leader, line, game, playerRows);
            const primaryHighlight = highlights[0] ?? null;
            const secondaryHighlights = highlights.slice(1, 4);
            const summary = `${leader.points} PT • ${leader.rebounds} REB • ${leader.assists} AST`;
            const tooltip = [summary, ...highlights.map((highlight) => `${highlight.label}: ${highlight.description}`)].join("\n");

            return (
              <div
                key={leader.playerId}
                className={`game-leader-card game-leader-card-${tone} ${primaryHighlight ? `game-leader-card-highlight-${primaryHighlight.tone}` : ""}`}
                title={tooltip}
              >
                <span className="game-leader-rank">{index + 1}</span>
                <img
                  src={buildPlayerHeadshotUrl(leader.playerId)}
                  alt={`Headshot di ${leader.fullName}`}
                  className="game-leader-headshot"
                  loading="lazy"
                />
                <div className="game-leader-copy">
                  <strong>{leader.fullName}</strong>

                  <div className="game-leader-meta-row">
                    <p className="game-leader-performance-summary">
                      <span className="game-leader-performance-stat game-leader-performance-stat-points">{leader.points} PT</span>
                      <span className="game-leader-performance-dot">•</span>
                      <span className="game-leader-performance-stat game-leader-performance-stat-rebounds">{leader.rebounds} REB</span>
                      <span className="game-leader-performance-dot">•</span>
                      <span className="game-leader-performance-stat game-leader-performance-stat-assists">{leader.assists} AST</span>
                    </p>
                    {primaryHighlight ? (
                      <span className={`game-highlight-badge game-highlight-badge-${primaryHighlight.tone}`}>
                        <span className="game-highlight-badge-icon">{primaryHighlight.icon}</span>
                        <span>{primaryHighlight.label}</span>
                      </span>
                    ) : null}
                  </div>

                  {secondaryHighlights.length > 0 ? (
                    <div className="game-highlight-badge-row">
                      {secondaryHighlights.map((highlight) => (
                        <span key={highlight.key} className={`game-highlight-badge game-highlight-badge-secondary game-highlight-badge-${highlight.tone}`}>
                          <span className="game-highlight-badge-icon">{highlight.icon}</span>
                          <span>{highlight.label}</span>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState label={emptyLabel} />
      )}
    </SurfaceCard>
  );
}

function PlayerTable({
  team,
  rows,
  emptyLabel,
  tone
}: {
  team: GameDetail["game"]["homeTeam"];
  rows: GameDetail["homePlayers"];
  emptyLabel: string;
  tone: "away" | "home";
}) {
  const sortedRows = [...rows].sort((left, right) => {
    if (right.points !== left.points) {
      return right.points - left.points;
    }

    return getPlayedMinutesSortValue(right.minutes) - getPlayedMinutesSortValue(left.minutes);
  });

  return (
    <SurfaceCard title={`Tabellino ${team.code}`} subtitle={team.name}>
      {rows.length > 0 ? (
        <div className="game-table-wrap">
          <table className={`detail-table detail-table-${tone}`} aria-label={`Tabellino ${team.code}`}>
            <thead>
              <tr>
                <th>Giocatore</th>
                <th>Minuti</th>
                <th>Punti</th>
                <th>Rimbalzi</th>
                <th>Assist</th>
                <th>Rec</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((player) => (
                <tr key={player.playerId} className={player.starter ? "detail-row-starter" : ""}>
                  <td data-label="Giocatore">
                    <div className="detail-player-copy">
                      <strong>{player.fullName}</strong>
                    </div>
                  </td>
                  <td data-label="Minuti">
                    <span className="detail-minutes-pill">{formatGameMinutes(player.minutes)}</span>
                  </td>
                  <td data-label="Punti">
                    <span className="detail-stat-pill detail-stat-pill-points">{player.points}</span>
                  </td>
                  <td data-label="Rimbalzi">
                    <span className="detail-stat-pill detail-stat-pill-rebounds">{player.rebounds}</span>
                  </td>
                  <td data-label="Assist">
                    <span className="detail-stat-pill detail-stat-pill-assists">{player.assists}</span>
                  </td>
                  <td data-label="Recuperi">
                    <span className="detail-stat-pill">{player.steals}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState label={emptyLabel} />
      )}
    </SurfaceCard>
  );
}

export function GameDetailPage() {
  const params = useParams();
  const gameId = params.gameId ?? "";
  const query = useQuery({
    queryKey: ["game", gameId],
    queryFn: () => apiGet<GameDetail>(`/api/games/${gameId}`)
  });

  if (query.isLoading) {
    return <LoadingState label="Sto caricando il dettaglio della partita..." />;
  }

  if (query.error) {
    return <ErrorState message={query.error.message} />;
  }

  if (!query.data) {
    return <EmptyState label="Partita non disponibile." />;
  }

  const { data, meta } = query.data;
  const availabilityMessage = data.dataAvailability.message;
  const emptyDataLabel =
    data.dataAvailability.status === "scheduled"
      ? "La partita deve ancora iniziare."
      : data.dataAvailability.status === "pending"
        ? "Dati non ancora disponibili nell'API NBA."
        : "Nessun dato disponibile.";

  return (
    <>
      <PageHeader
        title={`${data.game.awayTeam.name} VS ${data.game.homeTeam.name}`}
        description="Punteggio, stato, leader e tabellino completo della partita."
      />
      <DataStamp updatedAt={meta.updatedAt} stale={meta.stale} />

      {availabilityMessage ? (
        <SurfaceCard title="Disponibilita dati">
          <p className="game-data-note">{availabilityMessage}</p>
        </SurfaceCard>
      ) : null}

      <SurfaceCard>
        <div className="game-hero">
          <div className="game-hero-top">
            <div className="game-hero-meta">
              <span className="game-hero-chip">{formatGamePhase(data.game.phase)}</span>
              <span className="game-hero-chip">{formatGameDateLabel(data.game)}</span>
            </div>
            <Badge tone={getStatusTone(data.game.status)}>{formatStatusLabel(data.game.status)}</Badge>
          </div>

          <div className="game-hero-matchup">
            <div className="game-team-panel game-team-panel-away">
              <div className="game-team-panel-head">
                <span className="game-team-side">Ospiti</span>
                <span className="game-team-record">{data.game.awayTeam.record ?? "--"}</span>
              </div>
              <div className="game-team-brand">
                <img src={data.game.awayTeam.logo} alt="" className="team-logo-large" />
                <div>
                  <span className="game-team-code">{data.game.awayTeam.code}</span>
                  <strong>{data.game.awayTeam.name}</strong>
                </div>
              </div>
            </div>

            <div className="game-score-center">
              <span className="game-score-versus">VS</span>
              <strong className="game-score-value">
                <span>{data.game.awayTeam.score ?? "--"}</span>
                <small>-</small>
                <span>{data.game.homeTeam.score ?? "--"}</span>
              </strong>
              <span className="game-score-status">{formatGameStatusText(data.game)}</span>
            </div>

            <div className="game-team-panel game-team-panel-home">
              <div className="game-team-panel-head">
                <span className="game-team-side">Casa</span>
                <span className="game-team-record">{data.game.homeTeam.record ?? "--"}</span>
              </div>
              <div className="game-team-brand game-team-brand-home">
                <div>
                  <span className="game-team-code">{data.game.homeTeam.code}</span>
                  <strong>{data.game.homeTeam.name}</strong>
                </div>
                <img src={data.game.homeTeam.logo} alt="" className="team-logo-large" />
              </div>
            </div>
          </div>

          <div className="game-hero-footer">
            <span>{formatVenue(data.game.arena)}</span>
            {data.game.nationalTv.length > 0 ? <span>TV: {data.game.nationalTv.join(", ")}</span> : null}
          </div>
        </div>
      </SurfaceCard>

      <div className="grid-2">
        <LeaderSection
          title={`Migliori prestazioni ${data.game.awayTeam.code}`}
          subtitle={data.game.awayTeam.name}
          leaders={data.awayLeaders}
          playerRows={data.awayPlayers}
          game={data.game}
          emptyLabel={emptyDataLabel}
          tone="away"
        />
        <LeaderSection
          title={`Migliori prestazioni ${data.game.homeTeam.code}`}
          subtitle={data.game.homeTeam.name}
          leaders={data.homeLeaders}
          playerRows={data.homePlayers}
          game={data.game}
          emptyLabel={emptyDataLabel}
          tone="home"
        />
      </div>

      <div className="grid-2">
        <PlayerTable team={data.game.awayTeam} rows={data.awayPlayers} emptyLabel={emptyDataLabel} tone="away" />
        <PlayerTable team={data.game.homeTeam} rows={data.homePlayers} emptyLabel={emptyDataLabel} tone="home" />
      </div>
    </>
  );
}
