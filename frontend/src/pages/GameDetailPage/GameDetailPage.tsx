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
import type { GameDetail, GameLeader } from "../../lib/types";
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

function LeaderSection({
  title,
  subtitle,
  leaders,
  emptyLabel,
  tone
}: {
  title: string;
  subtitle: string;
  leaders: GameLeader[];
  emptyLabel: string;
  tone: "away" | "home";
}) {
  return (
    <SurfaceCard title={title} subtitle={subtitle}>
      {leaders.length > 0 ? (
        <div className="leader-list">
          {leaders.map((leader, index) => (
            <div key={leader.playerId} className={`game-leader-card game-leader-card-${tone}`}>
              <span className="game-leader-rank">{index + 1}</span>
              <img
                src={buildPlayerHeadshotUrl(leader.playerId)}
                alt={`Headshot di ${leader.fullName}`}
                className="game-leader-headshot"
                loading="lazy"
              />
              <div className="game-leader-copy">
                <strong>{leader.fullName}</strong>
                <div className="game-leader-stats">
                  <span className="game-leader-pill game-leader-pill-points">
                    <strong>{leader.points}</strong>
                    <small>PTS</small>
                  </span>
                  <span className="game-leader-pill game-leader-pill-rebounds">
                    <strong>{leader.rebounds}</strong>
                    <small>REB</small>
                  </span>
                  <span className="game-leader-pill game-leader-pill-assists">
                    <strong>{leader.assists}</strong>
                    <small>AST</small>
                  </span>
                </div>
              </div>
            </div>
          ))}
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
          <table className={`detail-table detail-table-${tone}`}>
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
                  <td>
                    <div className="detail-player-copy">
                      <strong>{player.fullName}</strong>
                    </div>
                  </td>
                  <td>
                    <span className="detail-minutes-pill">{formatGameMinutes(player.minutes)}</span>
                  </td>
                  <td>
                    <span className="detail-stat-pill detail-stat-pill-points">{player.points}</span>
                  </td>
                  <td>
                    <span className="detail-stat-pill detail-stat-pill-rebounds">{player.rebounds}</span>
                  </td>
                  <td>
                    <span className="detail-stat-pill detail-stat-pill-assists">{player.assists}</span>
                  </td>
                  <td>
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
          emptyLabel={emptyDataLabel}
          tone="away"
        />
        <LeaderSection
          title={`Migliori prestazioni ${data.game.homeTeam.code}`}
          subtitle={data.game.homeTeam.name}
          leaders={data.homeLeaders}
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
