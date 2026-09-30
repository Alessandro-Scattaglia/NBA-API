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

const HERO_CONTENT = {
  playoffs: {
    title: "Playoff subito in primo piano",
    copy:
      "Vai direttamente alla pagina playoff per bracket, serie aperte, calendario della postseason e quadro completo di Est e Ovest.",
    ctaLabel: "Vai alla pagina Playoff",
    ctaTo: "/playoffs",
    pills: ["Bracket completo", "Serie aggiornate", "Calendario postseason"],
    className: "hero-card-playoffs",
    eyebrow: "Home"
  },
  standings: {
    title: "Classifica della stagione regolare",
    copy:
      "Controlla subito la corsa alle seed, le squadre in zona playoff e l'andamento delle conference prima del cambio di fase.",
    ctaLabel: "Vai alla classifica",
    ctaTo: "/standings",
    pills: ["Seed aggiornate", "Play-in watch", "Corsa ai playoff"],
    className: "hero-card-standings",
    eyebrow: "Home"
  }
} as const;

export function HomePage() {
  const query = useQuery({
    queryKey: ["home"],
    queryFn: () => apiGet<HomeResponse>("/api/home")
  });

  if (query.isLoading) {
    return <LoadingState label="Sto caricando la home..." />;
  }

  if (query.error) {
    return <ErrorState message={query.error.message} />;
  }

  if (!query.data) {
    return <EmptyState label="Nessun dato home disponibile." />;
  }

  const { data, meta } = query.data;
  const hero = HERO_CONTENT[data.homeSpotlightMode];

  return (
    <>
      <PageHeader
        title="Home"
        description={
          data.homeSpotlightMode === "playoffs"
            ? "Accesso rapido ai playoff e ai dati NBA aggiornati."
            : "Accesso rapido alla classifica e ai dati NBA aggiornati."
        }
      />

      <section className={`hero-card ${hero.className}`}>
        <div className="hero-card-head">
          <div>
            <p className="eyebrow">{hero.eyebrow}</p>
            <h2 className="hero-title">{hero.title}</h2>
            <p className="hero-copy">{hero.copy}</p>
          </div>
          <Link to={hero.ctaTo} className="hero-card-cta">
            {hero.ctaLabel}
          </Link>
        </div>
        <div className="pill-row">
          {hero.pills.map((pill) => (
            <span key={pill} className="metric-pill">
              {pill}
            </span>
          ))}
        </div>
      </section>

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
        <p className="eyebrow">Home</p>
        <h2 className="hero-title">Panoramica rapida della stagione NBA {data.season}</h2>
        <p className="hero-copy">
          Dalla home puoi passare subito ai playoff, controllare squadre e giocatori, consultare il calendario e vedere
          i leader statistici in un'unica interfaccia.
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
