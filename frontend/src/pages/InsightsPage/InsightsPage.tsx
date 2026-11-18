import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { SurfaceCard } from "../../components/cards/SurfaceCard";
import { DataStamp, EmptyState, ErrorState, LoadingState, PageHeader, Badge } from "../../components/common/States";
import { apiGet } from "../../lib/api";
import { formatDate, formatGameDateLabel, formatNumber } from "../../lib/format";
import type { InsightGame, InsightPlayer, InsightTeam, InsightsResponse } from "../../lib/types";
import "./InsightsPage.css";

function TeamInsightCard({ title, insight }: { title: string; insight: InsightTeam | null }) {
  if (!insight) {
    return <SurfaceCard title={title}><EmptyState label="Dato non disponibile." /></SurfaceCard>;
  }

  const metric = title === "Miglior difesa" ? insight.metric.toFixed(1) : title === "Miglior attacco" ? insight.metric.toFixed(1) : `${Math.round(insight.metric * 100)}%`;

  return (
    <SurfaceCard title={title}>
      <Link to={`/teams/${insight.team.teamId}`} className="insight-feature">
        <img src={insight.team.logo} alt="" className="insight-team-logo" />
        <div>
          <strong>{insight.team.name}</strong>
          <p>{insight.team.wins}-{insight.team.losses} · {insight.metricLabel}</p>
        </div>
        <span className="insight-feature-value">{metric}</span>
      </Link>
    </SurfaceCard>
  );
}

function PlayerInsightCard({ insight }: { insight: InsightPlayer | null }) {
  if (!insight) {
    return <SurfaceCard title="Giocatore più caldo"><EmptyState label="Dato non disponibile." /></SurfaceCard>;
  }

  return (
    <SurfaceCard title="Giocatore più caldo">
      <Link to={`/players/${insight.player.playerId}`} className="insight-feature">
        <img src={insight.player.headshot} alt="" className="insight-player-headshot" />
        <div>
          <strong>{insight.player.fullName}</strong>
          <p>{insight.player.team?.code ?? "Svincolato"} · {insight.metricLabel}</p>
        </div>
        <span className="insight-feature-value">{formatNumber(insight.metric)}</span>
      </Link>
    </SurfaceCard>
  );
}

function formatTeamMetric(insight: InsightTeam, type: "form" | "attack" | "defense") {
  if (type === "form") {
    return `${Math.round(insight.metric * 100)}%`;
  }

  return formatNumber(insight.metric);
}

function TeamRanking({
  title,
  items,
  type
}: {
  title: string;
  items: InsightTeam[];
  type: "form" | "attack" | "defense";
}) {
  return (
    <SurfaceCard title={title}>
      {items.length > 0 ? (
        <div className="insight-ranking-list">
          {items.map((item, index) => (
            <Link key={item.team.teamId} to={`/teams/${item.team.teamId}`} className="insight-ranking-row">
              <span className="insight-ranking-position">{index + 1}</span>
              <img src={item.team.logo} alt="" className="insight-ranking-logo" />
              <div className="insight-ranking-copy">
                <strong>{item.team.name}</strong>
                <span>{item.team.wins}-{item.team.losses} · {item.metricLabel}</span>
              </div>
              <strong className="insight-ranking-value">{formatTeamMetric(item, type)}</strong>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState label="Ranking non disponibile." />
      )}
    </SurfaceCard>
  );
}

function PlayerRanking({ items }: { items: InsightPlayer[] }) {
  return (
    <SurfaceCard title="Top realizzatori">
      {items.length > 0 ? (
        <div className="insight-ranking-list">
          {items.map((item, index) => (
            <Link key={item.player.playerId} to={`/players/${item.player.playerId}`} className="insight-ranking-row">
              <span className="insight-ranking-position">{index + 1}</span>
              <img src={item.player.headshot} alt="" className="insight-ranking-headshot" />
              <div className="insight-ranking-copy">
                <strong>{item.player.fullName}</strong>
                <span>{item.player.team?.code ?? "Svincolato"} · {item.player.averages?.assists.toFixed(1)} assist</span>
              </div>
              <strong className="insight-ranking-value">{formatNumber(item.metric)}</strong>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState label="Ranking non disponibile." />
      )}
    </SurfaceCard>
  );
}

function InterestingGame({ item }: { item: InsightGame }) {
  return (
    <Link to={`/games/${item.game.gameId}`} className="insight-game">
      <div className="insight-game-date">
        <span>{formatGameDateLabel(item.game)}</span>
        <Badge tone={item.game.status === "live" ? "live" : item.game.status === "final" ? "neutral" : "warning"}>
          {item.game.status === "live" ? "In diretta" : item.game.status === "final" ? "Finita" : "In programma"}
        </Badge>
      </div>
      <div className="insight-game-matchup">
        <div className="insight-game-team">
          <img src={item.game.awayTeam.logo} alt="" className="insight-game-logo" />
          <strong>{item.game.awayTeam.code}</strong>
        </div>
        <span>{item.game.awayTeam.score ?? "--"} - {item.game.homeTeam.score ?? "--"}</span>
        <div className="insight-game-team">
          <strong>{item.game.homeTeam.code}</strong>
          <img src={item.game.homeTeam.logo} alt="" className="insight-game-logo" />
        </div>
      </div>
      <p>{item.reason}</p>
    </Link>
  );
}

export function InsightsPage() {
  const query = useQuery({
    queryKey: ["insights"],
    queryFn: () => apiGet<InsightsResponse>("/api/insights")
  });

  if (query.error) {
    return <ErrorState message={query.error.message} />;
  }

  if (query.isLoading) {
    return <LoadingState label="Sto elaborando l'analisi NBA..." />;
  }

  if (!query.data) {
    return <EmptyState label="Insights non disponibili." />;
  }

  const { data, meta } = query.data;

  return (
    <>
      <PageHeader
        title="Analisi"
        description="Una lettura rapida della stagione: forma, attacco, difesa, giocatori in evidenza e partite da seguire."
      />
      <DataStamp updatedAt={meta.updatedAt} stale={meta.stale} />

      <div className="insights-grid">
        <TeamInsightCard title="Squadra più in forma" insight={data.mostInFormTeam} />
        <TeamInsightCard title="Miglior attacco" insight={data.bestAttackTeam} />
        <TeamInsightCard title="Miglior difesa" insight={data.bestDefenseTeam} />
        <PlayerInsightCard insight={data.hottestPlayer} />
      </div>

      <div className="stats-grid insights-overview">
        <div className="stat-box"><span>Partite nei prossimi 7 giorni</span><strong>{data.overview.games}</strong></div>
        <div className="stat-box"><span>Partite in programma</span><strong>{data.overview.scheduledGames}</strong></div>
        <div className="stat-box"><span>Dirette</span><strong>{data.overview.liveGames}</strong></div>
        <div className="stat-box"><span>TV nazionale</span><strong>{data.overview.nationalTvGames}</strong></div>
        <div className="stat-box"><span>Punti medi per partita</span><strong>{formatNumber(data.overview.averageTotalPoints)}</strong></div>
      </div>

      <div className="grid-2 insights-rankings">
        <TeamRanking title="Squadre più in forma" items={data.teamFormRanking} type="form" />
        <TeamRanking title="Migliori attacchi" items={data.attackRanking} type="attack" />
        <TeamRanking title="Migliori difese" items={data.defenseRanking} type="defense" />
        <PlayerRanking items={data.playerRanking} />
      </div>

      <div className="insights-games-card">
        <SurfaceCard
          title="Partite più interessanti della settimana"
          subtitle={`${formatDate(data.period.from)} - ${formatDate(data.period.to)}`}
        >
          {data.interestingGames.length > 0 ? (
            <div className="insight-games-list">
              {data.interestingGames.map((item) => <InterestingGame key={item.game.gameId} item={item} />)}
            </div>
          ) : (
            <EmptyState label="Nessuna partita interessante disponibile per questo intervallo." />
          )}
        </SurfaceCard>
      </div>
    </>
  );
}
