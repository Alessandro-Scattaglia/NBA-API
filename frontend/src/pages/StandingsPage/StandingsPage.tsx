import { useQuery } from "@tanstack/react-query";
import { DataStamp, EmptyState, ErrorState, LoadingState, PageHeader } from "../../components/common/States";
import { SurfaceCard } from "../../components/cards/SurfaceCard";
import { StandingsTable } from "../../components/tables/StandingsTable";
import { apiGet } from "../../lib/api";
import type { StandingsResponse } from "../../lib/types";
import "./StandingsPage.css";

export function StandingsPage() {
  const query = useQuery({
    queryKey: ["standings"],
    queryFn: () => apiGet<StandingsResponse>("/api/standings")
  });

  if (query.isLoading) {
    return <LoadingState label="Sto caricando la classifica..." />;
  }

  if (query.error) {
    return <ErrorState message={query.error.message} />;
  }

  if (!query.data) {
    return <EmptyState label="Classifica non disponibile." />;
  }

  const { data, meta } = query.data;

  return (
    <div className="standings-page-layout">
      <PageHeader
        title="Classifica"
        description="Tabelle Est e Ovest con posizione, stato playoff/play-in, serie aperta e note sul formato della postseason."
      />
      <DataStamp updatedAt={meta.updatedAt} stale={meta.stale} />

      <div className="conference-stack standings-conference-stack">
        <div className="conference-pane">
          <SurfaceCard title="Conference Est">
            <StandingsTable teams={data.east} />
          </SurfaceCard>
        </div>
        <div className="conference-pane">
          <SurfaceCard title="Conference Ovest">
            <StandingsTable teams={data.west} />
          </SurfaceCard>
        </div>
      </div>

      <SurfaceCard title="Play-In e Playoff">
        <div className="leader-list">
          {data.playInNotes.map((note: string) => (
            <div key={note} className="filter-chip">
              {note}
            </div>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}
