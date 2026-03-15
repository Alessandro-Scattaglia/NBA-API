import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { DataStamp, EmptyState, ErrorState, LoadingState, PageHeader } from "../../components/common/States";
import { SurfaceCard } from "../../components/cards/SurfaceCard";
import { apiGet } from "../../lib/api";
import { formatGameDateLabel, formatGameStatusText, formatVenue } from "../../lib/format";
import type { GameDetail, GameLeader } from "../../lib/types";
import "./GameDetailPage.css";

function PlayerTable({
  title,
  rows,
  emptyLabel
}: {
  title: string;
  rows: GameDetail["homePlayers"];
  emptyLabel: string;
}) {
  return (
    <SurfaceCard title={title}>
      {rows.length > 0 ? (
        <div className="table-wrap">
          <table className="detail-table">
            <thead>
              <tr>
                <th>Giocatore</th>
                <th>Minuti</th>
                <th>Punti</th>
                <th>Rimbalzi</th>
                <th>Assist</th>
                <th>Recuperi</th>
                <th>Stoppate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((player) => (
                <tr key={player.playerId}>
                  <td>{player.fullName}</td>
                  <td>{player.minutes ?? "--"}</td>
                  <td>{player.points}</td>
                  <td>{player.rebounds}</td>
                  <td>{player.assists}</td>
                  <td>{player.steals}</td>
                  <td>{player.blocks}</td>
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
        title={`${data.game.awayTeam.code} a ${data.game.homeTeam.code}`}
        description="Punteggio, stato, leader e tabellino completo della partita."
      />
      <DataStamp updatedAt={meta.updatedAt} stale={meta.stale} />

      {availabilityMessage ? (
        <SurfaceCard title="Disponibilita dati">
          <p className="game-data-note">{availabilityMessage}</p>
        </SurfaceCard>
      ) : null}

      <SurfaceCard>
        <div className="game-card">
          <div className="game-card-head">
            <span>{formatGameDateLabel(data.game)}</span>
            <span>{formatGameStatusText(data.game)}</span>
          </div>
          <div className="game-matchup">
            <div className="game-team">
              <img src={data.game.awayTeam.logo} alt="" className="team-logo-large" />
              <div>
                <strong>{data.game.awayTeam.name}</strong>
                <p>{data.game.awayTeam.record ?? "--"}</p>
              </div>
            </div>
            <strong>
              {data.game.awayTeam.score ?? "--"} - {data.game.homeTeam.score ?? "--"}
            </strong>
            <div className="game-team game-team-right">
              <div>
                <strong>{data.game.homeTeam.name}</strong>
                <p>{data.game.homeTeam.record ?? "--"}</p>
              </div>
              <img src={data.game.homeTeam.logo} alt="" className="team-logo-large" />
            </div>
          </div>
          <div className="game-card-meta">
            <span>{formatVenue(data.game.arena)}</span>
          </div>
        </div>
      </SurfaceCard>

      <div className="grid-2">
        <SurfaceCard title="Migliori prestazioni ospiti">
          {data.awayLeaders.length > 0 ? (
            <div className="leader-list">
              {data.awayLeaders.map((leader: GameLeader) => (
                <div key={leader.playerId} className="leader-row">
                  <strong>{leader.fullName}</strong>
                  <span>
                    {leader.points} punti · {leader.rebounds} rimbalzi · {leader.assists} assist
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState label={emptyDataLabel} />
          )}
        </SurfaceCard>

        <SurfaceCard title="Migliori prestazioni casa">
          {data.homeLeaders.length > 0 ? (
            <div className="leader-list">
              {data.homeLeaders.map((leader: GameLeader) => (
                <div key={leader.playerId} className="leader-row">
                  <strong>{leader.fullName}</strong>
                  <span>
                    {leader.points} punti · {leader.rebounds} rimbalzi · {leader.assists} assist
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState label={emptyDataLabel} />
          )}
        </SurfaceCard>
      </div>

      <div className="grid-2">
        <PlayerTable title={`Tabellino ${data.game.awayTeam.code}`} rows={data.awayPlayers} emptyLabel={emptyDataLabel} />
        <PlayerTable title={`Tabellino ${data.game.homeTeam.code}`} rows={data.homePlayers} emptyLabel={emptyDataLabel} />
      </div>
    </>
  );
}
