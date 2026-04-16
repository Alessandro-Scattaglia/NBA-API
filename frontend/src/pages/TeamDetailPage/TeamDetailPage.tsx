import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { DataStamp, EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { SurfaceCard } from "../../components/cards/SurfaceCard";
import { GameList } from "../../components/tables/GameList";
import { apiGet } from "../../lib/api";
import { formatConference, formatDivision, formatHeight, formatNumber, formatPlayoffStatus, formatPosition } from "../../lib/format";
import type { TeamDetail } from "../../lib/types";
import "./TeamDetailPage.css";

export function TeamDetailPage() {
  const params = useParams();
  const teamId = params.teamId ?? "";
  const query = useQuery({
    queryKey: ["team", teamId],
    queryFn: () => apiGet<TeamDetail>(`/api/teams/${teamId}`)
  });

  if (query.isLoading) {
    return <LoadingState label="Sto caricando il dettaglio della squadra..." />;
  }

  if (query.error) {
    return <ErrorState message={query.error.message} />;
  }

  if (!query.data) {
    return <EmptyState label="Squadra non disponibile." />;
  }

  const { data, meta } = query.data;

  return (
    <>
      <SurfaceCard>
        <div className="team-detail-hero">
          <img src={data.logo} alt={`${data.name} logo`} className="team-logo-large" />
          <div className="team-detail-hero-copy">
            <span className="eyebrow">NBA 2025-2026</span>
            <h1>{data.name}</h1>
            <p className="detail-subtitle">
              Profilo squadra, rosa, rendimento stagionale e ultime partite.
            </p>
            <p className="team-detail-hero-meta">
              {formatConference(data.conference)} · {formatDivision(data.division)} · {data.wins}-{data.losses} · {formatPlayoffStatus(data.playoffStatus)}
            </p>
          </div>
        </div>
      </SurfaceCard>

      <DataStamp updatedAt={meta.updatedAt} stale={meta.stale} />

      <div className="stats-grid">
        <div className="stat-box">
          <span>Arena</span>
          <strong>{data.arena ?? "--"}</strong>
        </div>
        <div className="stat-box">
          <span>Allenatore</span>
          <strong>{data.coaches[0] ?? "--"}</strong>
        </div>
        <div className="stat-box">
          <span>Anno di fondazione</span>
          <strong>{data.foundedYear ?? "--"}</strong>
        </div>
        <div className="stat-box">
          <span>Casa / trasferta</span>
          <strong>
            {data.homeRecord} · {data.awayRecord}
          </strong>
        </div>
      </div>

      {data.stats ? (
        <SurfaceCard title="Statistiche di squadra">
          <div className="stats-grid">
            <div className="stat-box">
              <span>Punti segnati</span>
              <strong>{formatNumber(data.stats.pointsPerGame)}</strong>
            </div>
            <div className="stat-box">
              <span>Punti concessi</span>
              <strong>{formatNumber(data.stats.opponentPointsPerGame)}</strong>
            </div>
            <div className="stat-box">
              <span>Rimbalzi</span>
              <strong>{formatNumber(data.stats.reboundsPerGame)}</strong>
            </div>
            <div className="stat-box">
              <span>Assist</span>
              <strong>{formatNumber(data.stats.assistsPerGame)}</strong>
            </div>
            <div className="stat-box">
              <span>Saldo netto</span>
              <strong>{formatNumber(data.stats.netRating)}</strong>
            </div>
            <div className="stat-box">
              <span>% al tiro</span>
              <strong>{formatNumber(data.stats.fgPct)}%</strong>
            </div>
          </div>
        </SurfaceCard>
      ) : null}

      <div className="grid-2">
        <SurfaceCard title="Rosa">
          {data.roster.length > 0 ? (
            <div className="entity-grid">
              {data.roster.map((player) => (
                <Link key={player.playerId} to={`/players/${player.playerId}`} className="entity-card">
                  <div className="entity-card-head">
                    <img src={player.headshot} alt="" className="player-headshot-large" />
                    <div>
                      <strong>{player.fullName}</strong>
                      <p>
                        {formatPosition(player.position)} · #{player.jersey ?? "--"}
                      </p>
                    </div>
                  </div>
                  <div className="entity-meta">
                    <span>{formatHeight(player.height)}</span>
                    <span>{player.age ?? "--"} anni</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState label="Rosa non disponibile." />
          )}
        </SurfaceCard>

        <SurfaceCard title="Ultime partite">
          {data.recentGames.length > 0 ? <GameList games={data.recentGames} /> : <EmptyState label="Nessuna partita recente disponibile." />}
        </SurfaceCard>
      </div>
    </>
  );
}
