import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { DataStamp, EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { SurfaceCard } from "../../components/cards/SurfaceCard";
import { apiGet } from "../../lib/api";
import { formatDate, formatDraft, formatExperience, formatHeight, formatMatchup, formatNumber, formatPosition, formatWeight } from "../../lib/format";
import type { PlayerDetail, PlayerRecentGame } from "../../lib/types";
import "./PlayerDetailPage.css";

export function PlayerDetailPage() {
  const params = useParams();
  const playerId = params.playerId ?? "";
  const query = useQuery({
    queryKey: ["player", playerId],
    queryFn: () => apiGet<PlayerDetail>(`/api/players/${playerId}`)
  });

  if (query.isLoading) {
    return <LoadingState label="Sto caricando il profilo del giocatore..." />;
  }

  if (query.error) {
    return <ErrorState message={query.error.message} />;
  }

  if (!query.data) {
    return <EmptyState label="Giocatore non disponibile." />;
  }

  const { data, meta } = query.data;

  return (
    <>
      <SurfaceCard>
        <div className="player-detail-hero">
          <img src={data.headshot} alt={data.fullName} className="player-headshot-large" />
          <div className="player-detail-hero-copy">
            <span className="eyebrow">NBA 2025-2026</span>
            <h1>{data.fullName}</h1>
            <p className="detail-subtitle">Bio, squadra attuale, misure, medie stagionali e ultime partite.</p>
            <p className="player-detail-hero-meta">
              {data.team ? <Link to={`/teams/${data.team.teamId}`}>{data.team.name}</Link> : "Svincolato"} ·{" "}
              {formatPosition(data.position)} · #{data.jersey ?? "--"}
            </p>
          </div>
        </div>
      </SurfaceCard>

      <DataStamp updatedAt={meta.updatedAt} stale={meta.stale} />

      <div className="stats-grid">
        <div className="stat-box">
          <span>Altezza</span>
          <strong>{formatHeight(data.height)}</strong>
        </div>
        <div className="stat-box">
          <span>Peso</span>
          <strong>{formatWeight(data.weight)}</strong>
        </div>
        <div className="stat-box">
          <span>Eta`</span>
          <strong>{data.age ?? "--"}</strong>
        </div>
        <div className="stat-box">
          <span>Paese</span>
          <strong>{data.country ?? "--"}</strong>
        </div>
      </div>

      {data.averages ? (
        <SurfaceCard title="Medie stagionali">
          <div className="stats-grid">
            <div className="stat-box">
              <span>Punti</span>
              <strong>{formatNumber(data.averages.points)}</strong>
            </div>
            <div className="stat-box">
              <span>Rimbalzi</span>
              <strong>{formatNumber(data.averages.rebounds)}</strong>
            </div>
            <div className="stat-box">
              <span>Assist</span>
              <strong>{formatNumber(data.averages.assists)}</strong>
            </div>
            <div className="stat-box">
              <span>% al tiro</span>
              <strong>{formatNumber(data.averages.fgPct)}%</strong>
            </div>
            <div className="stat-box">
              <span>% da tre</span>
              <strong>{formatNumber(data.averages.threePct)}%</strong>
            </div>
            <div className="stat-box">
              <span>Minuti</span>
              <strong>{formatNumber(data.averages.minutes)}</strong>
            </div>
          </div>
        </SurfaceCard>
      ) : null}

      <div className="grid-2">
        <SurfaceCard title="Profilo">
          <div className="stats-grid">
            <div className="stat-box">
              <span>Scuola / universita`</span>
              <strong>{data.school ?? "--"}</strong>
            </div>
            <div className="stat-box">
              <span>Esperienza</span>
              <strong>{formatExperience(data.experience)}</strong>
            </div>
            <div className="stat-box">
              <span>Selezione al draft</span>
              <strong>{formatDraft(data.draft)}</strong>
            </div>
            <div className="stat-box">
              <span>Data di nascita</span>
              <strong>{data.birthDate ? formatDate(data.birthDate) : "--"}</strong>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard title="Ultime gare">
          {data.recentGames.length > 0 ? (
            <div className="table-wrap">
              <table className="detail-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Incontro</th>
                    <th>Ris</th>
                    <th>Punti</th>
                    <th>Rimbalzi</th>
                    <th>Assist</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentGames.map((game: PlayerRecentGame) => (
                    <tr key={game.gameId}>
                      <td>{formatDate(game.gameDate)}</td>
                      <td>{formatMatchup(game.matchup)}</td>
                      <td>
                        <span
                          className={`result-pill ${
                            game.result === "W"
                              ? "result-pill-win"
                              : game.result === "L"
                                ? "result-pill-loss"
                                : ""
                          }`}
                        >
                          {game.result}
                        </span>
                      </td>
                      <td>{game.points}</td>
                      <td>{game.rebounds}</td>
                      <td>{game.assists}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState label="Nessuna partita recente disponibile." />
          )}
        </SurfaceCard>
      </div>
    </>
  );
}
