import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { DataStamp, EmptyState, ErrorState, LoadingState, PageHeader } from "../../components/common/States";
import { SurfaceCard } from "../../components/cards/SurfaceCard";
import { apiGet } from "../../lib/api";
import { formatHeight, formatNumber, formatPosition } from "../../lib/format";
import type { PlayersResponse, PlayerSummary } from "../../lib/types";
import "./PlayersPage.css";

function buildQueryString(searchParams: URLSearchParams) {
  const query = searchParams.toString();
  return query ? `/api/players?${query}` : "/api/players";
}

export function PlayersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useQuery({
    queryKey: ["players", searchParams.toString()],
    queryFn: () => apiGet<PlayersResponse>(buildQueryString(searchParams))
  });

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);

    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }

    if (key !== "page") {
      next.delete("page");
    }

    setSearchParams(next);
  };

  return (
    <>
      <PageHeader
        title="Giocatori"
        description="Ricerca giocatori della stagione corrente con filtri, schede riassuntive e accesso al profilo completo."
      />

      <SurfaceCard>
        <div className="filters-bar">
          <input
            type="search"
            placeholder="Cerca giocatore o squadra"
            value={searchParams.get("search") ?? ""}
            onChange={(event) => updateParam("search", event.target.value)}
          />
          <select
            value={searchParams.get("position") ?? ""}
            onChange={(event) => updateParam("position", event.target.value)}
          >
            <option value="">Tutte le posizioni</option>
            <option value="G">Guardia</option>
            <option value="F">Ala</option>
            <option value="C">Centro</option>
          </select>
          <select
            value={searchParams.get("pageSize") ?? "30"}
            onChange={(event) => updateParam("pageSize", event.target.value)}
          >
            <option value="20">20 per pagina</option>
            <option value="30">30 per pagina</option>
            <option value="50">50 per pagina</option>
          </select>
        </div>
      </SurfaceCard>

      {query.isLoading ? <LoadingState label="Sto caricando la lista giocatori..." /> : null}
      {query.error ? <ErrorState message={query.error.message} /> : null}

      {query.data ? (
        <>
          <DataStamp updatedAt={query.data.meta.updatedAt} stale={query.data.meta.stale} />
          <SurfaceCard title={`Giocatori trovati: ${query.data.data.total}`}>
            {query.data.data.items.length > 0 ? (
              <div className="entity-grid">
                {query.data.data.items.map((player) => (
                  <Link key={player.playerId} to={`/players/${player.playerId}`} className="entity-card">
                    <div className="entity-card-head">
                      <img src={player.headshot} alt="" className="player-headshot-large" />
                      <div>
                        <strong>{player.fullName}</strong>
                        <p>
                          {player.team?.code ?? "Svincolato"} · {formatPosition(player.position)} · #{player.jersey ?? "--"}
                        </p>
                      </div>
                    </div>
                    <div className="entity-meta">
                      <span>{formatHeight(player.height)}</span>
                      <span>{formatNumber(player.averages?.points)} punti</span>
                    </div>
                    <div className="entity-meta">
                      <span>{formatNumber(player.averages?.rebounds)} rimbalzi</span>
                      <span>{formatNumber(player.averages?.assists)} assist</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState label="Nessun giocatore corrisponde ai filtri attivi." />
            )}
          </SurfaceCard>
        </>
      ) : null}
    </>
  );
}
