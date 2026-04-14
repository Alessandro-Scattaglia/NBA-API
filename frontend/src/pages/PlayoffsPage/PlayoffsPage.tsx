import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Badge, DataStamp, EmptyState, ErrorState, LoadingState, PageHeader } from "../../components/common/States";
import { SurfaceCard } from "../../components/cards/SurfaceCard";
import { apiGet } from "../../lib/api";
import { formatConference, formatDate, formatGameStatusText, formatStatusLabel, formatTime, formatVenue } from "../../lib/format";
import type {
  GameSummary,
  PlayoffsResponse,
  PostseasonConferenceSnapshot,
  PostseasonKeyDate,
  PostseasonSeries,
  StandingsRow
} from "../../lib/types";
import "./PlayoffsPage.css";

function formatMilestoneRange(item: PostseasonKeyDate) {
  if (item.endDate) {
    return `${formatDate(item.startDate)} - ${formatDate(item.endDate)}`;
  }

  return formatDate(item.startDate);
}

function formatSeriesStatus(series: PostseasonSeries) {
  if (series.status === "confirmed") {
    return "Serie definita";
  }

  if (series.status === "awaiting-play-in") {
    return "In attesa del Play-In";
  }

  return "Play-In fissato";
}

function getSeriesTone(series: PostseasonSeries) {
  if (series.status === "confirmed") {
    return "success" as const;
  }

  return "warning" as const;
}

function getTeamSeedTone(team: StandingsRow) {
  if (team.seed <= 6) {
    return "success" as const;
  }

  if (team.seed <= 10) {
    return "warning" as const;
  }

  return "danger" as const;
}

function getDisplayScore(game: GameSummary, side: "home" | "away") {
  const score = side === "home" ? game.homeTeam.score : game.awayTeam.score;

  if (game.status === "scheduled") {
    return "--";
  }

  return score ?? "--";
}

function formatGameDay(dateTimeUtc: string) {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(new Date(dateTimeUtc));
}

function groupGamesByDay(games: GameSummary[]) {
  const groups = new Map<string, { label: string; games: GameSummary[] }>();

  for (const game of games) {
    const key = game.dateTimeUtc.slice(0, 10);
    const existing = groups.get(key);

    if (existing) {
      existing.games.push(game);
      continue;
    }

    groups.set(key, {
      label: formatGameDay(game.dateTimeUtc),
      games: [game]
    });
  }

  return Array.from(groups.entries()).map(([key, value]) => ({
    key,
    label: value.label,
    games: value.games
  }));
}

function TeamSeedList({ title, teams, emptyLabel }: { title: string; teams: StandingsRow[]; emptyLabel: string }) {
  return (
    <div className="playoffs-block">
      <div className="playoffs-block-head">
        <h3>{title}</h3>
        <Badge tone="neutral">{teams.length}</Badge>
      </div>

      {teams.length > 0 ? (
        <div className="playoffs-seed-list">
          {teams.map((team) => (
            <Link key={team.teamId} to={`/teams/${team.teamId}`} className="playoffs-seed-card">
              <div className="playoffs-seed-main">
                <span className="playoffs-seed-rank">{team.seed}</span>
                <img src={team.logo} alt="" className="mini-logo" />
                <div>
                  <strong>{team.name}</strong>
                  <p>
                    {team.code} · {team.wins}-{team.losses} · {team.streak}
                  </p>
                </div>
              </div>
              <Badge tone={getTeamSeedTone(team)}>{team.seed <= 6 ? "Playoff" : team.seed <= 10 ? "Play-In" : "Fuori"}</Badge>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState label={emptyLabel} />
      )}
    </div>
  );
}

function SeriesList({ title, series }: { title: string; series: PostseasonSeries[] }) {
  return (
    <div className="playoffs-block">
      <div className="playoffs-block-head">
        <h3>{title}</h3>
        <Badge tone="neutral">{series.length}</Badge>
      </div>

      <div className="playoffs-series-list">
        {series.map((item) => (
          <article key={`${item.conference}-${item.round}-${item.seedHigh}-${item.seedLow}`} className="playoffs-series-card">
            <div className="playoffs-series-topline">
              <strong>{item.label}</strong>
              <Badge tone={getSeriesTone(item)}>{formatSeriesStatus(item)}</Badge>
            </div>
            <p>{item.note}</p>

            {item.games.length > 0 ? (
              <div className="playoffs-series-games">
                {item.games.map((game) => (
                  <Link key={game.gameId} to={`/games/${game.gameId}`} className="playoffs-series-game-link">
                    <span>
                      {game.awayTeam.code} @ {game.homeTeam.code}
                    </span>
                    <small>
                      {formatDate(game.dateTimeUtc)} · {formatTime(game.dateTimeUtc)}
                    </small>
                  </Link>
                ))}
              </div>
            ) : (
              <span className="playoffs-series-waiting">Le date dettagliate appariranno qui appena pubblicate nell'API.</span>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function ConferenceSnapshot({ snapshot }: { snapshot: PostseasonConferenceSnapshot }) {
  return (
    <SurfaceCard title={formatConference(snapshot.conference, true)} subtitle="Seed, Play-In e primo turno aggiornati con il calendario postseason">
      <div className="playoffs-conference-summary">
        <Badge tone="success">{snapshot.directSeeds.length} gia ai playoff</Badge>
        <Badge tone="warning">{snapshot.playInSeeds.length} nel Play-In</Badge>
        {snapshot.outsidePicture.length > 0 ? <Badge tone="danger">{snapshot.outsidePicture.length} fuori quadro</Badge> : null}
      </div>

      <div className="playoffs-conference-grid">
        <TeamSeedList
          title="Qualificate dirette"
          teams={snapshot.directSeeds}
          emptyLabel="Nessuna squadra ancora qualificata direttamente."
        />
        <TeamSeedList title="Zona Play-In" teams={snapshot.playInSeeds} emptyLabel="Play-In non ancora definito." />
        {snapshot.outsidePicture.length > 0 ? (
          <TeamSeedList title="Fuori dal quadro" teams={snapshot.outsidePicture} emptyLabel="Nessuna squadra fuori quadro." />
        ) : null}
        <SeriesList title="Accoppiamenti Play-In" series={snapshot.playInSeries} />
        <SeriesList title="Primo turno" series={snapshot.firstRoundSeries} />
      </div>
    </SurfaceCard>
  );
}

function PostseasonSchedule({
  title,
  subtitle,
  games,
  emptyLabel
}: {
  title: string;
  subtitle: string;
  games: GameSummary[];
  emptyLabel: string;
}) {
  const groups = groupGamesByDay(games);

  return (
    <SurfaceCard title={title} subtitle={subtitle}>
      {groups.length > 0 ? (
        <div className="playoffs-game-groups">
          {groups.map((group) => (
            <div key={group.key} className="playoffs-game-group">
              <div className="playoffs-block-head">
                <h3>{group.label}</h3>
                <Badge tone="neutral">{group.games.length}</Badge>
              </div>

              <div className="playoffs-game-list">
                {group.games.map((game) => (
                  <Link key={game.gameId} to={`/games/${game.gameId}`} className="playoffs-game-row">
                    <div className="playoffs-game-row-top">
                      <div>
                        <strong>
                          {game.awayTeam.code} {getDisplayScore(game, "away")} - {getDisplayScore(game, "home")} {game.homeTeam.code}
                        </strong>
                        <p>{formatVenue(game.arena)}</p>
                      </div>
                      <div className="playoffs-game-badges">
                        <Badge tone={game.status === "live" ? "live" : game.status === "final" ? "neutral" : "warning"}>
                          {formatStatusLabel(game.status)}
                        </Badge>
                      </div>
                    </div>

                    <div className="playoffs-game-row-meta">
                      <span>{formatGameStatusText(game)}</span>
                      <span>Ore {formatTime(game.dateTimeUtc)}</span>
                      {game.nationalTv.length > 0 ? <span>TV: {game.nationalTv.join(", ")}</span> : null}
                    </div>
                  </Link>
                ))}
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

function SourceList({ sources }: { sources: string[] }) {
  return (
    <SurfaceCard title="Fonti ufficiali" subtitle="Endpoint NBA e pagine NBA.com usate per timeline, bracket e calendario">
      <div className="playoffs-sources">
        {sources.map((source) => (
          <a key={source} href={source} target="_blank" rel="noreferrer" className="playoffs-source-link">
            {source}
          </a>
        ))}
      </div>
    </SurfaceCard>
  );
}

export function PlayoffsPage() {
  const query = useQuery({
    queryKey: ["playoffs"],
    queryFn: () => apiGet<PlayoffsResponse>("/api/playoffs")
  });

  return (
    <>
      <PageHeader
        title="Playoff"
        description="Quadro completo della postseason NBA 2025-2026: date chiave ufficiali, formato del torneo, seed Est/Ovest, Play-In, serie confermate e partite gia in calendario."
      />

      {query.isLoading ? <LoadingState label="Sto caricando il quadro playoff..." /> : null}
      {query.error ? <ErrorState message={query.error.message} /> : null}

      {query.data ? (
        <div className="playoffs-page-layout">
          <DataStamp updatedAt={query.data.meta.updatedAt} stale={query.data.meta.stale} />

          <div className="stats-grid">
            <div className="stat-box">
              <span>Gia qualificate</span>
              <strong>{query.data.data.overview.directQualifiedTeams}</strong>
            </div>
            <div className="stat-box">
              <span>Squadre Play-In</span>
              <strong>{query.data.data.overview.playInTeams}</strong>
            </div>
            <div className="stat-box">
              <span>Serie gia definite</span>
              <strong>{query.data.data.overview.confirmedFirstRoundSeries}</strong>
            </div>
            <div className="stat-box">
              <span>Partite schedulate</span>
              <strong>
                {query.data.data.overview.playInGamesScheduled + query.data.data.overview.playoffGamesScheduled}
              </strong>
            </div>
          </div>

          <div className="grid-2 playoffs-overview-grid">
            <SurfaceCard title="Date chiave" subtitle="Verificate su NBA.com per la postseason 2025-26">
              <div className="playoffs-timeline">
                {query.data.data.keyDates.map((item) => (
                  <article key={item.key} className="playoffs-timeline-card">
                    <span className="eyebrow">{formatMilestoneRange(item)}</span>
                    <strong>{item.label}</strong>
                    <p>{item.note}</p>
                  </article>
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard title="Come funziona il torneo" subtitle="Play-In, bracket di conference e formula delle serie">
              <div className="leader-list">
                {query.data.data.formatNotes.map((note) => (
                  <div key={note} className="filter-chip">
                    {note}
                  </div>
                ))}
              </div>
            </SurfaceCard>
          </div>

          <div className="grid-2 playoffs-conference-columns">
            <ConferenceSnapshot snapshot={query.data.data.east} />
            <ConferenceSnapshot snapshot={query.data.data.west} />
          </div>

          <div className="grid-2 playoffs-overview-grid">
            <PostseasonSchedule
              title="Calendario Play-In"
              subtitle="Le partite postseason gia pubblicate nell'API vengono raggruppate per giorno"
              games={query.data.data.playInGames}
              emptyLabel="Il calendario dettagliato del Play-In non e ancora disponibile nell'API."
            />
            <PostseasonSchedule
              title="Calendario Playoff"
              subtitle="Gare del tabellone principale gia presenti nel feed NBA"
              games={query.data.data.playoffGames}
              emptyLabel="Il calendario dettagliato dei playoff non e ancora disponibile nell'API."
            />
          </div>

          <div className="grid-2 playoffs-overview-grid">
            <SurfaceCard title="NBA Finals 2026" subtitle="Calendario ufficiale della finale, con Gara 7 se necessaria">
              <div className="playoffs-finals-list">
                {query.data.data.finalsDates.map((item) => (
                  <article key={item.key} className="playoffs-finals-row">
                    <div>
                      <strong>{item.label}</strong>
                      <p>{item.note}</p>
                    </div>
                    <Badge tone="neutral">{formatDate(item.startDate)}</Badge>
                  </article>
                ))}
              </div>
            </SurfaceCard>

            <SourceList sources={query.data.meta.source} />
          </div>
        </div>
      ) : null}

      {!query.isLoading && !query.error && !query.data ? <EmptyState label="Quadro playoff non disponibile." /> : null}
    </>
  );
}
