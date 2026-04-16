import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Badge, DataStamp, EmptyState, ErrorState, LoadingState, PageHeader } from "../../components/common/States";
import { SurfaceCard } from "../../components/cards/SurfaceCard";
import { apiGet } from "../../lib/api";
import { formatGamePhase, formatGameStatusText, formatStatusLabel, formatTime, formatVenue } from "../../lib/format";
import type { CalendarResponse, GameSummary } from "../../lib/types";
import "./CalendarPage.css";

function buildCalendarPath(searchParams: URLSearchParams) {
  const next = new URLSearchParams(searchParams);
  const date = next.get("date") ?? next.get("from") ?? todayIsoDate();

  next.delete("date");
  next.delete("from");
  next.delete("to");
  next.set("from", date);
  next.set("to", date);

  const query = next.toString();
  return query ? `/api/calendar?${query}` : "/api/calendar";
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function shiftIsoDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function shiftIsoMonth(date: string, months: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCMonth(value.getUTCMonth() + months);
  return value.toISOString().slice(0, 10);
}

function getVisibleDates(centerDate: string) {
  return [-1, 0, 1].map((offset) => shiftIsoDate(centerDate, offset));
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

function getDisplayScore(game: GameSummary, side: "home" | "away") {
  const score = side === "home" ? game.homeTeam.score : game.awayTeam.score;

  if (game.status === "scheduled") {
    return "--";
  }

  return score ?? "--";
}

function CalendarDayList({ games }: { games: GameSummary[] }) {
  return (
    <div className="calendar-day-list">
      {games.map((game) => (
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
                <strong>{game.awayTeam.code}</strong>
              </div>
              <span className="calendar-team-score">{getDisplayScore(game, "away")}</span>
            </div>

            <span className="calendar-game-separator">-</span>

            <div className="calendar-team-inline calendar-team-inline-home">
              <span className="calendar-team-score">{getDisplayScore(game, "home")}</span>
              <div className="game-team">
                <strong>{game.homeTeam.code}</strong>
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
  );
}

export function CalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedDate = searchParams.get("date") ?? searchParams.get("from") ?? todayIsoDate();
  const visibleDates = getVisibleDates(selectedDate);
  const query = useQuery({
    queryKey: ["calendar", searchParams.toString()],
    queryFn: () => apiGet<CalendarResponse>(buildCalendarPath(searchParams))
  });

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);

    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }

    setSearchParams(next);
  };

  const moveDay = (days: number) => {
    updateParam("date", shiftIsoDate(selectedDate, days));
  };

  const moveMonth = (months: number) => {
    updateParam("date", shiftIsoMonth(selectedDate, months));
  };

  return (
    <>
      <PageHeader
        title="Calendario"
        description="Calendario giornaliero della stagione 2025-2026 con navigazione rapida tra oggi, giorni vicini e mese precedente o successivo."
      />

      <SurfaceCard>
        <div className="calendar-toolbar">
          <div className="calendar-rail">
            <button type="button" className="calendar-nav-button" onClick={() => moveMonth(-1)}>
              {"<<"}
            </button>
            <button type="button" className="calendar-nav-button" onClick={() => moveDay(-1)}>
              {"<"}
            </button>
            <div className="calendar-date-strip">
              {visibleDates.map((date) => (
                <button
                  key={date}
                  type="button"
                  className={`calendar-date-pill ${date === selectedDate ? "calendar-date-pill-active" : ""}`}
                  onClick={() => updateParam("date", date)}
                >
                  <span>{formatCalendarPill(date)}</span>
                  {date === todayIsoDate() ? <small>Oggi</small> : null}
                </button>
              ))}
            </div>
            <button type="button" className="calendar-nav-button" onClick={() => moveDay(1)}>
              {">"}
            </button>
            <button type="button" className="calendar-nav-button" onClick={() => moveMonth(1)}>
              {">>"}
            </button>
          </div>
        </div>

        <div className="calendar-filter-row">
          <div className="calendar-selected-day">
            <span className="eyebrow">Partite del giorno</span>
            <strong>{formatCalendarHeading(selectedDate)}</strong>
          </div>
          <div className="filters-bar calendar-filters">
            <select
              value={searchParams.get("status") ?? ""}
              onChange={(event) => updateParam("status", event.target.value)}
            >
              <option value="">Tutti gli stati</option>
              <option value="scheduled">In programma</option>
              <option value="live">In diretta</option>
              <option value="final">Finita</option>
            </select>
            <select
              value={searchParams.get("phase") ?? ""}
              onChange={(event) => updateParam("phase", event.target.value)}
            >
              <option value="">Tutte le fasi</option>
              <option value="regular-season">{formatGamePhase("regular-season")}</option>
              <option value="play-in">Play-In</option>
              <option value="playoffs">{formatGamePhase("playoffs")}</option>
            </select>
          </div>
        </div>
      </SurfaceCard>

      {query.isLoading ? <LoadingState label="Sto caricando il calendario..." /> : null}
      {query.error ? <ErrorState message={query.error.message} /> : null}

      {query.data ? (
        <>
          <DataStamp updatedAt={query.data.meta.updatedAt} stale={query.data.meta.stale} />
          {query.data.data.items.length > 0 ? (
            <SurfaceCard title="Programma giornaliero" subtitle="Tocca la partita per aprire il dettaglio completo">
              <CalendarDayList games={query.data.data.items} />
            </SurfaceCard>
          ) : (
            <EmptyState label="Nessuna partita trovata per questo giorno con i filtri attivi." />
          )}
        </>
      ) : null}
    </>
  );
}
