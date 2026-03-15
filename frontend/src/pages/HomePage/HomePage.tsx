import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiGet } from "../../lib/api";
import type { HomeResponse } from "../../lib/types";
import { DataStamp, EmptyState, ErrorState, LoadingState, PageHeader } from "../../components/common/States";
import { SurfaceCard } from "../../components/cards/SurfaceCard";
import { LeaderPanel } from "../../components/cards/LeaderPanel";
import { GameList } from "../../components/tables/GameList";
import { formatConference, formatGameDateLabel, formatGameStatusText } from "../../lib/format";
import "./HomePage.css";

export function HomePage() {
  const query = useQuery({
    queryKey: ["home"],
    queryFn: () => apiGet<HomeResponse>("/api/home")
  });

  if (query.isLoading) {
    return <LoadingState label="Sto caricando la panoramica della stagione..." />;
  }

  if (query.error) {
    return <ErrorState message={query.error.message} />;
  }

  if (!query.data) {
    return <EmptyState label="Nessun dato home disponibile." />;
  }

  const { data, meta } = query.data;

  return (
    <>
      <PageHeader
        title="Panoramica stagione"
        description="Dati aggiornati della stagione NBA 2025-2026."
      />

      <DataStamp updatedAt={meta.updatedAt} stale={meta.stale} />

      {data.featuredGame ? (
        <SurfaceCard title="Partita in evidenza" subtitle="La sfida piu` rilevante del momento">
          <Link to={`/games/${data.featuredGame.gameId}`} className="entity-card">
            <div className="entity-meta">
              <span>{formatGameDateLabel(data.featuredGame)}</span>
              <span>{formatGameStatusText(data.featuredGame)}</span>
            </div>
            <div className="game-matchup">
              <div className="game-team">
                <img src={data.featuredGame.awayTeam.logo} alt="" className="mini-logo" />
                <strong>{data.featuredGame.awayTeam.name}</strong>
              </div>
              <strong>
                {data.featuredGame.awayTeam.score ?? "--"} - {data.featuredGame.homeTeam.score ?? "--"}
              </strong>
              <div className="game-team game-team-right">
                <strong>{data.featuredGame.homeTeam.name}</strong>
                <img src={data.featuredGame.homeTeam.logo} alt="" className="mini-logo" />
              </div>
            </div>
          </Link>
        </SurfaceCard>
      ) : null}

      <div className="grid-2">
        <SurfaceCard title={`Capolista ${formatConference("East", true)}`}>
          {data.conferenceLeaders.east ? (
            <Link to={`/teams/${data.conferenceLeaders.east.teamId}`} className="entity-card">
              <div className="entity-card-head">
                <img src={data.conferenceLeaders.east.logo} alt="" />
                <div>
                  <strong>{data.conferenceLeaders.east.name}</strong>
                  <p>
                    {data.conferenceLeaders.east.wins}-{data.conferenceLeaders.east.losses} · Posizione{" "}
                    {data.conferenceLeaders.east.conferenceRank}
                  </p>
                </div>
              </div>
            </Link>
          ) : (
            <EmptyState label="Nessuna capolista dell'Est disponibile." />
          )}
        </SurfaceCard>

        <SurfaceCard title={`Capolista ${formatConference("West", true)}`}>
          {data.conferenceLeaders.west ? (
            <Link to={`/teams/${data.conferenceLeaders.west.teamId}`} className="entity-card">
              <div className="entity-card-head">
                <img src={data.conferenceLeaders.west.logo} alt="" />
                <div>
                  <strong>{data.conferenceLeaders.west.name}</strong>
                  <p>
                    {data.conferenceLeaders.west.wins}-{data.conferenceLeaders.west.losses} · Posizione{" "}
                    {data.conferenceLeaders.west.conferenceRank}
                  </p>
                </div>
              </div>
            </Link>
          ) : (
            <EmptyState label="Nessuna capolista dell'Ovest disponibile." />
          )}
        </SurfaceCard>
      </div>

      <div className="grid-3">
        {data.playerLeaders.map((category: HomeResponse["playerLeaders"][number]) => (
          <LeaderPanel key={category.key} category={category} />
        ))}
      </div>

      <div className="grid-2">
        <SurfaceCard title="Partite di ieri">
          {data.todayGames.length > 0 ? <GameList games={data.todayGames} /> : <EmptyState label="Oggi non risultano partite." />}
        </SurfaceCard>
        <SurfaceCard title="Prossime partite">
          {data.upcomingGames.length > 0 ? (
            <GameList games={data.upcomingGames} />
          ) : (
            <EmptyState label="Non ci sono ancora partite in calendario in questo intervallo." />
          )}
        </SurfaceCard>
      </div>

      <section className="hero-card hero-card-secondary">
        <p className="eyebrow">Panoramica</p>
        <h2 className="hero-title">Tutto quello che conta nella stagione NBA 2025-2026</h2>
        <p className="hero-copy">
          Dati aggiornati dal backend, classifica Est e Ovest, focus su squadre e giocatori, calendario filtrabile
          e leader statistici in un'unica interfaccia.
        </p>
        <div className="pill-row">
          <span className="metric-pill">{data.todayGames.length} partite oggi</span>
          <span className="metric-pill">{data.upcomingGames.length} partite in arrivo</span>
          <span className="metric-pill">{data.playerLeaders.length} classifiche leader</span>
        </div>
      </section>
    </>
  );
}
