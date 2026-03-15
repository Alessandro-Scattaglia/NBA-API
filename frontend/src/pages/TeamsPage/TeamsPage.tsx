import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { DataStamp, EmptyState, ErrorState, LoadingState, PageHeader } from "../../components/common/States";
import { SurfaceCard } from "../../components/cards/SurfaceCard";
import { apiGet } from "../../lib/api";
import { formatDivision } from "../../lib/format";
import type { TeamsResponse } from "../../lib/types";
import "./TeamsPage.css";

function TeamGroup({ title, teams }: { title: string; teams: TeamsResponse["east"] }) {
  return (
    <SurfaceCard title={title}>
      <div className="entity-grid">
        {teams.map((team) => (
          <Link key={team.teamId} to={`/teams/${team.teamId}`} className="entity-card">
            <div className="entity-card-head">
              <img src={team.logo} alt="" />
              <div>
                <strong>{team.name}</strong>
                <p>{formatDivision(team.division)}</p>
              </div>
            </div>
            <div className="entity-meta">
              <span>
                {team.wins}-{team.losses}
              </span>
              <span>Posizione {team.conferenceRank}</span>
            </div>
            <div className="entity-meta">
              <span>Ultime 10: {team.lastTen}</span>
              <span>{team.streak}</span>
            </div>
          </Link>
        ))}
      </div>
    </SurfaceCard>
  );
}

export function TeamsPage() {
  const query = useQuery({
    queryKey: ["teams"],
    queryFn: () => apiGet<TeamsResponse>("/api/teams")
  });

  if (query.isLoading) {
    return <LoadingState label="Sto caricando le squadre NBA..." />;
  }

  if (query.error) {
    return <ErrorState message={query.error.message} />;
  }

  if (!query.data) {
    return <EmptyState label="Nessuna squadra disponibile." />;
  }

  return (
    <>
      <PageHeader
        title="Squadre"
        description="Tutte le franchigie Est e Ovest con record, posizione e accesso rapido al dettaglio squadra."
      />
      <DataStamp updatedAt={query.data.meta.updatedAt} stale={query.data.meta.stale} />
      <div className="grid-2">
        <TeamGroup title="Conference Est" teams={query.data.data.east} />
        <TeamGroup title="Conference Ovest" teams={query.data.data.west} />
      </div>
    </>
  );
}
