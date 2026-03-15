import { useQuery } from "@tanstack/react-query";
import { DataStamp, ErrorState, LoadingState, PageHeader } from "../../components/common/States";
import { LeaderPanel } from "../../components/cards/LeaderPanel";
import { apiGet } from "../../lib/api";
import type { LeadersResponse } from "../../lib/types";
import { EmptyState } from "../../components/common/States";
import "./LeadersPage.css";

export function LeadersPage() {
  const query = useQuery({
    queryKey: ["leaders"],
    queryFn: () => apiGet<LeadersResponse>("/api/leaders?limit=15")
  });

  if (query.isLoading) {
    return <LoadingState label="Sto caricando i leaders statistici..." />;
  }

  if (query.error) {
    return <ErrorState message={query.error.message} />;
  }

  if (!query.data) {
    return <EmptyState label="Leader statistici non disponibili." />;
  }

  return (
    <>
      <PageHeader
        title="Leader statistici"
        description="Migliori marcatori, rimbalzisti e assistman della stagione corrente."
      />
      <DataStamp updatedAt={query.data.meta.updatedAt} stale={query.data.meta.stale} />
      <div className="grid-3">
        {query.data.data.categories.map((category) => (
          <LeaderPanel key={category.key} category={category} />
        ))}
      </div>
    </>
  );
}
