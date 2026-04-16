import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Badge, DataStamp, EmptyState, ErrorState, LoadingState, PageHeader } from "../../components/common/States";
import { SurfaceCard } from "../../components/cards/SurfaceCard";
import { StandingsTable } from "../../components/tables/StandingsTable";
import { apiGet } from "../../lib/api";
import { formatConference, formatDate, formatGameDateLabel, formatGameStatusText, formatStatusLabel, formatTime, formatVenue } from "../../lib/format";
import type {
  GameSummary,
  PlayoffsResponse,
  PostseasonConferenceSnapshot,
  PostseasonKeyDate,
  PostseasonSeries,
  StandingsRow,
  TeamSummary
} from "../../lib/types";
import "./PlayoffsPage.css";

function hasPlayoffsStarted(payload: PlayoffsResponse) {
  const playoffsStart = payload.keyDates.find((item) => item.key === "playoffs-begin")?.startDate;

  if (!playoffsStart) {
    return false;
  }

  const startTimestamp = Date.parse(`${playoffsStart}T00:00:00Z`);

  if (Number.isNaN(startTimestamp)) {
    return false;
  }

  return Date.now() >= startTimestamp;
}

function getTeamGameOutcome(game: GameSummary, teamId: number) {
  const homeScore = game.homeTeam.score;
  const awayScore = game.awayTeam.score;

  if (homeScore === null || awayScore === null || homeScore === awayScore) {
    return null;
  }

  const isHomeTeam = game.homeTeam.teamId === teamId;
  const isAwayTeam = game.awayTeam.teamId === teamId;

  if (!isHomeTeam && !isAwayTeam) {
    return null;
  }

  const isWin = isHomeTeam ? homeScore > awayScore : awayScore > homeScore;
  return isWin ? "W" : "L";
}

function toPlayoffConferenceStandings(
  snapshot: PostseasonConferenceSnapshot,
  playoffGames: GameSummary[],
  playoffsStarted: boolean
): TeamSummary[] {
  const teams = [...snapshot.directSeeds, ...snapshot.playInSeeds].filter((team) => team.seed <= 8);

  if (!playoffsStarted) {
    return teams
      .slice()
      .sort((left, right) => {
        const leftRank = left.seed > 0 ? left.seed : left.conferenceRank;
        const rightRank = right.seed > 0 ? right.seed : right.conferenceRank;
        return leftRank - rightRank;
      })
      .map((team) => ({
        ...team,
        wins: 0,
        losses: 0,
        winPct: 0,
        gamesBehind: 0,
        conferenceRank: team.seed > 0 ? team.seed : team.conferenceRank,
        homeRecord: "0-0",
        awayRecord: "0-0",
        lastTen: "0-0",
        streak: "-",
        playoffStatus: "playoff",
        clinchedPlayoff: false,
        clinchedDivision: false,
        clinchedConference: false
      }));
  }

  const teamIds = new Set(teams.map((team) => team.teamId));
  const conferencePlayoffGames = playoffGames
    .filter((game) => teamIds.has(game.homeTeam.teamId) && teamIds.has(game.awayTeam.teamId))
    .filter((game) => game.status === "final" && game.homeTeam.score !== null && game.awayTeam.score !== null)
    .sort((left, right) => Date.parse(left.dateTimeUtc) - Date.parse(right.dateTimeUtc));

  const records = new Map<number, { wins: number; losses: number; homeWins: number; homeLosses: number; awayWins: number; awayLosses: number }>();

  for (const team of teams) {
    records.set(team.teamId, {
      wins: 0,
      losses: 0,
      homeWins: 0,
      homeLosses: 0,
      awayWins: 0,
      awayLosses: 0
    });
  }

  for (const game of conferencePlayoffGames) {
    const homeScore = game.homeTeam.score;
    const awayScore = game.awayTeam.score;

    if (homeScore === null || awayScore === null || homeScore === awayScore) {
      continue;
    }

    const homeRecord = records.get(game.homeTeam.teamId);
    const awayRecord = records.get(game.awayTeam.teamId);

    if (!homeRecord || !awayRecord) {
      continue;
    }

    if (homeScore > awayScore) {
      homeRecord.wins += 1;
      homeRecord.homeWins += 1;
      awayRecord.losses += 1;
      awayRecord.awayLosses += 1;
      continue;
    }

    awayRecord.wins += 1;
    awayRecord.awayWins += 1;
    homeRecord.losses += 1;
    homeRecord.homeLosses += 1;
  }

  const streakByTeamId = new Map<number, string>();

  for (const team of teams) {
    const teamGamesDesc = conferencePlayoffGames
      .filter((game) => game.homeTeam.teamId === team.teamId || game.awayTeam.teamId === team.teamId)
      .sort((left, right) => Date.parse(right.dateTimeUtc) - Date.parse(left.dateTimeUtc));

    let streakType: "W" | "L" | null = null;
    let streakValue = 0;

    for (const game of teamGamesDesc) {
      const result = getTeamGameOutcome(game, team.teamId);

      if (!result) {
        continue;
      }

      if (!streakType) {
        streakType = result;
        streakValue = 1;
        continue;
      }

      if (result === streakType) {
        streakValue += 1;
        continue;
      }

      break;
    }

    streakByTeamId.set(team.teamId, streakType ? `${streakType}${streakValue}` : "-");
  }

  const rankedTeams = teams
    .slice()
    .sort((left, right) => {
      const leftRecord = records.get(left.teamId);
      const rightRecord = records.get(right.teamId);

      const leftWins = leftRecord?.wins ?? 0;
      const rightWins = rightRecord?.wins ?? 0;

      if (leftWins !== rightWins) {
        return rightWins - leftWins;
      }

      const leftLosses = leftRecord?.losses ?? 0;
      const rightLosses = rightRecord?.losses ?? 0;

      if (leftLosses !== rightLosses) {
        return leftLosses - rightLosses;
      }

      return left.seed - right.seed;
    });

  const leader = records.get(rankedTeams[0]?.teamId ?? -1);
  const leaderWins = leader?.wins ?? 0;
  const leaderLosses = leader?.losses ?? 0;

  return rankedTeams.map((team, index) => {
    const record = records.get(team.teamId);
    const wins = record?.wins ?? 0;
    const losses = record?.losses ?? 0;
    const gamesPlayed = wins + losses;

    return {
      ...team,
      wins,
      losses,
      winPct: gamesPlayed > 0 ? wins / gamesPlayed : 0,
      gamesBehind: (leaderWins - wins + (losses - leaderLosses)) / 2,
      conferenceRank: index + 1,
      homeRecord: `${record?.homeWins ?? 0}-${record?.homeLosses ?? 0}`,
      awayRecord: `${record?.awayWins ?? 0}-${record?.awayLosses ?? 0}`,
      lastTen: `${wins}-${losses}`,
      streak: streakByTeamId.get(team.teamId) ?? "-",
      playoffStatus: "playoff",
      clinchedPlayoff: false,
      clinchedDivision: false,
      clinchedConference: false
    };
  });
}

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

function formatCompactScore(game: GameSummary) {
  const awayScore = getDisplayScore(game, "away");
  const homeScore = getDisplayScore(game, "home");

  if (awayScore === "--" && homeScore === "--") {
    return "-- - --";
  }

  return `${awayScore} - ${homeScore}`;
}

function getTeamDisplayCode(team: GameSummary["homeTeam"]) {
  if (team.code && team.code.trim()) {
    return team.code;
  }

  if (team.name && team.name.trim()) {
    return team.name;
  }

  return "TBD";
}

function GameTeamBadge({ team }: { team: GameSummary["homeTeam"] }) {
  const code = getTeamDisplayCode(team);

  return (
    <span className="playoffs-game-team-badge">
      {team.logo ? (
        <img src={team.logo} alt="" className="mini-logo playoffs-game-team-logo" />
      ) : (
        <span className="playoffs-game-team-logo-fallback">?</span>
      )}
      <span>{code}</span>
    </span>
  );
}

function GameMatchup({ game }: { game: GameSummary }) {
  return (
    <span className="playoffs-matchup-inline">
      <GameTeamBadge team={game.awayTeam} />
      <span className="playoffs-matchup-separator">vs</span>
      <GameTeamBadge team={game.homeTeam} />
    </span>
  );
}

function formatGameDay(dateTimeUtc: string) {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(new Date(dateTimeUtc));
}

function getGameDayKey(dateTimeUtc: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(dateTimeUtc));

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return dateTimeUtc.slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

function groupGamesByDay(games: GameSummary[]) {
  const groups = new Map<string, { label: string; games: GameSummary[] }>();

  for (const game of games) {
    const key = getGameDayKey(game.dateTimeUtc);
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

function mergePostseasonGames(playInGames: GameSummary[], playoffGames: GameSummary[]) {
  const byId = new Map<string, GameSummary>();

  for (const game of [...playInGames, ...playoffGames]) {
    if (!byId.has(game.gameId)) {
      byId.set(game.gameId, game);
    }
  }

  return Array.from(byId.values()).sort((left, right) => Date.parse(left.dateTimeUtc) - Date.parse(right.dateTimeUtc));
}

function seedLabel(seed: number) {
  return `${seed}${seed === 1 ? "st" : seed === 2 ? "nd" : seed === 3 ? "rd" : "th"}`;
}

function teamLabel(team?: StandingsRow) {
  if (!team) {
    return "TBD";
  }

  return `${team.city} ${team.nickname}`.trim();
}

function findSeed(teams: StandingsRow[], seed: number) {
  return teams.find((team) => team.seed === seed);
}

function findSeriesLabel(series: PostseasonSeries[], seedHigh: number, seedLow: number) {
  const item = series.find((entry) => entry.seedHigh === seedHigh && entry.seedLow === seedLow);

  if (!item) {
    return `${seedLabel(seedHigh)} vs ${seedLabel(seedLow)}`;
  }

  if (item.status === "confirmed") {
    const parts = item.label.split(" vs ");
    if (parts.length === 2) {
      return `${parts[0]} vs ${parts[1]}`;
    }
  }

  return `${seedLabel(seedHigh)} vs ${seedLabel(seedLow)}`;
}

function BracketTeamRow({ seed, team }: { seed: number; team?: StandingsRow }) {
  const content = (
    <>
      <span className="playoffs-playin-seed">{seed}°</span>
      <div className="playoffs-playin-team">
        {team ? <img src={team.logo} alt="" className="mini-logo playoffs-bracket-team-logo" /> : null}
        <div className="playoffs-bracket-team-copy">
          <strong>{team ? teamLabel(team) : "Da definire"}</strong>
          <span>{team ? team.code : "TBD"}</span>
        </div>
      </div>
    </>
  );

  if (!team) {
    return <div className="playoffs-playin-row">{content}</div>;
  }

  return (
    <Link to={`/teams/${team.teamId}`} className="playoffs-playin-row playoffs-bracket-team-link">
      {content}
    </Link>
  );
}

function BracketSeriesMatch({ series, fallbackHighSeed, fallbackLowSeed }: { series?: PostseasonSeries; fallbackHighSeed: number; fallbackLowSeed: number }) {
  const navigate = useNavigate();
  const scheduledGame = series?.games[0];
  const matchWrapperClassName = scheduledGame ? "playoffs-bracket-match playoffs-bracket-match-link" : "playoffs-bracket-match";

  const handleMatchClick = () => {
    if (scheduledGame) {
      navigate(`/games/${scheduledGame.gameId}`);
    }
  };

  const content = (
    <>
      <div className="playoffs-bracket-match-seedline">
        <span>{seedLabel(fallbackHighSeed)}</span>
        <span>{seedLabel(fallbackLowSeed)}</span>
      </div>

      {series?.highSeedTeam || series?.lowSeedTeam ? (
        <div className="playoffs-bracket-match-teams">
          {series?.highSeedTeam ? (
            <Link
              to={`/teams/${series.highSeedTeam.teamId}`}
              className="playoffs-bracket-match-team playoffs-bracket-team-link"
              onClick={(event) => event.stopPropagation()}
            >
              <img src={series.highSeedTeam.logo} alt="" className="mini-logo playoffs-bracket-team-logo" />
              <span>{teamLabel(series.highSeedTeam)}</span>
            </Link>
          ) : (
            <div className="playoffs-bracket-match-team">
              <span>Da definire</span>
            </div>
          )}
          {series?.lowSeedTeam ? (
            <Link
              to={`/teams/${series.lowSeedTeam.teamId}`}
              className="playoffs-bracket-match-team playoffs-bracket-team-link"
              onClick={(event) => event.stopPropagation()}
            >
              <img src={series.lowSeedTeam.logo} alt="" className="mini-logo playoffs-bracket-team-logo" />
              <span>{teamLabel(series.lowSeedTeam)}</span>
            </Link>
          ) : (
            <div className="playoffs-bracket-match-team">
              <span>Da definire</span>
            </div>
          )}
        </div>
      ) : (
        <div className="playoffs-bracket-match-placeholder">{`${seedLabel(fallbackHighSeed)} vs ${seedLabel(fallbackLowSeed)}`}</div>
      )}

      {scheduledGame ? (
        <Link to={`/games/${scheduledGame.gameId}`} className="playoffs-bracket-game-link">
          <GameMatchup game={scheduledGame} />
          <small>
            {formatDate(scheduledGame.dateTimeUtc)} · {formatTime(scheduledGame.dateTimeUtc)}
          </small>
        </Link>
      ) : null}
    </>
  );

  if (!scheduledGame) {
    return <div className={matchWrapperClassName}>{content}</div>;
  }

  return (
    <div
      className={matchWrapperClassName}
      onClick={handleMatchClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleMatchClick();
        }
      }}
      role="link"
      tabIndex={0}
    >
      {content}
    </div>
  );
}

function PlayoffBracket({ east, west }: { east: PostseasonConferenceSnapshot; west: PostseasonConferenceSnapshot }) {
  const westTop = west.firstRoundSeries.find((series) => series.seedHigh === 1 && series.seedLow === 8);
  const westMidTop = west.firstRoundSeries.find((series) => series.seedHigh === 4 && series.seedLow === 5);
  const westMidBottom = west.firstRoundSeries.find((series) => series.seedHigh === 3 && series.seedLow === 6);
  const westBottom = west.firstRoundSeries.find((series) => series.seedHigh === 2 && series.seedLow === 7);

  const eastTop = east.firstRoundSeries.find((series) => series.seedHigh === 1 && series.seedLow === 8);
  const eastMidTop = east.firstRoundSeries.find((series) => series.seedHigh === 4 && series.seedLow === 5);
  const eastMidBottom = east.firstRoundSeries.find((series) => series.seedHigh === 3 && series.seedLow === 6);
  const eastBottom = east.firstRoundSeries.find((series) => series.seedHigh === 2 && series.seedLow === 7);

  return (
    <SurfaceCard title="Formato Playoff NBA" subtitle="Schema visivo di Play-In, seed e primo turno sul modello del tabellone Est/Ovest">
      <div className="playoffs-bracket">
        <section className="playoffs-bracket-side playoffs-bracket-side-west">
          <div className="playoffs-bracket-side-header">
            <span className="eyebrow">Conference</span>
            <h3>West</h3>
          </div>

          <div className="playoffs-playin-card">
            <strong>Play-In Tournament</strong>
            <div className="playoffs-playin-rows">
              <BracketTeamRow seed={7} team={findSeed(west.playInSeeds, 7) ?? findSeed(west.directSeeds, 7)} />
              <BracketTeamRow seed={8} team={findSeed(west.playInSeeds, 8) ?? findSeed(west.directSeeds, 8)} />
              <BracketTeamRow seed={9} team={findSeed(west.playInSeeds, 9)} />
              <BracketTeamRow seed={10} team={findSeed(west.playInSeeds, 10)} />
            </div>
          </div>

          <div className="playoffs-bracket-round">
            <BracketSeriesMatch series={westTop} fallbackHighSeed={1} fallbackLowSeed={8} />
            <BracketSeriesMatch series={westMidTop} fallbackHighSeed={4} fallbackLowSeed={5} />
            <BracketSeriesMatch series={westMidBottom} fallbackHighSeed={3} fallbackLowSeed={6} />
            <BracketSeriesMatch series={westBottom} fallbackHighSeed={2} fallbackLowSeed={7} />
          </div>
        </section>

        <section className="playoffs-bracket-center">
          <div className="playoffs-bracket-center-top">
            <span className="eyebrow">NBA Postseason</span>
            <div className="playoffs-bracket-title">PLAYOFFS 2026</div>
            <div className="playoffs-bracket-subtitle">Play-In Tournament · First Round · Finals path</div>
          </div>

          <div className="playoffs-bracket-finals">
            <div className="playoffs-bracket-finals-card">
              <span className="eyebrow">Finals path</span>
              <strong>Vincente Ovest</strong>
            </div>
            <div className="playoffs-bracket-finals-card">
              <span className="eyebrow">Finals path</span>
              <strong>Vincente Est</strong>
            </div>
          </div>
        </section>

        <section className="playoffs-bracket-side playoffs-bracket-side-east">
          <div className="playoffs-bracket-side-header">
            <span className="eyebrow">Conference</span>
            <h3>East</h3>
          </div>

          <div className="playoffs-playin-card">
            <strong>Play-In Tournament</strong>
            <div className="playoffs-playin-rows">
              <BracketTeamRow seed={7} team={findSeed(east.playInSeeds, 7) ?? findSeed(east.directSeeds, 7)} />
              <BracketTeamRow seed={8} team={findSeed(east.playInSeeds, 8) ?? findSeed(east.directSeeds, 8)} />
              <BracketTeamRow seed={9} team={findSeed(east.playInSeeds, 9)} />
              <BracketTeamRow seed={10} team={findSeed(east.playInSeeds, 10)} />
            </div>
          </div>

          <div className="playoffs-bracket-round">
            <BracketSeriesMatch series={eastTop} fallbackHighSeed={1} fallbackLowSeed={8} />
            <BracketSeriesMatch series={eastMidTop} fallbackHighSeed={4} fallbackLowSeed={5} />
            <BracketSeriesMatch series={eastMidBottom} fallbackHighSeed={3} fallbackLowSeed={6} />
            <BracketSeriesMatch series={eastBottom} fallbackHighSeed={2} fallbackLowSeed={7} />
          </div>
        </section>
      </div>
    </SurfaceCard>
  );
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
  const scheduledGames = series.reduce((total, item) => total + item.games.length, 0);

  return (
    <div className="playoffs-block">
      <div className="playoffs-block-head">
        <h3>{title}</h3>
        <Badge tone="neutral">{series.length} serie</Badge>
      </div>

      <div className="playoffs-series-list">
        {series.map((item) => (
          <article key={`${item.conference}-${item.round}-${item.seedHigh}-${item.seedLow}`} className="playoffs-series-card">
            <div className="playoffs-series-topline">
              <strong>{item.label}</strong>
              <Badge tone={getSeriesTone(item)}>{formatSeriesStatus(item)}</Badge>
            </div>
            <p>{item.note}</p>
            {item.games.length > 0 ? <span className="playoffs-series-hint">{item.games.length} gara(e) gia nel calendario.</span> : null}
          </article>
        ))}
      </div>

      {scheduledGames === 0 ? (
        <span className="playoffs-series-waiting">Le date dettagliate appariranno nel calendario postseason appena pubblicate nell'API.</span>
      ) : null}
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
                        <strong>{getTeamDisplayCode(game.awayTeam)}</strong>
                      </div>

                      <strong>{formatCompactScore(game)}</strong>

                      <div className="game-team game-team-right">
                        <strong>{getTeamDisplayCode(game.homeTeam)}</strong>
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
    queryFn: () => apiGet<PlayoffsResponse>("/api/playoffs"),
    refetchInterval: 60_000,
    refetchIntervalInBackground: true
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
        description="Quadro completo della postseason NBA 2025-2026: date chiave ufficiali, formato del torneo, seed Est/Ovest, Play-In, serie confermate e partite gia in calendario."
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
                subtitle={
                  playoffsStarted
                    ? "Solo squadre del bracket playoff (seed 1-8), aggiornata automaticamente con i risultati finali"
                    : "Solo squadre del bracket playoff (seed 1-8), valori temporaneamente azzerati fino all'inizio dei playoff"
                }
              >
                <StandingsTable teams={eastStandings} showStatus={false} />
              </SurfaceCard>
            </div>
            <div className="playoffs-standings-pane">
              <SurfaceCard
                title="Classifica playoff Ovest"
                subtitle={
                  playoffsStarted
                    ? "Solo squadre del bracket playoff (seed 1-8), aggiornata automaticamente con i risultati finali"
                    : "Solo squadre del bracket playoff (seed 1-8), valori temporaneamente azzerati fino all'inizio dei playoff"
                }
              >
                <StandingsTable teams={westStandings} showStatus={false} />
              </SurfaceCard>
            </div>
          </div>

          <PlayoffBracket east={query.data.data.east} west={query.data.data.west} />

          <PostseasonSchedule
            title="Calendario Postseason"
            subtitle="Ogni gara appare una sola volta, ordinata per giorno e distinta tra Play-In e tabellone playoff"
            games={postseasonGames}
            emptyLabel="Il calendario dettagliato della postseason non e ancora disponibile nell'API."
          />

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
