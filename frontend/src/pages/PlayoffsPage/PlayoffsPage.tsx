import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, DataStamp, EmptyState, ErrorState, LoadingState, PageHeader } from "../../components/common/States";
import { SurfaceCard } from "../../components/cards/SurfaceCard";
import { StandingsTable } from "../../components/tables/StandingsTable";
import { apiGet } from "../../lib/api";
import { formatGameDateLabel, formatGameStatusText, formatStatusLabel, formatVenue } from "../../lib/format";
import type {
  GameSummary,
  PlayoffsResponse,
  PostseasonConferenceSnapshot,
  PostseasonSeries,
  StandingsRow,
  TeamSummary,
} from "../../lib/types";
import "./PlayoffsPage.css";

// ─── shared helpers ───────────────────────────────────────────────

function hasPlayoffsStarted(payload: PlayoffsResponse) {
  const playoffsStart = payload.keyDates.find((d) => d.key === "playoffs-begin")?.startDate;
  if (!playoffsStart) return false;
  const ts = Date.parse(`${playoffsStart}T00:00:00Z`);
  return !Number.isNaN(ts) && Date.now() >= ts;
}

function getTeamGameOutcome(game: GameSummary, teamId: number): "W" | "L" | null {
  const { homeTeam, awayTeam } = game;
  if (homeTeam.score === null || awayTeam.score === null || homeTeam.score === awayTeam.score) return null;
  const isHome = homeTeam.teamId === teamId;
  const isAway = awayTeam.teamId === teamId;
  if (!isHome && !isAway) return null;
  return isHome ? (homeTeam.score > awayTeam.score ? "W" : "L") : awayTeam.score > homeTeam.score ? "W" : "L";
}

function findSeed(teams: StandingsRow[], seed: number) {
  return teams.find((t) => t.seed === seed);
}

function toPlayoffConferenceStandings(
  snapshot: PostseasonConferenceSnapshot,
  playoffGames: GameSummary[],
  playoffsStarted: boolean
): TeamSummary[] {
  const teams = [...snapshot.directSeeds, ...snapshot.playInSeeds].filter((t) => t.seed <= 8);
  if (!playoffsStarted) {
    return teams
      .slice()
      .sort((a, b) => (a.seed || a.conferenceRank) - (b.seed || b.conferenceRank))
      .map((t) => ({
        ...t, wins: 0, losses: 0, winPct: 0, gamesBehind: 0,
        conferenceRank: t.seed || t.conferenceRank,
        homeRecord: "0-0", awayRecord: "0-0", lastTen: "0-0", streak: "-",
        playoffStatus: "playoff" as const, clinchedPlayoff: false, clinchedDivision: false, clinchedConference: false,
      }));
  }
  const teamIds = new Set(teams.map((t) => t.teamId));
  const games = playoffGames
    .filter((g) => teamIds.has(g.homeTeam.teamId) && teamIds.has(g.awayTeam.teamId) && g.status === "final" && g.homeTeam.score !== null)
    .sort((a, b) => Date.parse(a.dateTimeUtc) - Date.parse(b.dateTimeUtc));
  const rec = new Map(teams.map((t) => [t.teamId, { wins: 0, losses: 0, hw: 0, hl: 0, aw: 0, al: 0 }]));
  for (const g of games) {
    const home = rec.get(g.homeTeam.teamId);
    const away = rec.get(g.awayTeam.teamId);
    if (!home || !away || g.homeTeam.score === null || g.awayTeam.score === null) continue;
    if (g.homeTeam.score > g.awayTeam.score) { home.wins++; home.hw++; away.losses++; away.al++; }
    else { away.wins++; away.aw++; home.losses++; home.hl++; }
  }
  const streaks = new Map<number, string>();
  for (const t of teams) {
    const tg = [...games].filter((g) => g.homeTeam.teamId === t.teamId || g.awayTeam.teamId === t.teamId).reverse();
    let type: "W" | "L" | null = null, n = 0;
    for (const g of tg) {
      const r = getTeamGameOutcome(g, t.teamId);
      if (!r) continue;
      if (!type) { type = r; n = 1; } else if (r === type) { n++; } else break;
    }
    streaks.set(t.teamId, type ? `${type}${n}` : "-");
  }
  const ranked = teams.slice().sort((a, b) => {
    const ra = rec.get(a.teamId)!, rb = rec.get(b.teamId)!;
    return rb.wins - ra.wins || ra.losses - rb.losses || a.seed - b.seed;
  });
  const leader = rec.get(ranked[0]?.teamId ?? -1);
  return ranked.map((t, i) => {
    const r = rec.get(t.teamId)!;
    const gp = r.wins + r.losses;
    return {
      ...t, wins: r.wins, losses: r.losses, winPct: gp ? r.wins / gp : 0,
      gamesBehind: ((leader?.wins ?? 0) - r.wins + (r.losses - (leader?.losses ?? 0))) / 2,
      conferenceRank: i + 1,
      homeRecord: `${r.hw}-${r.hl}`, awayRecord: `${r.aw}-${r.al}`,
      lastTen: `${r.wins}-${r.losses}`, streak: streaks.get(t.teamId) ?? "-",
      playoffStatus: "playoff" as const, clinchedPlayoff: false, clinchedDivision: false, clinchedConference: false,
    };
  });
}

function mergePostseasonGames(playIn: GameSummary[], playoff: GameSummary[]) {
  const map = new Map<string, GameSummary>();
  for (const g of [...playIn, ...playoff]) { if (!map.has(g.gameId)) map.set(g.gameId, g); }
  return Array.from(map.values()).sort((a, b) => Date.parse(a.dateTimeUtc) - Date.parse(b.dateTimeUtc));
}

function getGameDayKey(dateTimeUtc: string) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(dateTimeUtc));
  const y = p.find((x) => x.type === "year")?.value;
  const m = p.find((x) => x.type === "month")?.value;
  const d = p.find((x) => x.type === "day")?.value;
  return y && m && d ? `${y}-${m}-${d}` : dateTimeUtc.slice(0, 10);
}

function addDaysToDayKey(key: string, days: number) {
  const d = new Date(`${key}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return key;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatGameDay(dateTimeUtc: string) {
  return new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "long", day: "numeric", month: "long" }).format(new Date(dateTimeUtc));
}

function groupGamesByDay(games: GameSummary[]) {
  const groups = new Map<string, { label: string; games: GameSummary[] }>();
  for (const g of games) {
    const k = getGameDayKey(g.dateTimeUtc);
    const ex = groups.get(k);
    if (ex) ex.games.push(g);
    else groups.set(k, { label: formatGameDay(g.dateTimeUtc), games: [g] });
  }
  return Array.from(groups.entries()).map(([key, val]) => ({ key, label: val.label, games: val.games }));
}

function getTeamCode(team: GameSummary["homeTeam"]) {
  return team.code?.trim() || team.name?.trim() || "TBD";
}

function displayScore(game: GameSummary, side: "home" | "away") {
  const s = side === "home" ? game.homeTeam.score : game.awayTeam.score;
  return game.status === "scheduled" ? "--" : (s ?? "--");
}

// ─── Bracket Components ───────────────────────────────────────────

type BtSeries = {
  seedHigh: number;
  seedLow: number;
  teamHigh: StandingsRow | null;
  teamLow: StandingsRow | null;
  winsHigh: number;
  winsLow: number;
};

type ExtendedPostseasonConferenceSnapshot = PostseasonConferenceSnapshot & {
  semifinalsSeries?: PostseasonSeries[];
  conferenceFinalsSeries?: PostseasonSeries[];
};

function btRecord(s?: PostseasonSeries) {
  if (!s?.highSeedTeam) return { winsHigh: 0, winsLow: 0 };
  let h = 0, l = 0;
  for (const g of s.games) {
    if (g.status !== "final") continue;
    getTeamGameOutcome(g, s.highSeedTeam.teamId) === "W" ? h++ : l++;
  }
  return { winsHigh: h, winsLow: l };
}

/** Restituisce la squadra vincente di una serie (se conclusa con 4 vittorie) */
function getSeriesWinner(series?: PostseasonSeries): StandingsRow | null {
  if (!series?.highSeedTeam) return null;
  const { winsHigh, winsLow } = btRecord(series);
  if (winsHigh === 4) return series.highSeedTeam;
  if (winsLow === 4) return series.lowSeedTeam;
  return null;
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
      teamLow:  s?.lowSeedTeam  ?? findSeed(all, l) ?? null,
      winsHigh, winsLow,
    };
  });
}

function BtTeam({
  seed, team, wins, isLeading,
}: {
  seed: number; team: StandingsRow | null; wins: number; isLeading: boolean;
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
  const lowLeads  = s.winsLow  > s.winsHigh;
  return (
    <div className="bt-card">
      <BtTeam seed={s.seedHigh} team={s.teamHigh} wins={s.winsHigh} isLeading={highLeads} />
      <div className="bt-sep" />
      <BtTeam seed={s.seedLow}  team={s.teamLow}  wins={s.winsLow}  isLeading={lowLeads} />
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
  const semi1 = snapExtended.semifinalsSeries?.find((s) => 
    (s.seedHigh === 1 && s.seedLow === 8) || (s.seedHigh === 4 && s.seedLow === 5) ||
    (s.seedHigh === 1 && s.seedLow === 4) // eventuale riordino
  );
  const semi2 = snapExtended.semifinalsSeries?.find((s) => 
    (s.seedHigh === 2 && s.seedLow === 7) || (s.seedHigh === 3 && s.seedLow === 6) ||
    (s.seedHigh === 2 && s.seedLow === 3)
  );

  const getSemiData = (semi?: PostseasonSeries, winnersFromFr?: [StandingsRow | null, StandingsRow | null]): BtSeries | null => {
    if (semi) {
      const rec = btRecord(semi);
      return {
        seedHigh: semi.seedHigh,
        seedLow: semi.seedLow,
        teamHigh: semi.highSeedTeam,
        teamLow: semi.lowSeedTeam,
        winsHigh: rec.winsHigh,
        winsLow: rec.winsLow,
      };
    }
    // Se la serie non esiste ancora ma abbiamo i vincitori del primo turno, creiamo placeholder con i team corretti
    if (winnersFromFr && winnersFromFr[0] && winnersFromFr[1]) {
      const [t1, t2] = winnersFromFr;
      const high = t1.seed < t2.seed ? t1 : t2;
      const low  = t1.seed < t2.seed ? t2 : t1;
      return {
        seedHigh: high.seed,
        seedLow: low.seed,
        teamHigh: high,
        teamLow: low,
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
  const semi1Data = getSemiData(semi1, [frWinners[0], frWinners[1]]);
  const semi2Data = getSemiData(semi2, [frWinners[2], frWinners[3]]);

  // Conference Finals
  const cfSeries = snapExtended.conferenceFinalsSeries?.[0];
  let cfData: BtSeries | null = null;
  if (cfSeries) {
    const rec = btRecord(cfSeries);
    cfData = {
      seedHigh: cfSeries.seedHigh,
      seedLow: cfSeries.seedLow,
      teamHigh: cfSeries.highSeedTeam,
      teamLow: cfSeries.lowSeedTeam,
      winsHigh: rec.winsHigh,
      winsLow: rec.winsLow,
    };
  } else {
    const semi1Winner = semi1Data ? (semi1Data.winsHigh === 4 ? semi1Data.teamHigh : (semi1Data.winsLow === 4 ? semi1Data.teamLow : null)) : null;
    const semi2Winner = semi2Data ? (semi2Data.winsHigh === 4 ? semi2Data.teamHigh : (semi2Data.winsLow === 4 ? semi2Data.teamLow : null)) : null;
    if (semi1Winner && semi2Winner) {
      const high = semi1Winner.seed < semi2Winner.seed ? semi1Winner : semi2Winner;
      const low  = semi1Winner.seed < semi2Winner.seed ? semi2Winner : semi1Winner;
      cfData = {
        seedHigh: high.seed,
        seedLow: low.seed,
        teamHigh: high,
        teamLow: low,
        winsHigh: 0,
        winsLow: 0,
      };
    }
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
  east, west,
}: {
  east: PostseasonConferenceSnapshot;
  west: PostseasonConferenceSnapshot;
}) {
  const westWinner = getSeriesWinner((west as ExtendedPostseasonConferenceSnapshot).conferenceFinalsSeries?.[0]);
  const eastWinner = getSeriesWinner((east as ExtendedPostseasonConferenceSnapshot).conferenceFinalsSeries?.[0]);

  return (
    <SurfaceCard
      title="Tabellone Playoff NBA 2026"
      subtitle="Primo turno in corso · Conf. Semifinals, Finals e NBA Finals in attesa dei risultati"
    >
      <div className="bt-bracket">
        <p className="bt-super-title">Playoffs 2026</p>

        <BtConference snap={west} side="west" />

        <div className="bt-finals-center">
          <p className="bt-finals-title">NBA Finals 2026</p>
          <div className="bt-card bt-finals-slot-card bt-finals-card">
            {westWinner ? (
              <BtTeam seed={westWinner.seed} team={westWinner} wins={0} isLeading={false} />
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

            {eastWinner ? (
              <BtTeam seed={eastWinner.seed} team={eastWinner} wins={0} isLeading={false} />
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

function PostseasonSchedule({
  title, subtitle, games, emptyLabel,
}: {
  title: string; subtitle: string; games: GameSummary[]; emptyLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const groups     = groupGamesByDay(games);
  const todayKey   = getGameDayKey(new Date().toISOString());
  const tomorrowKey = addDaysToDayKey(todayKey, 1);
  const spotlight  = groups.filter((g) => g.key === todayKey || g.key === tomorrowKey);
  const defaultGroups = spotlight.length > 0 ? spotlight : groups.slice(0, 2);
  const visible    = expanded ? groups : defaultGroups;
  const visibleKeys = new Set(visible.map((g) => g.key));
  const hiddenCount = groups.reduce((n, g) => (visibleKeys.has(g.key) ? n : n + g.games.length), 0);
  const doneCount   = games.filter((g) => g.status === "final").length;
  const upcomingCount = games.length - doneCount;

  return (
    <SurfaceCard title={title} subtitle={subtitle}>
      {groups.length > 0 ? (
        <>
          <div className="playoffs-schedule-summary">
            <Badge tone="warning">{upcomingCount} in programma/live</Badge>
            <Badge tone="neutral">{doneCount} concluse</Badge>
            <p className="playoffs-schedule-note">
              {spotlight.length > 0 ? "Vista rapida: oggi e domani." : "Vista rapida: prime giornate disponibili."}
            </p>
          </div>

          <div className="playoffs-game-groups">
            {visible.map((group) => (
              <div key={group.key} className="playoffs-game-group">
                <div className="playoffs-block-head">
                  <h3>{group.label}</h3>
                  <Badge tone="neutral">{group.games.length}</Badge>
                </div>
                <div className="playoffs-game-list">
                  {group.games.map((game) => (
                    <Link key={game.gameId} to={`/games/${game.gameId}`} className="game-card playoffs-game-row-link">
                      <div className="game-card-head">
                        <span>{formatGameDateLabel(game)}</span>
                        <Badge tone={game.status === "live" ? "live" : game.status === "final" ? "neutral" : "warning"}>
                          {formatStatusLabel(game.status)}
                        </Badge>
                      </div>
                      <div className="game-matchup">
                        <div className="game-team">
                          {game.awayTeam.logo ? <img src={game.awayTeam.logo} alt="" className="mini-logo" /> : null}
                          <strong>{getTeamCode(game.awayTeam)}</strong>
                        </div>
                        <strong>{displayScore(game, "away")} - {displayScore(game, "home")}</strong>
                        <div className="game-team game-team-right">
                          <strong>{getTeamCode(game.homeTeam)}</strong>
                          {game.homeTeam.logo ? <img src={game.homeTeam.logo} alt="" className="mini-logo" /> : null}
                        </div>
                      </div>
                      <div className="game-card-meta">
                        <span>{formatVenue(game.arena)}</span>
                        <span>{formatGameStatusText(game)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {expanded || hiddenCount > 0 ? (
            <button
              type="button"
              className="playoffs-schedule-toggle"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded ? "Mostra meno partite" : `Mostra altre ${hiddenCount} partite`}
            </button>
          ) : null}
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
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
  });

  const postseasonGames = query.data
    ? mergePostseasonGames(query.data.data.playInGames, query.data.data.playoffGames)
    : [];
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
        description="Quadro della postseason NBA 2025-2026: classifiche playoff Est/Ovest, tabellone e calendario partite."
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

          <PlayoffBracketShowcase east={query.data.data.east} west={query.data.data.west} />

          <div className="stats-grid">
            <div className="stat-box"><span>Già qualificate</span><strong>{query.data.data.overview.directQualifiedTeams}</strong></div>
            <div className="stat-box"><span>Squadre Play-In</span><strong>{query.data.data.overview.playInTeams}</strong></div>
            <div className="stat-box"><span>Serie definite</span><strong>{query.data.data.overview.confirmedFirstRoundSeries}</strong></div>
            <div className="stat-box">
              <span>Partite schedulate</span>
              <strong>{query.data.data.overview.playInGamesScheduled + query.data.data.overview.playoffGamesScheduled}</strong>
            </div>
          </div>

          <PostseasonSchedule
            title="Calendario Postseason"
            subtitle="Vista rapida su oggi e domani · espandi per vedere tutte le gare"
            games={postseasonGames}
            emptyLabel="Il calendario dettagliato della postseason non è ancora disponibile nell'API."
          />
        </div>
      ) : null}

      {!query.isLoading && !query.error && !query.data ? (
        <EmptyState label="Quadro playoff non disponibile." />
      ) : null}
    </>
  );
}