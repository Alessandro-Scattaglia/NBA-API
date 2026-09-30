import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, DataStamp, EmptyState, ErrorState, LoadingState, PageHeader } from "../../components/common/States";
import { SurfaceCard } from "../../components/cards/SurfaceCard";
import { StandingsTable } from "../../components/tables/StandingsTable";
import { apiGet } from "../../lib/api";
import { formatGameDateLabel, formatGameStatusText, formatStatusLabel, formatTime, formatVenue } from "../../lib/format";
import {
  btRecord,
  getFinalsSummary,
  hasVisibleSeriesData,
  toPlayoffConferenceStandings,
  type ExtendedPostseasonConferenceSnapshot,
  type FinalsSummary
} from "./playoffStats";
import type {
  GameSummary,
  PlayoffsResponse,
  PostseasonConferenceSnapshot,
  PostseasonSeries,
  StandingsRow
} from "../../lib/types";
import "../CalendarPage/CalendarPage.css";
import "./PlayoffsPage.css";

// ─── shared helpers ───────────────────────────────────────────────

function hasPlayoffsStarted(payload: PlayoffsResponse) {
  const playoffsStart = payload.keyDates.find((d) => d.key === "playoffs-begin")?.startDate;
  if (!playoffsStart) return false;
  const ts = Date.parse(`${playoffsStart}T00:00:00Z`);
  return !Number.isNaN(ts) && Date.now() >= ts;
}

function findSeed(teams: StandingsRow[], seed: number) {
  return teams.find((t) => t.seed === seed);
}

function formatCalendarPill(date: string) {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    weekday: "short",
    day: "2-digit",
    month: "short"
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function formatCalendarHeading(date: string) {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function getGameDayKey(dateTimeUtc: string) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(dateTimeUtc));
  const y = p.find((x) => x.type === "year")?.value;
  const m = p.find((x) => x.type === "month")?.value;
  const d = p.find((x) => x.type === "day")?.value;
  return y && m && d ? `${y}-${m}-${d}` : dateTimeUtc.slice(0, 10);
}

function getTeamCode(team: GameSummary["homeTeam"]) {
  return team.code?.trim() || team.name?.trim() || "TBD";
}

function displayScore(game: GameSummary, side: "home" | "away") {
  const s = side === "home" ? game.homeTeam.score : game.awayTeam.score;
  return game.status === "scheduled" ? "--" : (s ?? "--");
}

function getDefaultPlayoffDate(games: GameSummary[], availableDates: string[]) {
  if (availableDates.length === 0) return "";

  const todayKey = getGameDayKey(new Date().toISOString());
  if (availableDates.includes(todayKey)) return todayKey;

  const nextUpcoming = games
    .filter((game) => game.status !== "final" && getGameDayKey(game.dateTimeUtc) >= todayKey)
    .sort((left, right) => Date.parse(left.dateTimeUtc) - Date.parse(right.dateTimeUtc))
    .at(0);

  if (nextUpcoming) return getGameDayKey(nextUpcoming.dateTimeUtc);
  return availableDates[availableDates.length - 1];
}

function getVisibleDateWindow(availableDates: string[], selectedDate: string) {
  if (availableDates.length <= 3) return availableDates;
  const index = Math.max(0, availableDates.indexOf(selectedDate));
  const start = Math.max(0, Math.min(index - 1, availableDates.length - 3));
  return availableDates.slice(start, start + 3);
}

// ─── Bracket Components ───────────────────────────────────────────

type BtSeries = {
  seedHigh: number | "?";
  seedLow: number | "?";
  teamHigh: StandingsRow | null;
  teamLow: StandingsRow | null;
  winsHigh: number;
  winsLow: number;
};

function formatFinalsSeriesText(summary: FinalsSummary) {
  if (summary.champion && summary.runnerUp) {
    const championWins = summary.champion.teamId === summary.eastWinner.teamId ? summary.winsEast : summary.winsWest;
    const runnerUpWins = summary.runnerUp.teamId === summary.eastWinner.teamId ? summary.winsEast : summary.winsWest;
    return `${summary.champion.code} batte ${summary.runnerUp.code} ${championWins}-${runnerUpWins}`;
  }

  return `${summary.westWinner.code} ${summary.winsWest}-${summary.winsEast} ${summary.eastWinner.code}`;
}

function FinalsOutcomeCard({ summary }: { summary: FinalsSummary }) {
  const champion = summary.champion ?? (summary.winsWest >= summary.winsEast ? summary.westWinner : summary.eastWinner);
  const runnerUp = summary.runnerUp ?? (champion.teamId === summary.eastWinner.teamId ? summary.westWinner : summary.eastWinner);
  const seriesText = formatFinalsSeriesText(summary);

  return (
    <SurfaceCard
      title="Finali NBA"
      subtitle={summary.finished ? "Serie conclusa con il titolo assegnato" : "Serie finale in corso"}
    >
      <div className="playoffs-finals-summary">
        <div className="playoffs-finals-badge-row">
          <Badge tone={summary.finished ? "live" : "warning"}>{summary.finished ? "Campione NBA" : "Finali in corso"}</Badge>
          <span className="playoffs-finals-series-text">{seriesText}</span>
        </div>

        <div className="playoffs-finals-matchup">
          <Link to={`/teams/${summary.westWinner.teamId}`} className="playoffs-finals-team">
            <img src={summary.westWinner.logo} alt="" className="mini-logo" />
            <span>
              <strong>{summary.westWinner.code}</strong>
              <small>{summary.westWinner.name}</small>
            </span>
            <strong className="playoffs-finals-record">{summary.winsWest}</strong>
          </Link>

          <div className="playoffs-finals-center">
            <span className="playoffs-finals-vs">vs</span>
            <strong>{champion.code}</strong>
            <small>{summary.finished ? "Titolo assegnato" : "Serie aperta"}</small>
          </div>

          <Link to={`/teams/${summary.eastWinner.teamId}`} className="playoffs-finals-team">
            <img src={summary.eastWinner.logo} alt="" className="mini-logo" />
            <span>
              <strong>{summary.eastWinner.code}</strong>
              <small>{summary.eastWinner.name}</small>
            </span>
            <strong className="playoffs-finals-record">{summary.winsEast}</strong>
          </Link>
        </div>

        <div className="playoffs-finals-meta">
          <span>
            {summary.latestGame ? `Ultima gara: ${formatGameDateLabel(summary.latestGame)} · ${formatGameStatusText(summary.latestGame)}` : "Nessuna gara finale disponibile."}
          </span>
          <span>{summary.finished ? `${champion.code} campione NBA` : `Servono ancora ${4 - Math.max(summary.winsEast, summary.winsWest)} vittorie per chiudere la serie`}</span>
        </div>
      </div>
    </SurfaceCard>
  );
}

function buildBracketSeries(
  topTeam: StandingsRow | null,
  bottomTeam: StandingsRow | null,
  winsHigh = 0,
  winsLow = 0
): BtSeries | null {
  if (!topTeam && !bottomTeam) {
    return null;
  }

  return {
    seedHigh: topTeam?.seed ?? "?",
    seedLow: bottomTeam?.seed ?? "?",
    teamHigh: topTeam,
    teamLow: bottomTeam,
    winsHigh,
    winsLow,
  };
}

function btMatchups(snap: PostseasonConferenceSnapshot): BtSeries[] {
  const all = [...snap.directSeeds, ...snap.playInSeeds];
  return (
    [{ h: 1, l: 8 }, { h: 4, l: 5 }, { h: 3, l: 6 }, { h: 2, l: 7 }] as const
  ).map(({ h, l }) => {
    const s = snap.firstRoundSeries.find((r) => r.seedHigh === h && r.seedLow === l);
    const { winsHigh, winsLow } = btRecord(s);
    return {
      seedHigh: h, seedLow: l,
      teamHigh: s?.highSeedTeam ?? findSeed(all, h) ?? null,
      teamLow: s?.lowSeedTeam ?? findSeed(all, l) ?? null,
      winsHigh, winsLow,
    };
  });
}

function BtTeam({
  seed, team, wins, isLeading,
}: {
  seed: number | "?"; team: StandingsRow | null; wins: number; isLeading: boolean;
}) {
  const inner = (
    <div className="bt-team">
      <span className="bt-seed">{seed}</span>
      {team?.logo ? <img src={team.logo} alt="" className="bt-logo" /> : <span className="bt-logo-ph" />}
      <span className="bt-code">{team?.code ?? "---"}</span>
      <span className={`bt-wins${isLeading ? " bt-wins-leading" : ""}`}>{wins}</span>
    </div>
  );
  return team ? (
    <Link to={`/teams/${team.teamId}`} className="bt-team-link" onClick={(e) => e.stopPropagation()}>
      {inner}
    </Link>
  ) : (
    <div>{inner}</div>
  );
}

function BtCard({ s }: { s: BtSeries }) {
  const highLeads = s.winsHigh > s.winsLow;
  const lowLeads = s.winsLow > s.winsHigh;
  return (
    <div className="bt-card">
      <BtTeam seed={s.seedHigh} team={s.teamHigh} wins={s.winsHigh} isLeading={highLeads} />
      <div className="bt-sep" />
      <BtTeam seed={s.seedLow} team={s.teamLow} wins={s.winsLow} isLeading={lowLeads} />
    </div>
  );
}

/** Card placeholder per turni non ancora definiti */
function BtPlaceholderCard({ seedHigh, seedLow }: { seedHigh?: number; seedLow?: number }) {
  return (
    <div className="bt-card">
      <div className="bt-team">
        <span className="bt-seed">{seedHigh ?? "?"}</span>
        <span className="bt-logo-ph" />
        <span className="bt-code">TBD</span>
        <span className="bt-wins">0</span>
      </div>
      <div className="bt-sep" />
      <div className="bt-team">
        <span className="bt-seed">{seedLow ?? "?"}</span>
        <span className="bt-logo-ph" />
        <span className="bt-code">TBD</span>
        <span className="bt-wins">0</span>
      </div>
    </div>
  );
}

/**
 * Bracket connector.
 * variant="fr"  → 2 units, each = bt-pair-h (FR → Semis)
 * variant="cf"  → 1 unit spanning bt-body-h  (Semis → CF)
 */
function BtConn({ variant }: { variant: "fr" | "cf" }) {
  const units = variant === "fr" ? 2 : 1;
  return (
    <div className={`bt-conn bt-conn-${variant}`}>
      {Array.from({ length: units }, (_, i) => (
        <div key={i} className="bt-cu">
          <div className="bt-cu-t" />
          <div className="bt-cu-b" />
        </div>
      ))}
    </div>
  );
}

function BtConference({ snap, side }: { snap: PostseasonConferenceSnapshot; side: "west" | "east" }) {
  const allTeams = [...snap.directSeeds, ...snap.playInSeeds];
  const frMatchups = btMatchups(snap);
  const snapExtended = snap as ExtendedPostseasonConferenceSnapshot;

  // Semifinali: API fornisce array di 2 serie (seed 1/8 vs 4/5 e 2/7 vs 3/6)
  const semi1 = snapExtended.semifinalsSeries?.[0];
  const semi2 = snapExtended.semifinalsSeries?.[1];

  const getSemiData = (
    semi?: PostseasonSeries,
    winnersFromFr?: [StandingsRow | null, StandingsRow | null],
    fallbackSeeds?: [number | "?", number | "?"]
  ): BtSeries | null => {
    if (hasVisibleSeriesData(semi)) {
      const rec = btRecord(semi);
      return {
        seedHigh: semi!.seedHigh,
        seedLow: semi!.seedLow,
        teamHigh: semi!.highSeedTeam,
        teamLow: semi!.lowSeedTeam,
        winsHigh: rec.winsHigh,
        winsLow: rec.winsLow,
      };
    }

    // Se la serie non esiste ancora, mostra i vincitori gia qualificati
    // rispettando il ramo alto/basso del bracket.
    if (winnersFromFr && (winnersFromFr[0] || winnersFromFr[1])) {
      return {
        seedHigh: winnersFromFr[0]?.seed ?? fallbackSeeds?.[0] ?? "?",
        seedLow: winnersFromFr[1]?.seed ?? fallbackSeeds?.[1] ?? "?",
        teamHigh: winnersFromFr[0] ?? null,
        teamLow: winnersFromFr[1] ?? null,
        winsHigh: 0,
        winsLow: 0,
      };
    }
    return null;
  };

  // Determina i vincitori delle serie del primo turno per alimentare le semifinali
  const frWinners = frMatchups.map(m => {
    if (m.winsHigh === 4) return m.teamHigh;
    if (m.winsLow === 4) return m.teamLow;
    return null;
  });

  // Coppie per le semifinali: (1/8 vs 4/5) e (3/6 vs 2/7)
  const semi1Data = getSemiData(semi1, [frWinners[0], frWinners[1]], [1, "?"]);
  const semi2Data = getSemiData(semi2, [frWinners[2], frWinners[3]], [2, "?"]);

  // Conference Finals
  const cfSeries = snapExtended.conferenceFinalsSeries?.[0];
  let cfData: BtSeries | null = null;
  if (hasVisibleSeriesData(cfSeries)) {
    const rec = btRecord(cfSeries);
    cfData = {
      seedHigh: cfSeries!.seedHigh,
      seedLow: cfSeries!.seedLow,
      teamHigh: cfSeries!.highSeedTeam,
      teamLow: cfSeries!.lowSeedTeam,
      winsHigh: rec.winsHigh,
      winsLow: rec.winsLow,
    };
  } else {
    const semi1Winner = semi1Data ? (semi1Data.winsHigh === 4 ? semi1Data.teamHigh : (semi1Data.winsLow === 4 ? semi1Data.teamLow : null)) : null;
    const semi2Winner = semi2Data ? (semi2Data.winsHigh === 4 ? semi2Data.teamHigh : (semi2Data.winsLow === 4 ? semi2Data.teamLow : null)) : null;
    cfData = buildBracketSeries(semi1Winner, semi2Winner);
  }

  return (
    <div className={`bt-conf bt-${side}`}>
      <div className="bt-conf-head">
        <span className="bt-conf-name">{side === "west" ? "WEST" : "EAST"}</span>
      </div>
      <div className="bt-round-labels">
        <span>First Round</span>
        <span>Conf. Semis</span>
        <span>Conf. Finals</span>
      </div>

      <div className="bt-body">
        {/* First Round */}
        <div className="bt-fr">
          <div className="bt-pair">
            <BtCard s={frMatchups[0]} />
            <BtCard s={frMatchups[1]} />
          </div>
          <div className="bt-pair">
            <BtCard s={frMatchups[2]} />
            <BtCard s={frMatchups[3]} />
          </div>
        </div>

        <BtConn variant="fr" />

        {/* Conf Semifinals */}
        <div className="bt-semis">
          <div className="bt-semis-slot">
            {semi1Data ? <BtCard s={semi1Data} /> : <BtPlaceholderCard seedHigh={1} seedLow={4} />}
          </div>
          <div className="bt-semis-slot">
            {semi2Data ? <BtCard s={semi2Data} /> : <BtPlaceholderCard seedHigh={2} seedLow={3} />}
          </div>
        </div>

        <BtConn variant="cf" />

        {/* Conf Finals */}
        <div className="bt-cf">
          {cfData ? <BtCard s={cfData} /> : <BtPlaceholderCard />}
        </div>
      </div>
    </div>
  );
}

function PlayoffBracketShowcase({
  season, east, west,
  playoffGames = [],
}: {
  season: string;
  east: PostseasonConferenceSnapshot;
  west: PostseasonConferenceSnapshot;
  playoffGames?: GameSummary[];
}) {
  const finalsSummary = getFinalsSummary(playoffGames, east, west);
  const finalsChampion = finalsSummary?.finished ? finalsSummary.champion : null;

  return (
    <SurfaceCard
      title={`Tabellone Playoff NBA ${season}`}
      subtitle={finalsChampion ? `Finali concluse: ${finalsChampion.code} campione NBA` : "Primo turno in corso · Conf. Semifinals, Finals e NBA Finals in attesa dei risultati"}
    >
      <div className="bt-bracket">
        <p className="bt-super-title">Playoffs {season}</p>

        <BtConference snap={west} side="west" />

        <div className="bt-finals-center">
          <p className="bt-finals-title">NBA Finals {season}</p>
          <div className="bt-card bt-finals-slot-card bt-finals-card">
            {finalsSummary ? (
              <BtTeam seed={finalsSummary.westWinner.seed} team={finalsSummary.westWinner} wins={finalsSummary.winsWest} isLeading={finalsSummary.winsWest > finalsSummary.winsEast} />
            ) : (
              <div className="bt-team">
                <span className="bt-seed">W</span>
                <span className="bt-logo-ph" />
                <span className="bt-code">TBD</span>
                <span className="bt-wins">0</span>
              </div>
            )}

            <div className="bt-finals-mid">
              <span className="bt-finals-mid-pill">VS</span>
            </div>

            {finalsSummary ? (
              <BtTeam seed={finalsSummary.eastWinner.seed} team={finalsSummary.eastWinner} wins={finalsSummary.winsEast} isLeading={finalsSummary.winsEast > finalsSummary.winsWest} />
            ) : (
              <div className="bt-team">
                <span className="bt-seed">E</span>
                <span className="bt-logo-ph" />
                <span className="bt-code">TBD</span>
                <span className="bt-wins">0</span>
              </div>
            )}
          </div>
        </div>

        <BtConference snap={east} side="east" />
      </div>
    </SurfaceCard>
  );
}

// ─── Postseason Schedule ──────────────────────────────────────────
// (invariato rispetto all'originale)

function PlayoffCalendar({
  title, subtitle, games, emptyLabel,
}: {
  title: string; subtitle: string; games: GameSummary[]; emptyLabel: string;
}) {
  const [selectedDateState, setSelectedDateState] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"" | GameSummary["status"]>("");
  const availableDates = Array.from(new Set(games.map((game) => getGameDayKey(game.dateTimeUtc)))).sort();
  const defaultDate = getDefaultPlayoffDate(games, availableDates);
  const selectedDate =
    selectedDateState && availableDates.includes(selectedDateState) ? selectedDateState : defaultDate;
  const visibleDates = selectedDate ? getVisibleDateWindow(availableDates, selectedDate) : [];
  const selectedIndex = availableDates.indexOf(selectedDate);
  const doneCount = games.filter((game) => game.status === "final").length;
  const liveOrUpcomingCount = games.filter((game) => game.status !== "final").length;
  const filteredGames = games.filter((game) => {
    const matchesDay = getGameDayKey(game.dateTimeUtc) === selectedDate;
    const matchesStatus = statusFilter ? game.status === statusFilter : true;
    return matchesDay && matchesStatus;
  });

  const moveDate = (offset: number) => {
    if (selectedIndex < 0) return;
    const nextIndex = selectedIndex + offset;
    if (nextIndex < 0 || nextIndex >= availableDates.length) return;
    setSelectedDateState(availableDates[nextIndex]);
  };

  const jumpToBoundary = (edge: "start" | "end") => {
    if (availableDates.length === 0) return;
    setSelectedDateState(edge === "start" ? availableDates[0] : availableDates[availableDates.length - 1]);
  };

  return (
    <SurfaceCard title={title} subtitle={subtitle}>
      {availableDates.length > 0 ? (
        <>
          <div className="playoffs-calendar-summary">
            <Badge tone="warning">{liveOrUpcomingCount} in programma/live</Badge>
            <Badge tone="neutral">{doneCount} concluse</Badge>
            <p className="playoffs-calendar-note">
              Navigazione giornaliera dedicata ai playoff con lo stesso layout del calendario principale.
            </p>
          </div>

          <div className="calendar-toolbar playoffs-calendar-toolbar">
            <div className="calendar-rail">
              <button type="button" className="calendar-nav-button" onClick={() => jumpToBoundary("start")} disabled={selectedIndex <= 0}>
                {"<<"}
              </button>
              <button type="button" className="calendar-nav-button" onClick={() => moveDate(-1)} disabled={selectedIndex <= 0}>
                {"<"}
              </button>
              <div className="calendar-date-strip">
                {visibleDates.map((date) => (
                  <button
                    key={date}
                    type="button"
                    className={`calendar-date-pill ${date === selectedDate ? "calendar-date-pill-active" : ""}`}
                    onClick={() => setSelectedDateState(date)}
                  >
                    <span>{formatCalendarPill(date)}</span>
                    {date === getGameDayKey(new Date().toISOString()) ? <small>Oggi</small> : null}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="calendar-nav-button"
                onClick={() => moveDate(1)}
                disabled={selectedIndex === -1 || selectedIndex >= availableDates.length - 1}
              >
                {">"}
              </button>
              <button
                type="button"
                className="calendar-nav-button"
                onClick={() => jumpToBoundary("end")}
                disabled={selectedIndex === -1 || selectedIndex >= availableDates.length - 1}
              >
                {">>"}
              </button>
            </div>
          </div>

          <div className="calendar-filter-row playoffs-calendar-filter-row">
            <div className="calendar-selected-day">
              <span className="eyebrow">Partite playoff del giorno</span>
              <strong>{selectedDate ? formatCalendarHeading(selectedDate) : "Nessuna data disponibile"}</strong>
            </div>
            <div className="filters-bar calendar-filters">
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "" | GameSummary["status"])}>
                <option value="">Tutti gli stati</option>
                <option value="scheduled">In programma</option>
                <option value="live">In diretta</option>
                <option value="final">Finita</option>
              </select>
            </div>
          </div>

          {filteredGames.length > 0 ? (
            <div className="calendar-day-list">
              {filteredGames.map((game) => (
                <Link key={game.gameId} to={`/games/${game.gameId}`} className="calendar-game-row">
                  <div className="calendar-game-time">
                    <span className="calendar-game-hour">{formatTime(game.dateTimeUtc)}</span>
                    <Badge tone={game.status === "live" ? "live" : game.status === "final" ? "neutral" : "warning"}>
                      {formatStatusLabel(game.status)}
                    </Badge>
                  </div>

                  <div className="calendar-game-matchup">
                    <div className="calendar-team-inline">
                      <div className="game-team">
                        <img src={game.awayTeam.logo} alt="" className="mini-logo" />
                        <strong>{getTeamCode(game.awayTeam)}</strong>
                      </div>
                      <span className="calendar-team-score">{displayScore(game, "away")}</span>
                    </div>

                    <span className="calendar-game-separator">-</span>

                    <div className="calendar-team-inline calendar-team-inline-home">
                      <span className="calendar-team-score">{displayScore(game, "home")}</span>
                      <div className="game-team">
                        <strong>{getTeamCode(game.homeTeam)}</strong>
                        <img src={game.homeTeam.logo} alt="" className="mini-logo" />
                      </div>
                    </div>
                  </div>

                  <div className="calendar-game-info">
                    <strong>{formatVenue(game.arena)}</strong>
                    <span>{formatGameStatusText(game)}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState label="Nessuna partita playoff trovata per questo giorno con i filtri attivi." />
          )}
        </>
      ) : (
        <EmptyState label={emptyLabel} />
      )}
    </SurfaceCard>
  );
}

// ─── Page ─────────────────────────────────────────────────────────

export function PlayoffsPage() {
  const query = useQuery({
    queryKey: ["playoffs"],
    queryFn: () => apiGet<PlayoffsResponse>("/api/playoffs"),
    refetchInterval: 30_000,
    staleTime: 10_000,
    refetchIntervalInBackground: true,
  });

  const playoffsStarted = query.data ? hasPlayoffsStarted(query.data.data) : false;
  const eastStandings = query.data
    ? toPlayoffConferenceStandings(query.data.data.east, query.data.data.playoffGames, playoffsStarted)
    : [];
  const westStandings = query.data
    ? toPlayoffConferenceStandings(query.data.data.west, query.data.data.playoffGames, playoffsStarted)
    : [];

  return (
    <>
      <PageHeader
        title="Playoff"
        description="Quadro della postseason NBA: classifiche playoff Est/Ovest, tabellone e calendario partite."
      />

      {query.isLoading ? <LoadingState label="Sto caricando il quadro playoff..." /> : null}
      {query.error ? <ErrorState message={query.error.message} /> : null}

      {query.data ? (
        <div className="playoffs-page-layout">
          <DataStamp updatedAt={query.data.meta.updatedAt} stale={query.data.meta.stale} />

          <div className="playoffs-standings-stack">
            <div className="playoffs-standings-pane">
              <SurfaceCard
                title="Classifica playoff Est"
                subtitle={playoffsStarted ? "Seed 1-8, aggiornata con i risultati finali" : "Seed 1-8, valori azzerati fino all'inizio dei playoff"}
              >
                <StandingsTable teams={eastStandings} showStatus={false} />
              </SurfaceCard>
            </div>
            <div className="playoffs-standings-pane">
              <SurfaceCard
                title="Classifica playoff Ovest"
                subtitle={playoffsStarted ? "Seed 1-8, aggiornata con i risultati finali" : "Seed 1-8, valori azzerati fino all'inizio dei playoff"}
              >
                <StandingsTable teams={westStandings} showStatus={false} />
              </SurfaceCard>
            </div>
          </div>

          <PlayoffBracketShowcase season={query.data.data.season} east={query.data.data.east} west={query.data.data.west} playoffGames={query.data.data.playoffGames} />

          {getFinalsSummary(query.data.data.playoffGames, query.data.data.east, query.data.data.west) ? (
            <FinalsOutcomeCard summary={getFinalsSummary(query.data.data.playoffGames, query.data.data.east, query.data.data.west)!} />
          ) : null}

          <div className="stats-grid">
            <div className="stat-box"><span>Già qualificate</span><strong>{query.data.data.overview.directQualifiedTeams}</strong></div>
            <div className="stat-box"><span>Squadre Play-In</span><strong>{query.data.data.overview.playInTeams}</strong></div>
            <div className="stat-box"><span>Serie definite</span><strong>{query.data.data.overview.confirmedFirstRoundSeries}</strong></div>
            <div className="stat-box">
              <span>Partite schedulate</span>
              <strong>{query.data.data.overview.playInGamesScheduled + query.data.data.overview.playoffGamesScheduled}</strong>
            </div>
          </div>

          <PlayoffCalendar
            title="Calendario Playoff"
            subtitle="Versione dedicata ai playoff con lo stesso layout della pagina Calendario."
            games={query.data.data.playoffGames}
            emptyLabel="Il calendario playoff non è ancora disponibile nell'API."
          />
        </div>
      ) : null}

      {!query.isLoading && !query.error && !query.data ? (
        <EmptyState label="Quadro playoff non disponibile." />
      ) : null}
    </>
  );
}
